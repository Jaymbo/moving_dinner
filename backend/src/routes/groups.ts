import { Router, Response } from 'express';
import prisma from '../db.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireGroupAdmin, requireGroupMember } from '../middleware/groupAuth.js';
import { recalculateScoresForGroup } from '../services/scoring.js';
import { recalculateMatrixForGroup } from '../services/matrix.js';
import { randomBytes } from 'crypto';

const router = Router();

function generateCode(prefix: string): string {
  const rand = randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${rand.slice(0, 6)}`;
}

// GET /api/groups – list groups the current user is a member of
// Super-admins see all groups
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
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
  } catch (err) {
    console.error('List groups error:', err);
    res.status(500).json({ error: 'Failed to list groups' });
  }
});

// GET /api/groups/my – alias for current user's groups
router.get('/my', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
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
  } catch (err) {
    console.error('My groups error:', err);
    res.status(500).json({ error: 'Failed to list groups' });
  }
});

// POST /api/groups – create a new group (creator becomes admin)
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, meetingCreation } = req.body;
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const inviteCode = generateCode('GRP');
    const group = await prisma.group.create({
      data: {
        name,
        description: description || null,
        inviteCode,
        meetingCreation: meetingCreation === 'all' ? 'all' : 'admin',
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
  } catch (err) {
    console.error('Create group error:', err);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// GET /api/groups/:id
router.get('/:id', requireAuth, requireGroupMember, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
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
      res.status(404).json({ error: 'Group not found' });
      return;
    }
    res.json(group);
  } catch (err) {
    console.error('Get group error:', err);
    res.status(500).json({ error: 'Failed to get group' });
  }
});

// PUT /api/groups/:id
router.put('/:id', requireAuth, requireGroupAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, description, meetingCreation } = req.body;

    const updated = await prisma.group.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description: description || null }),
        ...(meetingCreation !== undefined && {
          meetingCreation: meetingCreation === 'all' ? 'all' : 'admin',
        }),
      },
    });
    res.json(updated);
  } catch (err) {
    console.error('Update group error:', err);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// DELETE /api/groups/:id
router.delete('/:id', requireAuth, requireGroupAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    await prisma.group.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete group error:', err);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// POST /api/groups/:id/leave
router.post(
  '/:id/leave',
  requireAuth,
  requireGroupMember,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
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
    } catch (err) {
      console.error('Leave group error:', err);
      res.status(500).json({ error: 'Failed to leave group' });
    }
  }
);

// GET /api/groups/:id/members
router.get(
  '/:id/members',
  requireAuth,
  requireGroupMember,
  async (req: AuthRequest, res: Response) => {
    try {
      const groupId = parseInt(req.params.id, 10);
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
    } catch (err) {
      console.error('List members error:', err);
      res.status(500).json({ error: 'Failed to list members' });
    }
  }
);

// POST /api/groups/:id/members
router.post(
  '/:id/members',
  requireAuth,
  requireGroupAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const groupId = parseInt(req.params.id, 10);
      const { userId, role } = req.body;
      if (!userId) {
        res.status(400).json({ error: 'userId is required' });
        return;
      }

      const membership = await prisma.groupMember.create({
        data: {
          groupId,
          userId: parseInt(userId, 10),
          role: role === 'admin' ? 'admin' : 'member',
        },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      res.status(201).json(membership);
    } catch (err) {
      console.error('Add member error:', err);
      res.status(500).json({ error: 'Failed to add member' });
    }
  }
);

// DELETE /api/groups/:id/members/:userId
router.delete(
  '/:id/members/:userId',
  requireAuth,
  requireGroupAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const groupId = parseInt(req.params.id, 10);
      const userId = parseInt(req.params.userId, 10);
      await prisma.groupMember.delete({
        where: { groupId_userId: { groupId, userId } },
      });
      res.json({ success: true });
    } catch (err) {
      console.error('Remove member error:', err);
      res.status(500).json({ error: 'Failed to remove member' });
    }
  }
);

// PUT /api/groups/:id/members/:userId/role
router.put(
  '/:id/members/:userId/role',
  requireAuth,
  requireGroupAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const groupId = parseInt(req.params.id, 10);
      const userId = parseInt(req.params.userId, 10);
      const { role } = req.body;
      if (!role || (role !== 'admin' && role !== 'member')) {
        res.status(400).json({ error: 'role must be admin or member' });
        return;
      }

      const updated = await prisma.groupMember.update({
        where: { groupId_userId: { groupId, userId } },
        data: { role },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      res.json(updated);
    } catch (err) {
      console.error('Change role error:', err);
      res.status(500).json({ error: 'Failed to change role' });
    }
  }
);

// GET /api/groups/:id/invitations
router.get(
  '/:id/invitations',
  requireAuth,
  requireGroupAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const groupId = parseInt(req.params.id, 10);
      const invitations = await prisma.groupInvitation.findMany({
        where: { groupId },
        orderBy: { createdAt: 'desc' },
      });
      res.json(invitations);
    } catch (err) {
      console.error('List invitations error:', err);
      res.status(500).json({ error: 'Failed to list invitations' });
    }
  }
);

// POST /api/groups/:id/invitations
router.post(
  '/:id/invitations',
  requireAuth,
  requireGroupAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const groupId = parseInt(req.params.id, 10);
      const { maxUses, expiresAt } = req.body;

      let expiresAtDate: Date | null = null;
      if (expiresAt) {
        expiresAtDate = new Date(expiresAt);
        if (isNaN(expiresAtDate.getTime())) {
          res.status(400).json({ error: 'Invalid expiresAt' });
          return;
        }
      }

      const code = generateCode('JOIN');
      const invitation = await prisma.groupInvitation.create({
        data: {
          groupId,
          code,
          maxUses: maxUses ? parseInt(maxUses, 10) : null,
          expiresAt: expiresAtDate,
        },
      });
      res.status(201).json(invitation);
    } catch (err) {
      console.error('Create invitation error:', err);
      res.status(500).json({ error: 'Failed to create invitation' });
    }
  }
);

// GET /api/groups/:id/scores
router.get(
  '/:id/scores',
  requireAuth,
  requireGroupMember,
  async (req: AuthRequest, res: Response) => {
    try {
      const groupId = parseInt(req.params.id, 10);
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
    } catch (err) {
      console.error('Get group scores error:', err);
      res.status(500).json({ error: 'Failed to get scores' });
    }
  }
);

// GET /api/groups/:id/matrix
router.get(
  '/:id/matrix',
  requireAuth,
  requireGroupMember,
  async (req: AuthRequest, res: Response) => {
    try {
      const groupId = parseInt(req.params.id, 10);
      const matrix = await prisma.meetupMatrix.findMany({
        where: { groupId },
        include: {
          userA: { select: { id: true, name: true } },
          userB: { select: { id: true, name: true } },
        },
        orderBy: { count: 'desc' },
      });
      res.json(matrix);
    } catch (err) {
      console.error('Get group matrix error:', err);
      res.status(500).json({ error: 'Failed to get matrix' });
    }
  }
);

// POST /api/groups/:id/recalculate
router.post(
  '/:id/recalculate',
  requireAuth,
  requireGroupAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const groupId = parseInt(req.params.id, 10);
      await recalculateScoresForGroup(groupId);
      await recalculateMatrixForGroup(groupId);
      res.json({ success: true });
    } catch (err) {
      console.error('Recalculate group error:', err);
      res.status(500).json({ error: 'Failed to recalculate' });
    }
  }
);

export default router;
