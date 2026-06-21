import { Router, Response } from 'express';
import prisma from '../db.js';
import { requireAuth, requireSuperAdmin, AuthRequest } from '../middleware/auth.js';
import { requireMeetingGroupAdmin } from '../middleware/groupAuth.js';
import { assignHosts } from '../services/assignment.js';
import { recalculateAllScores } from '../services/scoring.js';
import { recalculateAllMatrix } from '../services/matrix.js';
import { sendAssignmentEmails, sendDeadlineReminder, sendMail } from '../services/email.js';
import { generateRsvpTokens } from '../services/rsvp.js';
import { logger } from '../utils/logger.js';

const router = Router();

// POST /api/admin/test-email – Send a test email (requires auth)
router.post('/test-email', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { to } = req.body;
    if (!to) {
      res.status(400).json({ error: 'to is required (email address)' });
      return;
    }

    const success = await sendMail({
      to,
      subject: 'Moving Dinner – Test-E-Mail',
      body: `Hallo!\n\nDas ist eine Test-E-Mail von deiner Moving Dinner App.\n\nWenn du diese Nachricht erhältst, funktioniert der SMTP-Versand korrekt!\n\nGesendet an: ${to}\nZeitstempel: ${new Date().toLocaleString('de-DE')}\n\nViele Grüße,\nMoving Dinner`,
    });

    if (success) {
      res.json({ success: true, message: `Test email sent to ${to}` });
    } else {
      res.status(500).json({ error: 'Failed to send test email – check server logs' });
    }
  } catch (err) {
    logger.error('Test email error', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

// POST /api/admin/meetings/:id/freeze – Freeze a meeting and send emails
router.post(
  '/meetings/:id/freeze',
  requireAuth,
  requireMeetingGroupAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const meetingId = parseInt(req.params.id, 10);
      if (isNaN(meetingId)) {
        res.status(400).json({ error: 'Invalid meeting id' });
        return;
      }

      const meeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
        include: { responses: true },
      });
      if (!meeting) {
        res.status(404).json({ error: 'Meeting not found' });
        return;
      }
      if (meeting.frozen) {
        res.status(400).json({ error: 'Meeting already frozen' });
        return;
      }

      // Run assignment if not already assigned
      const hasUnassigned = meeting.responses.some((r) => r.assignedHost === null);
      if (hasUnassigned) {
        await assignHosts(meetingId);
      }

      // Send assignment emails
      await sendAssignmentEmails(meetingId);

      // Freeze the meeting
      await prisma.meeting.update({
        where: { id: meetingId },
        data: { frozen: true },
      });

      // Recalculate scores and matrix
      await recalculateAllScores();
      await recalculateAllMatrix();

      res.json({ success: true });
    } catch (err) {
      logger.error('Freeze error', {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: 'Failed to freeze meeting' });
    }
  }
);

// POST /api/admin/meetings/:id/remind – Send deadline reminder manually
router.post(
  '/meetings/:id/remind',
  requireAuth,
  requireMeetingGroupAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const meetingId = parseInt(req.params.id, 10);
      if (isNaN(meetingId)) {
        res.status(400).json({ error: 'Invalid meeting id' });
        return;
      }

      const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
      if (!meeting) {
        res.status(404).json({ error: 'Meeting not found' });
        return;
      }
      if (meeting.frozen) {
        res.status(400).json({ error: 'Meeting already frozen' });
        return;
      }

      await sendDeadlineReminder(meetingId, meeting.date, meeting.deadline);

      res.json({ success: true });
    } catch (err) {
      logger.error('Remind error', {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: 'Failed to send reminders' });
    }
  }
);

// POST /api/admin/recalculate-scores – Recalculate all scores and matrix (super-admin only)
router.post(
  '/recalculate-scores',
  requireAuth,
  requireSuperAdmin,
  async (_req: AuthRequest, res: Response) => {
    try {
      await recalculateAllScores();
      await recalculateAllMatrix();
      res.json({ success: true });
    } catch (err) {
      logger.error('Recalculate error', {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: 'Failed to recalculate scores' });
    }
  }
);

// POST /api/admin/meetings/:id/send-rsvp – Send RSVP emails to all group members
router.post(
  '/meetings/:id/send-rsvp',
  requireAuth,
  requireMeetingGroupAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const meetingId = parseInt(req.params.id, 10);
      if (isNaN(meetingId)) {
        res.status(400).json({ error: 'Invalid meeting id' });
        return;
      }

      const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
      if (!meeting) {
        res.status(404).json({ error: 'Meeting not found' });
        return;
      }

      // Ensure RSVP tokens exist for all members
      await generateRsvpTokens(meetingId, meeting.groupId);

      // Send emails
      const { notifyGroupNewMeeting } = await import('../services/email');
      await notifyGroupNewMeeting(meeting.groupId, meetingId, meeting.date, meeting.deadline);

      res.json({ success: true });
    } catch (err) {
      logger.error('Send RSVP error', {
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ error: 'Failed to send RSVP emails' });
    }
  }
);

export default router;
