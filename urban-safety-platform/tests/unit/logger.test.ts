import { Prisma } from '@prisma/client';
import { stdSerializers } from 'pino';
import { describe, expect, it, vi } from 'vitest';

import { logSerializers } from '../../src/utils/logger';

// logger.ts reads env at import time; the serializer under test needs none of it.
// vi.mock is hoisted above the imports, so the logger sees this fake env.
vi.mock('../../src/config/env', () => ({ env: { LOG_LEVEL: 'silent' } }));

const SECRET_VALUE = 'jane@example.com';

function prismaError(): Error {
  return new Prisma.PrismaClientKnownRequestError(`Unique constraint failed on ${SECRET_VALUE}`, {
    code: 'P2002',
    clientVersion: '6.19.3',
  });
}

// What pino-http hands the serializer: the error after pino's own serializer has run.
function preSerialized(err: Error): Error {
  return stdSerializers.err(err) as unknown as Error;
}

describe('logSerializers.err', () => {
  it('keeps the message of an ordinary Error', () => {
    const result = logSerializers.err(new Error('boom'));
    expect(result).toMatchObject({ type: 'Error', message: 'boom' });
  });

  it('does not throw on an already-serialized ordinary Error, which has no name', () => {
    const result = logSerializers.err(preSerialized(new Error('boom')));
    expect(result).toMatchObject({ message: 'boom' });
  });

  it('does not throw on an object with no name and no type', () => {
    const odd = { message: 'odd', stack: undefined } as unknown as Error;
    expect(() => logSerializers.err(odd)).not.toThrow();
  });

  it('strips the message of a Prisma error, keeping class name and code', () => {
    const result = logSerializers.err(prismaError());
    expect(result).toMatchObject({ type: 'PrismaClientKnownRequestError', code: 'P2002' });
    expect(JSON.stringify(result)).not.toContain(SECRET_VALUE);
  });

  it('strips the message of an already-serialized Prisma error too', () => {
    const result = logSerializers.err(preSerialized(prismaError()));
    expect(result).toMatchObject({ type: 'PrismaClientKnownRequestError', code: 'P2002' });
    expect(JSON.stringify(result)).not.toContain(SECRET_VALUE);
  });

  it('handles a Prisma error with no code (a lost database connection)', () => {
    const lost = new Prisma.PrismaClientInitializationError(
      `Can't reach database server at ${SECRET_VALUE}`,
      '6.19.3',
    );
    const result = logSerializers.err(preSerialized(lost));
    expect(result).toMatchObject({ type: 'PrismaClientInitializationError' });
    expect(JSON.stringify(result)).not.toContain(SECRET_VALUE);
  });
});
