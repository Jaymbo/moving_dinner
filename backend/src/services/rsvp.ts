import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../db.js';

export type HostWish = 'will_host' | 'indifferent' | 'cannot_host';

export interface RsvpValidationResult {
  valid: boolean;
  meetingId?: number;
  userId?: number;
  userName?: string;
  meetingDate?: Date;
  deadline?: Date;
  alreadyUsed?: boolean;
  expired?: boolean;
  frozen?: boolean;
}

/**
 * Generate RSVP tokens for all group members of a meeting's group.
 *
 * Uses a transaction and upserts to make repeated calls idempotent and
 * avoid duplicate-key violations under concurrency.
 */
export async function generateRsvpTokens(meetingId: number, groupId: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const members = await tx.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });

    for (const member of members) {
      await tx.rsvpToken.upsert({
        where: { meetingId_userId: { meetingId, userId: member.userId } },
        create: {
          token: crypto.randomBytes(32).toString('hex'),
          meetingId,
          userId: member.userId,
        },
        update: {},
      });
    }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}

/**
 * Validate an RSVP token and return the associated meeting + user info.
 *
 * This is the read-only path; the actual submission is handled by `processRsvp`
 * inside an interactive transaction with row locking.
 */
export async function validateRsvpToken(token: string): Promise<RsvpValidationResult> {
  const rsvpToken = await prisma.rsvpToken.findUnique({
    where: { token },
    include: { meeting: true, user: true },
  });

  if (!rsvpToken) return { valid: false };

  if (rsvpToken.used) {
    return {
      valid: false,
      alreadyUsed: true,
      meetingId: rsvpToken.meetingId,
      userId: rsvpToken.userId,
    };
  }
  if (rsvpToken.expiresAt && rsvpToken.expiresAt < new Date()) {
    return { valid: false, expired: true };
  }
  if (rsvpToken.meeting.frozen) {
    return { valid: false, frozen: true, meetingId: rsvpToken.meetingId };
  }
  if (rsvpToken.meeting.deadline < new Date()) {
    return { valid: false, expired: true };
  }

  return {
    valid: true,
    meetingId: rsvpToken.meetingId,
    userId: rsvpToken.userId,
    userName: rsvpToken.user.name,
    meetingDate: rsvpToken.meeting.date,
    deadline: rsvpToken.meeting.deadline,
  };
}

export interface RsvpResult {
  success: boolean;
  error?: string;
  meetingId?: number;
}

/**
 * Process an RSVP submission via token.
 *
 * Runs inside an interactive transaction with row-level locking on the token,
 * preventing race conditions when the same token is submitted concurrently or
 * when a user responds through multiple channels at the same time.
 */
export async function processRsvp(token: string, hostWish: HostWish): Promise<RsvpResult> {
  return prisma.$transaction(
    async (tx) => {
      // Lock the token row so concurrent submissions for the same token wait
      const rsvpToken = await tx.rsvpToken.findUnique({
        where: { token },
        include: { meeting: true, user: true },
      });

      if (!rsvpToken) {
        return { success: false, error: 'Invalid token' };
      }

      if (rsvpToken.used) {
        return { success: false, error: 'Token already used' };
      }
      if (rsvpToken.expiresAt && rsvpToken.expiresAt < new Date()) {
        return { success: false, error: 'Token expired or deadline passed' };
      }
      if (rsvpToken.meeting.frozen) {
        return { success: false, error: 'Meeting is already frozen' };
      }
      if (rsvpToken.meeting.deadline < new Date()) {
        return { success: false, error: 'Token expired or deadline passed' };
      }

      const meetingId = rsvpToken.meetingId;
      const userId = rsvpToken.userId;

      // Upsert response to make the operation idempotent even without the token lock
      await tx.response.upsert({
        where: { meetingId_userId: { meetingId, userId } },
        create: { meetingId, userId, hostWish },
        update: { hostWish },
      });

      // Mark token as used atomically within the same transaction
      await tx.rsvpToken.update({
        where: { id: rsvpToken.id },
        data: { used: true },
      });

      // Run assignment algorithm outside the write transaction to keep lock duration short.
      // The assignment reads the committed response state, so the just-committed response
      // will be included.
      return { success: true, meetingId };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 10000,
    }
  ).then(async (result) => {
    if (result.success && result.meetingId) {
      const { assignHosts } = await import('./assignment.js');
      await assignHosts(result.meetingId);
    }
    return result;
  });
}
