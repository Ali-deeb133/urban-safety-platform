import type { Prisma } from '@prisma/client';

import { prisma } from '../../config/db';
import {
  ACTIVE_REPORT_STATUSES,
  DEDUP_MAX_RESULTS,
  DEDUP_WINDOW_DAYS,
} from '../../config/constants';
import { ConflictError } from '../../errors/conflict-error';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Exposes other citizens' descriptions on purpose so the reporter can judge "same problem?" (decision C4).
// `id` is what POST /reports/:id/confirm needs when the citizen picks one of these.
const DUPLICATE_SELECT = {
  id: true,
  trackingNumber: true,
  description: true,
  status: true,
  createdAt: true,
} satisfies Prisma.ReportSelect;

export type DuplicateDto = Prisma.ReportGetPayload<{ select: typeof DUPLICATE_SELECT }>;

/**
 * Throws 409 DUPLICATE_REPORTS when active reports for the same category and area exist
 * within the dedup window. The caller skips this when the citizen acknowledged duplicates.
 */
export async function ensureNoActiveDuplicates(categoryId: string, areaId: string): Promise<void> {
  const since = new Date(Date.now() - DEDUP_WINDOW_DAYS * MS_PER_DAY);

  const duplicates = await prisma.report.findMany({
    where: {
      categoryId,
      areaId,
      status: { in: [...ACTIVE_REPORT_STATUSES] },
      createdAt: { gte: since },
    },
    select: DUPLICATE_SELECT,
    orderBy: { createdAt: 'desc' },
    take: DEDUP_MAX_RESULTS,
  });

  if (duplicates.length > 0) {
    throw new ConflictError('Similar reports already exist', 'DUPLICATE_REPORTS', { duplicates });
  }
}
