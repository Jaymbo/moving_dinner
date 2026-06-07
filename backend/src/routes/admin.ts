import { Router, Response } from 'express';
import prisma from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { requireMeetingGroupAdmin, requireAnyGroupAdmin } from '../middleware/groupAuth';
import { assignHosts } from '../services/assignment';
import { recalculateScores } from '../services/scoring';
import { recalculateMatrix } from '../services/matrix';
import { sendAssignmentEmails, sendDeadlineReminder } from '../services/email';
import { generateRsvpTokens } from '../services/rsvp';

const router = Router();

// POST /api/admin/meetings/:id/freeze – Freeze a meeting and send emails
router.post('/meetings/:id/freeze', requireAuth, requireMeetingGroupAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const meetingId = parseInt(req.params.id, 10);
    if (isNaN(meetingId)) { res.status(400).json({ error: 'Invalid meeting id' }); return; }

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { responses: true },
    });
    if (!meeting) { res.status(404).json({ error: 'Meeting not found' }); return; }
    if (meeting.frozen) { res.status(400).json({ error: 'Meeting already frozen' }); return; }

    // Run assignment if not already assigned
    const hasUnassigned = meeting.responses.some(r => r.assignedHost === null);
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
    await recalculateScores();
    await recalculateMatrix();

    res.json({ success: true });
  } catch (err) {
    console.error('Freeze error:', err);
    res.status(500).json({ error: 'Failed to freeze meeting' });
  }
});

// POST /api/admin/meetings/:id/remind – Send deadline reminder manually
router.post('/meetings/:id/remind', requireAuth, requireMeetingGroupAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const meetingId = parseInt(req.params.id, 10);
    if (isNaN(meetingId)) { res.status(400).json({ error: 'Invalid meeting id' }); return; }

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) { res.status(404).json({ error: 'Meeting not found' }); return; }
    if (meeting.frozen) { res.status(400).json({ error: 'Meeting already frozen' }); return; }

    await sendDeadlineReminder(meetingId, meeting.date, meeting.deadline);

    res.json({ success: true });
  } catch (err) {
    console.error('Remind error:', err);
    res.status(500).json({ error: 'Failed to send reminders' });
  }
});

// POST /api/admin/recalculate-scores – Recalculate all scores and matrix (any group admin)
router.post('/recalculate-scores', requireAuth, requireAnyGroupAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    await recalculateScores();
    await recalculateMatrix();
    res.json({ success: true });
  } catch (err) {
    console.error('Recalculate error:', err);
    res.status(500).json({ error: 'Failed to recalculate scores' });
  }
});

// POST /api/admin/meetings/:id/send-rsvp – Send RSVP emails to all group members
router.post('/meetings/:id/send-rsvp', requireAuth, requireMeetingGroupAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const meetingId = parseInt(req.params.id, 10);
    if (isNaN(meetingId)) { res.status(400).json({ error: 'Invalid meeting id' }); return; }

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) { res.status(404).json({ error: 'Meeting not found' }); return; }

    // Ensure RSVP tokens exist for all members
    await generateRsvpTokens(meetingId, meeting.groupId);

    // Send emails
    const { notifyGroupNewMeeting } = await import('../services/email');
    await notifyGroupNewMeeting(meeting.groupId, meetingId, meeting.date, meeting.deadline);

    res.json({ success: true });
  } catch (err) {
    console.error('Send RSVP error:', err);
    res.status(500).json({ error: 'Failed to send RSVP emails' });
  }
});

export default router;