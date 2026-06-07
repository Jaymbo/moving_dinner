import crypto from 'crypto';
import prisma from '../db';

/**
 * Generate a unique invite code for a group.
 */
export function generateInviteCode(): string {
  return 'GRP-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

/**
 * Generate a unique join code for an invitation.
 */
export function generateJoinCode(): string {
  return 'JOIN-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

/**
 * Create a new group with the creator as admin.
 */
export async function createGroup(name: string, description: string | null, createdBy: number): Promise<{ id: number; inviteCode: string }> {
  const inviteCode = generateInviteCode();
  const group = await prisma.group.create({
    data: {
      name,
      description,
      inviteCode,
      createdBy,
      members: {
        create: { userId: createdBy, role: 'admin' },
      },
    },
  });
  return { id: group.id, inviteCode: group.inviteCode }; // inviteCode is same as generated
}

/**
 * Join a group via invite code (the permanent group code).
 */
export async function joinGroupByInviteCode(inviteCode: string, userId: number): Promise<{ success: boolean; groupId?: number; error?: string }> {
  const group = await prisma.group.findUnique({ where: { inviteCode } });
  if (!group) return { success: false, error: 'Invalid invite code' };

  // Check if already a member
  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId } },
  });
  if (existing) return { success: false, error: 'Already a member of this group' };

  await prisma.groupMember.create({
    data: { groupId: group.id, userId, role: 'member' },
  });

  return { success: true, groupId: group.id };
}

/**
 * Join a group via invitation code (time-limited, usage-limited).
 */
export async function joinGroupByInvitationCode(code: string, userId: number): Promise<{ success: boolean; groupId?: number; error?: string }> {
  const invitation = await prisma.groupInvitation.findUnique({ where: { code } });
  if (!invitation) return { success: false, error: 'Invalid invitation code' };

  // Check expiry
  if (invitation.expiresAt && invitation.expiresAt < new Date()) {
    return { success: false, error: 'Invitation code has expired' };
  }

  // Check usage limit
  if (invitation.maxUses !== null && invitation.usedCount >= invitation.maxUses) {
    return { success: false, error: 'Invitation code has reached its usage limit' };
  }

  // Check if already a member
  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: invitation.groupId, userId } },
  });
  if (existing) return { success: false, error: 'Already a member of this group' };

  // Join group and increment usage count
  await prisma.$transaction([
    prisma.groupMember.create({
      data: { groupId: invitation.groupId, userId, role: 'member' },
    }),
    prisma.groupInvitation.update({
      where: { id: invitation.id },
      data: { usedCount: { increment: 1 } },
    }),
  ]);

  return { success: true, groupId: invitation.groupId };
}

/**
 * Create a new invitation code for a group.
 */
export async function createInvitation(
  groupId: number,
  maxUses?: number,
  expiresAt?: Date
): Promise<{ code: string }> {
  const code = generateJoinCode();
  await prisma.groupInvitation.create({
    data: {
      groupId,
      code,
      maxUses: maxUses ?? null,
      expiresAt: expiresAt ?? null,
    },
  });
  return { code };
}