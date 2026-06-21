import { Router, Response } from 'express';
import prisma from '../db.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireGroupAdmin, requireGroupMember } from '../middleware/groupAuth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateBody, validateParams, typedParams } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import { recalculateScoresForGroup } from '../services/scoring.js';
import { recalculateMatrixForGroup } from '../services/matrix.js';
import { randomBytes } from 'crypto';
import {
  idParamSchema,
  userIdParamSchema,
  createGroupBodySchema,
  updateGroupBodySchema,
  addGroupMemberBodySchema,
  updateGroupMemberRoleBodySchema,
  createInvitationBodySchema,
} from '../validation/schemas.js';

const router = Router();

function generateCode(prefix: string): string {
  const rand = randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${rand.slice(0, 6)}`;
}

// GET /api/groups – list groups the current user is a member of
// Super-admins see all groups
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { isSuperAdmin: true },
    });

    if (currentUser?.isSuperAdmin) {
      const groups = await prisma.group.findMany({
        include: {
          _count: { select: { members: true, meetings: true } },
        },
        orderBy: { id: 'asc' },
      });
      res.json(groups.map((g) => ({ ...g, role: 'admin' })));
      return;
    }

    const memberships = await prisma.groupMember.findMany({
      where: { userId: req.userId },
      include: { group: { include: { _count: { select: { members: true, meetings: true } } } } },
    });
    res.json(memberships.map((m) => ({ ...m.group, role: m.role })));
  })
);

// GET /api/groups/my – alias for current user's groups
router.get(
  '/my',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { isSuperAdmin: true },
    });

    if (currentUser?.isSuperAdmin) {
      const groups = await prisma.group.findMany({
        include: {
          _count: { select: { members: true, meetings: true } },
        },
        orderBy: { id: 'asc' },
      });
      res.json(groups.map((g) => ({ ...g, role: 'admin' })));
      return;
    }

    const memberships = await prisma.groupMember.findMany({
      where: { userId: req.userId },
      include: { group: { include: { _count: { select: { members: true, meetings: true } } } } },
    });
    res.json(memberships.map((m) => ({ ...m.group, role: m.role })));
  })
);

// POST /api/groups – create a new group (creator becomes admin)
router.post(
  '/',
  requireAuth,
  validateBody(createGroupBodySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, description, meetingCreation } = req.body;

    const inviteCode = generateCode('GRP');
    const group = await prisma.group.create({
      data: {
        name,
        description,
        inviteCode,
        meetingCreation,
        createdBy: req.userId,
      },
    });

    await prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId: req.userId!,
        role: 'admin',
      },
    });

    res.status(201).json(group);
  })
);

// GET /api/groups/:id
router.get(
  '/:id',
  requireAuth,
  requireGroupMember,
  validateParams(idParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = typedParams(req, idParamSchema);
    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, isGuest: true, isSuperAdmin: true },
            },
          },
        },
        _count: { select: { members: true, meetings: true } },
      },
    });
    if (!group) {
      throw new AppError('Group not found', 404, 'GROUP_NOT_FOUND');
    }
    res.json(group);
  })
);

// PUT /api/groups/:id
router.put(
  '/:id',
  requireAuth,
  requireGroupAdmin,
  validateParams(idParamSchema),
  validateBody(updateGroupBodySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = typedParams(req, idParamSchema);
    const { name, description, meetingCreation } = req.body;

    const updated = await prisma.group.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(meetingCreation !== undefined && { meetingCreation }),
      },
    });
    res.json(updated);
  })
);

// DELETE /api/groups/:id
router.delete(
  '/:id',
  requireAuth,
  requireGroupAdmin,
  validateParams(idParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = typedParams(req, idParamSchema);
    await prisma.group.delete({ where: { id } });
    res.json({ success: true });
  })
);

// POST /api/groups/:id/leave
router.post(
  '/:id/leave',
  requireAuth,
  requireGroupMember,
  validateParams(idParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = typedParams(req, idParamSchema);
    await prisma.groupMember.delete({
      where: { groupId_userId: { groupId: id, userId: req.userId! } },
    });

    // If user was the last admin, promote oldest remaining member
    const remainingAdmins = await prisma.groupMember.findMany({
      where: { groupId: id, role: 'admin' },
    });
    if (remainingAdmins.length === 0) {
      const oldestMember = await prisma.groupMember.findFirst({
        where: { groupId: id },
        orderBy: { joinedAt: 'asc' },
      });
      if (oldestMember) {
        await prisma.groupMember.update({
          where: { id: oldestMember.id },
          data: { role: 'admin' },
        });
      } else {
        // No members left, delete group
        await prisma.group.delete({ where: { id } });
      }
    }

    res.json({ success: true });
  })
);

// GET /api/groups/:id/members
router.get(
  '/:id/members',
  requireAuth,
  requireGroupMember,
  validateParams(idParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: groupId } = typedParams(req, idParamSchema);
    const members = await prisma.groupMember.findMany({
      where: { groupId },
      include: {
        user: {
          select: { id: true, name: true, email: true, isGuest: true, isSuperAdmin: true },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
    res.json(members);
  })
);

// POST /api/groups/:id/members
router.post(
  '/:id/members',
  requireAuth,
  requireGroupAdmin,
  validateParams(idParamSchema),
  validateBody(addGroupMemberBodySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: groupId } = typedParams(req, idParamSchema);
    const { userId, role } = req.body;

    const membership = await prisma.groupMember.create({
      data: { groupId, userId, role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    res.status(201).json(membership);
  })
);

// DELETE /api/groups/:id/members/:userId
router.delete(
  '/:id/members/:userId',
  requireAuth,
  requireGroupAdmin,
  validateParams(userIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: groupId, userId } = typedParams(req, userIdParamSchema);
    await prisma.groupMember.delete({
      where: { groupId_userId: { groupId, userId } },
    });
    res.json({ success: true });
  })
);

// PUT /api/groups/:id/members/:userId/role
router.put(
  '/:id/members/:userId/role',
  requireAuth,
  requireGroupAdmin,
  validateParams(userIdParamSchema),
  validateBody(updateGroupMemberRoleBodySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: groupId, userId } = typedParams(req, userIdParamSchema);
    const { role } = req.body;

    const updated = await prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId } },
      data: { role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    res.json(updated);
  })
);

// GET /api/groups/:id/invitations
router.get(
  '/:id/invitations',
  requireAuth,
  requireGroupAdmin,
  validateParams(idParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: groupId } = typedParams(req, idParamSchema);
    const invitations = await prisma.groupInvitation.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(invitations);
  })
);

// POST /api/groups/:id/invitations
router.post(
  '/:id/invitations',
  requireAuth,
  requireGroupAdmin,
  validateParams(idParamSchema),
  validateBody(createInvitationBodySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: groupId } = typedParams(req, idParamSchema);
    const { maxUses, expiresAt } = req.body;

    const code = generateCode('JOIN');
    const invitation = await prisma.groupInvitation.create({
      data: { groupId, code, maxUses, expiresAt },
    });
    res.status(201).json(invitation);
  })
);

// GET /api/groups/:id/scores
router.get(
  '/:id/scores',
  requireAuth,
  requireGroupMember,
  validateParams(idParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: groupId } = typedParams(req, idParamSchema);
    const scores = await prisma.score.findMany({
      where: { groupId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            maxGuests: true,
            isGuest: true,
            isSuperAdmin: true,
          },
        },
      },
      orderBy: { score: 'asc' },
    });
    res.json(scores);
  })
);

// GET /api/groups/:id/matrix
router.get(
  '/:id/matrix',
  requireAuth,
  requireGroupMember,
  validateParams(idParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: groupId } = typedParams(req, idParamSchema);
    const matrix = await prisma.meetupMatrix.findMany({
      where: { groupId },
      include: {
        userA: { select: { id: true, name: true } },
        userB: { select: { id: true, name: true } },
      },
      orderBy: { count: 'desc' },
    });
    res.json(matrix);
  })
);

// POST /api/groups/:id/recalculate
router.post(
  '/:id/recalculate',
  requireAuth,
  requireGroupAdmin,
  validateParams(idParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: groupId } = typedParams(req, idParamSchema);
    await recalculateScoresForGroup(groupId);
    await recalculateMatrixForGroup(groupId);
    res.json({ success: true });
  })
);

export default router;
