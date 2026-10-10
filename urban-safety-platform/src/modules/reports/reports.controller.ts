import type { Request, Response } from 'express';

import * as confirmationService from './confirmation.service';
import * as reportsService from './reports.service';
import type {
  ChangeStatusInput,
  CreateReportInput,
  ListMyReportsQuery,
  ListReportsQuery,
  ReportIdParams,
  TrackingNumberParams,
} from './reports.validation';

// The casts below are safe: validate() runs before each handler and has already parsed the input.
export async function create(req: Request, res: Response): Promise<void> {
  const report = await reportsService.createReport(req.user, req.valid.body as CreateReportInput);
  res.status(201).json({ data: report });
}

export async function track(req: Request, res: Response): Promise<void> {
  const { trackingNumber } = req.valid.params as TrackingNumberParams;
  const report = await reportsService.trackReport(trackingNumber);
  res.status(200).json({ data: report });
}

export async function listMine(req: Request, res: Response): Promise<void> {
  const result = await reportsService.listMyReports(
    req.user,
    req.valid.query as ListMyReportsQuery,
  );
  res.status(200).json(result);
}

export async function confirm(req: Request, res: Response): Promise<void> {
  const { id } = req.valid.params as ReportIdParams;
  const confirmation = await confirmationService.confirmReport(req.user, id);
  res.status(200).json({ data: confirmation });
}

export async function list(req: Request, res: Response): Promise<void> {
  const result = await reportsService.listReports(req.user, req.valid.query as ListReportsQuery);
  res.status(200).json(result);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const { id } = req.valid.params as ReportIdParams;
  const report = await reportsService.getReportDetail(req.user, id);
  res.status(200).json({ data: report });
}

export async function changeStatus(req: Request, res: Response): Promise<void> {
  const { id } = req.valid.params as ReportIdParams;
  const report = await reportsService.changeStatus(
    req.user,
    id,
    req.valid.body as ChangeStatusInput,
  );
  res.status(200).json({ data: report });
}
