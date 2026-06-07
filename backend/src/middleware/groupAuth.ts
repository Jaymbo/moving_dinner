import { Response, NextFunction } from 'express';
import prisma from '../db';
import { AuthRequest } from './auth';

/**
 * Checks that the authenticated user is an admin of the group specified by :groupId param.
 */
export async function requireGroupAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const groupId = parseInt(req.params.groupId || req.params.id, 10);
  if (isNaN(groupId)) {
    res.status(400).json({ error: 'Invalid group id' });
    return;
  }
  if (!req.userId) {
    res.status(401).json({ error: 'Authorization required' });
    return;
  }
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: req.userId } },
  });
  if (!membership || membership.role !== 'admin') {
    res.status(403).json({ error: 'Group admin access required' });
    return;
  }
  next();
}

/**
 * Checks that the authenticated user is a member of the group specified by :groupId param.
 */
export async function requireGroupMember(req: AuthRequest, res: Response, next: NextFunction) {
  const groupId = parseInt(req.params.groupId || req.params.id, 10);
  if (isNaN(groupId)) {
    res.status(400).json({ error: 'Invalid group id' });
    return;
  }
  if (!req.userId) {
    res.status(401).json({ error: 'Authorization required' });
    return;
  }
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: req.userId } },
  });
  if (!membership) {
    res.status(403).json({ error: 'Not a member of this group' });
    return;
  }
  next();
}