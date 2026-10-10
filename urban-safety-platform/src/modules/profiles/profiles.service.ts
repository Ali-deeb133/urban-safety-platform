import type { Prisma, Role } from '@prisma/client';

import { prisma } from '../../config/db';
import { UnauthorizedError } from '../../errors/unauthorized-error';

const PROFILE_SELECT = {
  id: true,
  fullName: true,
  role: true,
  organizationId: true,
  areaId: true,
  createdAt: true,
} satisfies Prisma.ProfileSelect;

export type ProfileDto = Prisma.ProfileGetPayload<{ select: typeof PROFILE_SELECT }>;

export interface CreateProfileInput {
  id: string;
  fullName: string;
  // The single admin is created by prisma/seed.ts, never through the application.
  role: Exclude<Role, 'ADMIN'>;
  organizationId?: string;
  areaId?: string;
}

export async function findById(id: string): Promise<ProfileDto | null> {
  return prisma.profile.findUnique({ where: { id }, select: PROFILE_SELECT });
}

// The Profile can vanish between authentication and this read if the account is deleted meanwhile.
export async function getOwnProfile(id: string): Promise<ProfileDto> {
  const profile = await findById(id);
  if (!profile) {
    throw new UnauthorizedError();
  }
  return profile;
}

export async function createProfile(data: CreateProfileInput): Promise<ProfileDto> {
  return prisma.profile.create({ data, select: PROFILE_SELECT });
}
