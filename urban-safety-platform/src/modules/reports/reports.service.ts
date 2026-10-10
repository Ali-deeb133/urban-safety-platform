import { Prisma, ReportStatus, Role } from '@prisma/client';

import {
  AUTO_ROUTED_NOTE,
  FINAL_REPORT_STATUSES,
  IMAGE_FILE_NAME_PATTERN,
} from '../../config/constants';
import type { AssigneeRule } from '../../config/constants';
import { prisma } from '../../config/db';
import { env } from '../../config/env';
import { ConflictError } from '../../errors/conflict-error';
import { ForbiddenError } from '../../errors/forbidden-error';
import { InvalidTransitionError } from '../../errors/invalid-transition-error';
import { NotFoundError } from '../../errors/not-found-error';
import { ValidationError } from '../../errors/validation-error';
import type { AuthUser } from '../../types/express';
import { buildPaginationMeta, toSkipTake } from '../../utils/pagination';
import type { PaginationMeta } from '../../utils/pagination';
import { generateTrackingNumber } from '../../utils/tracking-number';
import { ensureNoActiveDuplicates } from './dedup.service';
import { findResponsibleOrganization } from './routing.service';
import { ensureReportable } from './safety-net.service';
import { findTransition } from './state-machine.service';
import type {
  ChangeStatusInput,
  CreateReportInput,
  ListMyReportsQuery,
  ListReportsQuery,
} from './reports.validation';

const REPORT_CREATED_SELECT = {
  trackingNumber: true,
  status: true,
  createdAt: true,
} satisfies Prisma.ReportSelect;

export type CreatedReportDto = Prisma.ReportGetPayload<{ select: typeof REPORT_CREATED_SELECT }>;

// Public, no login: never description, image, reporter, staff identities or earlier notes.
const REPORT_PUBLIC_SELECT = {
  status: true,
  category: { select: { name: true } },
  area: { select: { name: true } },
  createdAt: true,
  updatedAt: true,
  statusHistory: {
    select: { note: true },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
} satisfies Prisma.ReportSelect;

// The citizen's own list: the public fields plus the tracking number, nothing more.
const REPORT_MINE_SELECT = {
  trackingNumber: true,
  ...REPORT_PUBLIC_SELECT,
} satisfies Prisma.ReportSelect;

// Staff and admin lists: enough to triage. Never reporter identity; the assignee is staff (C14).
const REPORT_STAFF_SELECT = {
  id: true,
  trackingNumber: true,
  status: true,
  description: true,
  category: { select: { id: true, name: true } },
  area: { select: { id: true, name: true } },
  organization: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, fullName: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ReportSelect;

export type StaffReportDto = Prisma.ReportGetPayload<{ select: typeof REPORT_STAFF_SELECT }>;

// changedBy.role is read only to decide whether the name may be shown; it never leaves the service.
const REPORT_DETAIL_SELECT = {
  ...REPORT_STAFF_SELECT,
  imagePath: true,
  statusHistory: {
    select: {
      toStatus: true,
      note: true,
      createdAt: true,
      changedBy: { select: { fullName: true, role: true } },
    },
    // The two rows written at creation can share createdAt; the one with no fromStatus came first.
    orderBy: [{ createdAt: 'asc' }, { fromStatus: { sort: 'asc', nulls: 'first' } }, { id: 'asc' }],
  },
} satisfies Prisma.ReportSelect;

type ReportDetailRow = Prisma.ReportGetPayload<{ select: typeof REPORT_DETAIL_SELECT }>;

export interface StatusHistoryEntryDto {
  toStatus: ReportStatus;
  note: string | null;
  createdAt: Date;
  changedByName: string | null;
}

export type ReportDetailDto = Omit<ReportDetailRow, 'imagePath' | 'statusHistory'> & {
  imageUrl: string | null;
  statusHistory: StatusHistoryEntryDto[];
};

type ReportPublicRow = Prisma.ReportGetPayload<{ select: typeof REPORT_PUBLIC_SELECT }>;
type ReportMineRow = Prisma.ReportGetPayload<{ select: typeof REPORT_MINE_SELECT }>;

// statusHistory is only fetched to compute finalNote; it never leaves the service.
type WithFinalNote<Row> = Omit<Row, 'statusHistory'> & { finalNote: string | null };

export type TrackedReportDto = WithFinalNote<ReportPublicRow>;
export type MyReportDto = WithFinalNote<ReportMineRow>;

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function ensureOwnImagePath(userId: string, imagePath: string): void {
  const folder = `${userId}/`;
  const fileName = imagePath.slice(folder.length);
  if (!imagePath.startsWith(folder) || !IMAGE_FILE_NAME_PATTERN.test(fileName)) {
    throw new ValidationError('Invalid image path', 'INVALID_IMAGE_PATH');
  }
}

async function insertReport(
  actor: AuthUser,
  input: CreateReportInput,
  organizationId: string | null,
): Promise<CreatedReportDto> {
  const isRouted = organizationId !== null;

  return prisma.$transaction(async (tx) => {
    const { id, ...created } = await tx.report.create({
      data: {
        trackingNumber: generateTrackingNumber(),
        categoryId: input.categoryId,
        areaId: input.areaId,
        organizationId,
        description: input.description,
        imagePath: input.imagePath,
        status: isRouted ? ReportStatus.ASSIGNED : ReportStatus.PENDING,
        reporterId: actor.id,
      },
      select: { id: true, ...REPORT_CREATED_SELECT },
    });

    await tx.statusHistory.create({
      data: {
        reportId: id,
        fromStatus: null,
        toStatus: ReportStatus.PENDING,
        changedById: actor.id,
      },
    });
    // The routing decision gets its own row so the audit trail shows the system assigned it.
    if (isRouted) {
      await tx.statusHistory.create({
        data: {
          reportId: id,
          fromStatus: ReportStatus.PENDING,
          toStatus: ReportStatus.ASSIGNED,
          changedById: null,
          note: AUTO_ROUTED_NOTE,
        },
      });
    }
    return created;
  });
}

/**
 * Runs the create flow of data-flow.md §3 in its fixed order: every check and read first,
 * then one transaction. Nothing is written for an emergency, a duplicate or an invalid input.
 */
export async function createReport(
  actor: AuthUser,
  input: CreateReportInput,
): Promise<CreatedReportDto> {
  if (input.imagePath !== undefined) {
    ensureOwnImagePath(actor.id, input.imagePath);
  }
  await ensureReportable(input.categoryId, input.areaId);
  if (input.acknowledgeDuplicates !== true) {
    await ensureNoActiveDuplicates(input.categoryId, input.areaId);
  }
  const organizationId = await findResponsibleOrganization(input.categoryId, input.areaId);

  try {
    return await insertReport(actor, input, organizationId);
  } catch (error) {
    // trackingNumber is the only unique column written here; a collision is astronomically
    // unlikely, so retry once with a new number and let a second failure become a 500.
    if (isUniqueViolation(error)) {
      return insertReport(actor, input, organizationId);
    }
    throw error;
  }
}

// The latest note is the one that closed the report; while it is still open, staff notes stay internal.
function withFinalNote<
  Row extends { status: ReportStatus; statusHistory: { note: string | null }[] },
>({ statusHistory, ...report }: Row): WithFinalNote<Row> {
  const isFinal = FINAL_REPORT_STATUSES.includes(report.status);
  return { ...report, finalNote: isFinal ? (statusHistory[0]?.note ?? null) : null };
}

export async function trackReport(trackingNumber: string): Promise<TrackedReportDto> {
  const report = await prisma.report.findUnique({
    where: { trackingNumber },
    select: REPORT_PUBLIC_SELECT,
  });
  if (!report) {
    throw new NotFoundError('Report not found', 'REPORT_NOT_FOUND');
  }
  return withFinalNote(report);
}

// Scoped by the caller's own id only: a citizen never sees anyone else's reports.
export async function listMyReports(
  actor: AuthUser,
  query: ListMyReportsQuery,
): Promise<{ data: MyReportDto[]; meta: PaginationMeta }> {
  const where = { reporterId: actor.id } satisfies Prisma.ReportWhereInput;

  const [reports, total] = await prisma.$transaction([
    prisma.report.findMany({
      where,
      select: REPORT_MINE_SELECT,
      orderBy: { createdAt: 'desc' },
      ...toSkipTake(query),
    }),
    prisma.report.count({ where }),
  ]);
  return { data: reports.map(withFinalNote), meta: buildPaginationMeta(query, total) };
}

// The where-fragment every staff/admin read and write starts from. STAFF always have both ids
// (DB check constraint), but a null here would turn into "IS NULL" and match unrouted reports,
// so it is refused instead of trusted.
function reportScopeFor(actor: AuthUser): Prisma.ReportWhereInput {
  if (actor.role === Role.ADMIN) {
    return {};
  }
  if (actor.role !== Role.STAFF || actor.organizationId === null || actor.areaId === null) {
    throw new ForbiddenError();
  }
  return { organizationId: actor.organizationId, areaId: actor.areaId };
}

/** Staff see only their organization + area; admin sees all and may ask for unrouted ones. */
export async function listReports(
  actor: AuthUser,
  query: ListReportsQuery,
): Promise<{ data: StaffReportDto[]; meta: PaginationMeta }> {
  if (query.unrouted !== undefined && actor.role !== Role.ADMIN) {
    throw new ValidationError('The unrouted filter is only available to admins');
  }
  const where = {
    ...reportScopeFor(actor),
    ...(query.status !== undefined ? { status: query.status } : {}),
    ...(query.categoryId !== undefined ? { categoryId: query.categoryId } : {}),
    ...(query.unrouted === true ? { organizationId: null } : {}),
    ...(query.unrouted === false ? { organizationId: { not: null } } : {}),
  } satisfies Prisma.ReportWhereInput;

  const [reports, total] = await prisma.$transaction([
    prisma.report.findMany({
      where,
      select: REPORT_STAFF_SELECT,
      // id breaks ties so a page boundary never shows or skips a report twice.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...toSkipTake(query),
    }),
    prisma.report.count({ where }),
  ]);
  return { data: reports, meta: buildPaginationMeta(query, total) };
}

// data-flow.md §10: the bucket is public-read, so the URL is built from the path, no signing.
function toPublicImageUrl(imagePath: string): string {
  return `${env.SUPABASE_URL}/storage/v1/object/public/${env.SUPABASE_STORAGE_BUCKET}/${imagePath}`;
}

// Only staff names are shown (C14). The first row's actor is the citizen reporter, and the
// auto-route row has no actor; both come out as null.
function toHistoryEntry({
  changedBy,
  ...entry
}: ReportDetailRow['statusHistory'][number]): StatusHistoryEntryDto {
  const isStaff = changedBy?.role === Role.STAFF;
  return { ...entry, changedByName: isStaff ? changedBy.fullName : null };
}

/** Missing and out-of-scope reports give the same 404, so staff cannot probe other areas. */
export async function getReportDetail(actor: AuthUser, id: string): Promise<ReportDetailDto> {
  const report = await prisma.report.findFirst({
    where: { id, ...reportScopeFor(actor) },
    select: REPORT_DETAIL_SELECT,
  });
  if (!report) {
    throw new NotFoundError('Report not found', 'REPORT_NOT_FOUND');
  }
  const { imagePath, statusHistory, ...rest } = report;
  return {
    ...rest,
    imageUrl: imagePath !== null ? toPublicImageUrl(imagePath) : null,
    statusHistory: statusHistory.map(toHistoryEntry),
  };
}

function stateChanged(): ConflictError {
  return new ConflictError('Report state changed, reload it and try again', 'STATE_CHANGED');
}

// Who must hold the report before the change; the same value guards the conditional update.
function expectedAssignee(rule: AssigneeRule, actor: AuthUser): string | null {
  return rule === 'assignee' ? actor.id : null;
}

/**
 * data-flow.md §4: scoped read, transition check, assignee check, then one transaction whose
 * conditional updateMany only matches if nobody changed the report since it was read.
 */
export async function changeStatus(
  actor: AuthUser,
  id: string,
  input: ChangeStatusInput,
): Promise<StaffReportDto> {
  const scope = reportScopeFor(actor);
  const report = await prisma.report.findFirst({
    where: { id, ...scope },
    select: { status: true, assignedToId: true },
  });
  if (!report) {
    throw new NotFoundError('Report not found', 'REPORT_NOT_FOUND');
  }

  const transition = findTransition({ from: report.status, to: input.status, role: actor.role });
  if (!transition) {
    throw new InvalidTransitionError();
  }
  const assignee = expectedAssignee(transition.assignee, actor);
  if (report.assignedToId !== assignee) {
    if (transition.assignee === 'assignee') {
      throw new ForbiddenError(
        'Only the assigned staff member can change this report',
        'NOT_ASSIGNEE',
      );
    }
    throw stateChanged();
  }

  return prisma.$transaction(async (tx) => {
    const { count } = await tx.report.updateMany({
      where: { id, ...scope, status: report.status, assignedToId: assignee },
      data: {
        status: input.status,
        ...(transition.assignee === 'claim' ? { assignedToId: actor.id } : {}),
      },
    });
    // Someone else changed it between the read and this write (e.g. two staff claiming at once).
    if (count === 0) {
      throw stateChanged();
    }
    await tx.statusHistory.create({
      data: {
        reportId: id,
        fromStatus: report.status,
        toStatus: input.status,
        changedById: actor.id,
        note: input.note,
      },
    });
    return tx.report.findUniqueOrThrow({ where: { id }, select: REPORT_STAFF_SELECT });
  });
}
