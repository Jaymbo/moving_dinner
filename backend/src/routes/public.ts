import { Router, Response } from 'express';
import prisma from '../db.js';
import { logger } from '../utils/logger.js';

const router = Router();

// GET /api/public/meetings/active – Open meetings for guest registration
router.get('/meetings/active', async (_req, res: Response) => {
  try {
    const now = new Date();
    const meetings = await prisma.meeting.findMany({
      where: {
        frozen: false,
        deadline: { gt: now },
      },
      include: {
        group: { select: { id: true, name: true } },
        _count: { select: { responses: true } },
      },
      orderBy: { date: 'asc' },
    });
    res.json(meetings);
  } catch (err) {
    logger.error('Public meetings error', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Failed to get active meetings' });
  }
});

// POST /api/public/meetings/:id/register – Guest self-registration
router.post('/meetings/:id/register', async (req, res: Response) => {
  try {
    const meetingId = parseInt(req.params.id, 10);
    if (isNaN(meetingId)) {
      res.status(400).json({ error: 'Invalid meeting id' });
      return;
    }

    const { name, email, hostWish, diet } = req.body;
    if (!name || !email) {
      res.status(400).json({ error: 'name and email are required' });
      return;
    }
    if (!['will_host', 'indifferent', 'cannot_host'].includes(hostWish)) {
      res.status(400).json({ error: 'hostWish must be will_host, indifferent, or cannot_host' });
      return;
    }

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) {
      res.status(404).json({ error: 'Meeting not found' });
      return;
    }
    if (meeting.frozen) {
      res.status(403).json({ error: 'Meeting is frozen' });
      return;
    }
    if (meeting.deadline < new Date()) {
      res.status(403).json({ error: 'Deadline has passed' });
      return;
    }

    // Check if user with this email already exists
    let user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      // User exists – just create response
      // Check if already responded
      const existing = await prisma.response.findUnique({
        where: { meetingId_userId: { meetingId, userId: user.id } },
      });
      if (existing) {
        res.status(409).json({ error: 'Already registered for this meeting', userId: user.id });
        return;
      }

      await prisma.response.create({
        data: { meetingId, userId: user.id, hostWish },
      });
    } else {
      // Create guest user
      user = await prisma.user.create({
        data: {
          name,
          email,
          isGuest: true,
          diet: diet || null,
        },
      });

      // Add guest to the meeting's group
      const existingMembership = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: meeting.groupId, userId: user.id } },
      });
      if (!existingMembership) {
        await prisma.groupMember.create({
          data: { groupId: meeting.groupId, userId: user.id, role: 'member' },
        });
      }

      // Create response
      await prisma.response.create({
        data: { meetingId, userId: user.id, hostWish },
      });
    }

    // Run assignment algorithm
    const { assignHosts } = await import('../services/assignment');
    await assignHosts(meetingId);

    res.status(201).json({ success: true, userId: user.id, isGuest: user.isGuest });
  } catch (err) {
    logger.error('Guest registration error', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Failed to register' });
  }
});

export default router;
