import type { JsonObject } from 'swagger-ui-express';

import { RATE_LIMITS } from '../../config/constants';
import { EXAMPLE_IDS, errorResponse } from './components';

const ref = (name: string): JsonObject => ({ $ref: `#/components/schemas/${name}` });
const commonResponse = (name: string): JsonObject => ({ $ref: `#/components/responses/${name}` });
const param = (name: string): JsonObject => ({ $ref: `#/components/parameters/${name}` });

const MINUTE_MS = 60 * 1000;
const perWindow = ({ limit, windowMs }: { limit: number; windowMs: number }): string =>
  windowMs === MINUTE_MS ? `${limit} per minute` : `${limit} per ${windowMs / MINUTE_MS} minutes`;

function jsonBody(schemaName: string): JsonObject {
  return { required: true, content: { 'application/json': { schema: ref(schemaName) } } };
}

// Success bodies are always wrapped: { data } or, for lists, { data, meta }.
function dataResponse(description: string, schema: JsonObject): JsonObject {
  return {
    description,
    content: {
      'application/json': {
        schema: { type: 'object', required: ['data'], properties: { data: schema } },
      },
    },
  };
}

function listResponse(description: string, itemSchemaName: string): JsonObject {
  return dataResponse(description, { type: 'array', items: ref(itemSchemaName) });
}

function pageResponse(description: string, itemSchemaName: string): JsonObject {
  return {
    description,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['data', 'meta'],
          properties: {
            data: { type: 'array', items: ref(itemSchemaName) },
            meta: ref('PaginationMeta'),
          },
        },
      },
    },
  };
}

const roles = (...names: string[]): string => `**Roles:** ${names.join(', ')}.`;
const secured = [{ bearerAuth: [] }];

// 401 and 403 for a protected endpoint; 403 only when a role check runs.
function authErrors(withRoleCheck: boolean): JsonObject {
  return withRoleCheck
    ? { 401: commonResponse('Unauthorized'), 403: commonResponse('Forbidden') }
    : { 401: commonResponse('Unauthorized') };
}

const notFound = (code: string, message: string): JsonObject =>
  errorResponse('Not found.', { [code]: { code, message } });

export const paths: JsonObject = {
  // ---------------------------------------------------------------- Docs helper
  '/api-docs/login': {
    post: {
      tags: ['Get a token'],
      operationId: 'docsLogin',
      // Public: no token needed.
      security: [],
      summary: 'Log in and get an access token for the Authorize button',
      description:
        'Exists only for this documentation page: the real frontend logs in with Supabase ' +
        'directly, and the API never calls this. It returns the same Supabase access token.\n\n' +
        '1. Register with **POST /api/v1/auth/register** (or use an account you have).\n' +
        '2. Log in here and copy `accessToken`.\n' +
        '3. Click **Authorize** at the top of the page and paste it.\n\n' +
        `Rate limit: 10 per 15 minutes per IP.`,
      requestBody: jsonBody('DocsLoginInput'),
      responses: {
        200: dataResponse('Logged in.', ref('DocsLoginResult')),
        400: commonResponse('ValidationError'),
        401: errorResponse('Login refused.', {
          INVALID_CREDENTIALS: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
          EMAIL_NOT_CONFIRMED: { code: 'EMAIL_NOT_CONFIRMED', message: 'Email not confirmed yet' },
        }),
        429: commonResponse('RateLimited'),
      },
    },
  },

  // ---------------------------------------------------------------- Health
  '/': {
    get: {
      tags: ['Health'],
      operationId: 'getRoot',
      // Public: no token needed.
      security: [],
      summary: 'API name, status and a link to these docs',
      responses: {
        200: {
          description: 'The API is up. `docs` is `null` when the docs are turned off.',
          content: {
            'application/json': {
              example: {
                data: {
                  name: 'Urban Safety Reporting Platform API',
                  status: 'ok',
                  docs: 'https://your-host/api-docs',
                },
              },
            },
          },
        },
      },
    },
  },
  '/api/v1/health': {
    get: {
      tags: ['Health'],
      operationId: 'getHealth',
      // Public: no token needed.
      security: [],
      summary: 'Liveness check',
      responses: {
        200: {
          description: 'The API is up.',
          content: { 'application/json': { example: { data: { status: 'ok' } } } },
        },
      },
    },
  },

  // ---------------------------------------------------------------- Auth
  '/api/v1/auth/register': {
    post: {
      tags: ['Auth'],
      operationId: 'registerCitizen',
      // Public: no token needed.
      security: [],
      summary: 'Register a citizen account',
      description:
        'Creates a Supabase user and a profile with role `CITIZEN`. If the profile cannot be ' +
        'created, the Supabase user is deleted again, so no half-made account remains.\n\n' +
        'Whether the account can log in immediately depends on the Supabase "confirm email" setting.\n\n' +
        `Rate limit: ${perWindow(RATE_LIMITS.register)} per IP (invalid attempts count too).`,
      requestBody: jsonBody('RegisterInput'),
      responses: {
        201: dataResponse('Account created.', {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid', example: EXAMPLE_IDS.user } },
        }),
        400: errorResponse('Invalid input, or rejected by Supabase password/email rules.', {
          VALIDATION_ERROR: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: {
              issues: [
                {
                  location: 'body',
                  path: 'password',
                  message: 'Too small: expected string to have >=8 characters',
                },
              ],
            },
          },
          WEAK_PASSWORD: { code: 'VALIDATION_ERROR', message: 'Password is too weak' },
          EMAIL_NOT_ACCEPTED: {
            code: 'VALIDATION_ERROR',
            message: 'Email address is not accepted',
          },
        }),
        409: errorResponse('Email taken.', {
          EMAIL_TAKEN: { code: 'EMAIL_TAKEN', message: 'Email already registered' },
        }),
        429: commonResponse('RateLimited'),
      },
    },
  },
  '/api/v1/auth/account': {
    delete: {
      tags: ['Auth'],
      operationId: 'deleteMyAccount',
      summary: 'Delete my own account',
      description:
        `${roles('CITIZEN', 'STAFF')} The profile is removed with the account; the caller's ` +
        'reports stay (without a reporter). The admin account cannot be deleted.',
      security: secured,
      responses: {
        204: { description: 'Deleted. No body.' },
        ...authErrors(true),
      },
    },
  },

  // ---------------------------------------------------------------- Profiles
  '/api/v1/profiles/me': {
    get: {
      tags: ['Profiles'],
      operationId: 'getMyProfile',
      summary: 'Get my profile',
      description: `${roles('any')} The frontend uses \`role\` to decide which screens to show.`,
      security: secured,
      responses: {
        200: dataResponse("The caller's profile.", ref('Profile')),
        ...authErrors(false),
      },
    },
  },

  // ---------------------------------------------------------------- Reference data
  '/api/v1/categories': {
    get: {
      tags: ['Reference data'],
      operationId: 'listCategories',
      summary: 'List report categories',
      description: `${roles('any')} Sorted by name. Not paginated.`,
      security: secured,
      responses: {
        200: listResponse('All categories.', 'Category'),
        ...authErrors(false),
      },
    },
  },
  '/api/v1/areas': {
    get: {
      tags: ['Reference data'],
      operationId: 'listAreas',
      summary: 'List areas',
      description: `${roles('any')} Sorted by name. Not paginated.`,
      security: secured,
      responses: {
        200: listResponse('All areas.', 'Area'),
        ...authErrors(false),
      },
    },
  },
  '/api/v1/organizations': {
    get: {
      tags: ['Reference data'],
      operationId: 'listOrganizations',
      summary: 'List organizations',
      description: `${roles('ADMIN')} Sorted by name. Not paginated.`,
      security: secured,
      responses: {
        200: listResponse('All organizations.', 'Organization'),
        ...authErrors(true),
      },
    },
  },
  '/api/v1/responsibility-rules': {
    get: {
      tags: ['Reference data'],
      operationId: 'listResponsibilityRules',
      summary: 'List routing rules',
      description:
        `${roles('ADMIN')} The routing table: which organization gets reports for a category ` +
        'in an area. Sorted by category, area, then priority (the winning rule first).',
      security: secured,
      parameters: [param('Page'), param('Limit')],
      responses: {
        200: pageResponse('One page of rules.', 'ResponsibilityRule'),
        400: commonResponse('ValidationError'),
        ...authErrors(true),
      },
    },
    post: {
      tags: ['Reference data'],
      operationId: 'createResponsibilityRule',
      summary: 'Create a routing rule',
      description:
        `${roles('ADMIN')} Reports in this category and area go to this organization. ` +
        'When several active rules match, the lowest `priority` wins.',
      security: secured,
      requestBody: jsonBody('CreateRuleInput'),
      responses: {
        201: dataResponse('Rule created.', ref('ResponsibilityRule')),
        400: commonResponse('ValidationError'),
        ...authErrors(true),
        404: errorResponse('A referenced id does not exist.', {
          CATEGORY_NOT_FOUND: { code: 'CATEGORY_NOT_FOUND', message: 'Category not found' },
          AREA_NOT_FOUND: { code: 'AREA_NOT_FOUND', message: 'Area not found' },
          ORGANIZATION_NOT_FOUND: {
            code: 'ORGANIZATION_NOT_FOUND',
            message: 'Organization not found',
          },
        }),
        409: errorResponse('Priority taken.', {
          RULE_CONFLICT: {
            code: 'RULE_CONFLICT',
            message: 'A rule with this priority already exists for this category and area',
          },
        }),
      },
    },
  },
  '/api/v1/responsibility-rules/{id}': {
    patch: {
      tags: ['Reference data'],
      operationId: 'updateResponsibilityRule',
      summary: 'Update a routing rule',
      description: `${roles('ADMIN')} Only new reports use the change; existing ones are never re-routed.`,
      security: secured,
      parameters: [param('RuleId')],
      requestBody: jsonBody('UpdateRuleInput'),
      responses: {
        200: dataResponse('The updated rule.', ref('ResponsibilityRule')),
        400: errorResponse('Invalid input.', {
          EMPTY_BODY: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: {
              issues: [
                { location: 'body', path: '', message: 'At least one field must be provided' },
              ],
            },
          },
        }),
        ...authErrors(true),
        404: errorResponse('Unknown rule or organization.', {
          RULE_NOT_FOUND: { code: 'RULE_NOT_FOUND', message: 'Rule not found' },
          ORGANIZATION_NOT_FOUND: {
            code: 'ORGANIZATION_NOT_FOUND',
            message: 'Organization not found',
          },
        }),
        409: errorResponse('Priority taken.', {
          RULE_CONFLICT: {
            code: 'RULE_CONFLICT',
            message: 'A rule with this priority already exists for this category and area',
          },
        }),
      },
    },
  },

  // ---------------------------------------------------------------- Reports: citizen and public
  '/api/v1/reports': {
    post: {
      tags: ['Reports: citizen & public'],
      operationId: 'createReport',
      summary: 'File a report',
      description:
        `${roles('CITIZEN')} Checks run in order and nothing is written unless all pass: ` +
        'image path → category/area exist → not an emergency → no active duplicates → routing.\n\n' +
        '**Duplicates:** if active reports for the same category and area exist from the last ' +
        '15 days, the API answers `409 DUPLICATE_REPORTS` with up to 10 of them. The citizen ' +
        'either confirms one ("me too", **POST /reports/{id}/confirm**) or resends with ' +
        '`"acknowledgeDuplicates": true`.\n\n' +
        `Rate limit: ${perWindow(RATE_LIMITS.createReport)} per user.`,
      security: secured,
      requestBody: jsonBody('CreateReportInput'),
      responses: {
        201: dataResponse(
          'Report filed. Show the tracking number to the citizen.',
          ref('CreatedReport'),
        ),
        400: errorResponse('Invalid input, bad image path, or an emergency category.', {
          VALIDATION_ERROR: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: {
              issues: [
                {
                  location: 'body',
                  path: 'description',
                  message: 'Too small: expected string to have >=10 characters',
                },
              ],
            },
          },
          INVALID_IMAGE_PATH: { code: 'INVALID_IMAGE_PATH', message: 'Invalid image path' },
          EMERGENCY_CATEGORY: {
            code: 'EMERGENCY_CATEGORY',
            message: 'This is an emergency. Call the emergency services instead of filing a report',
          },
        }),
        ...authErrors(true),
        404: errorResponse('Unknown category or area.', {
          CATEGORY_NOT_FOUND: { code: 'CATEGORY_NOT_FOUND', message: 'Category not found' },
          AREA_NOT_FOUND: { code: 'AREA_NOT_FOUND', message: 'Area not found' },
        }),
        409: {
          description: 'Similar active reports exist.',
          content: {
            'application/json': {
              schema: ref('DuplicateReportsError'),
              example: {
                error: {
                  code: 'DUPLICATE_REPORTS',
                  message: 'Similar reports already exist',
                  details: {
                    duplicates: [
                      {
                        id: EXAMPLE_IDS.report,
                        trackingNumber: 'TRK-1A2B3C4D5E',
                        description: 'Street light out at the corner of Torstraße.',
                        status: 'ASSIGNED',
                        createdAt: '2026-10-05T17:02:11.000Z',
                      },
                    ],
                  },
                },
              },
            },
          },
        },
        429: commonResponse('RateLimited'),
      },
    },
    get: {
      tags: ['Reports: staff & admin'],
      operationId: 'listReports',
      summary: 'List reports',
      description:
        `${roles('STAFF', 'ADMIN')} Newest first. STAFF see only reports of their own ` +
        'organization **and** area; ADMIN sees all, including unrouted ones.',
      security: secured,
      parameters: [
        param('Page'),
        param('Limit'),
        { name: 'status', in: 'query', schema: ref('ReportStatus') },
        { name: 'categoryId', in: 'query', schema: { type: 'string', format: 'uuid' } },
        {
          name: 'unrouted',
          in: 'query',
          description:
            '**ADMIN only.** `true` = only reports with no organization, `false` = only routed ones.',
          schema: { type: 'string', enum: ['true', 'false'] },
        },
      ],
      responses: {
        200: pageResponse('One page of reports.', 'StaffReport'),
        400: errorResponse('Invalid input, or `unrouted` sent by STAFF.', {
          UNROUTED_FOR_STAFF: {
            code: 'VALIDATION_ERROR',
            message: 'The unrouted filter is only available to admins',
          },
        }),
        ...authErrors(true),
      },
    },
  },
  '/api/v1/reports/track/{trackingNumber}': {
    get: {
      tags: ['Reports: citizen & public'],
      operationId: 'trackReport',
      // Public: no token needed.
      security: [],
      summary: 'Track a report by its tracking number (public)',
      description:
        'No login needed. Returns only status, place, dates and the closing note.\n\n' +
        `Rate limit: ${perWindow(RATE_LIMITS.trackReport)} per IP.`,
      parameters: [param('TrackingNumber')],
      responses: {
        200: dataResponse("The report's public status.", ref('TrackedReport')),
        400: errorResponse('Malformed tracking number.', {
          INVALID_TRACKING_NUMBER: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: {
              issues: [
                { location: 'params', path: 'trackingNumber', message: 'Invalid tracking number' },
              ],
            },
          },
        }),
        404: notFound('REPORT_NOT_FOUND', 'Report not found'),
        429: commonResponse('RateLimited'),
      },
    },
  },
  '/api/v1/reports/mine': {
    get: {
      tags: ['Reports: citizen & public'],
      operationId: 'listMyReports',
      summary: 'List my reports',
      description: `${roles('CITIZEN')} Newest first.`,
      security: secured,
      parameters: [param('Page'), param('Limit')],
      responses: {
        200: pageResponse("One page of the caller's reports.", 'MyReport'),
        400: commonResponse('ValidationError'),
        ...authErrors(true),
      },
    },
  },
  '/api/v1/reports/{id}/confirm': {
    post: {
      tags: ['Reports: citizen & public'],
      operationId: 'confirmReport',
      summary: 'Confirm someone else\'s report ("me too")',
      description:
        `${roles('CITIZEN')} The id comes from the duplicate list of **POST /reports**. ` +
        'No body.',
      security: secured,
      parameters: [param('ReportId')],
      responses: {
        200: dataResponse('Confirmation recorded.', ref('Confirmation')),
        400: errorResponse("Invalid id, or the caller's own report.", {
          OWN_REPORT: { code: 'OWN_REPORT', message: 'You cannot confirm your own report' },
        }),
        ...authErrors(true),
        404: notFound('REPORT_NOT_FOUND', 'Report not found'),
        409: errorResponse('Already closed or already confirmed.', {
          REPORT_NOT_ACTIVE: {
            code: 'REPORT_NOT_ACTIVE',
            message: 'This report is already closed',
          },
          ALREADY_CONFIRMED: {
            code: 'ALREADY_CONFIRMED',
            message: 'You already confirmed this report',
          },
        }),
      },
    },
  },

  // ---------------------------------------------------------------- Reports: staff and admin
  '/api/v1/reports/{id}': {
    get: {
      tags: ['Reports: staff & admin'],
      operationId: 'getReport',
      summary: 'Get one report with its image and full history',
      description:
        `${roles('STAFF', 'ADMIN')} For STAFF, a report outside their organization and area ` +
        'is answered exactly like a missing one (404), so other areas cannot be probed.',
      security: secured,
      parameters: [param('ReportId')],
      responses: {
        200: dataResponse('The report.', ref('ReportDetail')),
        400: commonResponse('ValidationError'),
        ...authErrors(true),
        404: notFound('REPORT_NOT_FOUND', 'Report not found'),
      },
    },
  },
  '/api/v1/reports/{id}/status': {
    patch: {
      tags: ['Reports: staff & admin'],
      operationId: 'changeReportStatus',
      summary: "Change a report's status",
      description:
        `${roles('STAFF', 'ADMIN')} Each change is written to the history in the same ` +
        'transaction. Allowed moves (anything else is `400 INVALID_TRANSITION`):\n\n' +
        '| From | To | Who | Condition |\n' +
        '|---|---|---|---|\n' +
        '| ASSIGNED | IN_PROGRESS | STAFF | Unassigned; the caller becomes the assignee |\n' +
        '| ASSIGNED | REJECTED | STAFF | Unassigned; the caller becomes the assignee |\n' +
        '| IN_PROGRESS | RESOLVED | STAFF | Caller is the assignee |\n' +
        '| IN_PROGRESS | REJECTED | STAFF | Caller is the assignee |\n' +
        '| PENDING | REJECTED | ADMIN | Unrouted report |\n\n' +
        '`PENDING → ASSIGNED` happens only through routing when a report is created.\n\n' +
        'Race-safe: if two staff members start the same report at once, exactly one succeeds ' +
        'and the other gets `409 STATE_CHANGED`.',
      security: secured,
      parameters: [param('ReportId')],
      requestBody: jsonBody('ChangeStatusInput'),
      responses: {
        200: dataResponse('The report after the change.', ref('StaffReport')),
        400: errorResponse('Invalid input or a move that is not allowed.', {
          NOTE_REQUIRED: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: {
              issues: [
                {
                  location: 'body',
                  path: 'note',
                  message: 'A note is required when resolving or rejecting a report',
                },
              ],
            },
          },
          INVALID_TRANSITION: {
            code: 'INVALID_TRANSITION',
            message: 'This status change is not allowed',
          },
        }),
        401: commonResponse('Unauthorized'),
        403: errorResponse('Role not allowed, or the report belongs to another staff member.', {
          FORBIDDEN: { code: 'FORBIDDEN', message: 'You are not allowed to do this' },
          NOT_ASSIGNEE: {
            code: 'NOT_ASSIGNEE',
            message: 'Only the assigned staff member can change this report',
          },
        }),
        404: notFound('REPORT_NOT_FOUND', 'Report not found'),
        409: errorResponse(
          'Someone changed the report since it was read. Reload and decide again.',
          {
            STATE_CHANGED: {
              code: 'STATE_CHANGED',
              message: 'Report state changed, reload it and try again',
            },
          },
        ),
      },
    },
  },

  // ---------------------------------------------------------------- Admin
  '/api/v1/admin/staff': {
    post: {
      tags: ['Admin'],
      operationId: 'createStaff',
      summary: 'Create a staff account',
      description:
        `${roles('ADMIN')} The account is bound to one organization and one area. The email ` +
        'is confirmed by the admin, so no confirmation email is sent.',
      security: secured,
      requestBody: jsonBody('CreateStaffInput'),
      responses: {
        201: dataResponse('Staff account created.', ref('CreatedStaff')),
        400: errorResponse('Invalid input (for example a `role` field) or a weak password.', {
          ROLE_FIELD: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: {
              issues: [{ location: 'body', path: '', message: 'Unrecognized key: "role"' }],
            },
          },
          WEAK_PASSWORD: { code: 'VALIDATION_ERROR', message: 'Password is too weak' },
        }),
        ...authErrors(true),
        404: errorResponse(
          'Unknown organization or area (checked before any account is created).',
          {
            ORGANIZATION_NOT_FOUND: {
              code: 'ORGANIZATION_NOT_FOUND',
              message: 'Organization not found',
            },
            AREA_NOT_FOUND: { code: 'AREA_NOT_FOUND', message: 'Area not found' },
          },
        ),
        409: errorResponse('Email taken.', {
          EMAIL_TAKEN: { code: 'EMAIL_TAKEN', message: 'Email already registered' },
        }),
      },
    },
  },
};
