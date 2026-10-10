import type { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  role: Role;
  organizationId: string | null;
  areaId: string | null;
}

export interface ValidatedInput {
  body: unknown;
  query: unknown;
  params: unknown;
}

declare global {
  namespace Express {
    interface Request {
      // Set by auth.middleware; only read it in routes that run after `authenticate`.
      user: AuthUser;
      // Set by validate(); only read it in routes that run after `validate`.
      valid: ValidatedInput;
    }
  }
}
