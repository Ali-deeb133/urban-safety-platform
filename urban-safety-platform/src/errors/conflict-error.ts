import { AppError } from './app-error';

export class ConflictError extends AppError {
  constructor(message = 'Conflict with the current state', code = 'CONFLICT', details?: unknown) {
    super(message, 409, code, details);
  }
}
