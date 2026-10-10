import { z } from 'zod';

import {
  FULL_NAME_MAX_LENGTH,
  FULL_NAME_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../../config/constants';

export const registerSchema = z
  .object({
    email: z.email().toLowerCase(),
    // Not trimmed: spaces are a legitimate part of a password.
    password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
    fullName: z.string().trim().min(FULL_NAME_MIN_LENGTH).max(FULL_NAME_MAX_LENGTH),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
