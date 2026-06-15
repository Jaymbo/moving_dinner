import nodemailer from 'nodemailer';
import { config } from '../config';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user
        ? { user: config.smtp.user, pass: config.smtp.pass }
        : undefined,
    });
  }
  return transporter;
}

export interface MailOptions {
  to: string;
  subject: string;
  body: string;
}

/**
 * Send an email. Returns true on success, logs error on failure.
 */
export async function sendMail(options: MailOptions): Promise<boolean> {
  try {
    const info = await getTransporter().sendMail({
      from: config.smtp.from,
      to: options.to,
      subject: options.subject,
      text: options.body,
    });
    console.log(`Email sent to ${options.to}: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`Failed to send email to ${options.to}:`, err);
    return false;
  }
}

/**
 * Notify all group members about a new meeting with their RSVP link.
 */
export async function notifyGroupNewMeeting(
  groupId: number,
  meetingId: number,
  meetingDate: Date,
  deadline: Date
): Promise<void> {
  const members = await (await import('../db')).default.groupMember.findMany({
    where: { groupId },
    include: { user: true },
  });

  const tokens = await (await import('../db')).default.rsvpToken.findMany({
    where: { meetingId },
    include: { user: true },
  });

  const tokenMap = new Map(tokens.map(t => [t.userId, t.token]));
  const dateStr = meetingDate.toLocaleDateString('de-DE');
  const deadlineStr = deadline.toLocaleDateString('de-DE');

  for (const member of members) {
    if (!member.user.email) continue;
    const token = tokenMap.get(member.userId);
    const rsvpLink = token ? `${config.baseUrl}/rsvp/${token}` : '';

    const body = `Hallo ${member.user.name},

Ein neues Moving Dinner findet am ${dateStr} statt.
Anmeldeschluss: ${deadlineStr}

Bitte melde dich an:${rsvpLink ? '\n' + rsvpLink : ' Bitte melde dich in der App an.'}

Viele Grüße,
Moving Dinner`;

    await sendMail({
      to: member.user.email,
      subject: `Moving Dinner - Neues Treffen am ${dateStr}`,
      body,
    });
  }
}

/**
 * Send deadline reminder to unregistered members.
 */
export async function sendDeadlineReminder(
  meetingId: number,
  meetingDate: Date,
  deadline: Date
): Promise<void> {
  const prisma = (await import('../db')).default;

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      responses: true,
      rsvpTokens: { where: { used: false } },
    },
  });
  if (!meeting) return;

  const respondedUserIds = new Set(meeting.responses.map(r => r.userId));
  const tokenMap = new Map(meeting.rsvpTokens.map(t => [t.userId, t.token]));

  // Get all group members
  const members = await prisma.groupMember.findMany({
    where: { groupId: meeting.groupId },
    include: { user: true },
  });

  const dateStr = meetingDate.toLocaleDateString('de-DE');
  const deadlineStr = deadline.toLocaleDateString('de-DE');

  for (const member of members) {
    if (respondedUserIds.has(member.userId)) continue; // already responded
    if (!member.user.email) continue;

    let rsvpLink = '';
    const existingToken = tokenMap.get(member.userId);
    if (existingToken) {
      rsvpLink = `${config.baseUrl}/rsvp/${existingToken}`;
    } else {
      // Generate new token
      const crypto = await import('crypto');
      const newToken = crypto.randomBytes(32).toString('hex');
      await prisma.rsvpToken.create({
        data: { token: newToken, meetingId, userId: member.userId },
      });
      rsvpLink = `${config.baseUrl}/rsvp/${newToken}`;
    }

    const body = `Hallo ${member.user.name},

Erinnerung: Das Moving Dinner am ${dateStr} hat Anmeldeschluss am ${deadlineStr}.
Du hast dich noch nicht angemeldet.

Bitte melde dich an:
${rsvpLink}

Viele Grüße,
Moving Dinner`;

    await sendMail({
      to: member.user.email,
      subject: `Erinnerung: Moving Dinner am ${dateStr} - Bitte anmelden`,
      body,
    });
  }
}

/**
 * Send assignment notifications after freeze.
 */
export async function sendPasswordResetEmail(email: string, name: string, resetUrl: string): Promise<boolean> {
  const body = `Hallo ${name},

Du hast einen Link zum Zurücksetzen deines Passworts angefordert.
Klicke auf den folgenden Link, um ein neues Passwort zu setzen:

${resetUrl}

Dieser Link ist 1 Stunde gültig.

Falls du kein Passwort-Reset angefordert hast, kannst du diese E-Mail ignorieren.

Viele Grüße,
Moving Dinner`;

  return sendMail({
    to: email,
    subject: 'Moving Dinner - Passwort zurücksetzen',
    body,
  });
}

export async function sendAssignmentEmails(meetingId: number): Promise<void> {
  const prisma = (await import('../db')).default;

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      responses: { include: { user: true, assignedHostUser: true } },
    },
  });
  if (!meeting) return;

  const dateStr = meeting.date.toLocaleDateString('de-DE');

  // Group by host
  const hostGroups = new Map<number, { host: typeof meeting.responses[0]['user']; guests: (typeof meeting.responses[0])[] }>();

  for (const response of meeting.responses) {
    if (response.assignedHost === null) continue;
    if (!hostGroups.has(response.assignedHost)) {
      const hostResponse = meeting.responses.find(r => r.userId === response.assignedHost);
      hostGroups.set(response.assignedHost, {
        host: hostResponse!.user,
        guests: [],
      });
    }
    if (response.userId !== response.assignedHost) {
      hostGroups.get(response.assignedHost)!.guests.push(response);
    }
  }

  // Send to hosts
  for (const [_hostId, group] of hostGroups) {
    if (!group.host.email) continue;

    let guestList = '';
    let dietaryNotes = '';
    for (const gr of group.guests) {
      guestList += `- ${gr.user.name}\n`;
      if (gr.user.diet) {
        dietaryNotes += `- ${gr.user.name}: ${gr.user.diet}\n`;
      }
    }

    const body = `Hallo ${group.host.name},

Du hostest das Moving Dinner am ${dateStr}.

Deine Gäste:
${guestList || 'Keine Gäste zugewiesen'}
${dietaryNotes ? `\nErnährungsbesonderheiten:\n${dietaryNotes}` : ''}
Viele Grüße,
Moving Dinner`;

    await sendMail({
      to: group.host.email,
      subject: `Moving Dinner am ${dateStr} - Du hostest!`,
      body,
    });

    // Send to each guest
    for (const gr of group.guests) {
      if (!gr.user.email) continue;

      const guestBody = `Hallo ${gr.user.name},

Das Moving Dinner am ${dateStr} findet statt bei:

${group.host.name}
${group.host.address || 'Adresse folgt'}

Viel Spaß!
Moving Dinner`;

      await sendMail({
        to: gr.user.email,
        subject: `Moving Dinner am ${dateStr} - Dein Host`,
        body: guestBody,
      });
    }
  }
}