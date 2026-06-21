import crypto from 'crypto';
import prisma from '../db.js';

/**
 * Generate RSVP tokens for all group members of a meeting's group.
 */
export async function generateRsvpTokens(meetingId: number, groupId: number): Promise<void> {
  // Get all group members
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    select: { userId: true },
  });

  // Generate a token for each member (skip if already exists)
  for (const member of members) {
    const existing = await prisma.rsvpToken.findUnique({
      where: { meetingId_userId: { meetingId, userId: member.userId } },
    });
    if (existing) continue;

    const token = crypto.randomBytes(32).toString('hex');
    await prisma.rsvpToken.create({
      data: {
        token,
        meetingId,
        userId: member.userId,
      },
    });
  }
}

/**
 * Validate an RSVP token and return the associated meeting + user info.
 */
export async function validateRsvpToken(token: string): Promise<{
  valid: boolean;
  meetingId?: number;
  userId?: number;
  userName?: string;
  meetingDate?: Date;
  deadline?: Date;
  alreadyUsed?: boolean;
  expired?: boolean;
  frozen?: boolean;
}> {
  const rsvpToken = await prisma.rsvpToken.findUnique({
    where: { token },
    include: {
      meeting: true,
      user: true,
    },
  });

  if (!rsvpToken) return { valid: false };

  if (rsvpToken.used)
    return {
      valid: false,
      alreadyUsed: true,
      meetingId: rsvpToken.meetingId,
      userId: rsvpToken.userId,
    };
  if (rsvpToken.expiresAt && rsvpToken.expiresAt < new Date())
    return { valid: false, expired: true };
  if (rsvpToken.meeting.frozen)
    return { valid: false, frozen: true, meetingId: rsvpToken.meetingId };
  if (rsvpToken.meeting.deadline < new Date()) return { valid: false, expired: true };

  return {
    valid: true,
    meetingId: rsvpToken.meetingId,
    userId: rsvpToken.userId,
    userName: rsvpToken.user.name,
    meetingDate: rsvpToken.meeting.date,
    deadline: rsvpToken.meeting.deadline,
  };
}

/**
 * Process an RSVP submission via token.
 */
export async function processRsvp(
  token: string,
  hostWish: 'will_host' | 'indifferent' | 'cannot_host'
): Promise<{ success: boolean; error?: string }> {
  const validation = await validateRsvpToken(token);
  if (!validation.valid) {
    if (validation.alreadyUsed) return { success: false, error: 'Token already used' };
    if (validation.expired) return { success: false, error: 'Token expired or deadline passed' };
    if (validation.frozen) return { success: false, error: 'Meeting is already frozen' };
    return { success: false, error: 'Invalid token' };
  }

  const meetingId = validation.meetingId!;
  const userId = validation.userId!;

  // Check if response already exists
  const existing = await prisma.response.findUnique({
    where: { meetingId_userId: { meetingId, userId } },
  });

  if (existing) {
    // Update existing response
    await prisma.response.update({
      where: { id: existing.id },
      data: { hostWish },
    });
  } else {
    // Create new response
    await prisma.response.create({
      data: { meetingId, userId, hostWish },
    });
  }

  // Mark token as used
  await prisma.rsvpToken.update({
    where: { token },
    data: { used: true },
  });

  // Run assignment algorithm
  const { assignHosts } = await import('./assignment');
  await assignHosts(meetingId);

  return { success: true };
}
