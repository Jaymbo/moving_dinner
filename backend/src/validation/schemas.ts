import { z } from 'zod';
import {
  idParamSchema,
  userIdParamSchema,
  hostWishSchema,
  meetingCreationSchema,
  groupRoleSchema,
  emailSchema,
  passwordSchema,
} from './common.js';

/**
 * Zod schemas for request validation.
 *
 * These schemas mirror the business rules that were previously enforced with manual
 * if-statements in the route handlers. Centralising them makes the API consistent,
 * type-safe and easier to test.
 */

// ─────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────

export const registerBodySchema = z.object({
  name: z.string().trim().min(1),
  email: emailSchema,
  password: passwordSchema,
  address: z.string().trim().max(500).optional().nullable(),
  maxGuests: z.coerce.number().int().nonnegative().default(0),
  diet: z.string().trim().max(1000).optional().nullable(),
});

export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const forgotPasswordBodySchema = z.object({
  email: emailSchema,
});

export const resetPasswordBodySchema = z.object({
  token: z.string().trim().min(1),
  password: passwordSchema,
});

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

// ─────────────────────────────────────────────────────────────
// Users
// ─────────────────────────────────────────────────────────────

export const updateUserBodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  address: z.string().trim().max(500).optional().nullable(),
  maxGuests: z.coerce.number().int().nonnegative().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  diet: z.string().trim().max(1000).optional().nullable(),
});

export const convertUserBodySchema = z.object({
  password: passwordSchema,
  address: z.string().trim().max(500).optional().nullable(),
  maxGuests: z.coerce.number().int().nonnegative().optional().nullable(),
});

export const toggleSuperAdminBodySchema = z.object({
  isSuperAdmin: z.boolean(),
});

// ─────────────────────────────────────────────────────────────
// Groups
// ─────────────────────────────────────────────────────────────

export const createGroupBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  meetingCreation: meetingCreationSchema.default('admin'),
});

export const updateGroupBodySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  meetingCreation: meetingCreationSchema.optional(),
});

export const addGroupMemberBodySchema = z.object({
  userId: z.coerce.number().int().positive(),
  role: groupRoleSchema.default('member'),
});

export const updateGroupMemberRoleBodySchema = z.object({
  role: groupRoleSchema,
});

export const createInvitationBodySchema = z.object({
  maxUses: z.coerce.number().int().positive().optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
});

// ─────────────────────────────────────────────────────────────
// Meetings
// ─────────────────────────────────────────────────────────────

export const createMeetingBodySchema = z.object({
  date: z.coerce.date(),
  deadline: z.coerce.date(),
});

export const updateMeetingBodySchema = z.object({
  date: z.coerce.date().optional(),
  deadline: z.coerce.date().optional(),
});

export const meetingQuerySchema = z.object({
  group_id: z.coerce.number().int().positive().optional(),
});

// ─────────────────────────────────────────────────────────────
// Responses / RSVP
// ─────────────────────────────────────────────────────────────

export const responseBodySchema = z.object({
  hostWish: hostWishSchema,
});

export const rsvpTokenParamSchema = z.object({
  token: z.string().trim().min(1),
});

// ─────────────────────────────────────────────────────────────
// Assignment
// ─────────────────────────────────────────────────────────────

export const manualAssignmentBodySchema = z.object({
  assignments: z.array(
    z.object({
      userId: z.number().int().positive(),
      assignedHost: z.number().int().positive().nullable(),
    })
  ),
});

// ─────────────────────────────────────────────────────────────
// Admin
// ─────────────────────────────────────────────────────────────

export const testEmailBodySchema = z.object({
  to: emailSchema,
});

// ─────────────────────────────────────────────────────────────
// Feature requests
// ─────────────────────────────────────────────────────────────

export const featureRequestBodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
});

// ─────────────────────────────────────────────────────────────
// Re-exports
// ─────────────────────────────────────────────────────────────

export {
  idParamSchema,
  userIdParamSchema,
  hostWishSchema,
  meetingCreationSchema,
  groupRoleSchema,
  emailSchema,
  passwordSchema,
};
