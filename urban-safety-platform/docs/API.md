# API reference (v1)

Written from the code (routes, Zod schemas, services). If this file and the code disagree, the code wins and this file is the bug.

## Conventions

**Base URL:** `/api/v1`. Every path below is relative to it.

**Authentication.** Login, logout, token refresh and password reset happen between the frontend and Supabase directly; the API has no endpoints for them. Protected endpoints take the Supabase access token:

```
Authorization: Bearer <access_token>
```

The API checks the token with Supabase, then loads the caller's Profile. Role, organization and area always come from that Profile, never from the request.

**Roles:** `CITIZEN` (self-registered), `STAFF` (created by the admin, bound to one organization and one area), `ADMIN` (exactly one, created by the seed).

**Request bodies** are JSON. Every body, query and params object is strict: an unknown field (for example a smuggled `role`) is a `400 VALIDATION_ERROR`.

**Success shapes**

```json
{ "data": { ... } }
{ "data": [ ... ], "meta": { "page": 1, "limit": 20, "total": 134 } }
```

`204` has no body. Dates are ISO-8601 UTC strings; ids are UUIDs.

**Pagination** (every paginated list): `page` integer ≥ 1, default `1`; `limit` integer 1–100, default `20`.

**Error shape** (every error, including 404 for unknown routes and 429)

```json
{ "error": { "code": "DUPLICATE_REPORTS", "message": "Similar reports already exist", "details": { ... } } }
```

`details` is present only when it carries something. Clients branch on `code`, never on `message`.

### Errors any endpoint can return

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Body, query or params fail the schema, or the JSON is malformed. `details.issues` = `[{ location, path, message }]` (rejected values are never echoed) |
| 401 | `UNAUTHORIZED` | Token missing, invalid, expired, or the user has no Profile. Always the same message on purpose |
| 403 | `FORBIDDEN` | Authenticated, but the role is not allowed on this endpoint |
| 404 | `NOT_FOUND` | Unknown route (`"Route not found"`) |
| 429 | `RATE_LIMITED` | Rate limit hit (only on the three limited endpoints). `RateLimit` / `RateLimit-Policy` headers (draft-8) tell the client when to retry |
| 500 | `INTERNAL_ERROR` | Unexpected failure. The message is always `"Something went wrong"`; details go to the server log only |

The tables per endpoint below list only the codes specific to that endpoint.

### Report statuses

`PENDING` → `ASSIGNED` → `IN_PROGRESS` → `RESOLVED` / `REJECTED`. `RESOLVED` and `REJECTED` are final.

## Endpoint index

| # | Method | Path | Who | Rate limit |
|---|---|---|---|---|
| 1 | GET | `/health` | public | — |
| 2 | POST | `/auth/register` | public | 5 / hour / IP |
| 3 | DELETE | `/auth/account` | CITIZEN, STAFF | — |
| 4 | GET | `/profiles/me` | any role | — |
| 5 | GET | `/categories` | any role | — |
| 6 | GET | `/areas` | any role | — |
| 7 | GET | `/organizations` | ADMIN | — |
| 8 | GET | `/responsibility-rules` | ADMIN | — |
| 9 | POST | `/responsibility-rules` | ADMIN | — |
| 10 | PATCH | `/responsibility-rules/:id` | ADMIN | — |
| 11 | POST | `/reports` | CITIZEN | 10 / hour / user |
| 12 | GET | `/reports/track/:trackingNumber` | public | 60 / 15 min / IP |
| 13 | GET | `/reports/mine` | CITIZEN | — |
| 14 | POST | `/reports/:id/confirm` | CITIZEN | — |
| 15 | GET | `/reports` | STAFF, ADMIN | — |
| 16 | GET | `/reports/:id` | STAFF, ADMIN | — |
| 17 | PATCH | `/reports/:id/status` | STAFF, ADMIN | — |
| 18 | POST | `/admin/staff` | ADMIN | — |

---

## Health

### 1. `GET /health`

Liveness check. No auth.

**200**
```json
{ "data": { "status": "ok" } }
```

---

## Auth

### 2. `POST /auth/register`

Creates a citizen account (Supabase user + Profile with role `CITIZEN`). The client logs in afterwards through Supabase. Whether Supabase requires email confirmation first is a project setting (decisions G6).

**Body**

| Field | Type | Rules |
|---|---|---|
| `email` | string | valid email; stored lowercased |
| `password` | string | 8–72 characters; not trimmed |
| `fullName` | string | trimmed, 2–100 characters |

**201**
```json
{ "data": { "id": "6f1c…" } }
```

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `"Password is too weak"` or `"Email address is not accepted"` (Supabase's own rules) |
| 409 | `EMAIL_TAKEN` | The email already has an account |
| 429 | `RATE_LIMITED` | More than 5 attempts per hour from one IP (invalid attempts count too) |

### 3. `DELETE /auth/account`

Deletes the caller's own account. The Profile is removed with it; the caller's reports stay (without a reporter). Roles: `CITIZEN`, `STAFF`. The admin account cannot be deleted.

**204** — no body.

---

## Profiles

### 4. `GET /profiles/me`

The caller's own Profile. Any authenticated role.

**200**
```json
{
  "data": {
    "id": "6f1c…",
    "fullName": "Sara Haddad",
    "role": "STAFF",
    "organizationId": "a3e2…",
    "areaId": "91bd…",
    "createdAt": "2026-10-01T09:12:44.000Z"
  }
}
```

`organizationId` and `areaId` are `null` for `CITIZEN` and `ADMIN`. The frontend uses `role` to choose which screens to show.

---

## Reference data

### 5. `GET /categories`

All categories, sorted by name. Any authenticated role. Not paginated (small, static list).

**200**
```json
{ "data": [ { "id": "c1…", "name": "Broken street light", "isEmergency": false } ] }
```

Emergency categories are listed on purpose so the form can warn the citizen before submitting; creating a report in one is rejected (see 11).

### 6. `GET /areas`

All areas, sorted by name. Any authenticated role. Not paginated.

**200**
```json
{ "data": [ { "id": "91bd…", "name": "Old Town" } ] }
```

### 7. `GET /organizations`

All organizations, sorted by name. `ADMIN` only (needed for staff creation and routing rules). Not paginated.

**200**
```json
{ "data": [ { "id": "a3e2…", "name": "City Lighting Department", "type": "MUNICIPALITY" } ] }
```

`type` is one of `MUNICIPALITY`, `TRANSPORT`, `UTILITY`, `OTHER`.

### 8. `GET /responsibility-rules`

The routing table, paginated. `ADMIN` only. Sorted by category name, then area name, then priority (the rule that wins first).

**Query:** `page`, `limit`.

**200**
```json
{
  "data": [
    {
      "id": "r1…",
      "priority": 1,
      "active": true,
      "createdAt": "2026-09-20T10:00:00.000Z",
      "category": { "id": "c1…", "name": "Broken street light" },
      "area": { "id": "91bd…", "name": "Old Town" },
      "organization": { "id": "a3e2…", "name": "City Lighting Department" }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 48 }
}
```

### 9. `POST /responsibility-rules`

Adds a routing rule: reports in this category and area go to this organization. When several active rules match, the lowest `priority` wins. `ADMIN` only.

**Body**

| Field | Type | Rules |
|---|---|---|
| `categoryId` | uuid | must exist |
| `areaId` | uuid | must exist |
| `organizationId` | uuid | must exist |
| `priority` | integer | 1–100, optional, default `1` |

**201** — one rule, same shape as an item in 8.

| Status | Code | When |
|---|---|---|
| 404 | `CATEGORY_NOT_FOUND` / `AREA_NOT_FOUND` / `ORGANIZATION_NOT_FOUND` | A referenced id does not exist |
| 409 | `RULE_CONFLICT` | A rule with this priority already exists for this category and area |

### 10. `PATCH /responsibility-rules/:id`

Changes a rule. `ADMIN` only. Category and area cannot be changed (create a new rule instead). Existing reports are never re-routed; only new reports use the change.

**Params:** `id` uuid.

**Body** — at least one field:

| Field | Type | Rules |
|---|---|---|
| `organizationId` | uuid | optional; must exist |
| `priority` | integer | optional; 1–100 |
| `active` | boolean | optional; `false` takes the rule out of routing |

**200** — the updated rule, same shape as an item in 8.

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Empty body (`"At least one field must be provided"`) |
| 404 | `RULE_NOT_FOUND` / `ORGANIZATION_NOT_FOUND` | Unknown rule or organization |
| 409 | `RULE_CONFLICT` | The new priority collides with another rule for the same category and area |

---

## Reports — citizen and public

### 11. `POST /reports`

Files a report. `CITIZEN` only. Checks run in this order, and nothing is written unless all pass: image path → category/area exist → not an emergency → no active duplicates → routing.

**Image upload.** Optional. The frontend uploads the file to Supabase Storage itself, into the caller's own folder, then sends the path here: `<callerUserId>/<fileName>`, where `fileName` is letters, digits, `.`, `_`, `-`, ending in `.jpg`, `.jpeg`, `.png` or `.webp`. The bucket is public-read.

**Body**

| Field | Type | Rules |
|---|---|---|
| `categoryId` | uuid | required |
| `areaId` | uuid | required |
| `description` | string | trimmed, 10–1000 characters. Shown to other citizens in duplicate warnings: tell users not to put personal data here |
| `imagePath` | string | optional, 1–255 characters, format above |
| `acknowledgeDuplicates` | boolean | optional. `true` skips the duplicate check (the citizen saw the list and says this is a different problem) |

**201**
```json
{ "data": { "trackingNumber": "TRK-7Q2M9XK4TB", "status": "ASSIGNED", "createdAt": "2026-10-09T08:30:00.000Z" } }
```

`status` is `ASSIGNED` when a routing rule matched, `PENDING` when none did (the admin then handles it). The tracking number is the citizen's only handle for public tracking: show it prominently.

| Status | Code | When |
|---|---|---|
| 400 | `INVALID_IMAGE_PATH` | Not in the caller's folder, or a bad file name / extension |
| 400 | `EMERGENCY_CATEGORY` | The category is an emergency. Nothing is stored; tell the user to call the emergency services |
| 404 | `CATEGORY_NOT_FOUND` / `AREA_NOT_FOUND` | Unknown id |
| 409 | `DUPLICATE_REPORTS` | Active reports (pending, assigned or in progress) for the same category and area exist from the last 15 days. See below |
| 429 | `RATE_LIMITED` | More than 10 reports per hour by this user |

**Duplicate flow.** The 409 lists up to 10 matches, newest first:

```json
{
  "error": {
    "code": "DUPLICATE_REPORTS",
    "message": "Similar reports already exist",
    "details": {
      "duplicates": [
        { "id": "5b0e…", "trackingNumber": "TRK-1A2B3C4D5E", "description": "Street light out at…", "status": "ASSIGNED", "createdAt": "2026-10-05T17:02:11.000Z" }
      ]
    }
  }
}
```

The frontend shows the list and offers two choices: **"Me too"** → `POST /reports/{id}/confirm` with the chosen `id` (14), or **"Mine is different"** → resend the same body with `"acknowledgeDuplicates": true`.

### 12. `GET /reports/track/:trackingNumber`

Public tracking. No auth.

**Params:** `trackingNumber` must match `TRK-` + 10 characters from `0-9 A-Z` without `I L O U` (uppercase). Anything else is a 400 before the database is touched.

**200**
```json
{
  "data": {
    "status": "REJECTED",
    "category": { "name": "Broken street light" },
    "area": { "name": "Old Town" },
    "createdAt": "2026-10-01T08:30:00.000Z",
    "updatedAt": "2026-10-03T12:10:00.000Z",
    "finalNote": "This street is private property; the owner has been informed."
  }
}
```

`finalNote` is the closing note when `status` is `RESOLVED` or `REJECTED`, otherwise `null`. Never returned: description, image, reporter, staff identities, earlier notes.

| Status | Code | When |
|---|---|---|
| 404 | `REPORT_NOT_FOUND` | No report with this number |
| 429 | `RATE_LIMITED` | More than 60 lookups per 15 minutes from one IP |

### 13. `GET /reports/mine`

The caller's own reports, newest first. `CITIZEN` only.

**Query:** `page`, `limit` (no filters).

**200** — items have the fields of 12 plus `trackingNumber`:
```json
{
  "data": [
    {
      "trackingNumber": "TRK-7Q2M9XK4TB",
      "status": "IN_PROGRESS",
      "category": { "name": "Pothole" },
      "area": { "name": "Old Town" },
      "createdAt": "2026-10-09T08:30:00.000Z",
      "updatedAt": "2026-10-09T10:00:00.000Z",
      "finalNote": null
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 3 }
}
```

### 14. `POST /reports/:id/confirm`

"Me too" on someone else's active report. `CITIZEN` only. Changes nothing on the report itself in v1. The `id` comes from the duplicate list (11).

**Params:** `id` uuid. No body.

**200**
```json
{ "data": { "trackingNumber": "TRK-1A2B3C4D5E", "confirmationCount": 4 } }
```

| Status | Code | When |
|---|---|---|
| 400 | `OWN_REPORT` | The caller filed this report |
| 404 | `REPORT_NOT_FOUND` | Unknown id |
| 409 | `REPORT_NOT_ACTIVE` | The report is already resolved or rejected |
| 409 | `ALREADY_CONFIRMED` | The caller confirmed it before (also on a double click) |

---

## Reports — staff and admin

**Scope.** `STAFF` see only reports of **their** organization **and** area. A report outside that scope behaves exactly like a missing one (`404 REPORT_NOT_FOUND`), so other areas cannot be probed. `ADMIN` sees every report, including unrouted ones (`organization: null`), but only processes unrouted ones (see 17).

**Staff report shape** (used by 15 and 17):
```json
{
  "id": "5b0e…",
  "trackingNumber": "TRK-1A2B3C4D5E",
  "status": "IN_PROGRESS",
  "description": "Street light out at the corner of …",
  "category": { "id": "c1…", "name": "Broken street light" },
  "area": { "id": "91bd…", "name": "Old Town" },
  "organization": { "id": "a3e2…", "name": "City Lighting Department" },
  "assignedTo": { "id": "6f1c…", "fullName": "Sara Haddad" },
  "createdAt": "2026-10-05T17:02:11.000Z",
  "updatedAt": "2026-10-06T08:00:00.000Z"
}
```

`organization` is `null` for an unrouted report; `assignedTo` is `null` until a staff member starts or rejects it. Reporter identity is never returned.

### 15. `GET /reports`

Paginated list, newest first. `STAFF`, `ADMIN`.

**Query**

| Field | Type | Rules |
|---|---|---|
| `page`, `limit` | integer | pagination |
| `status` | enum | optional; one report status |
| `categoryId` | uuid | optional |
| `unrouted` | `true` / `false` | optional, **ADMIN only**. `true` = only reports with no organization, `false` = only routed ones. Exactly these words |

**200** — `{ "data": [ <staff report>, … ], "meta": { … } }`

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `unrouted` sent by STAFF (`"The unrouted filter is only available to admins"`) |

### 16. `GET /reports/:id`

One report with its image and full history. `STAFF` (in scope), `ADMIN`.

**Params:** `id` uuid.

**200** — the staff report shape plus `imageUrl` and `statusHistory` (oldest first):
```json
{
  "data": {
    "id": "5b0e…",
    "…": "all staff report fields",
    "imageUrl": "https://<project>.supabase.co/storage/v1/object/public/<bucket>/<userId>/photo.jpg",
    "statusHistory": [
      { "toStatus": "PENDING", "note": null, "createdAt": "2026-10-05T17:02:11.000Z", "changedByName": null },
      { "toStatus": "ASSIGNED", "note": "Auto-routed", "createdAt": "2026-10-05T17:02:11.000Z", "changedByName": null },
      { "toStatus": "IN_PROGRESS", "note": null, "createdAt": "2026-10-06T08:00:00.000Z", "changedByName": "Sara Haddad" }
    ]
  }
}
```

`imageUrl` is `null` when no image was attached. `changedByName` is shown only for staff; it is `null` for the citizen's creation row, the automatic routing row, and admin actions.

| Status | Code | When |
|---|---|---|
| 404 | `REPORT_NOT_FOUND` | Missing or outside the caller's scope |

### 17. `PATCH /reports/:id/status`

Moves a report through its lifecycle. `STAFF`, `ADMIN`. Each change is recorded in the history in the same transaction.

**Params:** `id` uuid.

**Body**

| Field | Type | Rules |
|---|---|---|
| `status` | enum | the target status |
| `note` | string | trimmed, 1–500 characters. **Required** when `status` is `RESOLVED` or `REJECTED`. Write it as if the citizen reads it: the closing note is public (12) |

No other field is accepted: assignee, organization, area and category cannot be changed here.

**Allowed moves** (anything else is `400 INVALID_TRANSITION`):

| From | To | Who | Condition |
|---|---|---|---|
| `ASSIGNED` | `IN_PROGRESS` | STAFF | Report unassigned; the caller becomes the assignee ("start") |
| `ASSIGNED` | `REJECTED` | STAFF | Report unassigned; the caller becomes the assignee (reject without starting) |
| `IN_PROGRESS` | `RESOLVED` | STAFF | Caller is the assignee |
| `IN_PROGRESS` | `REJECTED` | STAFF | Caller is the assignee |
| `PENDING` | `REJECTED` | ADMIN | Unrouted report (e.g. "area not served") |

`PENDING → ASSIGNED` happens only through routing when a report is created; no request can do it.

**200** — `{ "data": <staff report> }` after the change.

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing note on `RESOLVED` / `REJECTED`, or an extra field |
| 400 | `INVALID_TRANSITION` | The move is not in the table above for the caller's role |
| 403 | `NOT_ASSIGNEE` | The report is `IN_PROGRESS` and assigned to another staff member |
| 404 | `REPORT_NOT_FOUND` | Missing or outside the caller's scope |
| 409 | `STATE_CHANGED` | Someone changed the report since it was read (e.g. a colleague started it first). Reload it (16) and decide again |

---

## Admin

### 18. `POST /admin/staff`

Creates a staff account bound to one organization and one area. `ADMIN` only. The email is confirmed by the admin, so no confirmation email is sent. The temporary password is passed to Supabase and never stored by the API; give it to the staff member out of band. Nothing forces a change on first login in v1 (decisions G2).

**Body**

| Field | Type | Rules |
|---|---|---|
| `email` | string | valid email; stored lowercased |
| `temporaryPassword` | string | 8–72 characters; not trimmed |
| `fullName` | string | trimmed, 2–100 characters |
| `organizationId` | uuid | must exist |
| `areaId` | uuid | must exist |

There is no `role` field: the role is always `STAFF`, and sending `role` is a 400.

**201**
```json
{
  "data": {
    "id": "6f1c…",
    "email": "sara.haddad@example.org",
    "fullName": "Sara Haddad",
    "organizationId": "a3e2…",
    "areaId": "91bd…"
  }
}
```

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `"Password is too weak"` (Supabase's own rules) |
| 404 | `ORGANIZATION_NOT_FOUND` / `AREA_NOT_FOUND` | Unknown id; checked before any account is created |
| 409 | `EMAIL_TAKEN` | The email already has an account |
