import { Response, NextFunction } from 'express';
import prisma from '../db.js';
import { AuthRequest } from './auth.js';

function getParam(params: Record<string, string | string[]>, name: string): string | undefined {
  const value = params[name];
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Checks that the authenticated user is an admin of the group specified by :groupId param.
 * Super-admins bypass this check.
 */
export async function requireGroupAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const groupId = parseInt(getParam(req.params, 'groupId') || getParam(req.params, 'id') || '', 10);
  if (isNaN(groupId)) {
    res.status(400).json({ error: 'Invalid group id' });
    return;
  }
  if (!req.userId) {
    res.status(401).json({ error: 'Authorization required' });
    return;
  }
  // Super-admins bypass group checks
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { isSuperAdmin: true },
  });
  if (user?.isSuperAdmin) {
    next();
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
 * Super-admins bypass this check.
 */
export async function requireGroupMember(req: AuthRequest, res: Response, next: NextFunction) {
  const groupId = parseInt(getParam(req.params, 'groupId') || getParam(req.params, 'id') || '', 10);
  if (isNaN(groupId)) {
    res.status(400).json({ error: 'Invalid group id' });
    return;
  }
  if (!req.userId) {
    res.status(401).json({ error: 'Authorization required' });
    return;
  }
  // Super-admins bypass group checks
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { isSuperAdmin: true },
  });
  if (user?.isSuperAdmin) {
    next();
    return;
  }
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: req.userId } },
  });
  if (!membership) {
    res.status(403).json({ error: 'Not a member of this group' });
    return;
  }
  // Attach role so downstream handlers can use it
  req.userRole = membership.role;
  next();
}

/**
 * Checks that the authenticated user is an admin of the group that a meeting belongs to.
 * The meeting is specified by :id param (meeting id).
 * Super-admins bypass this check.
 */
export async function requireMeetingGroupAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const meetingId = parseInt(getParam(req.params, 'id') || '', 10);
  if (isNaN(meetingId)) {
    res.status(400).json({ error: 'Invalid meeting id' });
    return;
  }
  if (!req.userId) {
    res.status(401).json({ error: 'Authorization required' });
    return;
  }
  // Super-admins bypass group checks
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { isSuperAdmin: true },
  });
  if (user?.isSuperAdmin) {
    next();
    return;
  }
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { groupId: true },
  });
  if (!meeting) {
    res.status(404).json({ error: 'Meeting not found' });
    return;
  }
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: meeting.groupId, userId: req.userId } },
  });
  if (!membership || membership.role !== 'admin') {
    res.status(403).json({ error: 'Group admin access required for this action' });
    return;
  }
  next();
}

/**
 * Checks that the authenticated user is an admin of at least one group.
 * Super-admins bypass this check.
 */
export async function requireAnyGroupAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userId) {
    res.status(401).json({ error: 'Authorization required' });
    return;
  }
  // Super-admins bypass group checks
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { isSuperAdmin: true },
  });
  if (user?.isSuperAdmin) {
    next();
    return;
  }
  const adminMembership = await prisma.groupMember.findFirst({
    where: { userId: req.userId, role: 'admin' },
  });
  if (!adminMembership) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
