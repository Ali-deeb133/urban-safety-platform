import { Role , Prisma } from '@prisma/client';

import { prisma } from '../src/config/db';
import { env } from '../src/config/env';
import { supabaseAdmin } from '../src/lib/supabase/admin-client';
import { logger } from '../src/utils/logger';
import { AREAS, CATEGORIES, ORGANIZATIONS, RULE_OWNER_BY_CATEGORY } from './seed-data';

const ADMIN_FULL_NAME = 'Administrator';
const RULE_PRIORITY = 1;
const TRANSACTION_TIMEOUT_MS = 60_000;
const AUTH_USERS_PAGE_SIZE = 200;

function requireId(ids: Map<string, string>, name: string): string {
  const id = ids.get(name);
  if (id === undefined) {
    throw new Error(`Seed data refers to an unknown name: ${name}`);
  }
  return id;
}

async function seedReferenceData(): Promise<void> {
  await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const areaIds = new Map<string, string>();
      for (const name of AREAS) {
        const area = await tx.area.upsert({
          where: { name },
          update: {},
          create: { name },
          select: { id: true },
        });
        areaIds.set(name, area.id);
      }

      const organizationIds = new Map<string, string>();
      for (const { name, type } of ORGANIZATIONS) {
        const organization = await tx.organization.upsert({
          where: { name },
          update: { type },
          create: { name, type },
          select: { id: true },
        });
        organizationIds.set(name, organization.id);
      }

      const categoryIds = new Map<string, string>();
      for (const { name, isEmergency } of CATEGORIES) {
        const category = await tx.category.upsert({
          where: { name },
          update: { isEmergency },
          create: { name, isEmergency },
          select: { id: true },
        });
        categoryIds.set(name, category.id);
      }

      for (const [categoryName, ownerName] of Object.entries(RULE_OWNER_BY_CATEGORY)) {
        for (const areaName of AREAS) {
          const categoryId = requireId(categoryIds, categoryName);
          const areaId = requireId(areaIds, areaName);
          const organizationId = requireId(organizationIds, ownerName ?? `Bezirksamt ${areaName}`);

          // An existing rule is left as it is: the admin may have changed it through the API.
          await tx.responsibilityRule.upsert({
            where: {
              categoryId_areaId_priority: { categoryId, areaId, priority: RULE_PRIORITY },
            },
            update: {},
            create: { categoryId, areaId, organizationId, priority: RULE_PRIORITY },
          });
        }
      }
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  );
}

async function findAuthUserIdByEmail(email: string): Promise<string | undefined> {
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: AUTH_USERS_PAGE_SIZE,
    });
    if (error) {
      throw new Error(`Could not list auth users (${error.code ?? 'unknown'})`);
    }
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) {
      return match.id;
    }
    if (data.users.length < AUTH_USERS_PAGE_SIZE) {
      return undefined;
    }
  }
}

async function findOrCreateAdminAuthUser(): Promise<string> {
  const email = env.ADMIN_EMAIL.toLowerCase();

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: env.ADMIN_PASSWORD,
    email_confirm: true,
  });
  if (!error) {
    return data.user.id;
  }
  if (error.code !== 'email_exists') {
    throw new Error(`Could not create the admin auth user (${error.code ?? 'unknown'})`);
  }

  const existingId = await findAuthUserIdByEmail(email);
  if (existingId === undefined) {
    throw new Error('The admin email is taken but no matching auth user was found');
  }
  return existingId;
}

async function seedAdmin(): Promise<void> {
  const existingAdmin = await prisma.profile.findFirst({
    where: { role: Role.ADMIN },
    select: { id: true },
  });
  if (existingAdmin) {
    return;
  }

  const id = await findOrCreateAdminAuthUser();
  await prisma.profile.upsert({
    where: { id },
    update: { role: Role.ADMIN },
    create: { id, fullName: ADMIN_FULL_NAME, role: Role.ADMIN },
  });
}

async function run(): Promise<void> {
  try {
    await seedReferenceData();
    await seedAdmin();
    logger.info('Seed completed');
  } catch (error) {
    logger.error({ err: error }, 'Seed failed');
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void run();
