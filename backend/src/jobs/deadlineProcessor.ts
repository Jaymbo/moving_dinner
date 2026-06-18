import prisma from '../db';
import { assignHosts } from '../services/assignment';
import { sendAssignmentEmails } from '../services/email';
import { recalculateAllScores } from '../services/scoring';
import { recalculateAllMatrix } from '../services/matrix';

/**
 * P5 – Deadline-Verarbeitung (alle 30 Min)
 * Findet alle Meetings deren Deadline abgelaufen ist und noch nicht gefreezt sind.
 * Führt Host-Zuweisung durch, sendet E-Mails, und freezt das Meeting.
 */
export async function processDeadlines(): Promise<void> {
  const now = new Date();

  const meetings = await prisma.meeting.findMany({
    where: {
      frozen: false,
      deadline: {
        lte: now,
      },
    },
    include: { responses: true },
  });

  console.log(`[DeadlineProcessor] Found ${meetings.length} meetings past deadline`);

  let somethingChanged = false;

  for (const meeting of meetings) {
    try {
      console.log(`[DeadlineProcessor] Processing meeting ${meeting.id} (${meeting.date})`);

      // Run assignment if not already assigned
      const hasUnassigned = meeting.responses.some(r => r.assignedHost === null);
      if (hasUnassigned) {
        await assignHosts(meeting.id);
      }

      // Send assignment emails
      await sendAssignmentEmails(meeting.id);

      // Freeze the meeting
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: { frozen: true },
      });

      somethingChanged = true;
      console.log(`[DeadlineProcessor] Froze meeting ${meeting.id}`);
    } catch (err) {
      console.error(`[DeadlineProcessor] Failed for meeting ${meeting.id}:`, err);
    }
  }

  // If any meetings were frozen, recalculate scores and matrix for all groups
  if (somethingChanged) {
    try {
      await recalculateAllScores();
      console.log('[DeadlineProcessor] Recalculated scores');
    } catch (err) {
      console.error('[DeadlineProcessor] Failed to recalculate scores:', err);
    }

    try {
      await recalculateAllMatrix();
      console.log('[DeadlineProcessor] Recalculated meetup matrix');
    } catch (err) {
      console.error('[DeadlineProcessor] Failed to recalculate matrix:', err);
    }
  }
}
