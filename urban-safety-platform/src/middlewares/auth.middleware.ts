import type { NextFunction, Request, Response } from 'express';

import { UnauthorizedError } from '../errors/unauthorized-error';
import { supabaseAnon } from '../lib/supabase/anon-client';
import { findById } from '../modules/profiles/profiles.service';

const BEARER_PREFIX = 'Bearer ';

function readBearerToken(header: string | undefined): string | undefined {
  if (!header?.startsWith(BEARER_PREFIX)) {
    return undefined;
  }
  const token = header.slice(BEARER_PREFIX.length).trim();
  return token === '' ? undefined : token;
}

// Every failure throws the same error on purpose: the caller must not learn
// whether the token was missing, expired, or belongs to a user with no Profile.
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = readBearerToken(req.headers.authorization);
  if (token === undefined) {
    throw new UnauthorizedError();
  }

  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data.user) {
    throw new UnauthorizedError();
  }

  const profile = await findById(data.user.id);
  if (!profile) {
    throw new UnauthorizedError();
  }

  req.user = {
    id: profile.id,
    role: profile.role,
    organizationId: profile.organizationId,
    areaId: profile.areaId,
  };
  next();
}
