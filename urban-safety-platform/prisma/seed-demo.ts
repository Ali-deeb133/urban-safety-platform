import { Role } from '@prisma/client';

import { prisma } from '../src/config/db';
import { env } from '../src/config/env';
import { DEMO_ACCOUNTS } from '../src/docs/demo-accounts';
import { supabaseAdmin } from '../src/lib/supabase/admin-client';
import { logger } from '../src/utils/logger';

// Creates the public demo accounts shown on /api-docs, or repairs them: a visitor may delete a
// demo account through the API, so running this again recreates it and resets its password.
// Run after `prisma db seed`, which creates the organization and area the staff account needs.

const AUTH_USERS_PAGE_SIZE = 200;

interface DemoProfile {
  email: string;
  fullName: string;
  role: typeof Role.CITIZEN | typeof Role.STAFF;
  organizationId: string | null;
  areaId: string | null;
}

// Same lookup as prisma/seed.ts: Supabase has no "find by email" in its admin API.
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

async function upsertAuthUser(email: string, password: string): Promise<string> {
  const existingId = await findAuthUserIdByEmail(email);
  if (existingId === undefined) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) {
      throw new Error(`Could not create demo user ${email} (${error.code ?? 'unknown'})`);
    }
    return data.user.id;
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(existingId, {
    password,
    email_confirm: true,
  });
  if (error) {
    throw new Error(`Could not reset demo user ${email} (${error.code ?? 'unknown'})`);
  }
  return existingId;
}

async function upsertDemoAccount(profile: DemoProfile, password: string): Promise<void> {
  const id = await upsertAuthUser(profile.email, password);

  // Never turn the admin into a demo account, whatever the configured email is.
  const existing = await prisma.profile.findUnique({ where: { id }, select: { role: true } });
  if (existing?.role === Role.ADMIN) {
    throw new Error(`${profile.email} belongs to the admin; refusing to use it as a demo account`);
  }

  const fields = {
    fullName: profile.fullName,
    role: profile.role,
    organizationId: profile.organizationId,
    areaId: profile.areaId,
  };
  await prisma.profile.upsert({ where: { id }, update: fields, create: { id, ...fields } });
  logger.info({ email: profile.email, role: profile.role }, 'Demo account ready');
}

async function findIdByName(model: 'organization' | 'area', name: string): Promise<string> {
  const row =
    model === 'organization'
      ? await prisma.organization.findUnique({ where: { name }, select: { id: true } })
      : await prisma.area.findUnique({ where: { name }, select: { id: true } });
  if (!row) {
    throw new Error(`${model} "${name}" not found; run "npx prisma db seed" first`);
  }
  return row.id;
}

async function run(): Promise<void> {
  try {
    const password = env.DEMO_ACCOUNTS_PASSWORD;
    if (password === undefined) {
      throw new Error('Set DEMO_ACCOUNTS_PASSWORD in .env first');
    }

    const { citizen, staff } = DEMO_ACCOUNTS;
    const [organizationId, areaId] = await Promise.all([
      findIdByName('organization', staff.organizationName),
      findIdByName('area', staff.areaName),
    ]);

    await upsertDemoAccount(
      { ...citizen, role: Role.CITIZEN, organizationId: null, areaId: null },
      password,
    );
    await upsertDemoAccount(
      { email: staff.email, fullName: staff.fullName, role: Role.STAFF, organizationId, areaId },
      password,
    );
    logger.info('Demo accounts ready');
  } catch (error) {
    logger.error({ err: error }, 'Demo seed failed');
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void run();
