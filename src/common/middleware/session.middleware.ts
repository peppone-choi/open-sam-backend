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

const DEFAULT_COOKIE_MAX_AGE_MS = Number(process.env.SESSION_COOKIE_MAX_AGE_MS ?? 24 * 60 * 60 * 1000);
const DEFAULT_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS ?? 24 * 60 * 60);
const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'opensam.sid';
const REDIS_PREFIX = process.env.SESSION_REDIS_PREFIX || 'opensam:sess:';

let cachedSessionHandler: RequestHandler | null = null;
let redisClient: RedisClientType | null = null;
let redisStore: session.Store | null = null;
let mongoStore: session.Store | null = null;

function shouldUseMemoryStore(): boolean {
  return process.env.SESSION_DISABLE_PERSISTENCE === 'true' || process.env.NODE_ENV === 'test';
}

function createRedisStore(): session.Store | null {
  if (redisStore || shouldUseMemoryStore()) {
    return redisStore;
  }

  const redisUrl = process.env.REDIS_URL || process.env.REDIS_TLS_URL;
  if (!redisUrl) {
    logger.warn('[세션] REDIS_URL이 없어 Redis 스토어를 건너뜁니다.');
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
      prefix: REDIS_PREFIX,
      disableTouch: false,
    });

    return redisStore;
  } catch (error) {
    logger.error('[세션] Redis 세션 스토어 초기화 중 오류 발생, MongoDB로 폴백합니다.', {
      error: error instanceof Error ? error.message : error,
    });
    redisClient = null;
    redisStore = null;
    return null;
  }
}

function createMongoStore(): session.Store | undefined {
  if (mongoStore || shouldUseMemoryStore()) {
    return mongoStore ?? undefined;
  }

  const mongoUrl = process.env.SESSION_MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUrl) {
    logger.error('[세션] MONGODB_URI가 설정되지 않아 MemoryStore로 폴백됩니다.');
    return undefined;
  }

  try {
    mongoStore = MongoStore.create({
      mongoUrl,
      collectionName: process.env.SESSION_COLLECTION || 'app_sessions',
      ttl: DEFAULT_TTL_SECONDS,
      autoRemove: 'interval',
      autoRemoveInterval: Number(process.env.SESSION_AUTOREMOVE_INTERVAL ?? 10),
      stringify: false,
    });
    return mongoStore;
  } catch (error) {
    logger.error('[세션] Mongo 세션 스토어 초기화 실패, MemoryStore 사용', {
      error: error instanceof Error ? error.message : error,
    });
    mongoStore = null;
    return undefined;
  }
}

function resolveSessionStore(): session.Store | undefined {
  if (shouldUseMemoryStore()) {
    logger.warn('[세션] 지속형 세션이 비활성화되어 MemoryStore를 사용합니다.');
    return undefined;
  }

  const preference = (process.env.SESSION_STORE || 'redis').toLowerCase();
  if (preference === 'redis') {
    const store = createRedisStore() || createMongoStore();
    if (store) {
      logger.info('[세션] Redis 세션 스토어를 우선 사용합니다.');
      return store;
    }
  } else if (preference === 'mongo') {
    const store = createMongoStore() || createRedisStore() || undefined;
    if (store) {
      logger.info('[세션] MongoDB 세션 스토어를 우선 사용합니다.');
      return store;
    }
  }

  const fallback = createRedisStore() || createMongoStore() || undefined;
  if (fallback) {
    logger.warn('[세션] 선호 스토어 사용에 실패하여 다른 세션 스토어로 폴백합니다.');
  } else {
    logger.warn('[세션] 세션 저장소를 찾지 못해 MemoryStore를 사용합니다. (개발/테스트 전용)');
  }
  return fallback;
}

/**
 * Session 미들웨어 설정 (싱글톤)
 */
export function setupSessionMiddleware(): RequestHandler {
  if (cachedSessionHandler) {
    return cachedSessionHandler;
  }

  const sessionSecret = process.env.SESSION_SECRET || 'change-session-secret';
  const store = resolveSessionStore();

  cachedSessionHandler = session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    name: COOKIE_NAME,
    store,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: DEFAULT_COOKIE_MAX_AGE_MS,
    },
  });

  if (store instanceof RedisStore) {
    logger.info('[세션] Redis 기반 세션 스토어가 활성화되었습니다.');
  } else if (store) {
    logger.info('[세션] MongoDB 기반 세션 스토어가 활성화되었습니다.');
  } else {
    logger.warn('[세션] MemoryStore 사용 중입니다. (개발/테스트 전용)');
  }

  return cachedSessionHandler;
}

/**
 * Session 인스턴스를 Request에 추가하는 미들웨어
 */
export function sessionMiddleware(req: Request, _res: Response, next: NextFunction) {
  req.sessionInstance = Session.getInstance(req);
  next();
}
