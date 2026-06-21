import { Router, Response } from 'express';
import prisma from '../db.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { joinGroupByInviteCode, joinGroupByInvitationCode } from '../services/groups.js';
import { logger } from '../utils/logger.js';

const router = Router();

// GET /api/join/:code – Group info before joining
router.get('/:code', async (req: AuthRequest, res: Response) => {
  try {
    const code = req.params.code;

    // Try invitation code first
    const invitation = await prisma.groupInvitation.findUnique({
      where: { code },
      include: { group: true },
    });
    if (invitation) {
      // Check if expired
      if (invitation.expiresAt && invitation.expiresAt < new Date()) {
        res.status(410).json({ error: 'Invitation code has expired' });
        return;
      }
      if (invitation.maxUses !== null && invitation.usedCount >= invitation.maxUses) {
        res.status(410).json({ error: 'Invitation code has reached its usage limit' });
        return;
      }
      res.json({
        type: 'invitation',
        group: {
          id: invitation.group.id,
          name: invitation.group.name,
          description: invitation.group.description,
        },
      });
      return;
    }

    // Try permanent invite code
    const group = await prisma.group.findUnique({ where: { inviteCode: code } });
    if (group) {
      res.json({
        type: 'invite',
        group: { id: group.id, name: group.name, description: group.description },
      });
      return;
    }

    res.status(404).json({ error: 'Invalid code' });
  } catch (err) {
    logger.error('Join lookup error', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Failed to look up code' });
  }
});

// POST /api/join/:code – Join group
router.post('/:code', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const code = req.params.code;
    const userId = req.userId!;

    // Try invitation code first
    const invitation = await prisma.groupInvitation.findUnique({ where: { code } });
    if (invitation) {
      const result = await joinGroupByInvitationCode(code, userId);
      if (result.success) {
        res.json({ success: true, groupId: result.groupId });
      } else {
        res.status(400).json({ error: result.error });
      }
      return;
    }

    // Try permanent invite code
    const result = await joinGroupByInviteCode(code, userId);
    if (result.success) {
      res.json({ success: true, groupId: result.groupId });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (err) {
    logger.error('Join error', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Failed to join group' });
  }
});

export default router;
