import type { JsonObject } from 'swagger-ui-express';

import { DEMO_ACCOUNTS, DEMO_STORY_CATEGORY } from '../docs/demo-accounts';
import { components } from '../docs/openapi/components';
import { paths } from '../docs/openapi/paths';
import { API_NAME } from './constants';
import { env } from './env';

function demoAccountsSection(password: string): string {
  const { citizen, staff } = DEMO_ACCOUNTS;
  return (
    '### Demo accounts\n' +
    '| Role | Email | Password |\n' +
    '|---|---|---|\n' +
    `| CITIZEN | \`${citizen.email}\` | \`${password}\` |\n` +
    `| STAFF (${staff.organizationName}, ${staff.areaName}) | \`${staff.email}\` | \`${password}\` |\n\n` +
    '**Walk through the whole flow:**\n' +
    '1. Log in as the citizen (**POST /api-docs/login**) and click **Authorize** with the token.\n' +
    '2. `GET /api/v1/categories` and `GET /api/v1/areas`: note the ids of ' +
    `"${DEMO_STORY_CATEGORY}" and "${staff.areaName}".\n` +
    '3. `POST /api/v1/reports` with those ids. It is routed to ' +
    `${staff.organizationName} and you get a tracking number. (A \`409\` lists similar open ` +
    'reports: resend with `"acknowledgeDuplicates": true`.)\n' +
    '4. Log in as the staff member and **Authorize** again. `GET /api/v1/reports` shows the report.\n' +
    '5. `PATCH /api/v1/reports/{id}/status` with `IN_PROGRESS`, then `RESOLVED` and a note.\n' +
    '6. `GET /api/v1/reports/track/{trackingNumber}` (no login) shows the result.\n\n' +
    'Please do not delete the demo accounts; other visitors use them too.\n\n'
  );
}

// Unset password: the page simply tells visitors to register their own account.
const demoSection =
  env.DEMO_ACCOUNTS_PASSWORD === undefined ? '' : demoAccountsSection(env.DEMO_ACCOUNTS_PASSWORD);

// The OpenAPI document served at /api-docs. Schemas live in docs/openapi/components.ts and
// endpoints in docs/openapi/paths.ts; this file holds the page-level information.
export const openApiDocument: JsonObject = {
  openapi: '3.0.3',
  info: {
    title: API_NAME,
    version: '1.0.0',
    description:
      'A REST API that lets citizens report **non-emergency** urban safety problems (a broken ' +
      'street light, a pothole, a water leak) and track them with a tracking number. Each ' +
      'report is routed automatically to the responsible organization, whose staff move it ' +
      'through a strict, audited lifecycle.\n\n' +
      'Built with Express 5, TypeScript, Prisma (PostgreSQL), Supabase Auth and Zod.\n\n' +
      '### Try it\n' +
      '- **No login needed:** `GET /api/v1/health`, `POST /api/v1/auth/register`, ' +
      '`GET /api/v1/reports/track/{trackingNumber}`.\n' +
      '- **Everything else:** log in with **POST /api-docs/login** (a demo account if listed ' +
      'below, or one you registered), then click **Authorize** and paste the `accessToken`. A registered ' +
      'account has role `CITIZEN`; staff and admin endpoints answer `403` for it.\n\n' +
      demoSection +
      '### Conventions\n' +
      '- Success: `{ "data": ... }`, lists add `"meta": { page, limit, total }`.\n' +
      '- Errors: `{ "error": { "code", "message", "details"? } }`. Any endpoint can also ' +
      'answer `500 INTERNAL_ERROR` with the message "Something went wrong".\n' +
      '- Every body, query and path object is strict: an unknown field is a `400`.\n' +
      '- Roles: `CITIZEN` (self-registered), `STAFF` (created by the admin, bound to one ' +
      'organization and area), `ADMIN` (exactly one).',
  },
  // Relative, so "Try it out" calls whichever host serves this page.
  servers: [{ url: '/', description: 'This server' }],
  tags: [
    { name: 'Get a token', description: 'Documentation-only login for the Authorize button.' },
    { name: 'Health', description: 'Is the API up?' },
    {
      name: 'Auth',
      description: 'Registration and account deletion. Login is handled by Supabase.',
    },
    { name: 'Profiles', description: "The caller's own profile." },
    { name: 'Reports: citizen & public', description: 'Filing, tracking and confirming reports.' },
    { name: 'Reports: staff & admin', description: 'Working through reports.' },
    { name: 'Reference data', description: 'Categories, areas, organizations and routing rules.' },
    { name: 'Admin', description: 'Staff account management.' },
  ],
  paths,
  components,
};
