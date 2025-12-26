/**
 * Session 미들웨어 - express-session과 MongoStore 통합
 */

import { NextFunction, Request, RequestHandler, Response } from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { createClient, RedisClientType } from 'redis';
import { RedisStore } from 'connect-redis';
import { logger } from '../logger';
import { Session } from '../../utils/Session';
import { configManager } from '../../config/ConfigManager';

const { session: sess, system } = configManager.get();

let cachedSessionHandler: RequestHandler | null = null;
let redisClient: RedisClientType | null = null;
let redisStore: session.Store | null = null;
let mongoStore: session.Store | null = null;

function createRedisStore(): session.Store | null {
  if (redisStore || sess.disablePersistence) {
    return redisStore;
  }

  const { redisUrl } = system;
  if (!redisUrl) {
    logger.warn('[세션] redisUrl이 없어 Redis 스토어를 건너뜁니다.');
    return null;
  }

  try {
    redisClient = createClient({ url: redisUrl });
    redisClient.on('error', (error) => {
      logger.error('[세션] Redis 세션 스토어 오류 발생', { error: error.message });
    });

    redisClient.connect().then(() => {
      logger.info('[세션] Redis 세션 스토어 연결 완료');
    }).catch((error) => {
      logger.error('[세션] Redis 세션 스토어 연결 실패', { error: error.message });
    });

    redisStore = new RedisStore({
      client: redisClient,
      prefix: sess.redisPrefix,
      disableTouch: false,
    });

    return redisStore;
  } catch (error) {
    logger.error('[세션] Redis 세션 스토어 초기화 중 오류 발생', error);
    redisClient = null;
    redisStore = null;
    return null;
  }
}

function createMongoStore(): session.Store | undefined {
  if (mongoStore || sess.disablePersistence) {
    return mongoStore ?? undefined;
  }

  const { mongodbUri } = system;
  if (!mongodbUri) {
    logger.error('[세션] mongodbUri가 설정되지 않아 MemoryStore로 폴백됩니다.');
    return undefined;
  }

  try {
    mongoStore = MongoStore.create({
      mongoUrl: mongodbUri,
      collectionName: sess.collectionName,
      ttl: sess.ttlSeconds,
      autoRemove: 'interval',
      stringify: false,
    });
    return mongoStore;
  } catch (error) {
    logger.error('[세션] Mongo 세션 스토어 초기화 실패', error);
    mongoStore = null;
    return undefined;
  }
}

function resolveSessionStore(): session.Store | undefined {
  if (sess.disablePersistence) {
    logger.warn('[세션] 지속형 세션이 비활성화되어 MemoryStore를 사용합니다.');
    return undefined;
  }

  if (sess.storeType === 'redis') {
    return createRedisStore() || createMongoStore();
  } else if (sess.storeType === 'mongo') {
    return createMongoStore() || createRedisStore() || undefined;
  }

  return undefined;
}

export function setupSessionMiddleware(): RequestHandler {
  if (cachedSessionHandler) {
    return cachedSessionHandler;
  }

  const store = resolveSessionStore();

  cachedSessionHandler = session({
    secret: sess.secret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    name: sess.cookieName,
    store,
    cookie: {
      secure: system.cookieSecure || system.nodeEnv === 'production',
      httpOnly: true,
      sameSite: (system.cookieSameSite as any) || 'lax',
      maxAge: sess.cookieMaxAgeMs,
    },
  });

  return cachedSessionHandler;
}

export function sessionMiddleware(req: Request, _res: Response, next: NextFunction) {
  req.sessionInstance = Session.getInstance(req);
  next();
}
