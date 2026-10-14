import { randomUUID } from 'node:crypto';

import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { API_DOCS_PATH, API_NAME, API_PREFIX } from './config/constants';
import { env } from './config/env';
import { docsRouter } from './docs/docs.routes';
import { NotFoundError } from './errors/not-found-error';
import { errorHandler } from './middlewares/error-handler.middleware';
import { adminRouter } from './modules/admin/admin.routes';
import { authRouter } from './modules/auth/auth.routes';
import { profilesRouter } from './modules/profiles/profiles.routes';
import { referenceDataRouter } from './modules/reference-data/reference-data.routes';
import { reportsRouter } from './modules/reports/reports.routes';
import { logger, logSerializers } from './utils/logger';

export const app = express();

// The IP rate limiters key on req.ip; behind a proxy it must come from the proxy's header.
app.set('trust proxy', env.TRUST_PROXY_HOPS);

// pino-http replaces the logger's serializers with its own, so ours are passed again here.
app.use(pinoHttp({ logger, genReqId: () => randomUUID(), serializers: logSerializers }));
app.use(helmet());
// Auth is a Bearer header, not a cookie, so credentials are not enabled.
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());

const apiRouter = express.Router();

apiRouter.get('/health', (_req, res) => {
  res.status(200).json({ data: { status: 'ok' } });
});
apiRouter.use('/auth', authRouter);
apiRouter.use('/profiles', profilesRouter);
apiRouter.use('/reports', reportsRouter);
apiRouter.use('/admin', adminRouter);
// No prefix: this router owns several top-level paths (/categories, /areas, ...).
apiRouter.use(referenceDataRouter);

app.use(API_PREFIX, apiRouter);

if (env.ENABLE_API_DOCS) {
  app.use(API_DOCS_PATH, docsRouter);
}

// A landing response for whoever opens the bare URL. The docs link is absolute so it is
// clickable in a browser; req.protocol is correct behind a proxy thanks to 'trust proxy'.
app.get('/', (req, res) => {
  const docs = env.ENABLE_API_DOCS ? `${req.protocol}://${req.get('host')}${API_DOCS_PATH}` : null;
  res.status(200).json({ data: { name: API_NAME, status: 'ok', docs } });
});

app.use(() => {
  throw new NotFoundError('Route not found');
});

app.use(errorHandler);
