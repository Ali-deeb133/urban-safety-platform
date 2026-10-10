import { Role } from '@prisma/client';

import { prisma } from '../../config/db';
import { ConflictError } from '../../errors/conflict-error';
import { NotFoundError } from '../../errors/not-found-error';
import { ValidationError } from '../../errors/validation-error';
import { supabaseAdmin } from '../../lib/supabase/admin-client';
import { logger } from '../../utils/logger';
import { createProfile } from '../profiles/profiles.service';
import type { CreateStaffInput } from './admin.validation';

const EMAIL_TAKEN_CODES = new Set(['email_exists', 'user_already_exists']);

export interface CreatedStaffDto {
  id: string;
  email: string;
  fullName: string;
  organizationId: string;
  areaId: string;
}

// Same compensation as auth.service: an auth user without a Profile could log in but do nothing.
async function deleteOrphanAuthUser(userId: string): Promise<void> {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) {
    logger.error(
      { userId, err: error },
      'Compensation failed: staff auth user left without a profile',
    );
    return;
  }
  logger.warn({ userId }, 'Staff profile creation failed; auth user deleted');
}

/**
 * data-flow.md §8: both references are checked before Supabase is called, so a typo in an id
 * never leaves an auth user behind. The temporary password is passed through and never kept.
 */
export async function createStaff(input: CreateStaffInput): Promise<CreatedStaffDto> {
  const [organization, area] = await Promise.all([
    prisma.organization.findUnique({ where: { id: input.organizationId }, select: { id: true } }),
    prisma.area.findUnique({ where: { id: input.areaId }, select: { id: true } }),
  ]);
  if (!organization) {
    throw new NotFoundError('Organization not found', 'ORGANIZATION_NOT_FOUND');
  }
  if (!area) {
    throw new NotFoundError('Area not found', 'AREA_NOT_FOUND');
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.temporaryPassword,
    // The admin vouches for the address, so no confirmation email is sent.
    email_confirm: true,
  });
  if (error) {
    if (error.code !== undefined && EMAIL_TAKEN_CODES.has(error.code)) {
      throw new ConflictError('Email already registered', 'EMAIL_TAKEN');
    }
    if (error.code === 'weak_password') {
      throw new ValidationError('Password is too weak');
    }
    throw error;
  }

  const userId = data.user.id;
  try {
    await createProfile({
      id: userId,
      fullName: input.fullName,
      role: Role.STAFF,
      organizationId: input.organizationId,
      areaId: input.areaId,
    });
  } catch (profileError) {
    await deleteOrphanAuthUser(userId);
    throw profileError;
  }

  return {
    id: userId,
    email: input.email,
    fullName: input.fullName,
    organizationId: input.organizationId,
    areaId: input.areaId,
  };
}
