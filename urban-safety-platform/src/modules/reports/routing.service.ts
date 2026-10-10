import { prisma } from '../../config/db';

/**
 * Returns the organization of the winning active rule (lowest priority number) for the pair,
 * or null when no rule matches. Never throws for "no rule": the report is then stored unrouted.
 */
export async function findResponsibleOrganization(
  categoryId: string,
  areaId: string,
): Promise<string | null> {
  const rule = await prisma.responsibilityRule.findFirst({
    where: { categoryId, areaId, active: true },
    select: { organizationId: true },
    orderBy: { priority: 'asc' },
  });
  return rule?.organizationId ?? null;
}
