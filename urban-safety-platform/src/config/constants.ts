import { ReportStatus, Role } from '@prisma/client';

export const API_NAME = 'Urban Safety Reporting Platform API';
export const API_PREFIX = '/api/v1';
export const API_DOCS_PATH = '/api-docs';

export const PAGINATION_DEFAULT_LIMIT = 20;
export const PAGINATION_MAX_LIMIT = 100;

// Shared by citizen sign-up and staff creation, so both accounts follow the same rules.
export const PASSWORD_MIN_LENGTH = 8;
// Supabase hashes passwords with bcrypt, which ignores everything after 72 bytes.
export const PASSWORD_MAX_LENGTH = 72;
export const FULL_NAME_MIN_LENGTH = 2;
export const FULL_NAME_MAX_LENGTH = 100;

export const TRACKING_NUMBER_PREFIX = 'TRK-';
export const TRACKING_NUMBER_LENGTH = 10;
// Crockford base32: digits and capitals without I, L, O, U, so a citizen cannot misread one.
export const TRACKING_NUMBER_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const TRACKING_NUMBER_PATTERN = /^TRK-[0-9A-HJKMNP-TV-Z]{10}$/;

// A report still being worked on; RESOLVED and REJECTED are final.
export const ACTIVE_REPORT_STATUSES: readonly ReportStatus[] = [
  ReportStatus.PENDING,
  ReportStatus.ASSIGNED,
  ReportStatus.IN_PROGRESS,
];
export const FINAL_REPORT_STATUSES: readonly ReportStatus[] = [
  ReportStatus.RESOLVED,
  ReportStatus.REJECTED,
];
export const DEDUP_WINDOW_DAYS = 15;
export const DEDUP_MAX_RESULTS = 10;

// The file name inside the caller's own storage folder; no slash, so no other folder can be named.
export const IMAGE_FILE_NAME_PATTERN = /^[A-Za-z0-9._-]+\.(jpe?g|png|webp)$/;

export const AUTO_ROUTED_NOTE = 'Auto-routed';

// claim: the report must be unassigned and the actor becomes the assignee.
// assignee: only the current assignee may act.
// unassigned: nobody holds the report before or after (admin closing an unrouted report).
export type AssigneeRule = 'claim' | 'assignee' | 'unassigned';

export interface AllowedTransition {
  from: ReportStatus;
  to: ReportStatus;
  role: Role;
  assignee: AssigneeRule;
}

// architecture.md §7. PENDING → ASSIGNED is missing on purpose: only routing at creation does it,
// never a request. Anything not listed is an invalid transition.
export const ALLOWED_TRANSITIONS: readonly AllowedTransition[] = [
  {
    from: ReportStatus.PENDING,
    to: ReportStatus.REJECTED,
    role: Role.ADMIN,
    assignee: 'unassigned',
  },
  {
    from: ReportStatus.ASSIGNED,
    to: ReportStatus.IN_PROGRESS,
    role: Role.STAFF,
    assignee: 'claim',
  },
  { from: ReportStatus.ASSIGNED, to: ReportStatus.REJECTED, role: Role.STAFF, assignee: 'claim' },
  {
    from: ReportStatus.IN_PROGRESS,
    to: ReportStatus.RESOLVED,
    role: Role.STAFF,
    assignee: 'assignee',
  },
  {
    from: ReportStatus.IN_PROGRESS,
    to: ReportStatus.REJECTED,
    role: Role.STAFF,
    assignee: 'assignee',
  },
];

const MINUTE_MS = 60 * 1000;

export const RATE_LIMITS = {
  register: { windowMs: 1 * MINUTE_MS, limit: 5 },
  createReport: { windowMs: 60 * MINUTE_MS, limit: 10 },
  trackReport: { windowMs: 15 * MINUTE_MS, limit: 60 },
} as const;
