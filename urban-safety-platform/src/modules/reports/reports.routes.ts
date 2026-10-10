import { Role } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '../../middlewares/auth.middleware';
import { createReportLimiter, trackReportLimiter } from '../../middlewares/rate-limit.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as reportsController from './reports.controller';
import {
  changeStatusSchema,
  createReportSchema,
  listMyReportsQuerySchema,
  listReportsQuerySchema,
  reportIdParamsSchema,
  trackingNumberParamsSchema,
} from './reports.validation';

export const reportsRouter = Router();

reportsRouter.post(
  '/',
  authenticate,
  requireRole(Role.CITIZEN),
  createReportLimiter,
  validate({ body: createReportSchema }),
  reportsController.create,
);

// Public: no authenticate. Mounted before any '/:id' route so 'track' is never read as an id.
reportsRouter.get(
  '/track/:trackingNumber',
  trackReportLimiter,
  validate({ params: trackingNumberParamsSchema }),
  reportsController.track,
);

// Also before any '/:id' route, so 'mine' is never read as an id.
reportsRouter.get(
  '/mine',
  authenticate,
  requireRole(Role.CITIZEN),
  validate({ query: listMyReportsQuerySchema }),
  reportsController.listMine,
);

reportsRouter.post(
  '/:id/confirm',
  authenticate,
  requireRole(Role.CITIZEN),
  validate({ params: reportIdParamsSchema }),
  reportsController.confirm,
);

// Staff are scoped to their organization + area inside the service; admin sees all.
reportsRouter.get(
  '/',
  authenticate,
  requireRole(Role.STAFF, Role.ADMIN),
  validate({ query: listReportsQuerySchema }),
  reportsController.list,
);

reportsRouter.get(
  '/:id',
  authenticate,
  requireRole(Role.STAFF, Role.ADMIN),
  validate({ params: reportIdParamsSchema }),
  reportsController.getById,
);

reportsRouter.patch(
  '/:id/status',
  authenticate,
  requireRole(Role.STAFF, Role.ADMIN),
  validate({ params: reportIdParamsSchema, body: changeStatusSchema }),
  reportsController.changeStatus,
);
