import { Prisma } from '@prisma/client';

import { prisma } from '../../config/db';
import { ConflictError } from '../../errors/conflict-error';
import { NotFoundError } from '../../errors/not-found-error';
import { buildPaginationMeta, toSkipTake } from '../../utils/pagination';
import type { PaginationMeta } from '../../utils/pagination';
import type { CreateRuleInput, ListRulesQuery, UpdateRuleInput } from './reference-data.validation';

const CATEGORY_SELECT = { id: true, name: true, isEmergency: true } satisfies Prisma.CategorySelect;
const AREA_SELECT = { id: true, name: true } satisfies Prisma.AreaSelect;
const ORGANIZATION_SELECT = {
  id: true,
  name: true,
  type: true,
} satisfies Prisma.OrganizationSelect;

const RULE_SELECT = {
  id: true,
  priority: true,
  active: true,
  createdAt: true,
  category: { select: { id: true, name: true } },
  area: { select: { id: true, name: true } },
  organization: { select: { id: true, name: true } },
} satisfies Prisma.ResponsibilityRuleSelect;

// Grouped the way an admin reads the routing table: per category, per area, winner first.
const RULE_ORDER_BY = [
  { category: { name: 'asc' } },
  { area: { name: 'asc' } },
  { priority: 'asc' },
] satisfies Prisma.ResponsibilityRuleOrderByWithRelationInput[];

export type CategoryDto = Prisma.CategoryGetPayload<{ select: typeof CATEGORY_SELECT }>;
export type AreaDto = Prisma.AreaGetPayload<{ select: typeof AREA_SELECT }>;
export type OrganizationDto = Prisma.OrganizationGetPayload<{ select: typeof ORGANIZATION_SELECT }>;
export type RuleDto = Prisma.ResponsibilityRuleGetPayload<{ select: typeof RULE_SELECT }>;

function ruleConflictError(): ConflictError {
  return new ConflictError(
    'A rule with this priority already exists for this category and area',
    'RULE_CONFLICT',
  );
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

async function assertOrganizationExists(id: string): Promise<void> {
  const organization = await prisma.organization.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!organization) {
    throw new NotFoundError('Organization not found', 'ORGANIZATION_NOT_FOUND');
  }
}

// These lists are small and static, so they are the one allowed exception to pagination.
export async function listCategories(): Promise<CategoryDto[]> {
  return prisma.category.findMany({ select: CATEGORY_SELECT, orderBy: { name: 'asc' } });
}

export async function listAreas(): Promise<AreaDto[]> {
  return prisma.area.findMany({ select: AREA_SELECT, orderBy: { name: 'asc' } });
}

export async function listOrganizations(): Promise<OrganizationDto[]> {
  return prisma.organization.findMany({ select: ORGANIZATION_SELECT, orderBy: { name: 'asc' } });
}

export async function listRules(
  query: ListRulesQuery,
): Promise<{ data: RuleDto[]; meta: PaginationMeta }> {
  const [rules, total] = await prisma.$transaction([
    prisma.responsibilityRule.findMany({
      select: RULE_SELECT,
      orderBy: RULE_ORDER_BY,
      ...toSkipTake(query),
    }),
    prisma.responsibilityRule.count(),
  ]);
  return { data: rules, meta: buildPaginationMeta(query, total) };
}

export async function createRule(input: CreateRuleInput): Promise<RuleDto> {
  const [category, area] = await Promise.all([
    prisma.category.findUnique({ where: { id: input.categoryId }, select: { id: true } }),
    prisma.area.findUnique({ where: { id: input.areaId }, select: { id: true } }),
  ]);
  if (!category) {
    throw new NotFoundError('Category not found', 'CATEGORY_NOT_FOUND');
  }
  if (!area) {
    throw new NotFoundError('Area not found', 'AREA_NOT_FOUND');
  }
  await assertOrganizationExists(input.organizationId);

  try {
    return await prisma.responsibilityRule.create({ data: input, select: RULE_SELECT });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw ruleConflictError();
    }
    throw error;
  }
}

// Existing reports are never re-routed: routing is decided once, at report creation.
export async function updateRule(id: string, input: UpdateRuleInput): Promise<RuleDto> {
  const rule = await prisma.responsibilityRule.findUnique({ where: { id }, select: { id: true } });
  if (!rule) {
    throw new NotFoundError('Rule not found', 'RULE_NOT_FOUND');
  }
  if (input.organizationId !== undefined) {
    await assertOrganizationExists(input.organizationId);
  }

  try {
    return await prisma.responsibilityRule.update({
      where: { id },
      data: input,
      select: RULE_SELECT,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw ruleConflictError();
    }
    throw error;
  }
}
