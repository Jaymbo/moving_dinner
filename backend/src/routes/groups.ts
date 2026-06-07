import { Router, Response } from 'express';
import prisma from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { requireGroupAdmin, requireGroupMember } from '../middleware/groupAuth';
import { createGroup, createInvitation } from '../services/groups';

const router = Router();

// GET /api/groups – All groups (admin)
router.get('/', requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const groups = await prisma.group.findMany({
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { meetings: true, members: true } },
      },
      orderBy: { id: 'asc' },
    });
    res.json(groups);
  } catch (err) {
    console.error('List groups error:', err);
    res.status(500).json({ error: 'Failed to list groups' });
  }
});

// GET /api/groups/my – My groups
router.get('/my', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const memberships = await prisma.groupMember.findMany({
      where: { userId: req.userId },
      include: { group: { include: { _count: { select: { meetings: true, members: true } } } } },
    });
    res.json(memberships.map(m => ({ ...m.group, role: m.role })));
  } catch (err) {
    console.error('My groups error:', err);
    res.status(500).json({ error: 'Failed to get groups' });
  }
});

// GET /api/groups/:id
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true, isGuest: true } } } },
        _count: { select: { meetings: true } },
      },
    });
    if (!group) { res.status(404).json({ error: 'Group not found' }); return; }
    res.json(group);
  } catch (err) {
    console.error('Get group error:', err);
    res.status(500).json({ error: 'Failed to get group' });
  }
});

// POST /api/groups – Create group
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name) { res.status(400).json({ error: 'name is required' }); return; }

    const result = await createGroup(name, description || null, req.userId!);
    res.status(201).json({ id: result.id, inviteCode: result.inviteCode });
  } catch (err) {
    console.error('Create group error:', err);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// PUT /api/groups/:id – Edit group
router.put('/:id', requireAuth, requireGroupAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, description } = req.body;

    const group = await prisma.group.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
      },
    });
    res.json(group);
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

// GET /api/groups/:id/members
router.get('/:id/members', requireAuth, requireGroupMember, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const members = await prisma.groupMember.findMany({
      where: { groupId: id },
      include: { user: { select: { id: true, name: true, email: true, diet: true, isGuest: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    res.json(members);
  } catch (err) {
    console.error('List members error:', err);
    res.status(500).json({ error: 'Failed to list members' });
  }
});

// POST /api/groups/:id/members – Add member (admin)
router.post('/:id/members', requireAuth, requireGroupAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { userId, role } = req.body;
    if (!userId) { res.status(400).json({ error: 'userId is required' }); return; }

    const existing = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId } },
    });
    if (existing) { res.status(409).json({ error: 'Already a member' }); return; }

    const member = await prisma.groupMember.create({
      data: { groupId: id, userId, role: role || 'member' },
    });
    res.status(201).json(member);
  } catch (err) {
    console.error('Add member error:', err);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// DELETE /api/groups/:id/members/:uid – Remove member
router.delete('/:id/members/:uid', requireAuth, requireGroupAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const uid = parseInt(req.params.uid, 10);

    await prisma.groupMember.delete({
      where: { groupId_userId: { groupId: id, userId: uid } },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Remove member error:', err);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// POST /api/groups/:id/invitations – Create invitation code
router.post('/:id/invitations', requireAuth, requireGroupAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { maxUses, expiresAt } = req.body;

    const result = await createInvitation(id, maxUses, expiresAt ? new Date(expiresAt) : undefined);
    res.status(201).json({ code: result.code });
  } catch (err) {
    console.error('Create invitation error:', err);
    res.status(500).json({ error: 'Failed to create invitation' });
  }
});

// GET /api/groups/:id/invitations
router.get('/:id/invitations', requireAuth, requireGroupAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const invitations = await prisma.groupInvitation.findMany({
      where: { groupId: id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(invitations);
  } catch (err) {
    console.error('List invitations error:', err);
    res.status(500).json({ error: 'Failed to list invitations' });
  }
});

export default router;