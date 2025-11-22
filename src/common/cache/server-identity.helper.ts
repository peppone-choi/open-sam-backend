import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import { cacheService } from './cache.service';
import { Session, ISession } from '../../models/session.model';
import { logger } from '../logger';

export interface ServerIdentityPayload {
  sessionId: string;
  serverId: string;
  serverName: string;
  hiddenSeed: string;
  season: number;
  updatedAt: string;
}

const SessionModel = Session as Model<ISession>;
const CACHE_KEY = (sessionId: string) => `session:identity:${sessionId}`;
const CACHE_TTL = Number(process.env.SESSION_IDENTITY_CACHE_TTL || 600);

const buildFallbackIdentity = (sessionId: string): ServerIdentityPayload => {
  const defaultServerId = process.env.SERVER_ID || sessionId;
  return {
    sessionId,
    serverId: defaultServerId,
    serverName: process.env.SERVER_NAME || 'OpenSAM',
    hiddenSeed: process.env.SERVER_HIDDEN_SEED || randomUUID(),
    season: Number(process.env.SERVER_SEASON_INDEX ?? 0),
    updatedAt: new Date().toISOString(),
  };
};

const normalizeIdentity = (
  sessionId: string,
  sessionName?: string,
  source?: Partial<ServerIdentityPayload> | null
): ServerIdentityPayload => {
  const normalized: ServerIdentityPayload = {
    sessionId,
    serverId: source?.serverId || source?.sessionId || process.env.SERVER_ID || sessionId,
    serverName: source?.serverName || sessionName || process.env.SERVER_NAME || 'OpenSAM',
    hiddenSeed: source?.hiddenSeed || process.env.SERVER_HIDDEN_SEED || randomUUID(),
    season:
      typeof source?.season === 'number'
        ? source.season
        : Number(process.env.SERVER_SEASON_INDEX ?? 0),
    updatedAt: new Date().toISOString(),
  };
  return normalized;
};

const persistServerIdentity = async (sessionId: string, identity: ServerIdentityPayload) => {
  try {
    await SessionModel.updateOne(
      { session_id: sessionId },
      { $set: { 'data.server_identity': identity } },
      { upsert: false }
    );
  } catch (error: any) {
    logger.warn('[세션] 서버 식별자 정보를 저장하지 못했습니다.', {
      sessionId,
      error: error?.message || String(error),
    });
  }
};

export async function getServerIdentity(sessionId: string): Promise<ServerIdentityPayload> {
  const cached = await cacheService.getOrLoad<ServerIdentityPayload>(
    CACHE_KEY(sessionId),
    async () => {
      const doc = await SessionModel.findOne({ session_id: sessionId }).lean();
      if (!doc) {
        logger.warn('[세션] 세션 문서를 찾을 수 없어 기본값을 사용합니다.', { sessionId });
        return buildFallbackIdentity(sessionId);
      }

      const identitySource =
        (doc.data?.server_identity as Partial<ServerIdentityPayload> | undefined) ||
        (doc.data?.serverIdentity as Partial<ServerIdentityPayload> | undefined) ||
        null;
      const normalized = normalizeIdentity(sessionId, doc.name, identitySource);

      if (!identitySource) {
        await persistServerIdentity(sessionId, normalized);
      }
      return normalized;
    },
    CACHE_TTL
  );

  if (cached) {
    return cached;
  }

  logger.warn('[세션] 캐시에서 서버 식별자를 가져오지 못해 기본값을 사용합니다.', { sessionId });
  return buildFallbackIdentity(sessionId);
}

export async function updateServerIdentity(
  sessionId: string,
  identity: ServerIdentityPayload
): Promise<void> {
  await persistServerIdentity(sessionId, identity);
  await cacheService.invalidate([CACHE_KEY(sessionId)], []);
  await cacheService.getOrLoad(CACHE_KEY(sessionId), async () => identity, CACHE_TTL);
}

export async function clearServerIdentityCache(sessionId: string): Promise<void> {
  await cacheService.invalidate([CACHE_KEY(sessionId)], []);
}
