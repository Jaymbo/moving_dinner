import { Router, Response } from 'express';
import prisma from '../db.js';
import { requireAuth, requireSuperAdmin, AuthRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateBody, validateParams, typedParams } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import bcrypt from 'bcryptjs';
import {
  idParamSchema,
  updateUserBodySchema,
  convertUserBodySchema,
  toggleSuperAdminBodySchema,
} from '../validation/schemas.js';

const router = Router();

// GET /api/users - All users (Super-Admin only)
router.get(
  '/',
  requireAuth,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        address: true,
        maxGuests: true,
        notes: true,
        diet: true,
        isGuest: true,
        isSuperAdmin: true,
        createdAt: true,
      },
      orderBy: { id: 'asc' },
    });
    res.json(users);
  })
);

// GET /api/users/:id
router.get(
  '/:id',
  requireAuth,
  validateParams(idParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = typedParams(req, idParamSchema);

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        address: true,
        maxGuests: true,
        notes: true,
        diet: true,
        isGuest: true,
        isSuperAdmin: true,
        createdAt: true,
        groupMembers: { include: { group: true } },
      },
    });
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    res.json(user);
  })
);

// PUT /api/users/:id - Edit user (own profile, group admin, or super-admin)
router.put(
  '/:id',
  requireAuth,
  validateParams(idParamSchema),
  validateBody(updateUserBodySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = typedParams(req, idParamSchema);

    // Allow editing own profile, or if user is a group admin / super-admin
    if (req.userId !== id) {
      const currentUser = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { isSuperAdmin: true },
      });
      if (!currentUser?.isSuperAdmin) {
        const adminMembership = await prisma.groupMember.findFirst({
          where: { userId: req.userId!, role: 'admin' },
        });
        if (!adminMembership) {
          throw new AppError('Can only edit your own profile', 403, 'FORBIDDEN');
        }
      }
    }

    const { name, address, maxGuests, notes, diet } = req.body;
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(address !== undefined && { address }),
        ...(maxGuests !== undefined && { maxGuests }),
        ...(notes !== undefined && { notes }),
        ...(diet !== undefined && { diet }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        address: true,
        maxGuests: true,
        notes: true,
        diet: true,
        isGuest: true,
        isSuperAdmin: true,
      },
    });
    res.json(user);
  })
);

// DELETE /api/users/:id - Delete account (own, or super-admin can delete any)
router.delete(
  '/:id',
  requireAuth,
  validateParams(idParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = typedParams(req, idParamSchema);

    // Only allow deleting own profile, unless super-admin
    if (req.userId !== id) {
      const currentUser = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { isSuperAdmin: true },
      });
      if (!currentUser?.isSuperAdmin) {
        throw new AppError('Can only delete your own account', 403, 'FORBIDDEN');
      }
    }

    // Before deleting, handle groups where user is the only admin
    const adminMemberships = await prisma.groupMember.findMany({
      where: { userId: id, role: 'admin' },
      include: {
        group: {
          include: { members: true },
        },
      },
    });

    for (const membership of adminMemberships) {
      const otherMembers = membership.group.members.filter((m) => m.userId !== id);

      if (otherMembers.length === 0) {
        // User is the only member - delete the entire group
        await prisma.group.delete({ where: { id: membership.groupId } });
      } else {
        // Promote the longest-standing member to admin
        const oldestMember = otherMembers.reduce((a, b) => (a.joinedAt < b.joinedAt ? a : b));
        await prisma.groupMember.update({
          where: { id: oldestMember.id },
          data: { role: 'admin' },
        });
      }
    }

    await prisma.user.delete({ where: { id } });
    res.json({ success: true });
  })
);

// POST /api/users/:id/convert - Guest to regular user
router.post(
  '/:id/convert',
  requireAuth,
  validateParams(idParamSchema),
  validateBody(convertUserBodySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = typedParams(req, idParamSchema);

    if (req.userId !== id) {
      throw new AppError('Can only convert your own account', 403, 'FORBIDDEN');
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    if (!user.isGuest) {
      throw new AppError('User is not a guest', 400, 'NOT_A_GUEST');
    }

    const { password, address, maxGuests } = req.body;

    const passwordHash = await bcrypt.hash(password, 10);
    const updated = await prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        isGuest: false,
        ...(address !== undefined && { address }),
        ...(maxGuests !== undefined && { maxGuests }),
      },
    });

    // Score entries are created per group when the user joins a group or when scores are recalculated.
    // No global score entry is created here anymore.

    const { generateToken } = await import('../middleware/auth.js');
    const token = generateToken(id);
    res.json({ id: updated.id, name: updated.name, email: updated.email, token });
  })
);

// PUT /api/users/:id/super-admin - Toggle super-admin status (Super-Admin only)
router.put(
  '/:id/super-admin',
  requireAuth,
  requireSuperAdmin,
  validateParams(idParamSchema),
  validateBody(toggleSuperAdminBodySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = typedParams(req, idParamSchema);
    const { isSuperAdmin } = req.body;

    // Prevent removing your own super-admin status
    if (req.userId === id && !isSuperAdmin) {
      throw new AppError('Cannot remove your own super-admin status', 400, 'INVALID_OPERATION');
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isSuperAdmin },
      select: { id: true, name: true, email: true, isSuperAdmin: true },
    });

    res.json(updated);
  })
);

export default router;
