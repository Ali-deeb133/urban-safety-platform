import { AppError } from './app-error';

export class InvalidTransitionError extends AppError {
  constructor(
    message = 'This status change is not allowed',
    code = 'INVALID_TRANSITION',
    details?: unknown,
  ) {
    super(message, 400, code, details);
  }
}
