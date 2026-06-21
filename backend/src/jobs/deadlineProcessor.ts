import prisma from '../db.js';
import { assignHosts } from '../services/assignment.js';
import { sendAssignmentEmails } from '../services/email.js';
import { recalculateAllScores } from '../services/scoring.js';
import { recalculateAllMatrix } from '../services/matrix.js';
import { logger } from '../utils/logger.js';

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

  logger.info(`[DeadlineProcessor] Found ${meetings.length} meetings past deadline`);

  let somethingChanged = false;

  for (const meeting of meetings) {
    try {
      logger.info(`[DeadlineProcessor] Processing meeting ${meeting.id} (${meeting.date})`);

      // Run assignment if not already assigned
      const hasUnassigned = meeting.responses.some((r) => r.assignedHost === null);
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
      logger.info(`[DeadlineProcessor] Froze meeting ${meeting.id}`);
    } catch (err) {
      logger.error(`[DeadlineProcessor] Failed for meeting ${meeting.id}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // If any meetings were frozen, recalculate scores and matrix for all groups
  if (somethingChanged) {
    try {
      await recalculateAllScores();
      logger.info('[DeadlineProcessor] Recalculated scores');
    } catch (err) {
      logger.error('[DeadlineProcessor] Failed to recalculate scores', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    try {
      await recalculateAllMatrix();
      logger.info('[DeadlineProcessor] Recalculated meetup matrix');
    } catch (err) {
      logger.error('[DeadlineProcessor] Failed to recalculate matrix', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
