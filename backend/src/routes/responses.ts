import { Router, Response } from 'express';
import prisma from '../db.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateBody, validateParams, typedParams } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import { assignHosts } from '../services/assignment.js';
import { idParamSchema, responseBodySchema } from '../validation/schemas.js';

const router = Router();

// GET /api/meetings/:id/responses – All responses for a meeting
router.get(
  '/:id/responses',
  requireAuth,
  validateParams(idParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: meetingId } = typedParams(req, idParamSchema);
    const responses = await prisma.response.findMany({
      where: { meetingId },
      include: {
        user: { select: { id: true, name: true, diet: true, address: true, maxGuests: true } },
        assignedHostUser: { select: { id: true, name: true, address: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(responses);
  })
);

// POST /api/meetings/:id/responses – Create response (logged-in user)
router.post(
  '/:id/responses',
  requireAuth,
  validateParams(idParamSchema),
  validateBody(responseBodySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: meetingId } = typedParams(req, idParamSchema);
    const { hostWish } = req.body;

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) {
      throw new AppError('Meeting not found', 404, 'MEETING_NOT_FOUND');
    }
    if (meeting.frozen) {
      throw new AppError('Meeting is frozen', 403, 'MEETING_FROZEN');
    }
    if (meeting.deadline < new Date()) {
      throw new AppError('Deadline has passed', 403, 'DEADLINE_PASSED');
    }

    const existing = await prisma.response.findUnique({
      where: { meetingId_userId: { meetingId, userId: req.userId! } },
    });
    if (existing) {
      throw new AppError('Already responded', 409, 'ALREADY_RESPONDED');
    }

    const response = await prisma.response.create({
      data: { meetingId, userId: req.userId!, hostWish },
    });

    // Run assignment algorithm
    await assignHosts(meetingId);

    res.status(201).json(response);
  })
);

// PUT /api/meetings/:id/responses/me – Update own response
router.put(
  '/:id/responses/me',
  requireAuth,
  validateParams(idParamSchema),
  validateBody(responseBodySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: meetingId } = typedParams(req, idParamSchema);
    const { hostWish } = req.body;

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) {
      throw new AppError('Meeting not found', 404, 'MEETING_NOT_FOUND');
    }
    if (meeting.frozen) {
      throw new AppError('Meeting is frozen', 403, 'MEETING_FROZEN');
    }
    if (meeting.deadline < new Date()) {
      throw new AppError('Deadline has passed', 403, 'DEADLINE_PASSED');
    }

    const existing = await prisma.response.findUnique({
      where: { meetingId_userId: { meetingId, userId: req.userId! } },
    });
    if (!existing) {
      throw new AppError('No response found', 404, 'RESPONSE_NOT_FOUND');
    }

    const updated = await prisma.response.update({
      where: { id: existing.id },
      data: { hostWish },
    });

    await assignHosts(meetingId);

    res.json(updated);
  })
);

// DELETE /api/meetings/:id/responses/me – Withdraw own response
router.delete(
  '/:id/responses/me',
  requireAuth,
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

    const existing = await prisma.response.findUnique({
      where: { meetingId_userId: { meetingId, userId: req.userId! } },
    });
    if (!existing) {
      throw new AppError('No response found', 404, 'RESPONSE_NOT_FOUND');
    }

    await prisma.response.delete({ where: { id: existing.id } });

    await assignHosts(meetingId);

    res.json({ success: true });
  })
);

export default router;
