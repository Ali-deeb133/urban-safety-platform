import { ReportStatus } from '@prisma/client';
import { z } from 'zod';

import { FINAL_REPORT_STATUSES, TRACKING_NUMBER_PATTERN } from '../../config/constants';
import { paginationQuerySchema } from '../../utils/pagination';

const DESCRIPTION_MIN_LENGTH = 10;
const DESCRIPTION_MAX_LENGTH = 1000;
const IMAGE_PATH_MAX_LENGTH = 255;
const NOTE_MIN_LENGTH = 1;
const NOTE_MAX_LENGTH = 500;

export const createReportSchema = z
  .object({
    categoryId: z.uuid(),
    areaId: z.uuid(),
    description: z.string().trim().min(DESCRIPTION_MIN_LENGTH).max(DESCRIPTION_MAX_LENGTH),
    // Only the length is checked here; the folder must match the caller's id, which the service knows.
    imagePath: z.string().min(1).max(IMAGE_PATH_MAX_LENGTH).optional(),
    acknowledgeDuplicates: z.boolean().optional(),
  })
  .strict();

// Checked before the lookup so a malformed number never reaches the database.
export const trackingNumberParamsSchema = z
  .object({
    trackingNumber: z.string().regex(TRACKING_NUMBER_PATTERN, 'Invalid tracking number'),
  })
  .strict();

export const reportIdParamsSchema = z.object({ id: z.uuid() }).strict();

// Only page and limit: a citizen's own list has no filters in v1.
export const listMyReportsQuerySchema = paginationQuerySchema;

// unrouted is accepted for any caller here; the service rejects it for STAFF, since a schema
// cannot see the role.
export const listReportsQuerySchema = paginationQuerySchema
  .extend({
    status: z.enum(ReportStatus).optional(),
    categoryId: z.uuid().optional(),
    // Query strings are text; only the exact words are accepted, not "1" or "yes".
    unrouted: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
  })
  .strict();

// No assignedToId, organizationId, areaId or categoryId: with .strict() any of them is a 400.
export const changeStatusSchema = z
  .object({
    status: z.enum(ReportStatus),
    note: z.string().trim().min(NOTE_MIN_LENGTH).max(NOTE_MAX_LENGTH).optional(),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (FINAL_REPORT_STATUSES.includes(input.status) && input.note === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['note'],
        message: 'A note is required when resolving or rejecting a report',
      });
    }
  });

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type TrackingNumberParams = z.infer<typeof trackingNumberParamsSchema>;
export type ReportIdParams = z.infer<typeof reportIdParamsSchema>;
export type ListMyReportsQuery = z.infer<typeof listMyReportsQuerySchema>;
export type ListReportsQuery = z.infer<typeof listReportsQuerySchema>;
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;
