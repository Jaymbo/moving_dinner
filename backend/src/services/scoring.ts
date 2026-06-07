import prisma from '../db';

/**
 * Recalculate all scores from frozen meetings.
 * Port of updateMaster() from Master.gs
 *
 * Score = (Participations - Hostings - HostedGuests) / MaxGuests
 */
export async function recalculateScores(): Promise<void> {
  // Get all frozen meetings with their responses
  const frozenMeetings = await prisma.meeting.findMany({
    where: { frozen: true },
    include: { responses: true },
  });

  // Get all users
  const users = await prisma.user.findMany();

  // Build aggregation map
  const stats = new Map<number, { participations: number; hostings: number; hostedGuests: number }>();
  for (const user of users) {
    stats.set(user.id, { participations: 0, hostings: 0, hostedGuests: 0 });
  }

  // Aggregate from frozen meetings
  for (const meeting of frozenMeetings) {
    for (const response of meeting.responses) {
      const s = stats.get(response.userId);
      if (!s) continue;
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

  // Write to scores table (upsert)
  for (const user of users) {
    const s = stats.get(user.id)!;
    const maxGuests = user.maxGuests || 0;
    const rawScore = s.participations - s.hostings - s.hostedGuests;
    const adjustedScore = maxGuests > 0 ? rawScore / maxGuests : rawScore;

    await prisma.score.upsert({
      where: { userId: user.id },
      update: {
        participations: s.participations,
        hostings: s.hostings,
        hostedGuests: s.hostedGuests,
        score: adjustedScore,
      },
      create: {
        userId: user.id,
        participations: s.participations,
        hostings: s.hostings,
        hostedGuests: s.hostedGuests,
        score: adjustedScore,
      },
    });
  }
}