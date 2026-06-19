import 'dotenv/config';
import dotenv from 'dotenv';
dotenv.config();

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://movingdinner:movingdinner@localhost:5432/movingdinner?schema=public';
}

import prisma from '../src/db';

async function main() {
  const groupName = 'Sport Juhhuu';
  const targetDate = new Date('2026-06-10T00:00:00.000Z');
  const confirm = process.argv.includes('--confirm');

  const group = await prisma.group.findFirst({
    where: { name: groupName },
    select: { id: true, name: true },
  });

  if (!group) {
    console.error(`Group "${groupName}" not found`);
    process.exit(1);
  }

  console.log(`Found group: ${group.name} (id=${group.id})`);

  const meetings = await prisma.meeting.findMany({
    where: {
      groupId: group.id,
      date: targetDate,
    },
    include: {
      responses: { include: { user: { select: { id: true, name: true } } } },
      _count: { select: { responses: true, rsvpTokens: true } },
    },
  });

  if (meetings.length === 0) {
    console.error(`No meeting found on 2026-06-10 for group "${groupName}"`);
    process.exit(1);
  }

  for (const meeting of meetings) {
    console.log(`\nMeeting id=${meeting.id}, date=${meeting.date.toISOString()}, frozen=${meeting.frozen}`);
    console.log(`  Responses: ${meeting._count.responses}`);
    console.log(`  RSVP tokens: ${meeting._count.rsvpTokens}`);
    for (const r of meeting.responses) {
      console.log(`    - user ${r.user.name} (id=${r.user.id}): hostWish=${r.hostWish}, assignedHost=${r.assignedHost}`);
    }

    if (confirm) {
      await prisma.meeting.delete({ where: { id: meeting.id } });
      console.log(`  ✅ Deleted meeting ${meeting.id}`);
    } else {
      console.log(`  ⚠️  Dry-run: not deleted. Run with --confirm to delete.`);
    }
  }
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
