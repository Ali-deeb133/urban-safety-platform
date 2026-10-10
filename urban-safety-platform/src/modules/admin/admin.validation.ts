import { z } from 'zod';

import {
  FULL_NAME_MAX_LENGTH,
  FULL_NAME_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../../config/constants';

// No role field: the service always sets STAFF, and .strict() turns a smuggled role into a 400.
export const createStaffSchema = z
  .object({
    email: z.email().toLowerCase(),
    // Not trimmed: spaces are a legitimate part of a password.
    temporaryPassword: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
    fullName: z.string().trim().min(FULL_NAME_MIN_LENGTH).max(FULL_NAME_MAX_LENGTH),
    organizationId: z.uuid(),
    areaId: z.uuid(),
  })
  .strict();

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
