import { Router, Response } from 'express';
import prisma from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { requireGroupAdmin, requireGroupMember } from '../middleware/groupAuth';
import { generateRsvpTokens } from '../services/rsvp';
import { notifyGroupNewMeeting } from '../services/email';

const router = Router();

// GET /api/meetings – All meetings (admin, optional ?group_id=X filter)
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const groupId = req.query.group_id ? parseInt(req.query.group_id as string, 10) : undefined;
    const where = groupId ? { groupId } : {};

    const meetings = await prisma.meeting.findMany({
      where,
      include: {
        group: { select: { id: true, name: true } },
        _count: { select: { responses: true, rsvpTokens: true } },
      },
      orderBy: { date: 'asc' },
    });
    res.json(meetings);
  } catch (err) {
    console.error('List meetings error:', err);
    res.status(500).json({ error: 'Failed to list meetings' });
  }
});

// GET /api/meetings/my – My open meetings across all groups
router.get('/my', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    // Get all group memberships
    const memberships = await prisma.groupMember.findMany({
      where: { userId: req.userId },
      select: { groupId: true },
    });
    const groupIds = memberships.map(m => m.groupId);

    const meetings = await prisma.meeting.findMany({
      where: {
        groupId: { in: groupIds },
        frozen: false,
      },
      include: {
        group: { select: { id: true, name: true } },
        responses: { where: { userId: req.userId } },
      },
      orderBy: { date: 'asc' },
    });

    // Add response status
    const result = meetings.map(m => ({
      ...m,
      hasResponded: m.responses.length > 0,
      response: m.responses[0] || null,
    }));

    res.json(result);
  } catch (err) {
    console.error('My meetings error:', err);
    res.status(500).json({ error: 'Failed to get meetings' });
  }
});

// GET /api/groups/:id/meetings – All meetings for a group
router.get('/group/:id', requireAuth, requireGroupMember, async (req: AuthRequest, res: Response) => {
  try {
    const groupId = parseInt(req.params.id, 10);
    const meetings = await prisma.meeting.findMany({
      where: { groupId },
      include: {
        _count: { select: { responses: true } },
      },
      orderBy: { date: 'asc' },
    });
    res.json(meetings);
  } catch (err) {
    console.error('Group meetings error:', err);
    res.status(500).json({ error: 'Failed to get group meetings' });
  }
});

// POST /api/groups/:id/meetings – Create meeting (group admin)
// Note: Using /group/:id/meetings to avoid conflict with /meetings/:id
router.post('/group/:id', requireAuth, requireGroupAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const groupId = parseInt(req.params.id, 10);
    const { date, deadline } = req.body;

    if (!date || !deadline) {
      res.status(400).json({ error: 'date and deadline are required' });
      return;
    }

    const meetingDate = new Date(date);
    const meetingDeadline = new Date(deadline);

    if (meetingDeadline >= meetingDate) {
      res.status(400).json({ error: 'Deadline must be before the meeting date' });
      return;
    }

    const meeting = await prisma.meeting.create({
      data: {
        groupId,
        date: meetingDate,
        deadline: meetingDeadline,
        createdBy: req.userId,
      },
    });

    // Generate RSVP tokens for all group members
    await generateRsvpTokens(meeting.id, groupId);

    // Send notification emails in background
    notifyGroupNewMeeting(groupId, meeting.id, meetingDate, meetingDeadline).catch(err =>
      console.error('Failed to send meeting notifications:', err)
    );

    res.status(201).json(meeting);
  } catch (err) {
    console.error('Create meeting error:', err);
    res.status(500).json({ error: 'Failed to create meeting' });
  }
});

// GET /api/meetings/:id
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: {
        group: { select: { id: true, name: true } },
        responses: { include: { user: { select: { id: true, name: true, diet: true, address: true } } } },
      },
    });
    if (!meeting) { res.status(404).json({ error: 'Meeting not found' }); return; }
    res.json(meeting);
  } catch (err) {
    console.error('Get meeting error:', err);
    res.status(500).json({ error: 'Failed to get meeting' });
  }
});

// PUT /api/meetings/:id – Edit meeting
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { date, deadline } = req.body;

    const meeting = await prisma.meeting.findUnique({ where: { id } });
    if (!meeting) { res.status(404).json({ error: 'Meeting not found' }); return; }
    if (meeting.frozen) { res.status(403).json({ error: 'Meeting is frozen' }); return; }

    const updated = await prisma.meeting.update({
      where: { id },
      data: {
        ...(date !== undefined && { date: new Date(date) }),
        ...(deadline !== undefined && { deadline: new Date(deadline) }),
      },
    });
    res.json(updated);
  } catch (err) {
    console.error('Update meeting error:', err);
    res.status(500).json({ error: 'Failed to update meeting' });
  }
});

// DELETE /api/meetings/:id
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    const meeting = await prisma.meeting.findUnique({ where: { id } });
    if (!meeting) { res.status(404).json({ error: 'Meeting not found' }); return; }
    if (meeting.frozen) { res.status(403).json({ error: 'Cannot delete frozen meeting' }); return; }

    await prisma.meeting.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete meeting error:', err);
    res.status(500).json({ error: 'Failed to delete meeting' });
  }
});

export default router;