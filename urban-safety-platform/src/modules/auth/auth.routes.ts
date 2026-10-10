import { Role } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '../../middlewares/auth.middleware';
import { registerLimiter } from '../../middlewares/rate-limit.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as authController from './auth.controller';
import { registerSchema } from './auth.validation';

export const authRouter = Router();

authRouter.post(
  '/register',
  registerLimiter,
  validate({ body: registerSchema }),
  authController.register,
);

authRouter.delete(
  '/account',
  authenticate,
  requireRole(Role.CITIZEN, Role.STAFF),
  authController.deleteAccount,
);
