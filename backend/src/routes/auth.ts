import { Router, Response } from 'express';
import prisma from '../db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { requireAuth, generateToken, AuthRequest } from '../middleware/auth';
import { sendPasswordResetEmail } from '../services/email';
import { config } from '../config';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res: Response) => {
  try {
    const { name, email, password, address, maxGuests, diet } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: 'name, email, and password are required' });
      return;
    }

    const parsedMaxGuests = typeof maxGuests === 'number' ? maxGuests : parseInt(maxGuests, 10);
    if (maxGuests !== undefined && (Number.isNaN(parsedMaxGuests) || parsedMaxGuests < 0)) {
      res.status(400).json({ error: 'maxGuests must be a non-negative number' });
      return;
    }

    // Check if email already taken
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
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
        address: address || null,
        maxGuests: maxGuests || 0,
        diet: diet || null,
        isGuest: false,
        isSuperAdmin: isFirstUser,
      },
      select: {
        id: true, name: true, email: true, isSuperAdmin: true,
      },
    });

    const token = generateToken(user.id);
    res.status(201).json({ ...user, token });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Failed to register' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = generateToken(user.id);
    res.json({
      id: user.id, name: user.name, email: user.email,
      isGuest: user.isGuest, isSuperAdmin: user.isSuperAdmin, token,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true, name: true, email: true, address: true,
        maxGuests: true, notes: true, diet: true, isGuest: true,
        isSuperAdmin: true, createdAt: true,
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
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(user);
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'E-Mail ist erforderlich' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    // Always return success to prevent email enumeration
    if (!user || !user.passwordHash) {
      res.json({ message: 'Falls ein Account mit dieser E-Mail existiert, wurde eine E-Mail gesendet' });
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

    res.json({ message: 'Falls ein Account mit dieser E-Mail existiert, wurde eine E-Mail gesendet' });
  } catch (err) {
    console.error('Forgot password error:', err);
    // Still return success to prevent information leakage
    res.json({ message: 'Falls ein Account mit dieser E-Mail existiert, wurde eine E-Mail gesendet' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res: Response) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      res.status(400).json({ error: 'Token und Passwort sind erforderlich' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen lang sein' });
      return;
    }

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
      res.status(400).json({ error: 'Ungültiger oder abgelaufener Link' });
      return;
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
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Passwort konnte nicht zurückgesetzt werden' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Aktuelles und neues Passwort sind erforderlich' });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: 'Neues Passwort muss mindestens 6 Zeichen lang sein' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });
    if (!user || !user.passwordHash) {
      res.status(400).json({ error: 'Benutzer hat kein Passwort gesetzt' });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Aktuelles Passwort ist falsch' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.userId },
      data: { passwordHash },
    });

    res.json({ message: 'Passwort erfolgreich geändert' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Passwort konnte nicht geändert werden' });
  }
});

export default router;
