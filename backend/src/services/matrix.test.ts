import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { recalculateMatrixForGroup, recalculateAllMatrix } from './matrix.js';
import prisma from '../db.js';

/**
 * Helper to find a matrix pair regardless of ID order.
 * The matrix stores pairs with userAId < userBId.
 */
function findMatrixPair(
  matrix: { userAId: number; userBId: number; count: number }[],
  userId1: number,
  userId2: number
) {
  const [idA, idB] = userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];
  return matrix.find((m) => m.userAId === idA && m.userBId === idB);
}

describe('Matrix Service', () => {
  let testGroupId: number;
  let testUserIds: number[] = [];

  beforeEach(async () => {
    const uniqueId = `${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 8)}`;
    const group = await prisma.group.create({
      data: {
        name: 'Test Matrix Group',
        inviteCode: `TM-${uniqueId}`,
        meetingCreation: 'admin',
      },
    });
    testGroupId = group.id;

    const users = await Promise.all(
      [1, 2, 3, 4].map((i) =>
        prisma.user.create({
          data: {
            name: `Matrix User ${i}`,
            email: `matrix-${i}-${uniqueId}@example.com`,
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
    await prisma.meetupMatrix.deleteMany({ where: { groupId: testGroupId } });
    await prisma.response.deleteMany({ where: { meeting: { groupId: testGroupId } } });
    await prisma.meeting.deleteMany({ where: { groupId: testGroupId } });
    await prisma.groupMember.deleteMany({ where: { groupId: testGroupId } });
    await prisma.group.delete({ where: { id: testGroupId } });
    await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
  });

  it('should create matrix entries for a frozen meeting', async () => {
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
        { meetingId: meeting.id, userId: testUserIds[2], hostWish: 'indifferent', assignedHost: testUserIds[0] },
        { meetingId: meeting.id, userId: testUserIds[3], hostWish: 'cannot_host', assignedHost: testUserIds[0] },
      ],
    });

    await recalculateMatrixForGroup(testGroupId);

    const matrix = await prisma.meetupMatrix.findMany({ where: { groupId: testGroupId } });
    expect(matrix.length).toBe(6);

    const pair12 = findMatrixPair(matrix, testUserIds[0], testUserIds[1]);
    expect(pair12?.count).toBe(1);
  });

  it('should increment matrix counts for multiple meetings', async () => {
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

    for (const meetingId of [meeting1.id, meeting2.id]) {
      await prisma.response.createMany({
        data: [
          { meetingId, userId: testUserIds[0], hostWish: 'will_host', assignedHost: testUserIds[0] },
          { meetingId, userId: testUserIds[1], hostWish: 'indifferent', assignedHost: testUserIds[0] },
        ],
      });
    }

    await recalculateMatrixForGroup(testGroupId);

    const matrix = await prisma.meetupMatrix.findMany({ where: { groupId: testGroupId } });
    const pair12 = findMatrixPair(matrix, testUserIds[0], testUserIds[1]);
    expect(pair12?.count).toBe(2);
  });

  it('should handle multiple host groups in one meeting', async () => {
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
        { meetingId: meeting.id, userId: testUserIds[2], hostWish: 'will_host', assignedHost: testUserIds[2] },
        { meetingId: meeting.id, userId: testUserIds[3], hostWish: 'indifferent', assignedHost: testUserIds[2] },
      ],
    });

    await recalculateMatrixForGroup(testGroupId);

    const matrix = await prisma.meetupMatrix.findMany({ where: { groupId: testGroupId } });
    expect(matrix.length).toBe(2);

    const pair12 = findMatrixPair(matrix, testUserIds[0], testUserIds[1]);
    expect(pair12?.count).toBe(1);

    const pair34 = findMatrixPair(matrix, testUserIds[2], testUserIds[3]);
    expect(pair34?.count).toBe(1);
  });

  it('should clear and recreate matrix on recalculation', async () => {
    const meeting1 = await prisma.meeting.create({
      data: {
        groupId: testGroupId,
        date: new Date(),
        deadline: new Date(Date.now() - 1000),
        frozen: true,
      },
    });

    await prisma.response.createMany({
      data: [
        { meetingId: meeting1.id, userId: testUserIds[0], hostWish: 'will_host', assignedHost: testUserIds[0] },
        { meetingId: meeting1.id, userId: testUserIds[1], hostWish: 'indifferent', assignedHost: testUserIds[0] },
      ],
    });

    await recalculateMatrixForGroup(testGroupId);
    expect((await prisma.meetupMatrix.findMany({ where: { groupId: testGroupId } })).length).toBe(1);

    await prisma.response.deleteMany({ where: { meetingId: meeting1.id } });
    await prisma.meeting.delete({ where: { id: meeting1.id } });

    const meeting2 = await prisma.meeting.create({
      data: {
        groupId: testGroupId,
        date: new Date(),
        deadline: new Date(Date.now() - 1000),
        frozen: true,
      },
    });

    await prisma.response.createMany({
      data: [
        { meetingId: meeting2.id, userId: testUserIds[2], hostWish: 'will_host', assignedHost: testUserIds[2] },
        { meetingId: meeting2.id, userId: testUserIds[3], hostWish: 'indifferent', assignedHost: testUserIds[2] },
      ],
    });

    await recalculateMatrixForGroup(testGroupId);

    const matrix = await prisma.meetupMatrix.findMany({ where: { groupId: testGroupId } });
    expect(matrix.length).toBe(1);
    
    const pair34 = findMatrixPair(matrix, testUserIds[2], testUserIds[3]);
    expect(pair34).toBeDefined();
  });
});

describe('recalculateAllMatrix', () => {
  it('should recalculate matrix for all groups', async () => {
    await expect(recalculateAllMatrix()).resolves.not.toThrow();
  });
});
