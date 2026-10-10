import type { Request, Response } from 'express';

import * as authService from './auth.service';
import type { RegisterInput } from './auth.validation';

export async function register(req: Request, res: Response): Promise<void> {
  // validate({ body: registerSchema }) runs before this handler and has already parsed the body.
  const result = await authService.registerCitizen(req.valid.body as RegisterInput);
  res.status(201).json({ data: result });
}

export async function deleteAccount(req: Request, res: Response): Promise<void> {
  await authService.deleteAccount(req.user);
  res.status(204).end();
}
