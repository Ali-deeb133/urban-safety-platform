import type { Request, Response } from 'express';

import type { CreateStaffInput } from './admin.validation';
import * as staffService from './staff.service';

// The cast is safe: validate() runs before this handler and has already parsed the body.
export async function createStaff(req: Request, res: Response): Promise<void> {
  const staff = await staffService.createStaff(req.valid.body as CreateStaffInput);
  res.status(201).json({ data: staff });
}
