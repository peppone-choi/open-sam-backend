/**
 * 최소 API 서버 (데몬 분리 버전)
 * 
 * 게임 로직 데몬과 완전히 분리된 순수 API 서버입니다.
 * 커맨드 처리는 Redis Queue를 통해 데몬으로 위임합니다.
 */
import express from 'express';
import { createServer as createHTTPServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { mongoConnection } from './db/connection';
import { logger } from './common/logger';
import { requestLogger } from './common/middleware/request-logger.middleware';
import { errorMiddleware } from './common/middleware/error.middleware';
import { globalLimiter } from './middleware/rate-limit.middleware';
import gatewayRoutes from './routes/gateway.routes';
import authRoutes from './routes/auth.routes';
import gin7TacticalRoutes from './routes/gin7/tactical.routes';
import { SocketManager, setSocketManager } from './socket/socketManager';

dotenv.config();

const PORT = parseInt(process.env.PORT || '8080');

async function start() {
  try {
    logger.info('🚀 최소 API 서버 시작 중...');
    
    // MongoDB 연결
    logger.info('MongoDB 연결 중...');
    await mongoConnection.connect();
    logger.info('✅ MongoDB 연결 완료');
    
    // Express 앱 생성
    const app = express();
    
    // 프록시 신뢰 설정
    app.set('trust proxy', 1);
    
    // 보안 미들웨어
    app.use(helmet());
    
    // 글로벌 rate limiting (1000 req/15min)
    app.use(globalLimiter);
    
    // CORS 설정
    app.use(cors({
      origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:3003',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:3001',
          'http://127.0.0.1:3003',
          process.env.FRONTEND_URL
        ];
        
        if (allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          // Dev mode wildcard
          if (process.env.NODE_ENV !== 'production') {
             callback(null, true);
          } else {
             callback(new Error('Not allowed by CORS'));
          }
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['Set-Cookie']
    }));
    
    app.use(compression());
    app.use(cookieParser());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // 요청 로거
    app.use(requestLogger);
    
    // Health check
    app.get('/health', (_req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        mode: 'minimal-api-only'
      });
    });
    
    // API 라우트는 필요한 것만 추가
    app.get('/api/status', (_req, res) => {
      res.json({
        server: 'running',
        mode: 'api-only',
        message: '게임 데몬은 별도 명령어(npm run dev:daemon)로 실행해야 합니다.'
      });
    });
    
    // 인증 및 게이트웨이 라우트 추가
    app.use('/api/auth', authRoutes);
    app.use('/api/gateway', gatewayRoutes);
    
    // GIN7 Tactical routes (for demo/testing)
    app.use('/api/gin7/tactical', gin7TacticalRoutes);
    
    // 에러 핸들러
    app.use(errorMiddleware);
    
    // HTTP 서버 시작
    const httpServer = createHTTPServer(app);
    
    // Socket.IO 초기화 (WebSocket 실시간 통신용)
    const socketManager = new SocketManager(httpServer);
    setSocketManager(socketManager);
    logger.info('✅ Socket.IO 서버 초기화 완료');
    
    httpServer.listen(PORT, () => {
      logger.info('✅ API 서버 시작 완료', { port: PORT });
      console.log('\n🚀 서버가 성공적으로 시작되었습니다!');
      console.log(`📍 포트: ${PORT}`);
      console.log(`🌍 환경: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📡 WebSocket: enabled (/rtbattle namespace)`);
      console.log(`⚠️  게임 데몬은 별도 실행 필요: npm run dev:daemon\n`);
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
