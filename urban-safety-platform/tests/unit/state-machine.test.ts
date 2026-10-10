import { ReportStatus, Role } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { ALLOWED_TRANSITIONS } from '../../src/config/constants';
import { findTransition } from '../../src/modules/reports/state-machine.service';
import type { TransitionRequest } from '../../src/modules/reports/state-machine.service';

const { PENDING, ASSIGNED, IN_PROGRESS, RESOLVED, REJECTED } = ReportStatus;
const ALL_STATUSES = Object.values(ReportStatus);

function isAllowed(request: TransitionRequest): boolean {
  return findTransition(request) !== undefined;
}

describe('findTransition: allowed', () => {
  it.each([
    [PENDING, REJECTED, Role.ADMIN],
    [ASSIGNED, IN_PROGRESS, Role.STAFF],
    [ASSIGNED, REJECTED, Role.STAFF],
    [IN_PROGRESS, RESOLVED, Role.STAFF],
    [IN_PROGRESS, REJECTED, Role.STAFF],
  ])('allows %s → %s for %s', (from, to, role) => {
    expect(isAllowed({ from, to, role })).toBe(true);
  });

  it('has exactly the five transitions of architecture.md §7', () => {
    expect(ALLOWED_TRANSITIONS).toHaveLength(5);
  });
});

describe('findTransition: disallowed', () => {
  it('rejects ASSIGNED → RESOLVED (must be claimed first)', () => {
    expect(isAllowed({ from: ASSIGNED, to: RESOLVED, role: Role.STAFF })).toBe(false);
  });

  it('rejects PENDING → ASSIGNED from a request (only routing does it)', () => {
    for (const role of Object.values(Role)) {
      expect(isAllowed({ from: PENDING, to: ASSIGNED, role })).toBe(false);
    }
  });

  it.each([RESOLVED, REJECTED])('treats %s as terminal for every role', (from) => {
    for (const to of ALL_STATUSES) {
      for (const role of Object.values(Role)) {
        expect(isAllowed({ from, to, role })).toBe(false);
      }
    }
  });

  it('rejects every move by a CITIZEN', () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        expect(isAllowed({ from, to, role: Role.CITIZEN })).toBe(false);
      }
    }
  });

  it('rejects STAFF moving a PENDING (unrouted) report', () => {
    for (const to of ALL_STATUSES) {
      expect(isAllowed({ from: PENDING, to, role: Role.STAFF })).toBe(false);
    }
  });

  it.each([
    [ASSIGNED, IN_PROGRESS],
    [ASSIGNED, REJECTED],
    [IN_PROGRESS, RESOLVED],
    [IN_PROGRESS, REJECTED],
  ])('rejects ADMIN processing %s → %s', (from, to) => {
    expect(isAllowed({ from, to, role: Role.ADMIN })).toBe(false);
  });

  it('rejects going backwards IN_PROGRESS → ASSIGNED', () => {
    expect(isAllowed({ from: IN_PROGRESS, to: ASSIGNED, role: Role.STAFF })).toBe(false);
  });

  it('rejects staying in the same status', () => {
    for (const status of ALL_STATUSES) {
      for (const role of Object.values(Role)) {
        expect(isAllowed({ from: status, to: status, role })).toBe(false);
      }
    }
  });
});

describe('findTransition: assignee rule', () => {
  it.each([
    [ASSIGNED, IN_PROGRESS, Role.STAFF, 'claim'],
    [ASSIGNED, REJECTED, Role.STAFF, 'claim'],
    [IN_PROGRESS, RESOLVED, Role.STAFF, 'assignee'],
    [IN_PROGRESS, REJECTED, Role.STAFF, 'assignee'],
    [PENDING, REJECTED, Role.ADMIN, 'unassigned'],
  ])('%s → %s for %s uses "%s"', (from, to, role, assignee) => {
    expect(findTransition({ from, to, role })?.assignee).toBe(assignee);
  });

  it('returns undefined for a disallowed transition', () => {
    expect(findTransition({ from: ASSIGNED, to: RESOLVED, role: Role.STAFF })).toBeUndefined();
  });
});
