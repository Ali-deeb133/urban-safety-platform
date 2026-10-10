import type { Role } from '@prisma/client';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { ForbiddenError } from '../errors/forbidden-error';

// Must run after `authenticate`, which sets req.user from the Profile row.
export function requireRole(...roles: Role[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError();
    }
    next();
  };
}
