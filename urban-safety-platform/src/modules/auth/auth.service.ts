import { Role } from '@prisma/client';

import { ConflictError } from '../../errors/conflict-error';
import { ForbiddenError } from '../../errors/forbidden-error';
import { ValidationError } from '../../errors/validation-error';
import { supabaseAdmin } from '../../lib/supabase/admin-client';
import { supabaseAnon } from '../../lib/supabase/anon-client';
import type { AuthUser } from '../../types/express';
import { logger } from '../../utils/logger';
import { createProfile } from '../profiles/profiles.service';
import type { RegisterInput } from './auth.validation';

const EMAIL_TAKEN_CODES = new Set(['email_exists', 'user_already_exists']);

function emailTakenError(): ConflictError {
  return new ConflictError('Email already registered', 'EMAIL_TAKEN');
}

// Removes an auth user whose Profile could not be created, so no account exists that can never be used.
async function deleteOrphanAuthUser(userId: string): Promise<void> {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) {
    logger.error({ userId, err: error }, 'Compensation failed: auth user left without a profile');
    return;
  }
  logger.warn({ userId }, 'Profile creation failed; auth user deleted');
}

export async function registerCitizen(input: RegisterInput): Promise<{ id: string }> {
  const { data, error } = await supabaseAnon.auth.signUp({
    email: input.email,
    password: input.password,
  });

  if (error) {
    if (error.code === 'weak_password') {
      throw new ValidationError('Password is too weak');
    }
    if (error.code === 'email_address_invalid') {
      throw new ValidationError('Email address is not accepted');
    }
    if (error.code !== undefined && EMAIL_TAKEN_CODES.has(error.code)) {
      throw emailTakenError();
    }
    throw error;
  }

  const user = data.user;
  if (!user) {
    throw new Error('Sign-up returned no user');
  }
  // Supabase hides an existing email by returning a fake user with no identities.
  if (user.identities?.length === 0) {
    throw emailTakenError();
  }

  try {
    await createProfile({ id: user.id, fullName: input.fullName, role: Role.CITIZEN });
  } catch (profileError) {
    await deleteOrphanAuthUser(user.id);
    throw profileError;
  }

  return { id: user.id };
}

// Deleting the auth user cascades to the Profile in the database; the user's reports are kept.
export async function deleteAccount(actor: AuthUser): Promise<void> {
  if (actor.role === Role.ADMIN) {
    throw new ForbiddenError('The admin account cannot be deleted');
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(actor.id);
  if (error) {
    throw error;
  }
}
