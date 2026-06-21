import { Router, Response } from 'express';
import prisma from '../db.js';
import { requireAuth, requireSuperAdmin, AuthRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

function getParam(params: Record<string, string | string[]>, name: string): string | undefined {
  const value = params[name];
  if (Array.isArray(value)) return value[0];
  return value;
}

const router = Router();

// POST /api/feature-requests - Create a new feature request or bug report
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { type, title, description } = req.body;

    if (!type || !title || !description) {
      res.status(400).json({ error: 'type, title and description are required' });
      return;
    }

    if (!['bug', 'feature'].includes(type)) {
      res.status(400).json({ error: 'type must be "bug" or "feature"' });
      return;
    }

    const request = await prisma.featureRequest.create({
      data: {
        userId: req.userId!,
        type,
        title,
        description,
      },
    });

    res.status(201).json(request);
  } catch (err) {
    logger.error('Create feature request error', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Failed to create feature request' });
  }
});

// GET /api/feature-requests - List all feature requests (Super-Admin only)
router.get('/', requireAuth, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { status, type } = req.query;

    const where: { status?: string; type?: string } = {};
    if (status && (typeof status === 'string' || Array.isArray(status))) where.status = Array.isArray(status) ? status[0] : status;
    if (type && (typeof type === 'string' || Array.isArray(type))) where.type = Array.isArray(type) ? type[0] : type;

    const requests = await prisma.featureRequest.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(requests);
  } catch (err) {
    logger.error('List feature requests error', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Failed to list feature requests' });
  }
});

// GET /api/feature-requests/my - Get current user's own requests
router.get('/my', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const requests = await prisma.featureRequest.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json(requests);
  } catch (err) {
    logger.error('My feature requests error', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Failed to get feature requests' });
  }
});

// PATCH /api/feature-requests/:id - Update status/priority (Super-Admin only)
router.patch('/:id', requireAuth, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(getParam(req.params, 'id') || '', 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }

    const { status, priority } = req.body;

    if (status !== undefined && !['open', 'in_progress', 'done', 'rejected'].includes(status)) {
      res.status(400).json({ error: 'Invalid status. Must be: open, in_progress, done, rejected' });
      return;
    }

    if (priority !== undefined && !['low', 'medium', 'high'].includes(priority)) {
      res.status(400).json({ error: 'Invalid priority. Must be: low, medium, high' });
      return;
    }

    const existing = await prisma.featureRequest.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Feature request not found' });
      return;
    }

    const updated = await prisma.featureRequest.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority }),
      },
    });

    res.json(updated);
  } catch (err) {
    logger.error('Update feature request error', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Failed to update feature request' });
  }
});

// DELETE /api/feature-requests/:id - Delete a feature request
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(getParam(req.params, 'id') || '', 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }

    const existing = await prisma.featureRequest.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Feature request not found' });
      return;
    }

    // Check if user is the owner or a super admin
    if (existing.userId !== req.userId) {
      const user = await prisma.user.findUnique({
        where: { id: req.userId! },
        select: { isSuperAdmin: true },
      });
      if (!user?.isSuperAdmin) {
        res.status(403).json({ error: 'Only the author or a Super-Admin can delete this request' });
        return;
      }
    }

    await prisma.featureRequest.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    logger.error('Delete feature request error', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Failed to delete feature request' });
  }
});

export default router;
