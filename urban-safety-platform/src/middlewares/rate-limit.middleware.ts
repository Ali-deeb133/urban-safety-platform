import type { NextFunction, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';

import { RATE_LIMITS } from '../config/constants';
import { AppError } from '../errors/app-error';

// Passes the error on, so a 429 has the same JSON shape as every other error.
function rejectTooManyRequests(_req: Request, _res: Response, next: NextFunction): void {
  next(new AppError('Too many requests, please try again later', 429, 'RATE_LIMITED'));
}

// Public route with no user yet, so keyed by IP. Runs before validate(), so even malformed
// sign-up attempts count against the quota.
export const registerLimiter = rateLimit({
  ...RATE_LIMITS.register,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: rejectTooManyRequests,
});

// Keyed by user, not IP: must run after `authenticate`. Citizens behind one shared IP
// (a school, a mobile carrier) do not use up each other's quota.
export const createReportLimiter = rateLimit({
  ...RATE_LIMITS.createReport,
  keyGenerator: (req) => req.user.id,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: rejectTooManyRequests,
});

// Public route, so the only key is the IP (the default key generator).
export const trackReportLimiter = rateLimit({
  ...RATE_LIMITS.trackReport,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: rejectTooManyRequests,
});
