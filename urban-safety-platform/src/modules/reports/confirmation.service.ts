import { Prisma } from '@prisma/client';

import { ACTIVE_REPORT_STATUSES } from '../../config/constants';
import { prisma } from '../../config/db';
import { ConflictError } from '../../errors/conflict-error';
import { NotFoundError } from '../../errors/not-found-error';
import { ValidationError } from '../../errors/validation-error';
import type { AuthUser } from '../../types/express';

export interface ConfirmationDto {
  trackingNumber: string;
  confirmationCount: number;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * "Me too" on an existing report. It changes nothing on the report itself in v1.
 * The count is computed on every read and never stored, so it cannot drift.
 */
export async function confirmReport(actor: AuthUser, reportId: string): Promise<ConfirmationDto> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { trackingNumber: true, reporterId: true, status: true },
  });
  if (!report) {
    throw new NotFoundError('Report not found', 'REPORT_NOT_FOUND');
  }
  if (report.reporterId === actor.id) {
    throw new ValidationError('You cannot confirm your own report', 'OWN_REPORT');
  }
  if (!ACTIVE_REPORT_STATUSES.includes(report.status)) {
    throw new ConflictError('This report is already closed', 'REPORT_NOT_ACTIVE');
  }

  try {
    await prisma.confirmation.create({ data: { userId: actor.id, reportId } });
  } catch (error) {
    // The unique (userId, reportId) constraint decides, so two parallel clicks still count once.
    if (isUniqueViolation(error)) {
      throw new ConflictError('You already confirmed this report', 'ALREADY_CONFIRMED');
    }
    throw error;
  }

  const confirmationCount = await prisma.confirmation.count({ where: { reportId } });
  return { trackingNumber: report.trackingNumber, confirmationCount };
}
