import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import prisma from '../src/db';
import { generateInviteCode } from '../src/services/groups';
import { recalculateScoresForGroup } from '../src/services/scoring';
import { recalculateMatrixForGroup } from '../src/services/matrix';

const GROUP_NAME = 'Sport Juhhuu';
const STAMMDATEN_PATH = path.join(__dirname, '../../old_version/Moving Dinner - Stammdaten.csv');
const TREFFEN_DIR = path.join(__dirname, '../../old_version');

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parseHostWish(value: string): 'will_host' | 'cannot_host' | 'indifferent' {
  const v = (value || '').toLowerCase().trim();
  if (v.includes('will') || v.includes('hosten')) return 'will_host';
  if (v.includes('kann nicht') || v.includes('cannot')) return 'cannot_host';
  return 'indifferent';
}

function parseMeetingDateFromFilename(filename: string): Date | null {
  const match = filename.match(/Treffen_(\d{4})_(\d{2})_(\d{2})\.csv$/);
  if (!match) return null;
  const [_, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0);
}

function readStammdaten(): Map<string, string> {
  const raw = fs.readFileSync(STAMMDATEN_PATH, 'utf-8');
  const records = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter: ',',
  }) as Array<Record<string, string>>;

  const map = new Map<string, string>();
  for (const record of records) {
    const name = normalizeName(record.Name || '');
    const email = normalizeEmail(record.Email || '');
    if (name && email) {
      map.set(name, email);
    }
  }
  return map;
}

async function getOrCreateGroup(): Promise<number> {
  let group = await prisma.group.findFirst({ where: { name: GROUP_NAME } });

  if (!group) {
    console.log(`Gruppe '${GROUP_NAME}' nicht gefunden, lege sie an.`);
    // Use the first existing user as creator, or create without creator
    const firstUser = await prisma.user.findFirst({ orderBy: { id: 'asc' } });
    group = await prisma.group.create({
      data: {
        name: GROUP_NAME,
        description: 'Importierte historische Treffen aus der alten Version',
        inviteCode: generateInviteCode(),
        meetingCreation: 'admin',
        createdBy: firstUser?.id ?? null,
      },
    });
  }

  return group.id;
}

async function addAllUsersToGroup(groupId: number): Promise<void> {
  const users = await prisma.user.findMany({ select: { id: true } });
  let added = 0;
  let already = 0;

  for (const user of users) {
    try {
      await prisma.groupMember.create({
        data: { groupId, userId: user.id, role: 'member' },
      });
      added++;
    } catch (err: any) {
      if (err.code === 'P2002') {
        already++;
      } else {
        throw err;
      }
    }
  }

  console.log(`Gruppenmitglieder: ${added} hinzugefügt, ${already} bereits vorhanden.`);
}

async function importMeeting(filePath: string, groupId: number, nameToEmail: Map<string, string>): Promise<{ meetingId: number; imported: number; skipped: number; hostNotFound: number }> {
  const filename = path.basename(filePath);
  const meetingDate = parseMeetingDateFromFilename(filename);
  if (!meetingDate) {
    throw new Error(`Konnte Datum aus Dateiname nicht parsen: ${filename}`);
  }

  // Deadline = 3 days before the meeting at 23:59, mimicking old system default
  const deadline = new Date(meetingDate);
  deadline.setDate(deadline.getDate() - 3);
  deadline.setHours(23, 59, 59, 0);

  const raw = fs.readFileSync(filePath, 'utf-8');
  const records = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter: ',',
  }) as Array<Record<string, string>>;

  // Collect participant data first
  const participants: Array<{ name: string; email: string; userId: number; hostWish: string; hostName: string | null }> = [];
  const skippedNames: string[] = [];

  for (const record of records) {
    const nameCol = record['Ich will teilnehmen (Name auswählen)'] || record['Name'] || '';
    const name = normalizeName(nameCol);
    if (!name) continue;

    const email = nameToEmail.get(name);
    if (!email) {
      skippedNames.push(nameCol.trim());
      continue;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      skippedNames.push(`${nameCol.trim()} (${email})`);
      continue;
    }

    const hostWishRaw = record['hosten (bitte nur in Ausnahmefällen nutzen)'] || record['Kann nicht hosten / Will hosten'] || '';
    const hostWish = parseHostWish(hostWishRaw);
    const hostNameRaw = record['Host/Gast']?.trim() || null;

    participants.push({
      name: nameCol.trim(),
      email,
      userId: user.id,
      hostWish,
      hostName: hostNameRaw,
    });
  }

  if (participants.length === 0) {
    console.warn(`Keine Teilnehmer in ${filename}, überspringe.`);
    return { meetingId: -1, imported: 0, skipped: skippedNames.length, hostNotFound: 0 };
  }

  // Create meeting
  const existingMeeting = await prisma.meeting.findFirst({
    where: { groupId, date: meetingDate },
  });

  let meetingId: number;
  if (existingMeeting) {
    console.log(`Meeting für ${filename} existiert bereits (ID ${existingMeeting.id}), überschreibe Responses.`);
    await prisma.response.deleteMany({ where: { meetingId: existingMeeting.id } });
    meetingId = existingMeeting.id;
  } else {
    const meeting = await prisma.meeting.create({
      data: {
        groupId,
        date: meetingDate,
        deadline,
        frozen: true,
        createdBy: null,
      },
    });
    meetingId = meeting.id;
  }

  // Resolve host names to user ids
  const nameToUserId = new Map(participants.map(p => [normalizeName(p.name), p.userId]));
  const hostNotFound: string[] = [];
  const responses: Array<{ userId: number; hostWish: string; assignedHost: number | null }> = [];

  for (const p of participants) {
    let assignedHost: number | null = null;

    if (p.hostName) {
      const normalizedHostName = normalizeName(p.hostName);
      if (normalizedHostName === 'hosted') {
        assignedHost = p.userId;
      } else {
        const hostEmail = nameToEmail.get(normalizedHostName);
        if (hostEmail) {
          const hostUser = await prisma.user.findUnique({ where: { email: hostEmail } });
          if (hostUser) {
            assignedHost = hostUser.id;
          } else {
            hostNotFound.push(p.hostName);
          }
        } else {
          hostNotFound.push(p.hostName);
        }
      }
    }

    responses.push({
      userId: p.userId,
      hostWish: p.hostWish,
      assignedHost,
    });
  }

  await prisma.response.createMany({
    data: responses.map(r => ({
      meetingId,
      userId: r.userId,
      hostWish: r.hostWish,
      assignedHost: r.assignedHost,
    })),
    skipDuplicates: true,
  });

  if (skippedNames.length > 0) {
    console.warn(`  Nicht gematchte Teilnehmer in ${filename}: ${skippedNames.join(', ')}`);
  }
  if (hostNotFound.length > 0) {
    console.warn(`  Nicht gefundene Hosts in ${filename}: ${hostNotFound.join(', ')}`);
  }

  return {
    meetingId,
    imported: responses.length,
    skipped: skippedNames.length,
    hostNotFound: hostNotFound.length,
  };
}

async function main() {
  if (!fs.existsSync(STAMMDATEN_PATH)) {
    console.error(`Stammdaten nicht gefunden: ${STAMMDATEN_PATH}`);
    process.exit(1);
  }

  const nameToEmail = readStammdaten();
  console.log(`Stammdaten geladen: ${nameToEmail.size} Einträge.`);

  const groupId = await getOrCreateGroup();
  console.log(`Gruppe '${GROUP_NAME}' hat ID ${groupId}.`);

  await addAllUsersToGroup(groupId);

  const files = fs
    .readdirSync(TREFFEN_DIR)
    .filter(f => /^Moving Dinner - Treffen_\d{4}_\d{2}_\d{2}\.csv$/.test(f))
    .sort();

  console.log(`Gefundene Treffen-Dateien: ${files.length}`);

  let totalImported = 0;
  let totalSkipped = 0;
  let totalHostNotFound = 0;

  for (const file of files) {
    const filePath = path.join(TREFFEN_DIR, file);
    const result = await importMeeting(filePath, groupId, nameToEmail);
    if (result.meetingId !== -1) {
      console.log(`${file}: ${result.imported} Responses importiert (ID ${result.meetingId}).`);
    }
    totalImported += result.imported;
    totalSkipped += result.skipped;
    totalHostNotFound += result.hostNotFound;
  }

  console.log('\nBerechne Scores und Meetup-Matrix neu...');
  await recalculateScoresForGroup(groupId);
  await recalculateMatrixForGroup(groupId);

  console.log(`\nFertig.`);
  console.log(`Treffen: ${files.length}, Responses: ${totalImported}, Übersprungen: ${totalSkipped}, Hosts nicht gefunden: ${totalHostNotFound}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });