import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { sendPreDeadlineReminders } from './deadlineReminder.js';
import { processDeadlines } from './deadlineProcessor.js';
import { cleanupRsvpTokens } from './tokenCleanup.js';

/**
 * Start all cron jobs.
 */
export function startJobs(): void {
  // P4: Deadline-Erinnerung – täglich 09:00
  cron.schedule('0 9 * * *', async () => {
    logger.info('[Cron] Running deadline reminder job...');
    try {
      await sendPreDeadlineReminders();
    } catch (err) {
      logger.error(
        '[Cron] Deadline reminder failed',
        err instanceof Error ? { message: err.message } : undefined
      );
    }
  });

  // P5: Deadline-Verarbeitung – alle 30 Minuten
  cron.schedule('*/30 * * * *', async () => {
    logger.info('[Cron] Running deadline processor job...');
    try {
      await processDeadlines();
    } catch (err) {
      logger.error(
        '[Cron] Deadline processor failed',
        err instanceof Error ? { message: err.message } : undefined
      );
    }
  });

  // RSVP-Token Cleanup – täglich 03:00
  cron.schedule('0 3 * * *', async () => {
    logger.info('[Cron] Running token cleanup job...');
    try {
      await cleanupRsvpTokens();
    } catch (err) {
      logger.error(
        '[Cron] Token cleanup failed',
        err instanceof Error ? { message: err.message } : undefined
      );
    }
  });

  logger.info('[Cron] All jobs scheduled');
}
