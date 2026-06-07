import { Router, Response } from 'express';
import prisma from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { requireGroupMember, requireMeetingGroupAdmin } from '../middleware/groupAuth';
import { generateRsvpTokens } from '../services/rsvp';
import { notifyGroupNewMeeting } from '../services/email';

const router = Router();

// GET /api/meetings – Meetings for user's groups (optional ?group_id=X filter)
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const memberships = await prisma.groupMember.findMany({
      where: { userId: req.userId },
      select: { groupId: true, role: true },
    });
    const groupIds = memberships.map(m => m.groupId);
    const roleMap = new Map(memberships.map(m => [m.groupId, m.role]));

    const groupId = req.query.group_id ? parseInt(req.query.group_id as string, 10) : undefined;
    if (groupId && !groupIds.includes(groupId)) {
      res.status(403).json({ error: 'Not a member of this group' });
      return;
    }
    const where = groupId ? { groupId } : { groupId: { in: groupIds } };

    const meetings = await prisma.meeting.findMany({
      where,
      include: {
        group: { select: { id: true, name: true, meetingCreation: true } },
        _count: { select: { responses: true, rsvpTokens: true } },
      },
      orderBy: { date: 'asc' },
    });

    const result = meetings.map(m => ({
      ...m,
      userRole: roleMap.get(m.groupId) || 'member',
    }));

    res.json(result);
  } catch (err) {
    console.error('List meetings error:', err);
    res.status(500).json({ error: 'Failed to list meetings' });
  }
});

// GET /api/meetings/my – My open meetings across all groups
router.get('/my', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const memberships = await prisma.groupMember.findMany({
      where: { userId: req.userId },
      select: { groupId: true, role: true },
    });
    const groupIds = memberships.map(m => m.groupId);
    const roleMap = new Map(memberships.map(m => [m.groupId, m.role]));

    const meetings = await prisma.meeting.findMany({
      where: {
        groupId: { in: groupIds },
        frozen: false,
      },
      include: {
        group: { select: { id: true, name: true, meetingCreation: true } },
        responses: { where: { userId: req.userId } },
        _count: { select: { responses: true } },
      },
      orderBy: { date: 'asc' },
    });

    const result = meetings.map(m => ({
      ...m,
      hasResponded: m.responses.length > 0,
      response: m.responses[0] || null,
      totalResponses: m._count.responses,
      userRole: roleMap.get(m.groupId) || 'member',
    }));

    res.json(result);
  } catch (err) {
    console.error('My meetings error:', err);
    res.status(500).json({ error: 'Failed to get meetings' });
  }
});

// GET /api/meetings/group/:id – All meetings for a group
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

// POST /api/meetings/group/:id – Create meeting
// Permission depends on group's meetingCreation setting: 'admin' or 'all'
router.post('/group/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const groupId = parseInt(req.params.id, 10);
    const { date, deadline } = req.body;

    if (!date || !deadline) {
      res.status(400).json({ error: 'date and deadline are required' });
      return;
    }

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: req.userId! } },
    });
    if (!membership) {
      res.status(403).json({ error: 'Not a member of this group' });
      return;
    }

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    if (group.meetingCreation === 'admin' && membership.role !== 'admin') {
      res.status(403).json({ error: 'Nur Admins dürfen in dieser Gruppe Treffen erstellen' });
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

    await generateRsvpTokens(meeting.id, groupId);

    notifyGroupNewMeeting(groupId, meeting.id, meetingDate, meetingDeadline).catch(err =>
      console.error('Failed to send meeting notifications:', err)
    );

    res.status(201).json(meeting);
  } catch (err) {
    console.error('Create meeting error:', err);
    res.status(500).json({ error: 'Failed to create meeting' });
  }
});

// GET /api/meetings/:id – Get meeting details (group members only)
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: {
        group: { select: { id: true, name: true, meetingCreation: true } },
        responses: { include: { user: { select: { id: true, name: true, diet: true, address: true } } } },
      },
    });
    if (!meeting) { res.status(404).json({ error: 'Meeting not found' }); return; }

    // Check membership
    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: meeting.groupId, userId: req.userId! } },
    });
    if (!membership) {
      res.status(403).json({ error: 'Not a member of this group' });
      return;
    }

    res.json({ ...meeting, userRole: membership.role });
  } catch (err) {
    console.error('Get meeting error:', err);
    res.status(500).json({ error: 'Failed to get meeting' });
  }
});

// PUT /api/meetings/:id – Edit meeting (group admin only)
router.put('/:id', requireAuth, requireMeetingGroupAdmin, async (req: AuthRequest, res: Response) => {
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

// DELETE /api/meetings/:id (group admin only)
router.delete('/:id', requireAuth, requireMeetingGroupAdmin, async (req: AuthRequest, res: Response) => {
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