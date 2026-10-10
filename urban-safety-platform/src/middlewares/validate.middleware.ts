import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';

import { ValidationError } from '../errors/validation-error';

type RequestPart = 'body' | 'query' | 'params';

export type RequestSchemas = Partial<Record<RequestPart, z.ZodType>>;

interface ValidationIssue {
  location: RequestPart;
  path: string;
  message: string;
}

const REQUEST_PARTS: readonly RequestPart[] = ['body', 'query', 'params'];

// Parsed values go to req.valid and are never written back: req.query is read-only in Express 5.
export function validate(schemas: RequestSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const valid: Request['valid'] = { body: undefined, query: undefined, params: undefined };
    const issues: ValidationIssue[] = [];

    for (const part of REQUEST_PARTS) {
      const schema = schemas[part];
      if (schema === undefined) {
        continue;
      }
      const result = schema.safeParse(req[part]);
      if (result.success) {
        valid[part] = result.data;
        continue;
      }
      // Only paths and messages are returned, never the rejected values (they may be passwords).
      for (const issue of result.error.issues) {
        issues.push({
          location: part,
          path: issue.path.map(String).join('.'),
          message: issue.message,
        });
      }
    }

    if (issues.length > 0) {
      throw new ValidationError('Invalid input', 'VALIDATION_ERROR', { issues });
    }
    req.valid = valid;
    next();
  };
}
