import { z } from 'zod';

import { paginationQuerySchema } from '../../utils/pagination';

const PRIORITY_MIN = 1;
const PRIORITY_MAX = 100;
const PRIORITY_DEFAULT = 1;

const prioritySchema = z.int().min(PRIORITY_MIN).max(PRIORITY_MAX);

export const listRulesQuerySchema = paginationQuerySchema;

export const ruleIdParamsSchema = z.object({ id: z.uuid() }).strict();

export const createRuleSchema = z
  .object({
    categoryId: z.uuid(),
    areaId: z.uuid(),
    organizationId: z.uuid(),
    priority: prioritySchema.default(PRIORITY_DEFAULT),
  })
  .strict();

// categoryId and areaId are left out on purpose: moving a rule to another pair
// would silently change routing history. Create a new rule instead.
export const updateRuleSchema = z
  .object({
    organizationId: z.uuid().optional(),
    priority: prioritySchema.optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: 'At least one field must be provided',
  });

export type ListRulesQuery = z.infer<typeof listRulesQuerySchema>;
export type RuleIdParams = z.infer<typeof ruleIdParamsSchema>;
export type CreateRuleInput = z.infer<typeof createRuleSchema>;
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;
