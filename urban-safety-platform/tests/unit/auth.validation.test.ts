import { describe, expect, it } from 'vitest';

import { registerSchema } from '../../src/modules/auth/auth.validation';

const VALID_INPUT = {
  email: 'citizen@example.com',
  password: 'correct horse',
  fullName: 'Test Citizen',
};

describe('registerSchema', () => {
  it('accepts valid input', () => {
    expect(registerSchema.safeParse(VALID_INPUT).success).toBe(true);
  });

  it('lowercases the email', () => {
    const result = registerSchema.parse({ ...VALID_INPUT, email: 'Citizen@Example.COM' });
    expect(result.email).toBe('citizen@example.com');
  });

  it('trims the full name', () => {
    const result = registerSchema.parse({ ...VALID_INPUT, fullName: '  Test Citizen  ' });
    expect(result.fullName).toBe('Test Citizen');
  });

  it('keeps spaces in the password', () => {
    const result = registerSchema.parse({ ...VALID_INPUT, password: ' spaced pass ' });
    expect(result.password).toBe(' spaced pass ');
  });

  it.each([
    ['role', 'ADMIN'],
    ['organizationId', '6f1c2a8e-1d7b-4c43-9a51-0d2b9f3e7a10'],
    ['areaId', '6f1c2a8e-1d7b-4c43-9a51-0d2b9f3e7a10'],
    ['isAdmin', true],
  ])('rejects the unknown field %s', (field, value) => {
    expect(registerSchema.safeParse({ ...VALID_INPUT, [field]: value }).success).toBe(false);
  });

  it('rejects a password shorter than 8 characters', () => {
    expect(registerSchema.safeParse({ ...VALID_INPUT, password: '1234567' }).success).toBe(false);
  });

  it('accepts a password of exactly 8 and exactly 72 characters', () => {
    expect(registerSchema.safeParse({ ...VALID_INPUT, password: 'x'.repeat(8) }).success).toBe(
      true,
    );
    expect(registerSchema.safeParse({ ...VALID_INPUT, password: 'x'.repeat(72) }).success).toBe(
      true,
    );
  });

  it('rejects a password longer than 72 characters', () => {
    expect(registerSchema.safeParse({ ...VALID_INPUT, password: 'x'.repeat(73) }).success).toBe(
      false,
    );
  });

  it.each(['not-an-email', 'missing-at.example.com', 'user@', ''])(
    'rejects the email "%s"',
    (email) => {
      expect(registerSchema.safeParse({ ...VALID_INPUT, email }).success).toBe(false);
    },
  );

  it('rejects a full name shorter than 2 characters after trimming', () => {
    expect(registerSchema.safeParse({ ...VALID_INPUT, fullName: '  A  ' }).success).toBe(false);
  });

  it('rejects a full name longer than 100 characters', () => {
    expect(registerSchema.safeParse({ ...VALID_INPUT, fullName: 'a'.repeat(101) }).success).toBe(
      false,
    );
  });

  it.each(['email', 'password', 'fullName'])('rejects input without %s', (field) => {
    const input: Record<string, unknown> = { ...VALID_INPUT };
    delete input[field];
    expect(registerSchema.safeParse(input).success).toBe(false);
  });
});
