import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';

import { openApiDocument } from '../config/swagger';
import { AppError } from '../errors/app-error';
import { validate } from '../middlewares/validate.middleware';
import { loginForDocs } from './docs-login.service';
import type { DocsLoginInput } from './docs-login.validation';
import { docsLoginSchema } from './docs-login.validation';

// Everything Swagger needs lives here, mounted at /api-docs. Nothing under /api/v1 imports it,
// so turning it off (ENABLE_API_DOCS=false) leaves the API exactly as it was.
export const docsRouter = Router();

// Public login, so it is keyed by IP and kept tight to slow down password guessing.
const docsLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req: Request, _res: Response, next: NextFunction) => {
    next(new AppError('Too many requests, please try again later', 429, 'RATE_LIMITED'));
  },
});

// Registered before the UI so the static file handler never sees it.
docsRouter.post(
  '/login',
  docsLoginLimiter,
  validate({ body: docsLoginSchema }),
  async (req: Request, res: Response) => {
    const result = await loginForDocs(req.valid.body as DocsLoginInput);
    res.status(200).json({ data: result });
  },
);

docsRouter.use(
  '/',
  swaggerUi.serve,
  swaggerUi.setup(openApiDocument, {
    customSiteTitle: 'Urban Safety Platform API Docs',
    // Keeps the pasted token after a page reload.
    swaggerOptions: { persistAuthorization: true },
  }),
);
