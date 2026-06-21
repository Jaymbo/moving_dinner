import { Router, Response } from 'express';
import prisma from '../db.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireGroupMember, requireMeetingGroupAdmin } from '../middleware/groupAuth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateBody, validateParams, validateQuery, typedParams } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import { generateRsvpTokens } from '../services/rsvp.js';
import { notifyGroupNewMeeting } from '../services/email.js';
import {
  idParamSchema,
  createMeetingBodySchema,
  updateMeetingBodySchema,
  meetingQuerySchema,
} from '../validation/schemas.js';

const router = Router();

// GET /api/meetings – Meetings for user's groups (optional ?group_id=X filter)
// Super-admins see all meetings across all groups
router.get(
  '/',
  requireAuth,
  validateQuery(meetingQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { group_id: groupId } = req.query as { group_id?: number };

    // Check if user is super-admin
    const currentUser = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { isSuperAdmin: true },
    });

    if (currentUser?.isSuperAdmin) {
      const where = groupId ? { groupId } : {};

      const meetings = await prisma.meeting.findMany({
        where,
        include: {
          group: { select: { id: true, name: true, meetingCreation: true } },
          _count: { select: { responses: true, rsvpTokens: true } },
        },
        orderBy: { date: 'asc' },
      });

      // Super-admins get 'admin' role for all groups
      const result = meetings.map((m) => ({
        ...m,
        userRole: 'admin' as const,
      }));

      res.json(result);
      return;
    }

    const memberships = await prisma.groupMember.findMany({
      where: { userId: req.userId },
      select: { groupId: true, role: true },
    });
    const groupIds = memberships.map((m) => m.groupId);
    const roleMap = new Map(memberships.map((m) => [m.groupId, m.role]));

    if (groupId && !groupIds.includes(groupId)) {
      throw new AppError('Not a member of this group', 403, 'FORBIDDEN');
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

    const result = meetings.map((m) => ({
      ...m,
      userRole: roleMap.get(m.groupId) || 'member',
    }));

    res.json(result);
  })
);

// GET /api/meetings/my – My open meetings across all groups
// Super-admins see all open meetings with 'admin' role
router.get(
  '/my',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Check if user is super-admin
    const currentUser = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { isSuperAdmin: true },
    });

    if (currentUser?.isSuperAdmin) {
      const meetings = await prisma.meeting.findMany({
        where: { frozen: false },
        include: {
          group: { select: { id: true, name: true, meetingCreation: true } },
          responses: { where: { userId: req.userId } },
          _count: { select: { responses: true } },
        },
        orderBy: { date: 'asc' },
      });

      const result = meetings.map((m) => ({
        ...m,
        hasResponded: m.responses.length > 0,
        response: m.responses[0] || null,
        totalResponses: m._count.responses,
        userRole: 'admin' as const,
      }));

      res.json(result);
      return;
    }

    const memberships = await prisma.groupMember.findMany({
      where: { userId: req.userId },
      select: { groupId: true, role: true },
    });
    const groupIds = memberships.map((m) => m.groupId);
    const roleMap = new Map(memberships.map((m) => [m.groupId, m.role]));

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

    const result = meetings.map((m) => ({
      ...m,
      hasResponded: m.responses.length > 0,
      response: m.responses[0] || null,
      totalResponses: m._count.responses,
      userRole: roleMap.get(m.groupId) || 'member',
    }));

    res.json(result);
  })
);

// GET /api/meetings/group/:id – All meetings for a group
router.get(
  '/group/:id',
  requireAuth,
  requireGroupMember,
  validateParams(idParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: groupId } = typedParams(req, idParamSchema);
    const meetings = await prisma.meeting.findMany({
      where: { groupId },
      include: {
        _count: { select: { responses: true } },
      },
      orderBy: { date: 'asc' },
    });
    res.json(meetings);
  })
);

// POST /api/meetings/group/:id – Create meeting
// Permission depends on group's meetingCreation setting: 'admin' or 'all'
// Super-admins can always create meetings
router.post(
  '/group/:id',
  requireAuth,
  validateParams(idParamSchema),
  validateBody(createMeetingBodySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: groupId } = typedParams(req, idParamSchema);
    const { date: meetingDate, deadline: meetingDeadline } = req.body;

    // Check if user is super-admin
    const currentUser = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { isSuperAdmin: true },
    });

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      throw new AppError('Group not found', 404, 'GROUP_NOT_FOUND');
    }

    if (!currentUser?.isSuperAdmin) {
      const membership = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: req.userId! } },
      });
      if (!membership) {
        throw new AppError('Not a member of this group', 403, 'FORBIDDEN');
      }

      if (group.meetingCreation === 'admin' && membership.role !== 'admin') {
        throw new AppError(
          'Nur Admins dürfen in dieser Gruppe Treffen erstellen',
          403,
          'FORBIDDEN'
        );
      }
    }

    if (meetingDeadline >= meetingDate) {
      throw new AppError('Deadline must be before the meeting date', 400, 'INVALID_DEADLINE');
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

    notifyGroupNewMeeting(groupId, meeting.id, meetingDate, meetingDeadline).catch((err) =>
      console.error('Failed to send meeting notifications:', err)
    );

    res.status(201).json(meeting);
  })
);

// GET /api/meetings/:id – Get meeting details (group members or super-admins)
router.get(
  '/:id',
  requireAuth,
  validateParams(idParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = typedParams(req, idParamSchema);

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: {
        group: { select: { id: true, name: true, meetingCreation: true } },
        responses: {
          include: { user: { select: { id: true, name: true, diet: true, address: true } } },
        },
      },
    });
    if (!meeting) {
      throw new AppError('Meeting not found', 404, 'MEETING_NOT_FOUND');
    }

    // Check if user is super-admin
    const currentUser = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { isSuperAdmin: true },
    });

    if (currentUser?.isSuperAdmin) {
      res.json({ ...meeting, userRole: 'admin' });
      return;
    }

    // Check membership
    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: meeting.groupId, userId: req.userId! } },
    });
    if (!membership) {
      throw new AppError('Not a member of this group', 403, 'FORBIDDEN');
    }

    res.json({ ...meeting, userRole: membership.role });
  })
);

// PUT /api/meetings/:id – Edit meeting (group admin only)
router.put(
  '/:id',
  requireAuth,
  requireMeetingGroupAdmin,
  validateParams(idParamSchema),
  validateBody(updateMeetingBodySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = typedParams(req, idParamSchema);
    const { date, deadline } = req.body;

    const meeting = await prisma.meeting.findUnique({ where: { id } });
    if (!meeting) {
      throw new AppError('Meeting not found', 404, 'MEETING_NOT_FOUND');
    }
    if (meeting.frozen) {
      throw new AppError('Meeting is frozen', 403, 'MEETING_FROZEN');
    }

    const updated = await prisma.meeting.update({
      where: { id },
      data: {
        ...(date !== undefined && { date }),
        ...(deadline !== undefined && { deadline }),
      },
    });
    res.json(updated);
  })
);

// DELETE /api/meetings/:id (group admin only)
router.delete(
  '/:id',
  requireAuth,
  requireMeetingGroupAdmin,
  validateParams(idParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = typedParams(req, idParamSchema);

    const meeting = await prisma.meeting.findUnique({ where: { id } });
    if (!meeting) {
      throw new AppError('Meeting not found', 404, 'MEETING_NOT_FOUND');
    }
    if (meeting.frozen) {
      throw new AppError('Cannot delete frozen meeting', 403, 'MEETING_FROZEN');
    }

    await prisma.meeting.delete({ where: { id } });
    res.json({ success: true });
  })
);

export default router;
