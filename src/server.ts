import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { mongoConnection } from './db/connection';
import { mountRoutes } from './api';
import { errorMiddleware } from './common/middleware/error.middleware';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// TODO: 보안 미들웨어
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// TODO: Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// TODO: 도메인 라우터 통합
mountRoutes(app);

// TODO: 에러 핸들링 미들웨어 (맨 마지막)
app.use(errorMiddleware);

async function start() {
  try {
    // TODO: MongoDB 연결
    await mongoConnection.connect(process.env.MONGODB_URI!);
    
    app.listen(PORT, () => {
      console.log(`✅ API Server running on port ${PORT}`);
      console.log(`📍 Routes mounted: /api/generals, /api/cities, /api/commands`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
