import { Router, Response } from 'express';
import prisma from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { assignHosts } from '../services/assignment';

const router = Router();

// POST /api/assignment/:id/assign – Auto-assign hosts for a meeting
router.post('/:id/assign', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const meetingId = parseInt(req.params.id, 10);
    if (isNaN(meetingId)) { res.status(400).json({ error: 'Invalid meeting id' }); return; }

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) { res.status(404).json({ error: 'Meeting not found' }); return; }
    if (meeting.frozen) { res.status(403).json({ error: 'Meeting is frozen' }); return; }

    await assignHosts(meetingId);

    const responses = await prisma.response.findMany({
      where: { meetingId },
      include: {
        user: { select: { id: true, name: true } },
        assignedHostUser: { select: { id: true, name: true, address: true } },
      },
    });

    res.json({ success: true, assignments: responses });
  } catch (err) {
    console.error('Assign error:', err);
    res.status(500).json({ error: 'Failed to assign hosts' });
  }
});

// GET /api/assignment/:id – Get current assignment for a meeting
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const meetingId = parseInt(req.params.id, 10);
    if (isNaN(meetingId)) { res.status(400).json({ error: 'Invalid meeting id' }); return; }

    const responses = await prisma.response.findMany({
      where: { meetingId },
      include: {
        user: { select: { id: true, name: true, diet: true, address: true, maxGuests: true } },
        assignedHostUser: { select: { id: true, name: true, address: true } },
      },
    });

    // Group by host
    const hostGroups: Record<number, { host: typeof responses[0]['assignedHostUser']; guests: typeof responses } > = {};
    const unassigned: typeof responses = [];

    for (const r of responses) {
      if (r.assignedHost === null) {
        unassigned.push(r);
      } else if (r.assignedHost === r.userId) {
        // This person is a host
        if (!hostGroups[r.userId]) {
          hostGroups[r.userId] = { host: r.assignedHostUser, guests: [] };
        }
      } else {
        // This person is a guest
        if (!hostGroups[r.assignedHost]) {
          const hostResponse = responses.find(rr => rr.userId === r.assignedHost);
          hostGroups[r.assignedHost] = { host: hostResponse?.assignedHostUser || r.assignedHostUser, guests: [] };
        }
        hostGroups[r.assignedHost].guests.push(r);
      }
    }

    res.json({ meetingId, hostGroups, unassigned });
  } catch (err) {
    console.error('Get assignment error:', err);
    res.status(500).json({ error: 'Failed to get assignment' });
  }
});

// PUT /api/assignment/:id – Manual assignment override (before freeze)
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const meetingId = parseInt(req.params.id, 10);
    if (isNaN(meetingId)) { res.status(400).json({ error: 'Invalid meeting id' }); return; }

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) { res.status(404).json({ error: 'Meeting not found' }); return; }
    if (meeting.frozen) { res.status(403).json({ error: 'Meeting is frozen, cannot change assignment' }); return; }

    const { assignments } = req.body as { assignments: { userId: number; assignedHost: number | null }[] };
    if (!Array.isArray(assignments)) {
      res.status(400).json({ error: 'assignments array is required' });
      return;
    }

    // Update all assignments in a transaction
    await prisma.$transaction(
      assignments.map(a =>
        prisma.response.updateMany({
          where: { meetingId, userId: a.userId },
          data: { assignedHost: a.assignedHost },
        })
      )
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Manual assignment error:', err);
    res.status(500).json({ error: 'Failed to update assignment' });
  }
});

export default router;