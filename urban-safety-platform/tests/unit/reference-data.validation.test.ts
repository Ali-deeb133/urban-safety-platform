import { describe, expect, it } from 'vitest';

import {
  createRuleSchema,
  ruleIdParamsSchema,
  updateRuleSchema,
} from '../../src/modules/reference-data/reference-data.validation';

const UUID = '6f1c2a8e-1d7b-4c43-9a51-0d2b9f3e7a10';

const VALID_CREATE = {
  categoryId: UUID,
  areaId: UUID,
  organizationId: UUID,
};

describe('createRuleSchema', () => {
  it('accepts valid input and defaults priority to 1', () => {
    expect(createRuleSchema.parse(VALID_CREATE)).toEqual({ ...VALID_CREATE, priority: 1 });
  });

  it.each([1, 100])('accepts the priority %d', (priority) => {
    expect(createRuleSchema.safeParse({ ...VALID_CREATE, priority }).success).toBe(true);
  });

  it.each([0, 101, 1.5, '1'])('rejects the priority %s', (priority) => {
    expect(createRuleSchema.safeParse({ ...VALID_CREATE, priority }).success).toBe(false);
  });

  it.each(['categoryId', 'areaId', 'organizationId'])('rejects input without %s', (field) => {
    const input: Record<string, unknown> = { ...VALID_CREATE };
    delete input[field];
    expect(createRuleSchema.safeParse(input).success).toBe(false);
  });

  it.each(['categoryId', 'areaId', 'organizationId'])('rejects a non-UUID %s', (field) => {
    expect(createRuleSchema.safeParse({ ...VALID_CREATE, [field]: 'not-a-uuid' }).success).toBe(
      false,
    );
  });

  it.each([
    ['active', false],
    ['id', UUID],
  ])('rejects the unknown field %s', (field, value) => {
    expect(createRuleSchema.safeParse({ ...VALID_CREATE, [field]: value }).success).toBe(false);
  });
});

describe('updateRuleSchema', () => {
  it.each([{ organizationId: UUID }, { priority: 5 }, { active: false }])(
    'accepts a single field %o',
    (input) => {
      expect(updateRuleSchema.safeParse(input).success).toBe(true);
    },
  );

  it('rejects an empty body', () => {
    expect(updateRuleSchema.safeParse({}).success).toBe(false);
  });

  it('does not default priority when it is omitted', () => {
    expect(updateRuleSchema.parse({ active: true })).toEqual({ active: true });
  });

  it.each([
    ['categoryId', UUID],
    ['areaId', UUID],
  ])('rejects the non-patchable field %s', (field, value) => {
    expect(updateRuleSchema.safeParse({ active: true, [field]: value }).success).toBe(false);
  });

  it.each([0, 101])('rejects the priority %d', (priority) => {
    expect(updateRuleSchema.safeParse({ priority }).success).toBe(false);
  });

  it('rejects a non-boolean active', () => {
    expect(updateRuleSchema.safeParse({ active: 'false' }).success).toBe(false);
  });
});

describe('ruleIdParamsSchema', () => {
  it('accepts a UUID', () => {
    expect(ruleIdParamsSchema.safeParse({ id: UUID }).success).toBe(true);
  });

  it('rejects a non-UUID id', () => {
    expect(ruleIdParamsSchema.safeParse({ id: '123' }).success).toBe(false);
  });
});
