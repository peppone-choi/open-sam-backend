import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { mongoConnection } from './db/connection';
import { mountRoutes } from './api';
import { errorMiddleware } from './common/middleware/error.middleware';
import { requestLogger } from './common/middleware/request-logger.middleware';
import { logger } from './common/logger';
import { CommandRegistry } from './core/command';
import { swaggerSpec } from './config/swagger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 보안 미들웨어
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 요청 로깅 미들웨어
app.use(requestLogger);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: '삼국지 게임 API 문서'
}));

// Swagger JSON endpoint
app.get('/api-docs.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// 기존 도메인 라우터
mountRoutes(app);

// 새로운 라우트 추가
import sessionRoutes from './routes/session.routes';
import generalRoutes from './routes/general.routes';
import battleRoutes from './routes/battle.routes';
import battlemapRoutes from './routes/battlemap-editor.routes';
import auctionRoutes from './routes/auction.routes';
import bettingRoutes from './routes/betting.routes';
import messageRoutes from './routes/message.routes';
import voteRoutes from './routes/vote.routes';
import scenarioRoutes from './routes/scenario.routes';

app.use('/api/session', sessionRoutes);
app.use('/api/general', generalRoutes);
app.use('/api/battle', battleRoutes);
app.use('/api/battlemap', battlemapRoutes);
app.use('/api/auction', auctionRoutes);
app.use('/api/betting', bettingRoutes);
app.use('/api/message', messageRoutes);
app.use('/api/vote', voteRoutes);
app.use('/api/scenarios', scenarioRoutes);

// 에러 핸들링 미들웨어 (맨 마지막)
app.use(errorMiddleware);

async function start() {
  try {
    logger.info('서버 시작 중...', {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: PORT,
      nodeVersion: process.version
    });

    // MongoDB 연결
    await mongoConnection.connect(process.env.MONGODB_URI);
    logger.info('MongoDB 연결 성공', { uri: process.env.MONGODB_URI?.replace(/\/\/.*:.*@/, '//***:***@') });
    
    // Redis 캐시 상태 확인
    const { cacheManager } = await import('./cache/CacheManager');
    const cacheStats = cacheManager.getStats();
    logger.info('캐시 시스템 상태', cacheStats);
    
    // 커맨드 레지스트리 초기화
    await CommandRegistry.loadAll();
    const commandStats = CommandRegistry.getStats();
    logger.info('커맨드 시스템 초기화 완료', commandStats);
    
    // 시나리오 로드
    logger.info('시나리오 로딩 중...');
    const { ScenarioLoader } = await import('./common/registry/scenario-loader');
    await ScenarioLoader.loadAll();
    logger.info('시나리오 로딩 완료');
    
    // 기본 세션 자동 생성
    logger.info('세션 초기화 중...');
    const { SessionService } = await import('./services/session.service');
    const { InitService } = await import('./services/init.service');
    const { Session } = await import('./models/session.model');
    
    const sessionId = process.env.DEFAULT_SESSION_ID || 'sangokushi_default';
    let session = await Session.findOne({ session_id: sessionId });
    
    if (!session) {
      logger.info('기본 삼국지 세션 생성 중...', { sessionId });
      try {
        session = await SessionService.createDefaultSangokushi(sessionId);
        await InitService.initializeSession(sessionId);
        logger.info('기본 세션 생성 완료', { sessionId });
      } catch (error: any) {
        // 중복 세션이면 무시하고 로드
        if (error.message?.includes('E11000') || error.message?.includes('이미 존재')) {
          session = await Session.findOne({ session_id: sessionId });
          logger.info('기존 세션 로드', { sessionId });
        } else {
          throw error;
        }
      }
    } else {
      logger.info('기본 세션 로드 완료', { sessionId, sessionName: session.name });
    }
    
    app.listen(PORT, () => {
      logger.info('API 서버 시작 완료', {
        port: PORT,
        routes: [
          'Admin: /api/admin/*',
          'Core: /api/generals, /api/cities, /api/nations, /api/commands, /api/game-sessions',
          'General: /api/commander-turns, /api/commander-access-logs, /api/commander-records',
          'Nation: /api/faction-turns, /api/faction-envs',
          'Military: /api/troops, /api/battles, /api/battlefield-tiles, /api/items',
          'Communication: /api/messages, /api/boards, /api/comments',
          'History: /api/world-histories, /api/ng-histories',
          'System: /api/events, /api/plocks, /api/storages, /api/rank-data, /api/reserved-opens',
          'Selection: /api/select-npc-tokens, /api/select-pools',
          'User: /api/user-records',
          'Events: /api/ng-bettings, /api/votes, /api/vote-comments, /api/ng-auctions, /api/ng-auction-bids'
        ]
      });
      console.log('\n🚀 서버가 성공적으로 시작되었습니다!');
      console.log(`📍 포트: ${PORT}`);
      console.log(`🌍 환경: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🎮 커맨드: ${commandStats.total}개 (General: ${commandStats.generalCount}, Nation: ${commandStats.nationCount})`);
      console.log(`📖 Swagger UI: http://localhost:${PORT}/api-docs\n`);
    });
  } catch (error) {
    logger.error('서버 시작 실패', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

// 프로세스 에러 핸들링
process.on('unhandledRejection', (reason, promise) => {
  logger.error('처리되지 않은 Promise 거부', {
    reason: String(reason),
    promise: String(promise)
  });
});

process.on('uncaughtException', (error) => {
  logger.error('처리되지 않은 예외', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

start();
