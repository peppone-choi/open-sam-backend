import express, { Express, Request, Response } from 'express';
import { createServer as createHTTPServer, Server as HTTPServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { mongoConnection } from './db/connection';
import { mountRoutes } from './api';
import { errorMiddleware } from './common/middleware/error.middleware';
import { requestLogger } from './common/middleware/request-logger.middleware';
import { logger } from './common/logger';
import { CommandRegistry } from './core/command';
import { swaggerSpec } from './config/swagger';
import { autoExtractToken } from './middleware/auth';
import { initializeSocket } from './socket/socketManager';
import { setupSessionMiddleware, sessionMiddleware } from './common/middleware/session.middleware';
import sessionRoutes from './routes/session.routes';
import generalRoutes from './routes/general.routes';
import battleRoutes from './routes/battle.routes';
import battlemapRoutes from './routes/battlemap-editor.routes';
import auctionRoutes from './routes/auction.routes';
import bettingRoutes from './routes/betting.routes';
import messageRoutes from './routes/message.routes';
import voteRoutes from './routes/vote.routes';
import loginRoutes from './routes/login.routes';
import gatewayRoutes from './routes/gateway.routes';
import adminRoutes from './routes/admin.routes';
import joinRoutes from './routes/join.routes';
import boardRoutes from './routes/board.routes';
import diplomacyRoutes from './routes/diplomacy.routes';
import infoRoutes from './routes/info.routes';
import worldRoutes from './routes/world.routes';
import npcRoutes from './routes/npc.routes';
import chiefRoutes from './routes/chief.routes';
import processingRoutes from './routes/processing.routes';
import installRoutes from './routes/install.routes';
import oauthRoutes from './routes/oauth.routes';
import archiveRoutes from './routes/archive.routes';
import tournamentRoutes from './routes/tournament.routes';
import { FileWatcherService } from './services/file-watcher.service';

dotenv.config();

// 테스트용 앱 생성 함수
export async function createApp(): Promise<Express> {
  const app = express();
  
  // 프록시 신뢰 설정
  app.set('trust proxy', 1);
  
  // 보안 미들웨어
  app.use(helmet());
  
  // CORS 설정
  app.use(cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      process.env.FRONTEND_URL || 'http://localhost:3000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Set-Cookie']
  }));
  
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Session 미들웨어
  app.use(setupSessionMiddleware());
  app.use(sessionMiddleware);
  
  // 요청 로거
  app.use(requestLogger);
  
  // 토큰 자동 추출
  app.use(autoExtractToken);
  
  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  // Swagger API 문서
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'OpenSAM API Documentation'
  }));
  
  // Swagger JSON
  app.get('/api-docs.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
  
  // 라우트 마운트
  mountRoutes(app);
  
  // 추가 라우트 (테스트용)
  app.use('/api/session', sessionRoutes);
  app.use('/api/general', generalRoutes);
  app.use('/api/battle', battleRoutes);
  app.use('/api/battlemap', battlemapRoutes);
  app.use('/api/auction', auctionRoutes);
  app.use('/api/betting', bettingRoutes);
  app.use('/api/message', messageRoutes);
  app.use('/api/vote', voteRoutes);
  app.use('/api/login', loginRoutes);
  app.use('/api/gateway', gatewayRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/join', joinRoutes);
  app.use('/api/board', boardRoutes);
  app.use('/api/diplomacy', diplomacyRoutes);
  app.use('/api/info', infoRoutes);
  app.use('/api/world', worldRoutes);
  app.use('/api/npc', npcRoutes);
  app.use('/api/chief', chiefRoutes);
  app.use('/api/processing', processingRoutes);
  
  // 에러 미들웨어
  app.use(errorMiddleware);
  
  return app;
}

const app = express();
const PORT = process.env.PORT || 8080;

// 프록시 신뢰 설정 (reverse proxy 환경 대응)
app.set('trust proxy', 1);

// 보안 미들웨어
app.use(helmet());

// CORS 설정 - 프론트엔드에서 쿠키를 포함한 요청 허용
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    process.env.FRONTEND_URL || 'http://localhost:3000'
  ],
  credentials: true, // 쿠키, 인증 헤더 등을 포함한 요청 허용
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie']
}));

app.use(compression());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session 미들웨어 (express-session 또는 기본)
app.use(setupSessionMiddleware());
app.use(sessionMiddleware);

// 요청 로깅 미들웨어
app.use(requestLogger);

// JWT 토큰 자동 추출 미들웨어 (모든 요청에 대해 토큰이 있으면 자동으로 추출)
app.use(autoExtractToken);

/**
 * @swagger
 * /health:
 *   get:
 *     summary: 서버 상태 확인
 *     tags: [Health]
 *     description: 서버가 정상적으로 작동하는지 확인합니다.
 *     responses:
 *       200:
 *         description: 서버 정상 작동
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: 2025-11-01T10:30:00.000Z
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Swagger API 문서
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'OpenSAM API Documentation'
}));

// Swagger JSON
app.get('/api-docs.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// 기존 도메인 라우터
mountRoutes(app);

// 새로운 라우트 추가
app.use('/api/session', sessionRoutes);
app.use('/api/general', generalRoutes);
app.use('/api/battle', battleRoutes);
app.use('/api/battlemap', battlemapRoutes);
app.use('/api/auction', auctionRoutes);
app.use('/api/betting', bettingRoutes);
app.use('/api/message', messageRoutes);
app.use('/api/vote', voteRoutes);
app.use('/api/login', loginRoutes);
app.use('/api/gateway', gatewayRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/join', joinRoutes);
app.use('/api/board', boardRoutes);
app.use('/api/diplomacy', diplomacyRoutes);
app.use('/api/info', infoRoutes);
app.use('/api/world', worldRoutes);
app.use('/api/npc', npcRoutes);
app.use('/api/chief', chiefRoutes);
app.use('/api/processing', processingRoutes);
app.use('/api/install', installRoutes);
app.use('/api/oauth', oauthRoutes);
app.use('/api/archive', archiveRoutes);
app.use('/api/tournament', tournamentRoutes);

// 에러 핸들링 미들웨어 (맨 마지막)
app.use(errorMiddleware);

async function start() {
  try {
    // 한국 시간대(Asia/Seoul, UTC+9) 설정
    if (!process.env.TZ) {
      process.env.TZ = 'Asia/Seoul';
    }
    
    logger.info('서버 시작 중...', {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: PORT,
      nodeVersion: process.version,
      timezone: process.env.TZ,
      currentTime: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
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
    
    // 기본 세션 자동 생성
    logger.info('세션 초기화 중...');
    const { SessionService } = await import('./services/session.service');
    const { InitService } = await import('./services/init.service');
    const { Session } = await import('./models/session.model');
    
    const sessionId = process.env.DEFAULT_SESSION_ID || 'sangokushi_default';
    let session = await Session.findOne({ session_id: sessionId });
    
    if (!session) {
      logger.info('기본 삼국지 세션 생성 중...');
      session = await SessionService.createDefaultSangokushi();
      
      // 세션이 DB에 저장되었는지 확인 (재시도)
      let retries = 3;
      while (retries > 0) {
        session = await Session.findOne({ session_id: sessionId });
        if (session) break;
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms 대기
        retries--;
      }
      
      if (!session) {
        throw new Error('세션 생성 후 DB 조회 실패');
      }
      
      await InitService.initializeSession(sessionId);
      logger.info('기본 세션 생성 완료', { sessionId });
    } else {
      logger.info('기본 세션 로드 완료', { sessionId, sessionName: session.name });
      
      // 도시가 없으면 초기화
      const { City } = await import('./models/city.model');
      const cityCount = await City.countDocuments({ session_id: sessionId });
      if (cityCount === 0) {
        logger.info('도시가 없어 초기화를 진행합니다...');
        await InitService.initializeSession(sessionId);
        logger.info('도시 초기화 완료');
      }
    }
    
    // HTTP 서버 생성 (Socket.IO를 위한)
    const httpServer = createHTTPServer(app);
    
    // Socket.IO 초기화
    const socketManager = initializeSocket(httpServer);
    logger.info('Socket.IO 서버 초기화 완료');
    
    // 턴 프로세서 데몬 시작 (환경 변수로 제어 가능)
    if (process.env.ENABLE_TURN_PROCESSOR !== 'false') {
      const { startTurnProcessor } = await import('./daemon/turn-processor');
      await startTurnProcessor();
      logger.info('턴 프로세서 데몬 시작 완료');
    } else {
      logger.info('턴 프로세서 데몬 비활성화됨 (ENABLE_TURN_PROCESSOR=false)');
    }
    
    // 세션 영속화 데몬 시작 (환경 변수로 제어 가능)
    if (process.env.ENABLE_SESSION_PERSISTER !== 'false') {
      const { startSessionPersister } = await import('./daemon/session-persister');
      await startSessionPersister();
      logger.info('세션 영속화 데몬 시작 완료');
    } else {
      logger.info('세션 영속화 데몬 비활성화됨 (ENABLE_SESSION_PERSISTER=false)');
    }
    
    // HTTP 서버 시작
    httpServer.listen(PORT, () => {
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
      
      // 개발 모드에서 JSON 파일 감시 시작
      if (process.env.NODE_ENV !== 'production') {
        const defaultSessionId = process.env.DEFAULT_SESSION_ID || 'sangokushi_default';
        const defaultScenarioId = process.env.DEFAULT_SCENARIO_ID || 'sangokushi';
        FileWatcherService.startWatching(defaultScenarioId, defaultSessionId);
      }
      console.log(`🎮 커맨드: ${commandStats.total}개 (General: ${commandStats.generalCount}, Nation: ${commandStats.nationCount})`);
      console.log(`📡 Socket.IO: 활성화됨\n`);
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
