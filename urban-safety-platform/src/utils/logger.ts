import { pino, stdSerializers } from 'pino';
import type { SerializedError, SerializedRequest, SerializedResponse } from 'pino';

import { env } from '../config/env';

// Kept as a safety net, even though the request serializer below no longer logs headers.
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  '*.password',
  '*.temporaryPassword',
  '*.token',
  '*.accessToken',
];

// The query string is logged before validation runs, so whatever a client puts there
// (an email, a name) would reach the log. The path alone is enough to trace a request.
function serializeRequest(req: SerializedRequest): Record<string, unknown> {
  return {
    id: req.id,
    method: req.method,
    url: req.url.split('?')[0],
    // Kept for abuse investigation (rate limits); see decisions.md C17.
    remoteAddress: req.remoteAddress,
  };
}

// Headers are not sensitive here, but helmet's policy on every line buried the useful fields.
function serializeResponse(res: SerializedResponse): Record<string, unknown> {
  return { statusCode: res.statusCode };
}

// A direct logger call passes the Error itself. pino-http passes an error pino has already
// serialized: `name` is usually gone there and `type` holds the class name. Either may be missing,
// so neither is trusted to be a string.
function errorClassName(err: Error): string | undefined {
  const { name, type } = err as { name?: unknown; type?: unknown };
  if (typeof type === 'string' && type !== 'Object') {
    return type;
  }
  return typeof name === 'string' ? name : undefined;
}

// Prisma messages echo the values a query was given (descriptions, names), and the first lines
// of the stack repeat the message. For Prisma errors only the name, code and stack frames remain.
function serializeError(err: Error): SerializedError | Record<string, unknown> {
  const serialized = stdSerializers.err(err);
  const className = errorClassName(err);
  if (!className?.startsWith('Prisma')) {
    return serialized;
  }
  const stack = typeof err.stack === 'string' ? err.stack : '';
  const frames = stack.split('\n').filter((line) => line.trimStart().startsWith('at '));
  return {
    type: className,
    code: 'code' in err ? err.code : undefined,
    stack: frames.join('\n'),
  };
}

export const logSerializers = {
  req: serializeRequest,
  res: serializeResponse,
  err: serializeError,
};

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  // Only err: req and res are logged by pino-http alone, which gets logSerializers in app.ts.
  serializers: { err: serializeError },
});
