import { Router, Response } from 'express';
import prisma from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { assignHosts } from '../services/assignment';

const router = Router();

// GET /api/meetings/:id/responses – All responses for a meeting
router.get('/:id/responses', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const meetingId = parseInt(req.params.id, 10);
    if (isNaN(meetingId)) { res.status(400).json({ error: 'Invalid meeting id' }); return; }

    const responses = await prisma.response.findMany({
      where: { meetingId },
      include: {
        user: { select: { id: true, name: true, diet: true, address: true, maxGuests: true } },
        assignedHostUser: { select: { id: true, name: true, address: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(responses);
  } catch (err) {
    console.error('List responses error:', err);
    res.status(500).json({ error: 'Failed to list responses' });
  }
});

// POST /api/meetings/:id/responses – Create response (logged-in user)
router.post('/:id/responses', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const meetingId = parseInt(req.params.id, 10);
    const { hostWish } = req.body;

    if (!['will_host', 'indifferent', 'cannot_host'].includes(hostWish)) {
      res.status(400).json({ error: 'hostWish must be will_host, indifferent, or cannot_host' });
      return;
    }

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) { res.status(404).json({ error: 'Meeting not found' }); return; }
    if (meeting.frozen) { res.status(403).json({ error: 'Meeting is frozen' }); return; }
    if (meeting.deadline < new Date()) { res.status(403).json({ error: 'Deadline has passed' }); return; }

    const existing = await prisma.response.findUnique({
      where: { meetingId_userId: { meetingId, userId: req.userId! } },
    });
    if (existing) { res.status(409).json({ error: 'Already responded' }); return; }

    const response = await prisma.response.create({
      data: { meetingId, userId: req.userId!, hostWish },
    });

    // Run assignment algorithm
    await assignHosts(meetingId);

    res.status(201).json(response);
  } catch (err) {
    console.error('Create response error:', err);
    res.status(500).json({ error: 'Failed to create response' });
  }
});

// PUT /api/meetings/:id/responses/me – Update own response
router.put('/:id/responses/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const meetingId = parseInt(req.params.id, 10);
    const { hostWish } = req.body;

    if (!['will_host', 'indifferent', 'cannot_host'].includes(hostWish)) {
      res.status(400).json({ error: 'hostWish must be will_host, indifferent, or cannot_host' });
      return;
    }

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) { res.status(404).json({ error: 'Meeting not found' }); return; }
    if (meeting.frozen) { res.status(403).json({ error: 'Meeting is frozen' }); return; }
    if (meeting.deadline < new Date()) { res.status(403).json({ error: 'Deadline has passed' }); return; }

    const existing = await prisma.response.findUnique({
      where: { meetingId_userId: { meetingId, userId: req.userId! } },
    });
    if (!existing) { res.status(404).json({ error: 'No response found' }); return; }

    const updated = await prisma.response.update({
      where: { id: existing.id },
      data: { hostWish },
    });

    // Re-run assignment
    await assignHosts(meetingId);

    res.json(updated);
  } catch (err) {
    console.error('Update response error:', err);
    res.status(500).json({ error: 'Failed to update response' });
  }
});

// DELETE /api/meetings/:id/responses/me – Withdraw own response
router.delete('/:id/responses/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const meetingId = parseInt(req.params.id, 10);

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) { res.status(404).json({ error: 'Meeting not found' }); return; }
    if (meeting.frozen) { res.status(403).json({ error: 'Meeting is frozen' }); return; }

    const existing = await prisma.response.findUnique({
      where: { meetingId_userId: { meetingId, userId: req.userId! } },
    });
    if (!existing) { res.status(404).json({ error: 'No response found' }); return; }

    await prisma.response.delete({ where: { id: existing.id } });

    // Re-run assignment
    await assignHosts(meetingId);

    res.json({ success: true });
  } catch (err) {
    console.error('Delete response error:', err);
    res.status(500).json({ error: 'Failed to delete response' });
  }
});

export default router;