import prisma from '../db';
import { sendDeadlineReminder } from '../services/email';

/**
 * P4 – Deadline-Erinnerung (täglich 09:00)
 * Findet alle offenen Meetings deren Deadline in den nächsten 24h liegt
 * und sendet Erinnerungen an noch nicht angemeldete Mitglieder.
 */
export async function sendPreDeadlineReminders(): Promise<void> {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const meetings = await prisma.meeting.findMany({
    where: {
      frozen: false,
      deadline: {
        gt: now,
        lte: in24h,
      },
    },
  });

  console.log(`[DeadlineReminder] Found ${meetings.length} meetings with upcoming deadlines`);

  for (const meeting of meetings) {
    try {
      await sendDeadlineReminder(meeting.id, meeting.date, meeting.deadline);
      console.log(`[DeadlineReminder] Sent reminders for meeting ${meeting.id}`);
    } catch (err) {
      console.error(`[DeadlineReminder] Failed for meeting ${meeting.id}:`, err);
    }
  }
}