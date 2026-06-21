import { Router, Response } from 'express';
import prisma from '../db.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireMeetingGroupAdmin } from '../middleware/groupAuth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateBody, validateParams, typedParams } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import { assignHosts } from '../services/assignment.js';
import { idParamSchema, manualAssignmentBodySchema } from '../validation/schemas.js';

const router = Router();

// POST /api/assignment/:id/assign – Auto-assign hosts for a meeting (group admin only)
router.post(
  '/:id/assign',
  requireAuth,
  requireMeetingGroupAdmin,
  validateParams(idParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: meetingId } = typedParams(req, idParamSchema);

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) {
      throw new AppError('Meeting not found', 404, 'MEETING_NOT_FOUND');
    }
    if (meeting.frozen) {
      throw new AppError('Meeting is frozen', 403, 'MEETING_FROZEN');
    }

    await assignHosts(meetingId);

    const responses = await prisma.response.findMany({
      where: { meetingId },
      include: {
        user: { select: { id: true, name: true } },
        assignedHostUser: { select: { id: true, name: true, address: true } },
      },
    });

    res.json({ success: true, assignments: responses });
  })
);

// GET /api/assignment/:id – Get current assignment for a meeting (group members only)
router.get(
  '/:id',
  requireAuth,
  validateParams(idParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: meetingId } = typedParams(req, idParamSchema);

    // Check group membership
    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) {
      throw new AppError('Meeting not found', 404, 'MEETING_NOT_FOUND');
    }
    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: meeting.groupId, userId: req.userId! } },
    });
    if (!membership) {
      throw new AppError('Not a member of this group', 403, 'FORBIDDEN');
    }

    const responses = await prisma.response.findMany({
      where: { meetingId },
      include: {
        user: { select: { id: true, name: true, diet: true, address: true, maxGuests: true } },
        assignedHostUser: { select: { id: true, name: true, address: true } },
      },
    });

    // Group by host
    const hostGroups: Record<
      number,
      { host: (typeof responses)[0]['assignedHostUser']; guests: typeof responses }
    > = {};
    const unassigned: typeof responses = [];

    for (const r of responses) {
      if (r.assignedHost === null) {
        unassigned.push(r);
      } else if (r.assignedHost === r.userId) {
        if (!hostGroups[r.userId]) {
          hostGroups[r.userId] = { host: r.assignedHostUser, guests: [] };
        }
      } else {
        if (!hostGroups[r.assignedHost]) {
          const hostResponse = responses.find((rr) => rr.userId === r.assignedHost);
          hostGroups[r.assignedHost] = {
            host: hostResponse?.assignedHostUser || r.assignedHostUser,
            guests: [],
          };
        }
        hostGroups[r.assignedHost].guests.push(r);
      }
    }

    res.json({ meetingId, hostGroups, unassigned });
  })
);

// PUT /api/assignment/:id – Manual assignment override (group admin only, before freeze)
router.put(
  '/:id',
  requireAuth,
  requireMeetingGroupAdmin,
  validateParams(idParamSchema),
  validateBody(manualAssignmentBodySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: meetingId } = typedParams(req, idParamSchema);

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) {
      throw new AppError('Meeting not found', 404, 'MEETING_NOT_FOUND');
    }
    if (meeting.frozen) {
      throw new AppError('Meeting is frozen, cannot change assignment', 403, 'MEETING_FROZEN');
    }

    const { assignments } = req.body;

    await prisma.$transaction(
      assignments.map((a: { userId: number; assignedHost: number | null }) =>
        prisma.response.updateMany({
          where: { meetingId, userId: a.userId },
          data: { assignedHost: a.assignedHost },
        })
      )
    );

    res.json({ success: true });
  })
);

export default router;
