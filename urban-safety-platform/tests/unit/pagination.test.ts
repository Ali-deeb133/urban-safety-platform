import { describe, expect, it } from 'vitest';

import { PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT } from '../../src/config/constants';
import { buildPaginationMeta, paginationQuerySchema, toSkipTake } from '../../src/utils/pagination';

describe('paginationQuerySchema', () => {
  it('defaults to the first page and the default limit', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, limit: PAGINATION_DEFAULT_LIMIT });
  });

  it('coerces query-string numbers', () => {
    expect(paginationQuerySchema.parse({ page: '3', limit: '50' })).toEqual({ page: 3, limit: 50 });
  });

  it('accepts the maximum limit', () => {
    const result = paginationQuerySchema.parse({ limit: String(PAGINATION_MAX_LIMIT) });
    expect(result.limit).toBe(PAGINATION_MAX_LIMIT);
  });

  it('rejects a limit above the maximum', () => {
    const limit = String(PAGINATION_MAX_LIMIT + 1);
    expect(paginationQuerySchema.safeParse({ limit }).success).toBe(false);
  });

  it.each(['0', '-1', '1.5', 'abc', ''])('rejects the page "%s"', (page) => {
    expect(paginationQuerySchema.safeParse({ page }).success).toBe(false);
  });

  it.each(['0', '-1', '1.5', 'abc', ''])('rejects the limit "%s"', (limit) => {
    expect(paginationQuerySchema.safeParse({ limit }).success).toBe(false);
  });

  it('rejects unknown query fields', () => {
    expect(paginationQuerySchema.safeParse({ page: '1', sort: 'name' }).success).toBe(false);
  });
});

describe('toSkipTake', () => {
  it('skips nothing on the first page', () => {
    expect(toSkipTake({ page: 1, limit: 20 })).toEqual({ skip: 0, take: 20 });
  });

  it('skips the earlier pages', () => {
    expect(toSkipTake({ page: 3, limit: 20 })).toEqual({ skip: 40, take: 20 });
  });
});

describe('buildPaginationMeta', () => {
  it('returns page, limit and total', () => {
    expect(buildPaginationMeta({ page: 2, limit: 10 }, 134)).toEqual({
      page: 2,
      limit: 10,
      total: 134,
    });
  });
});
