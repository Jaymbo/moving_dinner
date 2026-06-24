import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import prisma from '../src/db.ts';

async function main() {
  // Check if database is already seeded
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log('Database already seeded, skipping...');
    return;
  }

  console.log('Seeding database...');

  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@example.com',
      passwordHash: adminPassword,
      address: 'Musterstraße 1, 12345 Stadt',
      maxGuests: 4,
      isGuest: false,
      isSuperAdmin: true,
    },
  });

  const users = [
    {
      name: 'Anna Müller',
      email: 'anna@example.com',
      address: 'Berliner Str. 5, 12345 Berlin',
      maxGuests: 3,
      diet: 'vegetarisch',
    },
    {
      name: 'Ben Schmidt',
      email: 'ben@example.com',
      address: 'Hamburger Weg 12, 12345 Berlin',
      maxGuests: 2,
      diet: null,
    },
    {
      name: 'Clara Fischer',
      email: 'clara@example.com',
      address: 'Münchner Platz 3, 12345 Berlin',
      maxGuests: 4,
      diet: 'vegan',
    },
    {
      name: 'David Weber',
      email: 'david@example.com',
      address: 'Kölner Allee 8, 12345 Berlin',
      maxGuests: 2,
      diet: null,
    },
    {
      name: 'Eva Braun',
      email: 'eva@example.com',
      address: 'Frankfurter Ring 15, 12345 Berlin',
      maxGuests: 3,
      diet: 'glutenfrei',
    },
    {
      name: 'Felix Hoffmann',
      email: 'felix@example.com',
      address: 'Stuttgarter Str. 22, 12345 Berlin',
      maxGuests: 0,
      diet: null,
    },
  ];

  const createdUsers = [admin];
  for (const u of users) {
    const passwordHash = await bcrypt.hash('demo123', 10);
    const user = await prisma.user.create({
      data: {
        name: u.name,
        email: u.email,
        passwordHash,
        address: u.address,
        maxGuests: u.maxGuests,
        diet: u.diet,
        isGuest: false,
      },
    });
    createdUsers.push(user);
  }

  const group = await prisma.group.create({
    data: {
      name: 'Moving Dinner Berlin',
      description: 'Die originale Moving Dinner Gruppe',
      inviteCode: 'GRP-DEMO01',
      createdBy: admin.id,
      members: {
        create: createdUsers.map((u) => ({
          userId: u.id,
          role: u.id === admin.id ? 'admin' : 'member',
        })),
      },
    },
  });

  const group2 = await prisma.group.create({
    data: {
      name: 'Moving Dinner Köln',
      description: 'Die Kölner Gruppe',
      inviteCode: 'GRP-KOELN1',
      createdBy: admin.id,
      members: {
        create: [
          { userId: admin.id, role: 'admin' },
          { userId: createdUsers[1].id, role: 'member' },
          { userId: createdUsers[2].id, role: 'member' },
        ],
      },
    },
  });

  await prisma.groupInvitation.create({
    data: {
      groupId: group.id,
      code: 'JOIN-TEST1',
      maxUses: 10,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const meetingDate = new Date();
  meetingDate.setDate(meetingDate.getDate() + 14);
  const deadlineDate = new Date();
  deadlineDate.setDate(deadlineDate.getDate() + 7);

  const meeting = await prisma.meeting.create({
    data: { groupId: group.id, date: meetingDate, deadline: deadlineDate, createdBy: admin.id },
  });

  const members = await prisma.groupMember.findMany({ where: { groupId: group.id } });
  for (const member of members) {
    const token = randomBytes(32).toString('hex');
    await prisma.rsvpToken.create({
      data: { token, meetingId: meeting.id, userId: member.userId },
    });
  }

  const responses = [
    { userId: createdUsers[1].id, hostWish: 'will_host' },
    { userId: createdUsers[2].id, hostWish: 'indifferent' },
    { userId: createdUsers[3].id, hostWish: 'cannot_host' },
    { userId: createdUsers[4].id, hostWish: 'will_host' },
    { userId: createdUsers[5].id, hostWish: 'indifferent' },
  ];
  for (const r of responses) {
    await prisma.response.create({
      data: { meetingId: meeting.id, userId: r.userId, hostWish: r.hostWish },
    });
  }

  const pastMeetingDate = new Date();
  pastMeetingDate.setDate(pastMeetingDate.getDate() - 14);
  const pastDeadline = new Date();
  pastDeadline.setDate(pastDeadline.getDate() - 21);

  const pastMeeting = await prisma.meeting.create({
    data: {
      groupId: group.id,
      date: pastMeetingDate,
      deadline: pastDeadline,
      frozen: true,
      createdBy: admin.id,
    },
  });

  const pastResponses = [
    { userId: createdUsers[1].id, hostWish: 'will_host', assignedHost: createdUsers[1].id },
    { userId: createdUsers[2].id, hostWish: 'indifferent', assignedHost: createdUsers[1].id },
    { userId: createdUsers[3].id, hostWish: 'cannot_host', assignedHost: createdUsers[1].id },
    { userId: createdUsers[4].id, hostWish: 'will_host', assignedHost: createdUsers[4].id },
    { userId: createdUsers[5].id, hostWish: 'indifferent', assignedHost: createdUsers[4].id },
    { userId: admin.id, hostWish: 'indifferent', assignedHost: createdUsers[4].id },
  ];
  for (const r of pastResponses) {
    await prisma.response.create({
      data: {
        meetingId: pastMeeting.id,
        userId: r.userId,
        hostWish: r.hostWish,
        assignedHost: r.assignedHost,
      },
    });
  }

  // Recalculate scores
  console.log('Recalculating scores...');
  const frozenMeetings = await prisma.meeting.findMany({
    where: { frozen: true },
    include: { responses: true },
  });
  const allUsers = await prisma.user.findMany();
  const stats = new Map<
    number,
    { participations: number; hostings: number; hostedGuests: number }
  >();
  for (const user of allUsers) {
    stats.set(user.id, { participations: 0, hostings: 0, hostedGuests: 0 });
  }
  for (const m of frozenMeetings) {
    for (const r of m.responses) {
      const s = stats.get(r.userId);
      if (!s) continue;
      s.participations++;
      if (r.assignedHost === r.userId) {
        s.hostings++;
        s.hostedGuests += m.responses.filter(
          (rr) => rr.assignedHost === r.userId && rr.userId !== r.userId
        ).length;
      }
    }
  }
  for (const user of allUsers) {
    const s = stats.get(user.id)!;
    const maxG = user.maxGuests || 0;
    const raw = s.participations - s.hostings - s.hostedGuests;
    const score = maxG > 0 ? raw / maxG : raw;
    await prisma.score.upsert({
      where: { userId_groupId: { userId: user.id, groupId: group.id } },
      update: {
        participations: s.participations,
        hostings: s.hostings,
        hostedGuests: s.hostedGuests,
        score,
      },
      create: {
        userId: user.id,
        groupId: group.id,
        participations: s.participations,
        hostings: s.hostings,
        hostedGuests: s.hostedGuests,
        score,
      },
    });
  }

  // Recalculate matrix
  console.log('Recalculating matrix...');
  const pairCounts = new Map<string, number>();
  for (const m of frozenMeetings) {
    const hostGroups = new Map<number, number[]>();
    for (const r of m.responses) {
      if (r.assignedHost === null) continue;
      if (!hostGroups.has(r.assignedHost)) hostGroups.set(r.assignedHost, []);
      hostGroups.get(r.assignedHost)!.push(r.userId);
    }
    for (const [, ids] of hostGroups) {
      for (let a = 0; a < ids.length; a++) {
        for (let b = a + 1; b < ids.length; b++) {
          const idA = Math.min(ids[a], ids[b]);
          const idB = Math.max(ids[a], ids[b]);
          const key = `${idA}_${idB}`;
          pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
        }
      }
    }
  }
  await prisma.meetupMatrix.deleteMany({});
  const entries = Array.from(pairCounts.entries()).map(([key, count]) => {
    const [userAId, userBId] = key.split('_').map(Number);
    return { userAId, userBId, groupId: group.id, count };
  });
  if (entries.length > 0) {
    await prisma.meetupMatrix.createMany({ data: entries });
  }

  console.log('Seed completed!');
  console.log('');
  console.log('Demo accounts:');
  console.log('  Admin:    admin@example.com / admin123');
  console.log('  Users:    anna@example.com / demo123, ben@example.com / demo123, etc.');
  console.log('  Group 1:  Moving Dinner Berlin (GRP-DEMO01)');
  console.log('  Group 2:  Moving Dinner Köln (GRP-KOELN1)');
  console.log('  Invite:   JOIN-TEST1 (10 uses, 30 days)');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
