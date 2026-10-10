import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { ForbiddenError } from '../../src/errors/forbidden-error';
import { requireRole } from '../../src/middlewares/role.middleware';

function fakeRequest(role: Role): Request {
  // Only req.user is read by requireRole, so the rest of the Request is not needed.
  return {
    user: { id: '6f1c2a8e-1d7b-4c43-9a51-0d2b9f3e7a10', role, organizationId: null, areaId: null },
  } as unknown as Request;
}

const fakeResponse = {} as Response;

describe('requireRole', () => {
  it.each([Role.CITIZEN, Role.STAFF])('lets %s through a CITIZEN, STAFF route', (role) => {
    const next = vi.fn();
    requireRole(Role.CITIZEN, Role.STAFF)(fakeRequest(role), fakeResponse, next);
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects ADMIN on a CITIZEN, STAFF route with 403 FORBIDDEN', () => {
    const next = vi.fn();
    const run = (): unknown =>
      requireRole(Role.CITIZEN, Role.STAFF)(fakeRequest(Role.ADMIN), fakeResponse, next);

    expect(run).toThrow(ForbiddenError);
    expect(run).toThrow(expect.objectContaining({ statusCode: 403, code: 'FORBIDDEN' }));
    expect(next).not.toHaveBeenCalled();
  });

  it.each([Role.CITIZEN, Role.STAFF])('rejects %s on an ADMIN-only route', (role) => {
    const next = vi.fn();
    expect(() => requireRole(Role.ADMIN)(fakeRequest(role), fakeResponse, next)).toThrow(
      ForbiddenError,
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('lets ADMIN through an ADMIN-only route', () => {
    const next = vi.fn();
    requireRole(Role.ADMIN)(fakeRequest(Role.ADMIN), fakeResponse, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects every role when no role is listed', () => {
    for (const role of Object.values(Role)) {
      const next = vi.fn();
      expect(() => requireRole()(fakeRequest(role), fakeResponse, next)).toThrow(ForbiddenError);
      expect(next).not.toHaveBeenCalled();
    }
  });
});
