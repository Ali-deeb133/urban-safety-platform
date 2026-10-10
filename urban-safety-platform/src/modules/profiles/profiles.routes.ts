import { Router } from 'express';

import { authenticate } from '../../middlewares/auth.middleware';
import * as profilesController from './profiles.controller';

export const profilesRouter = Router();

// Every role may read its own profile, so there is no requireRole here.
profilesRouter.get('/me', authenticate, profilesController.getMe);
