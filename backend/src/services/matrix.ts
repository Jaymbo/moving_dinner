import prisma from '../db';

/**
 * Recalculate the meetup matrix from frozen meetings.
 * Port of createMeetupMatrix() from meetups.gs
 *
 * For each frozen meeting, groups participants by their assigned host.
 * For each pair (A, B) in the same host group, increment the count.
 */
export async function recalculateMatrix(): Promise<void> {
  // Get all frozen meetings with responses including user info
  const frozenMeetings = await prisma.meeting.findMany({
    where: { frozen: true },
    include: { responses: true },
  });

  // Build pair counts: "smallerId_largerId" -> count
  const pairCounts = new Map<string, number>();

  for (const meeting of frozenMeetings) {
    // Group responses by assigned host
    const hostGroups = new Map<number, number[]>(); // hostUserId -> [participantUserIds]

    for (const response of meeting.responses) {
      if (response.assignedHost === null) continue;
      const hostId = response.assignedHost;
      if (!hostGroups.has(hostId)) {
        hostGroups.set(hostId, []);
      }
      hostGroups.get(hostId)!.push(response.userId);
    }

    // For each host group, increment pairs
    for (const [_hostId, memberIds] of hostGroups) {
      for (let a = 0; a < memberIds.length; a++) {
        for (let b = a + 1; b < memberIds.length; b++) {
          const idA = Math.min(memberIds[a], memberIds[b]);
          const idB = Math.max(memberIds[a], memberIds[b]);
          const key = `${idA}_${idB}`;
          pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
        }
      }
    }
  }

  // Clear existing matrix and rewrite
  await prisma.meetupMatrix.deleteMany({});

  // Insert new entries
  const entries = Array.from(pairCounts.entries()).map(([key, count]) => {
    const [userAId, userBId] = key.split('_').map(Number);
    return { userAId, userBId, count };
  });

  // Batch insert (Prisma doesn't have native batch insert, use createMany)
  if (entries.length > 0) {
    await prisma.meetupMatrix.createMany({ data: entries });
  }
}