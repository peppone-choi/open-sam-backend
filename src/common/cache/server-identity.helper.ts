import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import { cacheService } from './cache.service';
import { Session, ISession } from '../../models/session.model';
import { logger } from '../logger';
import { configManager } from '../../config/ConfigManager';

const { system } = configManager.get();

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
const CACHE_TTL = 600; // 10분 고정

const buildFallbackIdentity = (sessionId: string): ServerIdentityPayload => {
  return {
    sessionId,
    serverId: system.serverId,
    serverName: system.serverName,
    hiddenSeed: system.hiddenSeed,
    season: system.seasonIndex,
    updatedAt: new Date().toISOString(),
  };
};

const normalizeIdentity = (
  sessionId: string,
  sessionName?: string,
  source?: Partial<ServerIdentityPayload> | null
): ServerIdentityPayload => {
  return {
    sessionId,
    serverId: source?.serverId || source?.sessionId || system.serverId,
    serverName: source?.serverName || sessionName || system.serverName,
    hiddenSeed: source?.hiddenSeed || system.hiddenSeed,
    season: typeof source?.season === 'number' ? source.season : system.seasonIndex,
    updatedAt: new Date().toISOString(),
  };
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
        return buildFallbackIdentity(sessionId);
      }

      const identitySource =
        (doc.data?.server_identity as Partial<ServerIdentityPayload> | undefined) ||
        (doc.data?.serverIdentity as Partial<ServerIdentityPayload> | undefined) ||
        null;
      const normalized = normalizeIdentity(sessionId, (doc as any).name, identitySource);

      if (!identitySource) {
        await persistServerIdentity(sessionId, normalized);
      }
      return normalized;
    },
    CACHE_TTL
  );

  return cached || buildFallbackIdentity(sessionId);
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
