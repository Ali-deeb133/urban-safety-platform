import { describe, expect, it } from 'vitest';

import {
  TRACKING_NUMBER_ALPHABET,
  TRACKING_NUMBER_LENGTH,
  TRACKING_NUMBER_PATTERN,
  TRACKING_NUMBER_PREFIX,
} from '../../src/config/constants';
import { generateTrackingNumber } from '../../src/utils/tracking-number';

const SAMPLE_SIZE = 10_000;

const sample = Array.from({ length: SAMPLE_SIZE }, generateTrackingNumber);

describe('TRACKING_NUMBER_ALPHABET', () => {
  it('has 32 distinct characters', () => {
    expect(new Set(TRACKING_NUMBER_ALPHABET).size).toBe(32);
    expect(TRACKING_NUMBER_ALPHABET).toHaveLength(32);
  });

  it.each(['I', 'L', 'O', 'U'])('does not contain the ambiguous letter %s', (letter) => {
    expect(TRACKING_NUMBER_ALPHABET).not.toContain(letter);
  });

  it('matches the documented pattern character by character', () => {
    for (const char of TRACKING_NUMBER_ALPHABET) {
      const value = TRACKING_NUMBER_PREFIX + char.repeat(TRACKING_NUMBER_LENGTH);
      expect(TRACKING_NUMBER_PATTERN.test(value)).toBe(true);
    }
  });
});

describe('generateTrackingNumber', () => {
  it('produces the documented format', () => {
    for (const trackingNumber of sample) {
      expect(trackingNumber).toMatch(TRACKING_NUMBER_PATTERN);
    }
  });

  it('starts with the prefix and has the expected length', () => {
    expect(sample[0]).toMatch(/^TRK-/);
    expect(sample[0]).toHaveLength(TRACKING_NUMBER_PREFIX.length + TRACKING_NUMBER_LENGTH);
  });

  it(`has no duplicates in ${SAMPLE_SIZE} samples`, () => {
    expect(new Set(sample).size).toBe(SAMPLE_SIZE);
  });
});

describe('TRACKING_NUMBER_PATTERN', () => {
  it.each([
    ['lowercase', 'TRK-abcdefghjk'],
    ['the letter O', 'TRK-O123456789'],
    ['the letter I', 'TRK-I123456789'],
    ['too short', 'TRK-123456789'],
    ['too long', 'TRK-12345678901'],
    ['a wrong prefix', 'TRX-1234567890'],
    ['no prefix', '1234567890'],
    ['trailing text', 'TRK-1234567890 '],
  ])('rejects %s', (_label, value) => {
    expect(TRACKING_NUMBER_PATTERN.test(value)).toBe(false);
  });
});
