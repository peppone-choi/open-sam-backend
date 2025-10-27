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
      console.log('');
      console.log('✅ API Server running on port ' + PORT);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📍 33 Routes mounted:');
      console.log('');
      console.log('Admin:');
      console.log('  /api/admin/*');
      console.log('');
      console.log('Core:');
      console.log('  /api/generals, /api/cities, /api/nations');
      console.log('  /api/commands, /api/game-sessions');
      console.log('');
      console.log('General:');
      console.log('  /api/commander-turns, /api/commander-access-logs');
      console.log('  /api/commander-records');
      console.log('');
      console.log('Nation:');
      console.log('  /api/faction-turns, /api/faction-envs');
      console.log('');
      console.log('Military:');
      console.log('  /api/troops, /api/battles');
      console.log('  /api/battlefield-tiles, /api/items');
      console.log('');
      console.log('Communication:');
      console.log('  /api/messages, /api/boards, /api/comments');
      console.log('');
      console.log('History:');
      console.log('  /api/world-histories, /api/ng-histories');
      console.log('');
      console.log('System:');
      console.log('  /api/events, /api/plocks, /api/storages');
      console.log('  /api/rank-data, /api/reserved-opens');
      console.log('');
      console.log('Selection:');
      console.log('  /api/select-npc-tokens, /api/select-pools');
      console.log('');
      console.log('User:');
      console.log('  /api/user-records');
      console.log('');
      console.log('Events:');
      console.log('  /api/ng-bettings, /api/votes');
      console.log('  /api/vote-comments, /api/ng-auctions');
      console.log('  /api/ng-auction-bids');
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
