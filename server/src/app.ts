import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler, notFound } from './middleware/error';
import { apiRouter } from './routes';
import { localUploadDir } from './services/storageService';

export function createApp(): express.Express {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  if (env.nodeEnv !== 'test') app.use(morgan('tiny'));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'lam-server' });
  });

  // Local storage fallback (dev without Firebase)
  app.use('/uploads', express.static(localUploadDir(), { maxAge: '7d', immutable: true }));

  app.use('/api/v1', apiRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
