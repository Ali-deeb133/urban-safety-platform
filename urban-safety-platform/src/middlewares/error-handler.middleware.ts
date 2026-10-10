import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../errors/app-error';
import { ValidationError } from '../errors/validation-error';

// Check if the error is a malformed JSON error from Express's body parser.
function isMalformedJsonError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && 'type' in err && err.type === 'entity.parse.failed'
  );
}

// Express recognises an error handler by its four parameters, so `_next` must stay.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const error = isMalformedJsonError(err) ? new ValidationError('Malformed JSON body') : err;

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    });
    return;
  }

  req.log.error({ err: error }, 'Unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
}
