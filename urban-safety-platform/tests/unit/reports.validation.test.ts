import { describe, expect, it } from 'vitest';

import { IMAGE_FILE_NAME_PATTERN } from '../../src/config/constants';
import {
  changeStatusSchema,
  createReportSchema,
  listMyReportsQuerySchema,
  listReportsQuerySchema,
  reportIdParamsSchema,
  trackingNumberParamsSchema,
} from '../../src/modules/reports/reports.validation';

const UUID = '6f1c2a8e-1d7b-4c43-9a51-0d2b9f3e7a10';

const VALID_CREATE = {
  categoryId: UUID,
  areaId: UUID,
  description: 'The street light on the corner has been off for a week.',
};

describe('createReportSchema', () => {
  it('accepts the minimal valid input', () => {
    expect(createReportSchema.safeParse(VALID_CREATE).success).toBe(true);
  });

  it('accepts the optional imagePath and acknowledgeDuplicates', () => {
    const input = { ...VALID_CREATE, imagePath: `${UUID}/photo.jpg`, acknowledgeDuplicates: true };
    expect(createReportSchema.safeParse(input).success).toBe(true);
  });

  it('trims the description', () => {
    const result = createReportSchema.parse({ ...VALID_CREATE, description: '  Broken light  ' });
    expect(result.description).toBe('Broken light');
  });

  it('rejects a description shorter than 10 characters after trimming', () => {
    const input = { ...VALID_CREATE, description: '   short   ' };
    expect(createReportSchema.safeParse(input).success).toBe(false);
  });

  it('accepts a description of exactly 10 and exactly 1000 characters', () => {
    for (const length of [10, 1000]) {
      const input = { ...VALID_CREATE, description: 'x'.repeat(length) };
      expect(createReportSchema.safeParse(input).success).toBe(true);
    }
  });

  it('rejects a description longer than 1000 characters', () => {
    const input = { ...VALID_CREATE, description: 'x'.repeat(1001) };
    expect(createReportSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    ['reporterId', UUID],
    ['organizationId', UUID],
    ['assignedToId', UUID],
    ['status', 'RESOLVED'],
    ['trackingNumber', 'TRK-0123456789'],
  ])('rejects the smuggled field %s', (field, value) => {
    expect(createReportSchema.safeParse({ ...VALID_CREATE, [field]: value }).success).toBe(false);
  });

  it.each(['categoryId', 'areaId', 'description'])('rejects input without %s', (field) => {
    const input: Record<string, unknown> = { ...VALID_CREATE };
    delete input[field];
    expect(createReportSchema.safeParse(input).success).toBe(false);
  });

  it.each(['categoryId', 'areaId'])('rejects a non-UUID %s', (field) => {
    const input = { ...VALID_CREATE, [field]: 'not-a-uuid' };
    expect(createReportSchema.safeParse(input).success).toBe(false);
  });

  it('rejects a non-boolean acknowledgeDuplicates', () => {
    const input = { ...VALID_CREATE, acknowledgeDuplicates: 'true' };
    expect(createReportSchema.safeParse(input).success).toBe(false);
  });

  it('rejects an empty or too long imagePath', () => {
    expect(createReportSchema.safeParse({ ...VALID_CREATE, imagePath: '' }).success).toBe(false);
    const imagePath = 'x'.repeat(256);
    expect(createReportSchema.safeParse({ ...VALID_CREATE, imagePath }).success).toBe(false);
  });
});

describe('IMAGE_FILE_NAME_PATTERN', () => {
  it.each(['photo.jpg', 'a.jpeg', 'x.png', 'y.webp', 'my_photo-2.final.jpg'])(
    'accepts %s',
    (fileName) => {
      expect(IMAGE_FILE_NAME_PATTERN.test(fileName)).toBe(true);
    },
  );

  it.each([
    ['another folder', 'a/b.png'],
    ['a parent folder', '../x.png'],
    ['a disallowed type', 'x.gif'],
    ['an uppercase extension', 'x.PNG'],
    ['no extension', 'photo'],
    ['a space', 'my photo.jpg'],
    ['a trailing extension', 'x.png.exe'],
  ])('rejects %s', (_label, fileName) => {
    expect(IMAGE_FILE_NAME_PATTERN.test(fileName)).toBe(false);
  });
});

describe('trackingNumberParamsSchema', () => {
  it('accepts a valid tracking number', () => {
    const params = { trackingNumber: 'TRK-0123456789' };
    expect(trackingNumberParamsSchema.safeParse(params).success).toBe(true);
  });

  it.each(['TRK-012345678', 'trk-0123456789', 'TRK-O123456789', UUID])(
    'rejects %s',
    (trackingNumber) => {
      expect(trackingNumberParamsSchema.safeParse({ trackingNumber }).success).toBe(false);
    },
  );
});

describe('reportIdParamsSchema', () => {
  it('accepts a UUID', () => {
    expect(reportIdParamsSchema.safeParse({ id: UUID }).success).toBe(true);
  });

  it.each(['mine', 'track', '123'])('rejects the id "%s"', (id) => {
    expect(reportIdParamsSchema.safeParse({ id }).success).toBe(false);
  });
});

describe('listMyReportsQuerySchema', () => {
  it('defaults page and limit', () => {
    expect(listMyReportsQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
  });

  it.each([
    ['status', 'RESOLVED'],
    ['reporterId', UUID],
  ])('rejects the filter %s', (field, value) => {
    expect(listMyReportsQuerySchema.safeParse({ [field]: value }).success).toBe(false);
  });
});

describe('listReportsQuerySchema', () => {
  it('defaults page and limit and leaves the filters out', () => {
    expect(listReportsQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
  });

  it('accepts every filter together', () => {
    const query = {
      status: 'ASSIGNED',
      categoryId: UUID,
      page: '2',
      limit: '50',
      unrouted: 'false',
    };
    expect(listReportsQuerySchema.parse(query)).toEqual({
      status: 'ASSIGNED',
      categoryId: UUID,
      page: 2,
      limit: 50,
      unrouted: false,
    });
  });

  it.each([
    ['true', true],
    ['false', false],
  ])('turns unrouted "%s" into %s', (text, value) => {
    expect(listReportsQuerySchema.parse({ unrouted: text }).unrouted).toBe(value);
  });

  it.each(['1', '0', 'yes', 'TRUE', ''])('rejects unrouted "%s"', (unrouted) => {
    expect(listReportsQuerySchema.safeParse({ unrouted }).success).toBe(false);
  });

  it('rejects an unknown status', () => {
    expect(listReportsQuerySchema.safeParse({ status: 'CLOSED' }).success).toBe(false);
  });

  it('rejects a non-UUID categoryId', () => {
    expect(listReportsQuerySchema.safeParse({ categoryId: 'lights' }).success).toBe(false);
  });

  it.each([
    ['organizationId', UUID],
    ['areaId', UUID],
    ['reporterId', UUID],
  ])('rejects the smuggled filter %s', (field, value) => {
    expect(listReportsQuerySchema.safeParse({ [field]: value }).success).toBe(false);
  });

  it('keeps the pagination cap', () => {
    expect(listReportsQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
  });
});

describe('changeStatusSchema', () => {
  it('accepts IN_PROGRESS without a note', () => {
    expect(changeStatusSchema.safeParse({ status: 'IN_PROGRESS' }).success).toBe(true);
  });

  it.each(['RESOLVED', 'REJECTED'])('requires a note for %s', (status) => {
    const result = changeStatusSchema.safeParse({ status });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['note']);
  });

  it.each(['RESOLVED', 'REJECTED'])('accepts %s with a note', (status) => {
    const input = { status, note: 'Replaced the bulb.' };
    expect(changeStatusSchema.safeParse(input).success).toBe(true);
  });

  it('trims the note', () => {
    const result = changeStatusSchema.parse({ status: 'RESOLVED', note: '  Fixed.  ' });
    expect(result.note).toBe('Fixed.');
  });

  it('rejects a note made only of spaces', () => {
    expect(changeStatusSchema.safeParse({ status: 'REJECTED', note: '   ' }).success).toBe(false);
  });

  it('accepts a note of exactly 500 characters and rejects 501', () => {
    const at = { status: 'RESOLVED', note: 'x'.repeat(500) };
    const over = { status: 'RESOLVED', note: 'x'.repeat(501) };
    expect(changeStatusSchema.safeParse(at).success).toBe(true);
    expect(changeStatusSchema.safeParse(over).success).toBe(false);
  });

  it.each(['CLOSED', 'WAITING_FOR_INFO', 'in_progress', ''])(
    'rejects the status "%s"',
    (status) => {
      expect(changeStatusSchema.safeParse({ status }).success).toBe(false);
    },
  );

  it('rejects a body without status', () => {
    expect(changeStatusSchema.safeParse({ note: 'Done.' }).success).toBe(false);
  });

  it.each([
    ['assignedToId', UUID],
    ['organizationId', UUID],
    ['areaId', UUID],
    ['categoryId', UUID],
    ['role', 'ADMIN'],
  ])('rejects the smuggled field %s', (field, value) => {
    const input = { status: 'IN_PROGRESS', [field]: value };
    expect(changeStatusSchema.safeParse(input).success).toBe(false);
  });
});
