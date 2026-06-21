import prisma from '../db.js';

/**
 * RSVP-Token Cleanup (täglich 03:00)
 * Räumt abgelaufene und verbrauchte Tokens auf.
 */
export async function cleanupRsvpTokens(): Promise<void> {
  const now = new Date();

  // Delete expired tokens
  const expired = await prisma.rsvpToken.deleteMany({
    where: {
      expiresAt: {
        lte: now,
      },
    },
  });

  // Delete used tokens older than 30 days (keep recent ones for audit)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const oldUsed = await prisma.rsvpToken.deleteMany({
    where: {
      used: true,
      createdAt: {
        lte: thirtyDaysAgo,
      },
    },
  });

  console.log(
    `[TokenCleanup] Deleted ${expired.count} expired tokens, ${oldUsed.count} old used tokens`
  );

  // Clean up password reset tokens
  const expiredPw = await prisma.passwordResetToken.deleteMany({
    where: {
      expiresAt: {
        lte: now,
      },
    },
  });

  const oldUsedPw = await prisma.passwordResetToken.deleteMany({
    where: {
      used: true,
      createdAt: {
        lte: thirtyDaysAgo,
      },
    },
  });

  console.log(
    `[TokenCleanup] Deleted ${expiredPw.count} expired password reset tokens, ${oldUsedPw.count} old used password reset tokens`
  );
}
