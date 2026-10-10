import { Role } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as adminController from './admin.controller';
import { createStaffSchema } from './admin.validation';

export const adminRouter = Router();

adminRouter.post(
  '/staff',
  authenticate,
  requireRole(Role.ADMIN),
  validate({ body: createStaffSchema }),
  adminController.createStaff,
);
