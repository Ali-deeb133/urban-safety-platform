import { z } from 'zod';

import { PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT } from '../config/constants';

const FIRST_PAGE = 1;

// Query strings are always text, so numbers are coerced before they are checked.
export const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(FIRST_PAGE).default(FIRST_PAGE),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(PAGINATION_MAX_LIMIT)
      .default(PAGINATION_DEFAULT_LIMIT),
  })
  .strict();

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

export function toSkipTake(query: PaginationQuery): { skip: number; take: number } {
  return { skip: (query.page - FIRST_PAGE) * query.limit, take: query.limit };
}

export function buildPaginationMeta(query: PaginationQuery, total: number): PaginationMeta {
  return { page: query.page, limit: query.limit, total };
}
