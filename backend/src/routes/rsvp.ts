import { Router, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateBody, validateParams, typedParams } from '../middleware/validate.js';
import { validateRsvpToken, processRsvp } from '../services/rsvp.js';
import { rsvpTokenParamSchema, responseBodySchema } from '../validation/schemas.js';

const router = Router();

// GET /api/rsvp/:token – Get RSVP info (no auth required)
router.get(
  '/:token',
  validateParams(rsvpTokenParamSchema),
  asyncHandler(async (req, res: Response) => {
    const { token } = typedParams(req, rsvpTokenParamSchema);

    const result = await validateRsvpToken(token);
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
  })
);

// POST /api/rsvp/:token – Submit RSVP (no auth required)
router.post(
  '/:token',
  validateParams(rsvpTokenParamSchema),
  validateBody(responseBodySchema),
  asyncHandler(async (req, res: Response) => {
    const { token } = typedParams(req, rsvpTokenParamSchema);
    const { hostWish } = req.body;

    const result = await processRsvp(token, hostWish);
    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(400).json({ error: result.error });
    }
  })
);

export default router;
