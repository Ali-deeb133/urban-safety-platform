import { AppError } from './app-error';

export class ValidationError extends AppError {
  constructor(message = 'Invalid input', code = 'VALIDATION_ERROR', details?: unknown) {
    super(message, 400, code, details);
  }
}
