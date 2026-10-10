import type { Request, Response } from 'express';

import * as profilesService from './profiles.service';

export async function getMe(req: Request, res: Response): Promise<void> {
  const profile = await profilesService.getOwnProfile(req.user.id);
  res.status(200).json({ data: profile });
}
