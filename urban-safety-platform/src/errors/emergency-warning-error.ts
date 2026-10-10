import { AppError } from './app-error';

export class EmergencyWarningError extends AppError {
  constructor(
    message = 'This is an emergency. Call the emergency services instead of filing a report',
    code = 'EMERGENCY_CATEGORY',
    details?: unknown,
  ) {
    super(message, 400, code, details);
  }
}
