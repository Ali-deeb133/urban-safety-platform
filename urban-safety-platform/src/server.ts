import { app } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';

app.listen(env.PORT, (error) => {
  if (error) {
    throw error;
  }
  logger.info({ port: env.PORT }, 'Server listening');
});
