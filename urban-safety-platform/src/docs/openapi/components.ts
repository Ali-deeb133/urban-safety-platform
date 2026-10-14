import type { JsonObject } from 'swagger-ui-express';

import {
  FULL_NAME_MAX_LENGTH,
  FULL_NAME_MIN_LENGTH,
  PAGINATION_DEFAULT_LIMIT,
  PAGINATION_MAX_LIMIT,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../../config/constants';

// Limits come from the same constants the validators use, so the docs cannot drift from them.
// Values that live only inside a validation file (description, note, priority) are restated here.

const ref = (name: string): JsonObject => ({ $ref: `#/components/schemas/${name}` });

// Example ids, reused so the examples read as one consistent story.
export const EXAMPLE_IDS = {
  user: '6f1c2a8e-1d7b-4c43-9a51-0d2b9f3e7a10',
  report: '5b0e8c1d-3f2a-4e6b-9c7d-1a2b3c4d5e6f',
  category: 'c1a7e4b2-8d3f-4a19-b6c5-2e7f9a0d1b34',
  area: '91bd4f3e-2c1a-4b8d-9e7f-6a5b4c3d2e10',
  organization: 'a3e27c9d-5b4f-4e1a-8c2d-9f0e1b2a3c45',
  rule: 'e4d3c2b1-a098-4f7e-8d6c-5b4a39281706',
} as const;

const uuid: JsonObject = { type: 'string', format: 'uuid' };
const dateTime: JsonObject = { type: 'string', format: 'date-time' };
const idName = (exampleId: string, exampleName: string): JsonObject => ({
  type: 'object',
  required: ['id', 'name'],
  properties: {
    id: { ...uuid, example: exampleId },
    name: { type: 'string', example: exampleName },
  },
});
const nameOnly = (exampleName: string): JsonObject => ({
  type: 'object',
  required: ['name'],
  properties: { name: { type: 'string', example: exampleName } },
});

const schemas: JsonObject = {
  // ---- Shared ----
  Error: {
    type: 'object',
    required: ['error'],
    description: 'Every error has this shape. Clients branch on `code`, never on `message`.',
    properties: {
      error: {
        type: 'object',
        required: ['code', 'message'],
        properties: {
          code: { type: 'string', example: 'REPORT_NOT_FOUND' },
          message: { type: 'string', example: 'Report not found' },
          details: { description: 'Present only when it carries something.' },
        },
      },
    },
  },
  PaginationMeta: {
    type: 'object',
    required: ['page', 'limit', 'total'],
    properties: {
      page: { type: 'integer', example: 1 },
      limit: { type: 'integer', example: PAGINATION_DEFAULT_LIMIT },
      total: { type: 'integer', example: 3 },
    },
  },
  Role: { type: 'string', enum: ['CITIZEN', 'STAFF', 'ADMIN'] },
  ReportStatus: {
    type: 'string',
    enum: ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'],
    description: '`RESOLVED` and `REJECTED` are final.',
  },
  OrganizationType: { type: 'string', enum: ['MUNICIPALITY', 'TRANSPORT', 'UTILITY', 'OTHER'] },

  // ---- Docs helper ----
  DocsLoginInput: {
    type: 'object',
    required: ['email', 'password'],
    additionalProperties: false,
    properties: {
      email: { type: 'string', format: 'email', example: 'citizen@example.com' },
      password: { type: 'string', format: 'password', example: 'a-long-password' },
    },
  },
  DocsLoginResult: {
    type: 'object',
    required: ['accessToken', 'tokenType', 'expiresIn'],
    properties: {
      accessToken: {
        type: 'string',
        description: 'Paste this into **Authorize** (without the word Bearer).',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      },
      tokenType: { type: 'string', enum: ['Bearer'] },
      expiresIn: {
        type: 'integer',
        description: 'Seconds until the token expires.',
        example: 3600,
      },
    },
  },

  // ---- Auth & profiles ----
  RegisterInput: {
    type: 'object',
    required: ['email', 'password', 'fullName'],
    additionalProperties: false,
    properties: {
      email: {
        type: 'string',
        format: 'email',
        description: 'Stored lowercased.',
        example: 'jonas.weber@example.com',
      },
      password: {
        type: 'string',
        format: 'password',
        minLength: PASSWORD_MIN_LENGTH,
        maxLength: PASSWORD_MAX_LENGTH,
        description: 'Not trimmed: spaces count.',
        example: 'correct-horse-battery',
      },
      fullName: {
        type: 'string',
        minLength: FULL_NAME_MIN_LENGTH,
        maxLength: FULL_NAME_MAX_LENGTH,
        description: 'Trimmed.',
        example: 'Jonas Weber',
      },
    },
  },
  Profile: {
    type: 'object',
    required: ['id', 'fullName', 'role', 'organizationId', 'areaId', 'createdAt'],
    properties: {
      id: { ...uuid, example: EXAMPLE_IDS.user },
      fullName: { type: 'string', example: 'Sara Haddad' },
      role: ref('Role'),
      organizationId: {
        ...uuid,
        nullable: true,
        description: '`null` for CITIZEN and ADMIN.',
        example: EXAMPLE_IDS.organization,
      },
      areaId: {
        ...uuid,
        nullable: true,
        description: '`null` for CITIZEN and ADMIN.',
        example: EXAMPLE_IDS.area,
      },
      createdAt: { ...dateTime, example: '2026-10-01T09:12:44.000Z' },
    },
  },

  // ---- Reference data ----
  Category: {
    type: 'object',
    required: ['id', 'name', 'isEmergency'],
    properties: {
      id: { ...uuid, example: EXAMPLE_IDS.category },
      name: { type: 'string', example: 'Broken street light' },
      isEmergency: {
        type: 'boolean',
        description: 'Listed so the form can warn early; filing a report in one is rejected.',
        example: false,
      },
    },
  },
  Area: idName(EXAMPLE_IDS.area, 'Mitte'),
  Organization: {
    type: 'object',
    required: ['id', 'name', 'type'],
    properties: {
      id: { ...uuid, example: EXAMPLE_IDS.organization },
      name: { type: 'string', example: 'Stromnetz Berlin' },
      type: ref('OrganizationType'),
    },
  },
  ResponsibilityRule: {
    type: 'object',
    required: ['id', 'priority', 'active', 'createdAt', 'category', 'area', 'organization'],
    properties: {
      id: { ...uuid, example: EXAMPLE_IDS.rule },
      priority: { type: 'integer', description: 'Lowest active priority wins.', example: 1 },
      active: { type: 'boolean', example: true },
      createdAt: { ...dateTime, example: '2026-09-20T10:00:00.000Z' },
      category: idName(EXAMPLE_IDS.category, 'Broken street light'),
      area: idName(EXAMPLE_IDS.area, 'Mitte'),
      organization: idName(EXAMPLE_IDS.organization, 'Stromnetz Berlin'),
    },
  },
  CreateRuleInput: {
    type: 'object',
    required: ['categoryId', 'areaId', 'organizationId'],
    additionalProperties: false,
    properties: {
      categoryId: { ...uuid, example: EXAMPLE_IDS.category },
      areaId: { ...uuid, example: EXAMPLE_IDS.area },
      organizationId: { ...uuid, example: EXAMPLE_IDS.organization },
      priority: { type: 'integer', minimum: 1, maximum: 100, default: 1, example: 2 },
    },
  },
  UpdateRuleInput: {
    type: 'object',
    minProperties: 1,
    additionalProperties: false,
    description:
      'At least one field. Category and area cannot change: create a new rule instead. ' +
      'Existing reports are never re-routed.',
    properties: {
      organizationId: { ...uuid, example: EXAMPLE_IDS.organization },
      priority: { type: 'integer', minimum: 1, maximum: 100, example: 3 },
      active: {
        type: 'boolean',
        description: '`false` takes the rule out of routing.',
        example: false,
      },
    },
  },

  // ---- Reports ----
  CreateReportInput: {
    type: 'object',
    required: ['categoryId', 'areaId', 'description'],
    additionalProperties: false,
    properties: {
      categoryId: { ...uuid, example: EXAMPLE_IDS.category },
      areaId: { ...uuid, example: EXAMPLE_IDS.area },
      description: {
        type: 'string',
        minLength: 10,
        maxLength: 1000,
        description:
          'Trimmed. Other citizens see it in duplicate warnings, so it should hold no personal data.',
        example: 'Street light out at the corner of Torstraße and Rosenthaler Straße.',
      },
      imagePath: {
        type: 'string',
        minLength: 1,
        maxLength: 255,
        description:
          'Optional. The frontend uploads the image to Supabase Storage first, into the ' +
          "caller's own folder, then sends `<callerUserId>/<fileName>` (letters, digits, " +
          '`.` `_` `-`, ending in `.jpg`, `.jpeg`, `.png` or `.webp`).',
        example: `${EXAMPLE_IDS.user}/street-light.jpg`,
      },
      acknowledgeDuplicates: {
        type: 'boolean',
        description:
          '`true` skips the duplicate check: the citizen saw the list and says this is a different problem.',
        example: false,
      },
    },
  },
  CreatedReport: {
    type: 'object',
    required: ['trackingNumber', 'status', 'createdAt'],
    properties: {
      trackingNumber: { type: 'string', example: 'TRK-7Q2M9XK4TB' },
      status: {
        type: 'string',
        enum: ['ASSIGNED', 'PENDING'],
        description: '`ASSIGNED` when a routing rule matched, `PENDING` when none did.',
        example: 'ASSIGNED',
      },
      createdAt: { ...dateTime, example: '2026-10-09T08:30:00.000Z' },
    },
  },
  TrackedReport: {
    type: 'object',
    required: ['status', 'category', 'area', 'createdAt', 'updatedAt', 'finalNote'],
    description: 'Public view. Never includes description, image, reporter or staff identities.',
    properties: {
      status: ref('ReportStatus'),
      category: nameOnly('Broken street light'),
      area: nameOnly('Mitte'),
      createdAt: { ...dateTime, example: '2026-10-01T08:30:00.000Z' },
      updatedAt: { ...dateTime, example: '2026-10-03T12:10:00.000Z' },
      finalNote: {
        type: 'string',
        nullable: true,
        description: 'The closing note when `RESOLVED` or `REJECTED`, otherwise `null`.',
        example: 'The lamp was replaced on 3 October.',
      },
    },
  },
  MyReport: {
    allOf: [
      {
        type: 'object',
        required: ['trackingNumber'],
        properties: { trackingNumber: { type: 'string', example: 'TRK-7Q2M9XK4TB' } },
      },
      ref('TrackedReport'),
    ],
  },
  Confirmation: {
    type: 'object',
    required: ['trackingNumber', 'confirmationCount'],
    properties: {
      trackingNumber: { type: 'string', example: 'TRK-1A2B3C4D5E' },
      confirmationCount: { type: 'integer', example: 4 },
    },
  },
  DuplicateReport: {
    type: 'object',
    properties: {
      id: { ...uuid, example: EXAMPLE_IDS.report },
      trackingNumber: { type: 'string', example: 'TRK-1A2B3C4D5E' },
      description: { type: 'string', example: 'Street light out at the corner of Torstraße.' },
      status: ref('ReportStatus'),
      createdAt: { ...dateTime, example: '2026-10-05T17:02:11.000Z' },
    },
  },
  DuplicateReportsError: {
    type: 'object',
    required: ['error'],
    properties: {
      error: {
        type: 'object',
        required: ['code', 'message', 'details'],
        properties: {
          code: { type: 'string', enum: ['DUPLICATE_REPORTS'] },
          message: { type: 'string', example: 'Similar reports already exist' },
          details: {
            type: 'object',
            required: ['duplicates'],
            properties: {
              duplicates: {
                type: 'array',
                description: 'Up to 10 active matches, newest first.',
                items: ref('DuplicateReport'),
              },
            },
          },
        },
      },
    },
  },
  StaffReport: {
    type: 'object',
    required: [
      'id',
      'trackingNumber',
      'status',
      'description',
      'category',
      'area',
      'organization',
      'assignedTo',
      'createdAt',
      'updatedAt',
    ],
    description: 'Never includes reporter identity.',
    properties: {
      id: { ...uuid, example: EXAMPLE_IDS.report },
      trackingNumber: { type: 'string', example: 'TRK-1A2B3C4D5E' },
      status: ref('ReportStatus'),
      description: { type: 'string', example: 'Street light out at the corner of Torstraße.' },
      category: idName(EXAMPLE_IDS.category, 'Broken street light'),
      area: idName(EXAMPLE_IDS.area, 'Mitte'),
      organization: {
        ...idName(EXAMPLE_IDS.organization, 'Stromnetz Berlin'),
        nullable: true,
        description: '`null` for an unrouted report.',
      },
      assignedTo: {
        type: 'object',
        nullable: true,
        description: '`null` until a staff member starts or rejects the report.',
        required: ['id', 'fullName'],
        properties: {
          id: { ...uuid, example: EXAMPLE_IDS.user },
          fullName: { type: 'string', example: 'Sara Haddad' },
        },
      },
      createdAt: { ...dateTime, example: '2026-10-05T17:02:11.000Z' },
      updatedAt: { ...dateTime, example: '2026-10-06T08:00:00.000Z' },
    },
  },
  StatusHistoryEntry: {
    type: 'object',
    required: ['toStatus', 'note', 'createdAt', 'changedByName'],
    properties: {
      toStatus: ref('ReportStatus'),
      note: { type: 'string', nullable: true, example: null },
      createdAt: { ...dateTime, example: '2026-10-06T08:00:00.000Z' },
      changedByName: {
        type: 'string',
        nullable: true,
        description:
          'Shown only for staff; `null` for the creation row, automatic routing and admin actions.',
        example: 'Sara Haddad',
      },
    },
  },
  ReportDetail: {
    allOf: [
      ref('StaffReport'),
      {
        type: 'object',
        required: ['imageUrl', 'statusHistory'],
        properties: {
          imageUrl: {
            type: 'string',
            format: 'uri',
            nullable: true,
            example:
              'https://<project>.supabase.co/storage/v1/object/public/<bucket>/' +
              `${EXAMPLE_IDS.user}/street-light.jpg`,
          },
          statusHistory: {
            type: 'array',
            description: 'Oldest first.',
            items: ref('StatusHistoryEntry'),
          },
        },
      },
    ],
  },
  ChangeStatusInput: {
    type: 'object',
    required: ['status'],
    additionalProperties: false,
    properties: {
      status: ref('ReportStatus'),
      note: {
        type: 'string',
        minLength: 1,
        maxLength: 500,
        description:
          '**Required** for `RESOLVED` and `REJECTED`. The closing note is public (shown in tracking).',
        example: 'The lamp was replaced.',
      },
    },
  },

  // ---- Admin ----
  CreateStaffInput: {
    type: 'object',
    required: ['email', 'temporaryPassword', 'fullName', 'organizationId', 'areaId'],
    additionalProperties: false,
    description: 'No `role` field: the role is always STAFF, and sending one is a 400.',
    properties: {
      email: { type: 'string', format: 'email', example: 'sara.haddad@example.org' },
      temporaryPassword: {
        type: 'string',
        format: 'password',
        minLength: PASSWORD_MIN_LENGTH,
        maxLength: PASSWORD_MAX_LENGTH,
        description: 'Passed to Supabase, never stored by the API.',
        example: 'temporary-pass-123',
      },
      fullName: {
        type: 'string',
        minLength: FULL_NAME_MIN_LENGTH,
        maxLength: FULL_NAME_MAX_LENGTH,
        example: 'Sara Haddad',
      },
      organizationId: { ...uuid, example: EXAMPLE_IDS.organization },
      areaId: { ...uuid, example: EXAMPLE_IDS.area },
    },
  },
  CreatedStaff: {
    type: 'object',
    required: ['id', 'email', 'fullName', 'organizationId', 'areaId'],
    properties: {
      id: { ...uuid, example: EXAMPLE_IDS.user },
      email: { type: 'string', format: 'email', example: 'sara.haddad@example.org' },
      fullName: { type: 'string', example: 'Sara Haddad' },
      organizationId: { ...uuid, example: EXAMPLE_IDS.organization },
      areaId: { ...uuid, example: EXAMPLE_IDS.area },
    },
  },
};

const parameters: JsonObject = {
  Page: {
    name: 'page',
    in: 'query',
    schema: { type: 'integer', minimum: 1, default: 1 },
  },
  Limit: {
    name: 'limit',
    in: 'query',
    schema: {
      type: 'integer',
      minimum: 1,
      maximum: PAGINATION_MAX_LIMIT,
      default: PAGINATION_DEFAULT_LIMIT,
    },
  },
  ReportId: { name: 'id', in: 'path', required: true, schema: uuid, example: EXAMPLE_IDS.report },
  RuleId: { name: 'id', in: 'path', required: true, schema: uuid, example: EXAMPLE_IDS.rule },
  TrackingNumber: {
    name: 'trackingNumber',
    in: 'path',
    required: true,
    description:
      '`TRK-` followed by 10 characters from 0-9 and A-Z without I, L, O, U (uppercase). ' +
      'Anything else is a 400 before the database is touched.',
    schema: { type: 'string', pattern: '^TRK-[0-9A-HJKMNP-TV-Z]{10}$' },
    example: 'TRK-7Q2M9XK4TB',
  },
};

// Builds an error response with one named example per error code.
export function errorResponse(
  description: string,
  examples: Record<string, { code: string; message: string; details?: unknown }>,
): JsonObject {
  return {
    description,
    content: {
      'application/json': {
        schema: ref('Error'),
        examples: Object.fromEntries(
          Object.entries(examples).map(([name, error]) => [name, { value: { error } }]),
        ),
      },
    },
  };
}

// The errors any endpoint can return, referenced from each path that can hit them.
const responses: JsonObject = {
  ValidationError: errorResponse('Invalid input. Rejected values are never echoed back.', {
    VALIDATION_ERROR: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid input',
      details: { issues: [{ location: 'body', path: 'email', message: 'Invalid email address' }] },
    },
  }),
  Unauthorized: errorResponse(
    'Token missing, invalid or expired, or the user has no profile. Always the same message on purpose.',
    { UNAUTHORIZED: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
  ),
  Forbidden: errorResponse('Authenticated, but this role may not use the endpoint.', {
    FORBIDDEN: { code: 'FORBIDDEN', message: 'You are not allowed to do this' },
  }),
  RateLimited: {
    ...errorResponse('Rate limit hit. The `RateLimit` header says when to retry.', {
      RATE_LIMITED: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
    }),
    headers: {
      RateLimit: { schema: { type: 'string' }, description: 'IETF draft-8 rate limit header.' },
      'RateLimit-Policy': { schema: { type: 'string' } },
    },
  },
};

export const components: JsonObject = {
  securitySchemes: {
    bearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description:
        'A Supabase access token. Get one from **POST /api-docs/login** and paste the `accessToken` here.',
    },
  },
  schemas,
  parameters,
  responses,
};
