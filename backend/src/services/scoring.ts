import prisma from '../db';

/**
 * Recalculate scores for a specific group from frozen meetings.
 * Score = (Participations - Hostings - HostedGuests) / MaxGuests
 */
export async function recalculateScoresForGroup(groupId: number): Promise<void> {
  // Get all frozen meetings for this group with their responses
  const frozenMeetings = await prisma.meeting.findMany({
    where: { frozen: true, groupId },
    include: { responses: true },
  });

  // Get all members of this group
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    select: { userId: true },
  });
  const memberIds = members.map(m => m.userId);

  // Build aggregation map
  const stats = new Map<number, { participations: number; hostings: number; hostedGuests: number }>();
  for (const userId of memberIds) {
    stats.set(userId, { participations: 0, hostings: 0, hostedGuests: 0 });
  }

  // Aggregate from frozen meetings in this group
  for (const meeting of frozenMeetings) {
    for (const response of meeting.responses) {
      const s = stats.get(response.userId);
      if (!s) continue; // Skip users not in this group
      s.participations++;

      // If this user is a host (assignedHost points to themselves)
      if (response.assignedHost === response.userId) {
        s.hostings++;
        // Count guests assigned to this host in this meeting
        const guestsAtThisHost = meeting.responses.filter(
          r => r.assignedHost === response.userId && r.userId !== response.userId
        );
        s.hostedGuests += guestsAtThisHost.length;
      }
    }
  }

  // Write to scores table (upsert per group)
  for (const userId of memberIds) {
    const s = stats.get(userId)!;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { maxGuests: true } });
    const maxGuests = user?.maxGuests || 0;
    const rawScore = s.participations - s.hostings - s.hostedGuests;
    const adjustedScore = maxGuests > 0 ? rawScore / maxGuests : rawScore;

    await prisma.score.upsert({
      where: { userId_groupId: { userId, groupId } },
      update: {
        participations: s.participations,
        hostings: s.hostings,
        hostedGuests: s.hostedGuests,
        score: adjustedScore,
      },
      create: {
        userId,
        groupId,
        participations: s.participations,
        hostings: s.hostings,
        hostedGuests: s.hostedGuests,
        score: adjustedScore,
      },
    });
  }

  // Clean up scores for users no longer in this group
  await prisma.score.deleteMany({
    where: { groupId, userId: { notIn: memberIds } },
  });
}

/**
 * Recalculate scores for all groups.
 */
export async function recalculateAllScores(): Promise<void> {
  const groups = await prisma.group.findMany({ select: { id: true } });
  for (const group of groups) {
    await recalculateScoresForGroup(group.id);
  }
}

/**
 * Legacy function: recalculate scores across all groups.
 * @deprecated Use recalculateAllScores() or recalculateScoresForGroup() instead.
 */
export async function recalculateScores(): Promise<void> {
  return recalculateAllScores();
}