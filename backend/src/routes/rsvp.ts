import { Router, Response } from 'express';
import { validateRsvpToken, processRsvp } from '../services/rsvp';

const router = Router();

// GET /api/rsvp/:token – Get RSVP info (no auth required)
router.get('/:token', async (req, res: Response) => {
  try {
    const result = await validateRsvpToken(req.params.token);
    if (!result.valid) {
      if (result.alreadyUsed) {
        res.json({ valid: false, reason: 'already_used', meetingId: result.meetingId });
        return;
      }
      if (result.expired) {
        res.json({ valid: false, reason: 'expired' });
        return;
      }
      if (result.frozen) {
        res.json({ valid: false, reason: 'frozen', meetingId: result.meetingId });
        return;
      }
      res.status(404).json({ error: 'Invalid token' });
      return;
    }

    res.json({
      valid: true,
      meetingId: result.meetingId,
      userId: result.userId,
      userName: result.userName,
      meetingDate: result.meetingDate,
      deadline: result.deadline,
    });
  } catch (err) {
    console.error('RSVP lookup error:', err);
    res.status(500).json({ error: 'Failed to look up RSVP' });
  }
});

// POST /api/rsvp/:token – Submit RSVP (no auth required)
router.post('/:token', async (req, res: Response) => {
  try {
    const { hostWish } = req.body;
    if (!['will_host', 'indifferent', 'cannot_host'].includes(hostWish)) {
      res.status(400).json({ error: 'hostWish must be will_host, indifferent, or cannot_host' });
      return;
    }

    const result = await processRsvp(req.params.token, hostWish);
    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (err) {
    console.error('RSVP submit error:', err);
    res.status(500).json({ error: 'Failed to process RSVP' });
  }
});

export default router;