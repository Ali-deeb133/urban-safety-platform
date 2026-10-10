import { randomBytes } from 'node:crypto';

import {
  TRACKING_NUMBER_ALPHABET,
  TRACKING_NUMBER_LENGTH,
  TRACKING_NUMBER_PREFIX,
} from '../config/constants';

// Random, not sequential: a tracking number must not be guessable or reveal how many reports exist.
export function generateTrackingNumber(): string {
  const bytes = randomBytes(TRACKING_NUMBER_LENGTH);
  let suffix = '';
  for (const byte of bytes) {
    // 256 is a multiple of the 32-letter alphabet, so the modulo picks every letter equally often.
    suffix += TRACKING_NUMBER_ALPHABET.charAt(byte % TRACKING_NUMBER_ALPHABET.length);
  }
  return TRACKING_NUMBER_PREFIX + suffix;
}
