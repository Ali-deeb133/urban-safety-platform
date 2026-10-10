import { AppError } from './app-error';

export class ForbiddenError extends AppError {
  constructor(message = 'You are not allowed to do this', code = 'FORBIDDEN', details?: unknown) {
    super(message, 403, code, details);
  }
}
