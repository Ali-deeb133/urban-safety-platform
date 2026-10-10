import { AppError } from './app-error';

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', code = 'UNAUTHORIZED', details?: unknown) {
    super(message, 401, code, details);
  }
}
