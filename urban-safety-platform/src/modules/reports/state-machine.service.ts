import type { ReportStatus, Role } from '@prisma/client';

import { ALLOWED_TRANSITIONS } from '../../config/constants';
import type { AllowedTransition } from '../../config/constants';

export interface TransitionRequest {
  from: ReportStatus;
  to: ReportStatus;
  role: Role;
}

// Returns the table row so changeStatus can apply its assignee rule; undefined means not allowed.
export function findTransition({
  from,
  to,
  role,
}: TransitionRequest): AllowedTransition | undefined {
  return ALLOWED_TRANSITIONS.find((t) => t.from === from && t.to === to && t.role === role);
}
