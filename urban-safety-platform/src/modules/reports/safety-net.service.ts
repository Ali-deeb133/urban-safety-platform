import { prisma } from '../../config/db';
import { EmergencyWarningError } from '../../errors/emergency-warning-error';
import { NotFoundError } from '../../errors/not-found-error';

/**
 * Rejects a report before anything is written: unknown category or area, or an emergency category.
 * Emergencies must reach the emergency services, not a queue that staff work through in days.
 */
export async function ensureReportable(categoryId: string, areaId: string): Promise<void> {
  const [category, area] = await Promise.all([
    prisma.category.findUnique({ where: { id: categoryId }, select: { isEmergency: true } }),
    prisma.area.findUnique({ where: { id: areaId }, select: { id: true } }),
  ]);

  if (!category) {
    throw new NotFoundError('Category not found', 'CATEGORY_NOT_FOUND');
  }
  if (!area) {
    throw new NotFoundError('Area not found', 'AREA_NOT_FOUND');
  }
  if (category.isEmergency) {
    throw new EmergencyWarningError();
  }
}
