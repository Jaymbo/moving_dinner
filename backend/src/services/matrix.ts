import prisma from '../db';

/**
 * Recalculate the meetup matrix for a specific group from frozen meetings.
 *
 * For each frozen meeting in the group, groups participants by their assigned host.
 * For each pair (A, B) in the same host group, increment the count.
 */
export async function recalculateMatrixForGroup(groupId: number): Promise<void> {
  // Get all frozen meetings for this group with responses
  const frozenMeetings = await prisma.meeting.findMany({
    where: { frozen: true, groupId },
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

  // Clear existing matrix for this group and rewrite
  await prisma.meetupMatrix.deleteMany({ where: { groupId } });

  // Insert new entries
  const entries = Array.from(pairCounts.entries()).map(([key, count]) => {
    const [userAId, userBId] = key.split('_').map(Number);
    return { userAId, userBId, groupId, count };
  });

  // Batch insert
  if (entries.length > 0) {
    await prisma.meetupMatrix.createMany({ data: entries });
  }
}

/**
 * Recalculate the meetup matrix for all groups.
 */
export async function recalculateAllMatrix(): Promise<void> {
  const groups = await prisma.group.findMany({ select: { id: true } });
  for (const group of groups) {
    await recalculateMatrixForGroup(group.id);
  }
}

/**
 * Legacy function: recalculate matrix across all groups.
 * @deprecated Use recalculateAllMatrix() or recalculateMatrixForGroup() instead.
 */
export async function recalculateMatrix(): Promise<void> {
  return recalculateAllMatrix();
}