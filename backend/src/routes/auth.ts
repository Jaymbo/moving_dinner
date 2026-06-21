import { Router, Response } from 'express';
import prisma from '../db.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { requireAuth, generateToken, AuthRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateBody } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import { sendPasswordResetEmail } from '../services/email.js';
import { config } from '../config.js';
import {
  registerBodySchema,
  loginBodySchema,
  forgotPasswordBodySchema,
  resetPasswordBodySchema,
  changePasswordBodySchema,
} from '../validation/schemas.js';

const router = Router();

// POST /api/auth/register
router.post(
  '/register',
  validateBody(registerBodySchema),
  asyncHandler(async (req, res: Response) => {
    const { name, email, password, address, maxGuests, diet } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Check if this is the first user – make them super admin
    const userCount = await prisma.user.count();
    const isFirstUser = userCount === 0;

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        address,
        maxGuests,
        diet,
        isGuest: false,
        isSuperAdmin: isFirstUser,
      },
      select: {
        id: true,
        name: true,
        email: true,
        isSuperAdmin: true,
      },
    });

    const token = generateToken(user.id);
    res.status(201).json({ ...user, token });
  })
);

// POST /api/auth/login
router.post(
  '/login',
  validateBody(loginBodySchema),
  asyncHandler(async (req, res: Response) => {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const token = generateToken(user.id);
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      isGuest: user.isGuest,
      isSuperAdmin: user.isSuperAdmin,
      token,
    });
  })
);

// GET /api/auth/me
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        name: true,
        email: true,
        address: true,
        maxGuests: true,
        notes: true,
        diet: true,
        isGuest: true,
        isSuperAdmin: true,
        createdAt: true,
        scores: true,
        groupMembers: {
          include: {
            group: {
              select: { id: true, name: true, inviteCode: true },
            },
          },
        },
      },
    });
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    res.json(user);
  })
);

// POST /api/auth/forgot-password
router.post(
  '/forgot-password',
  validateBody(forgotPasswordBodySchema),
  asyncHandler(async (req, res: Response) => {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    // Always return success to prevent email enumeration
    if (!user || !user.passwordHash) {
      res.json({
        message: 'Falls ein Account mit dieser E-Mail existiert, wurde eine E-Mail gesendet',
      });
      return;
    }

    // Invalidate any existing reset tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    // Generate reset token
    const token = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    // Send email with reset link
    const resetUrl = `${config.baseUrl}/reset-password/${token}`;
    await sendPasswordResetEmail(user.email, user.name, resetUrl);

    res.json({
      message: 'Falls ein Account mit dieser E-Mail existiert, wurde eine E-Mail gesendet',
    });
  })
);

// POST /api/auth/reset-password
router.post(
  '/reset-password',
  validateBody(resetPasswordBodySchema),
  asyncHandler(async (req, res: Response) => {
    const { token, password } = req.body;

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
      throw new AppError('Ungültiger oder abgelaufener Link', 400, 'INVALID_TOKEN');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });

    // Mark token as used
    await prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used: true },
    });

    // Generate a new login token so the user is automatically logged in
    const jwt = generateToken(resetToken.userId);
    res.json({ message: 'Passwort erfolgreich geändert', token: jwt });
  })
);

// POST /api/auth/change-password
router.post(
  '/change-password',
  requireAuth,
  validateBody(changePasswordBodySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });
    if (!user || !user.passwordHash) {
      throw new AppError('Benutzer hat kein Passwort gesetzt', 400, 'NO_PASSWORD');
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new AppError('Aktuelles Passwort ist falsch', 401, 'INVALID_PASSWORD');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.userId },
      data: { passwordHash },
    });

    res.json({ message: 'Passwort erfolgreich geändert' });
  })
);

export default router;
