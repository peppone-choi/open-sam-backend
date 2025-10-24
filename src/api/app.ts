import 'reflect-metadata';
import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { AppConfig } from '../config/app.config';
import { errorMiddleware } from './middleware/error.middleware';
import { routes } from './routes';
import { logger } from '../shared/utils/logger';

export function createApp(): Application {
  const app = express();

  // 보안 미들웨어
  app.use(helmet());
  
  // CORS
  app.use(cors({
    origin: AppConfig.cors.origin,
    credentials: true,
  }));

  // Compression
  app.use(compression());

  // Body parser
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // TODO: Request logging 미들웨어
  // TODO: Rate limiting 미들웨어

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API Routes
  app.use('/api', routes);

  // Error handling (맨 마지막)
  app.use(errorMiddleware);

  logger.info('Express app created');
  return app;
}
