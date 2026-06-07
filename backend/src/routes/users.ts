import { Router, Response } from 'express';
import prisma from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { requireAnyGroupAdmin } from '../middleware/groupAuth';
import bcrypt from 'bcryptjs';

const router = Router();

// GET /api/users - All users (any group admin)
router.get('/', requireAuth, requireAnyGroupAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, name: true, email: true, address: true,
        maxGuests: true, notes: true, diet: true, isGuest: true, createdAt: true,
        scores: true,
      },
      orderBy: { id: 'asc' },
    });
    res.json(users);
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// GET /api/users/:id
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, address: true,
        maxGuests: true, notes: true, diet: true, isGuest: true, createdAt: true,
        scores: true,
        groupMembers: { include: { group: true } },
      },
    });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(user);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// PUT /api/users/:id - Edit user (own profile or admin)
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

    // Only allow editing own profile (TODO: add admin check)
    if (req.userId !== id) {
      res.status(403).json({ error: 'Can only edit your own profile' });
      return;
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
        id: true, name: true, email: true, address: true,
        maxGuests: true, notes: true, diet: true, isGuest: true,
      },
    });
    res.json(user);
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /api/users/:id - Delete own account
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

    // Only allow deleting own profile
    if (req.userId !== id) {
      res.status(403).json({ error: 'Can only delete your own account' });
      return;
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
      const otherMembers = membership.group.members.filter(m => m.userId !== id);

      if (otherMembers.length === 0) {
        // User is the only member - delete the entire group
        await prisma.group.delete({ where: { id: membership.groupId } });
      } else {
        // Promote the longest-standing member to admin
        const oldestMember = otherMembers.reduce((a, b) =>
          a.joinedAt < b.joinedAt ? a : b
        );
        await prisma.groupMember.update({
          where: { id: oldestMember.id },
          data: { role: 'admin' },
        });
      }
    }

    await prisma.user.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// POST /api/users/:id/convert - Guest to regular user
router.post('/:id/convert', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

    if (req.userId !== id) {
      res.status(403).json({ error: 'Can only convert your own account' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    if (!user.isGuest) { res.status(400).json({ error: 'User is not a guest' }); return; }

    const { password, address, maxGuests } = req.body;
    if (!password) { res.status(400).json({ error: 'password is required' }); return; }

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

    // Create score entry
    await prisma.score.upsert({
      where: { userId: id },
      update: {},
      create: { userId: id },
    });

    const { generateToken } = await import('../middleware/auth');
    const token = generateToken(id);
    res.json({ id: updated.id, name: updated.name, email: updated.email, token });
  } catch (err) {
    console.error('Convert user error:', err);
    res.status(500).json({ error: 'Failed to convert user' });
  }
});

export default router;