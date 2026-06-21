import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { recalculateScoresForGroup, recalculateAllScores } from './scoring.js';
import prisma from '../db.js';

describe('Scoring Service', () => {
  let testGroupId: number;
  let testUserIds: number[] = [];

  beforeEach(async () => {
    const uniqueId = `${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 8)}`;
    const group = await prisma.group.create({
      data: {
        name: 'Test Group',
        inviteCode: `TS-${uniqueId}`,
        meetingCreation: 'admin',
      },
    });
    testGroupId = group.id;

    const users = await Promise.all(
      [1, 2, 3].map((i) =>
        prisma.user.create({
          data: {
            name: `Test User ${i}`,
            email: `test-score-${i}-${uniqueId}@example.com`,
            passwordHash: 'hash',
            maxGuests: 2,
          },
        })
      )
    );
    testUserIds = users.map((u) => u.id);

    await Promise.all(
      testUserIds.map((userId) =>
        prisma.groupMember.create({
          data: { groupId: testGroupId, userId, role: 'member' },
        })
      )
    );
  });

  afterEach(async () => {
    await prisma.score.deleteMany({ where: { groupId: testGroupId } });
    await prisma.groupMember.deleteMany({ where: { groupId: testGroupId } });
    await prisma.response.deleteMany({ where: { meeting: { groupId: testGroupId } } });
    await prisma.meeting.deleteMany({ where: { groupId: testGroupId } });
    await prisma.group.delete({ where: { id: testGroupId } });
    await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
  });

  it('should calculate scores correctly for a frozen meeting', async () => {
    const meeting = await prisma.meeting.create({
      data: {
        groupId: testGroupId,
        date: new Date(),
        deadline: new Date(Date.now() - 1000),
        frozen: true,
      },
    });

    await prisma.response.createMany({
      data: [
        { meetingId: meeting.id, userId: testUserIds[0], hostWish: 'will_host', assignedHost: testUserIds[0] },
        { meetingId: meeting.id, userId: testUserIds[1], hostWish: 'indifferent', assignedHost: testUserIds[0] },
        { meetingId: meeting.id, userId: testUserIds[2], hostWish: 'cannot_host', assignedHost: testUserIds[0] },
      ],
    });

    await recalculateScoresForGroup(testGroupId);

    const scores = await prisma.score.findMany({ where: { groupId: testGroupId } });
    expect(scores.length).toBe(3);

    const user1Score = scores.find((s) => s.userId === testUserIds[0]);
    expect(user1Score?.participations).toBe(1);
    expect(user1Score?.hostings).toBe(1);
    expect(user1Score?.hostedGuests).toBe(2);

    const user2Score = scores.find((s) => s.userId === testUserIds[1]);
    expect(user2Score?.participations).toBe(1);
    expect(user2Score?.hostings).toBe(0);
    expect(user2Score?.hostedGuests).toBe(0);
  });

  it('should handle multiple frozen meetings', async () => {
    const meeting1 = await prisma.meeting.create({
      data: {
        groupId: testGroupId,
        date: new Date(),
        deadline: new Date(Date.now() - 1000),
        frozen: true,
      },
    });

    const meeting2 = await prisma.meeting.create({
      data: {
        groupId: testGroupId,
        date: new Date(),
        deadline: new Date(Date.now() - 1000),
        frozen: true,
      },
    });

    await prisma.response.create({
      data: { meetingId: meeting1.id, userId: testUserIds[0], hostWish: 'will_host', assignedHost: testUserIds[0] },
    });
    await prisma.response.create({
      data: { meetingId: meeting1.id, userId: testUserIds[1], hostWish: 'indifferent', assignedHost: testUserIds[0] },
    });

    await prisma.response.create({
      data: { meetingId: meeting2.id, userId: testUserIds[0], hostWish: 'indifferent', assignedHost: testUserIds[1] },
    });
    await prisma.response.create({
      data: { meetingId: meeting2.id, userId: testUserIds[1], hostWish: 'will_host', assignedHost: testUserIds[1] },
    });

    await recalculateScoresForGroup(testGroupId);

    const scores = await prisma.score.findMany({ where: { groupId: testGroupId } });
    
    const user1Score = scores.find((s) => s.userId === testUserIds[0]);
    expect(user1Score?.participations).toBe(2);
    expect(user1Score?.hostings).toBe(1);
    expect(user1Score?.hostedGuests).toBe(1);

    const user2Score = scores.find((s) => s.userId === testUserIds[1]);
    expect(user2Score?.participations).toBe(2);
    expect(user2Score?.hostings).toBe(1);
    expect(user2Score?.hostedGuests).toBe(1);
  });

  it('should clean up scores for users no longer in group', async () => {
    const externalUser = await prisma.user.create({
      data: {
        name: 'External User',
        email: `external-${Date.now()}@example.com`,
        passwordHash: 'hash',
      },
    });

    await prisma.score.create({
      data: {
        userId: externalUser.id,
        groupId: testGroupId,
        participations: 1,
        hostings: 0,
        hostedGuests: 0,
        score: 1,
      },
    });

    await recalculateScoresForGroup(testGroupId);

    const remainingScore = await prisma.score.findUnique({
      where: { userId_groupId: { userId: externalUser.id, groupId: testGroupId } },
    });
    expect(remainingScore).toBeNull();

    await prisma.user.delete({ where: { id: externalUser.id } });
  });

  it('should calculate score with maxGuests adjustment', async () => {
    const meeting = await prisma.meeting.create({
      data: {
        groupId: testGroupId,
        date: new Date(),
        deadline: new Date(Date.now() - 1000),
        frozen: true,
      },
    });

    await prisma.response.create({
      data: { meetingId: meeting.id, userId: testUserIds[0], hostWish: 'will_host', assignedHost: testUserIds[0] },
    });

    await recalculateScoresForGroup(testGroupId);

    const score = await prisma.score.findFirst({ where: { userId: testUserIds[0], groupId: testGroupId } });
    expect(Number(score?.score)).toBe(0);
  });
});

describe('recalculateAllScores', () => {
  it('should recalculate scores for all groups', async () => {
    await expect(recalculateAllScores()).resolves.not.toThrow();
  });
});
