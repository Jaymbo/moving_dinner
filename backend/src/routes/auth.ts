import { Router, Response } from 'express';
import prisma from '../db';
import bcrypt from 'bcryptjs';
import { requireAuth, generateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res: Response) => {
  try {
    const { name, email, password, address, maxGuests, diet } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: 'name, email, and password are required' });
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

    // Create initial score entry
    await prisma.score.create({ data: { userId: user.id } });

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

export default router;
