import { describe, expect, it } from 'vitest';

import { createStaffSchema } from '../../src/modules/admin/admin.validation';

const UUID = '6f1c2a8e-1d7b-4c43-9a51-0d2b9f3e7a10';

const VALID_STAFF = {
  email: 'staff@example.com',
  temporaryPassword: 'Temp-pass-123',
  fullName: 'Lena Fischer',
  organizationId: UUID,
  areaId: UUID,
};

describe('createStaffSchema', () => {
  it('accepts valid input', () => {
    expect(createStaffSchema.safeParse(VALID_STAFF).success).toBe(true);
  });

  it('lowercases the email', () => {
    const result = createStaffSchema.parse({ ...VALID_STAFF, email: 'Staff@Example.COM' });
    expect(result.email).toBe('staff@example.com');
  });

  it('trims the full name', () => {
    const result = createStaffSchema.parse({ ...VALID_STAFF, fullName: '  Lena Fischer  ' });
    expect(result.fullName).toBe('Lena Fischer');
  });

  it('keeps spaces in the temporary password', () => {
    const result = createStaffSchema.parse({ ...VALID_STAFF, temporaryPassword: ' pass word ' });
    expect(result.temporaryPassword).toBe(' pass word ');
  });

  it.each([
    ['role', 'ADMIN'],
    ['role', 'STAFF'],
    ['id', UUID],
    ['password', 'Temp-pass-123'],
  ])('rejects the smuggled field %s = %s', (field, value) => {
    expect(createStaffSchema.safeParse({ ...VALID_STAFF, [field]: value }).success).toBe(false);
  });

  it.each(['not-an-email', 'staff@', '@example.com', ''])('rejects the email "%s"', (email) => {
    expect(createStaffSchema.safeParse({ ...VALID_STAFF, email }).success).toBe(false);
  });

  it('accepts a password of exactly 8 and exactly 72 characters', () => {
    for (const length of [8, 72]) {
      const input = { ...VALID_STAFF, temporaryPassword: 'x'.repeat(length) };
      expect(createStaffSchema.safeParse(input).success).toBe(true);
    }
  });

  it.each([7, 73])('rejects a password of %i characters', (length) => {
    const input = { ...VALID_STAFF, temporaryPassword: 'x'.repeat(length) };
    expect(createStaffSchema.safeParse(input).success).toBe(false);
  });

  it('rejects a full name shorter than 2 characters after trimming', () => {
    expect(createStaffSchema.safeParse({ ...VALID_STAFF, fullName: '  L  ' }).success).toBe(false);
  });

  it('rejects a full name longer than 100 characters', () => {
    const input = { ...VALID_STAFF, fullName: 'x'.repeat(101) };
    expect(createStaffSchema.safeParse(input).success).toBe(false);
  });

  it.each(['email', 'temporaryPassword', 'fullName', 'organizationId', 'areaId'])(
    'rejects input without %s',
    (field) => {
      const input: Record<string, unknown> = { ...VALID_STAFF };
      delete input[field];
      expect(createStaffSchema.safeParse(input).success).toBe(false);
    },
  );

  it.each(['organizationId', 'areaId'])('rejects a non-UUID %s', (field) => {
    const input = { ...VALID_STAFF, [field]: 'berlin-mitte' };
    expect(createStaffSchema.safeParse(input).success).toBe(false);
  });

  it.each(['organizationId', 'areaId'])('rejects a null %s', (field) => {
    const input = { ...VALID_STAFF, [field]: null };
    expect(createStaffSchema.safeParse(input).success).toBe(false);
  });
});
