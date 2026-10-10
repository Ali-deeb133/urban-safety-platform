import type { Request, Response } from 'express';

import * as referenceDataService from './reference-data.service';
import type {
  CreateRuleInput,
  ListRulesQuery,
  RuleIdParams,
  UpdateRuleInput,
} from './reference-data.validation';

export async function listCategories(_req: Request, res: Response): Promise<void> {
  const categories = await referenceDataService.listCategories();
  res.status(200).json({ data: categories });
}

export async function listAreas(_req: Request, res: Response): Promise<void> {
  const areas = await referenceDataService.listAreas();
  res.status(200).json({ data: areas });
}

export async function listOrganizations(_req: Request, res: Response): Promise<void> {
  const organizations = await referenceDataService.listOrganizations();
  res.status(200).json({ data: organizations });
}

// The casts below are safe: validate() runs before each handler and has already parsed the input.
export async function listRules(req: Request, res: Response): Promise<void> {
  const result = await referenceDataService.listRules(req.valid.query as ListRulesQuery);
  res.status(200).json(result);
}

export async function createRule(req: Request, res: Response): Promise<void> {
  const rule = await referenceDataService.createRule(req.valid.body as CreateRuleInput);
  res.status(201).json({ data: rule });
}

export async function updateRule(req: Request, res: Response): Promise<void> {
  const { id } = req.valid.params as RuleIdParams;
  const rule = await referenceDataService.updateRule(id, req.valid.body as UpdateRuleInput);
  res.status(200).json({ data: rule });
}
