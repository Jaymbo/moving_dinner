import cron from 'node-cron';
import { sendPreDeadlineReminders } from './deadlineReminder';
import { processDeadlines } from './deadlineProcessor';
import { cleanupRsvpTokens } from './tokenCleanup';

/**
 * Start all cron jobs.
 */
export function startJobs(): void {
  // P4: Deadline-Erinnerung – täglich 09:00
  cron.schedule('0 9 * * *', async () => {
    console.log('[Cron] Running deadline reminder job...');
    try {
      await sendPreDeadlineReminders();
    } catch (err) {
      console.error('[Cron] Deadline reminder failed:', err);
    }
  });

  // P5: Deadline-Verarbeitung – alle 30 Minuten
  cron.schedule('*/30 * * * *', async () => {
    console.log('[Cron] Running deadline processor job...');
    try {
      await processDeadlines();
    } catch (err) {
      console.error('[Cron] Deadline processor failed:', err);
    }
  });

  // RSVP-Token Cleanup – täglich 03:00
  cron.schedule('0 3 * * *', async () => {
    console.log('[Cron] Running token cleanup job...');
    try {
      await cleanupRsvpTokens();
    } catch (err) {
      console.error('[Cron] Token cleanup failed:', err);
    }
  });

  console.log('[Cron] All jobs scheduled');
}