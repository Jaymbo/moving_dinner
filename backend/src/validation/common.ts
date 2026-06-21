import { z } from 'zod';

/**
 * Shared Zod schemas used across multiple route validators.
 */

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const userIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  userId: z.coerce.number().int().positive(),
});

export const hostWishSchema = z.enum(['will_host', 'indifferent', 'cannot_host']);

export const meetingCreationSchema = z.enum(['admin', 'all']);

export const groupRoleSchema = z.enum(['admin', 'member']);

export const emailSchema = z.string().trim().toLowerCase().email();

export const passwordSchema = z.string().min(6);
