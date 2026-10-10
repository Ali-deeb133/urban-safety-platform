import { Role } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as referenceDataController from './reference-data.controller';
import {
  createRuleSchema,
  listRulesQuerySchema,
  ruleIdParamsSchema,
  updateRuleSchema,
} from './reference-data.validation';

export const referenceDataRouter = Router();

// Any authenticated role may read these: the create-report form needs them.
// They stay behind authenticate in v1; making them public needs the owner's approval.
referenceDataRouter.get('/categories', authenticate, referenceDataController.listCategories);
referenceDataRouter.get('/areas', authenticate, referenceDataController.listAreas);

referenceDataRouter.get(
  '/organizations',
  authenticate,
  requireRole(Role.ADMIN),
  referenceDataController.listOrganizations,
);

referenceDataRouter.get(
  '/responsibility-rules',
  authenticate,
  requireRole(Role.ADMIN),
  validate({ query: listRulesQuerySchema }),
  referenceDataController.listRules,
);

referenceDataRouter.post(
  '/responsibility-rules',
  authenticate,
  requireRole(Role.ADMIN),
  validate({ body: createRuleSchema }),
  referenceDataController.createRule,
);

referenceDataRouter.patch(
  '/responsibility-rules/:id',
  authenticate,
  requireRole(Role.ADMIN),
  validate({ params: ruleIdParamsSchema, body: updateRuleSchema }),
  referenceDataController.updateRule,
);
