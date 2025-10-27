/**
 * DI Container (수동 의존성 주입 팩토리)
 */

import { CacheManager } from './infrastructure/cache/cache-manager';
import { RedisService } from './infrastructure/cache/redis.service';
import { CommandQueue } from './infrastructure/queue/command-queue';
import { CommandRepository } from './api/command/repository/command.repository';
import { GameSessionRepository } from './api/game-session/repository/game-session.repository';
import { CommandService } from './api/command/service/command.service';

/**
 * 싱글톤 인스턴스 저장소
 */
const singletons = {
  cacheManager: null as CacheManager | null,
  redisService: null as RedisService | null,
  commandQueue: null as CommandQueue | null,
  commandRepository: null as CommandRepository | null,
  gameSessionRepository: null as GameSessionRepository | null,
};

/**
 * CacheManager 싱글톤 반환
 */
export const getCacheManager = (): CacheManager => {
  if (!singletons.cacheManager) {
    singletons.cacheManager = new CacheManager();
  }
  return singletons.cacheManager;
};

/**
 * RedisService 싱글톤 반환
 */
export const getRedisService = (): RedisService => {
  if (!singletons.redisService) {
    singletons.redisService = new RedisService();
  }
  return singletons.redisService;
};

/**
 * CommandQueue 싱글톤 반환
 */
export const getCommandQueue = (): CommandQueue => {
  if (!singletons.commandQueue) {
    singletons.commandQueue = new CommandQueue(getRedisService());
  }
  return singletons.commandQueue;
};

/**
 * CommandRepository 싱글톤 반환
 */
export const getCommandRepository = (): CommandRepository => {
  if (!singletons.commandRepository) {
    singletons.commandRepository = new CommandRepository();
  }
  return singletons.commandRepository;
};

/**
 * GameSessionRepository 싱글톤 반환
 */
export const getGameSessionRepository = (): GameSessionRepository => {
  if (!singletons.gameSessionRepository) {
    singletons.gameSessionRepository = new GameSessionRepository();
  }
  return singletons.gameSessionRepository;
};

/**
 * CommandService 팩토리
 */
export const makeCommandService = (): CommandService => {
  return new CommandService(getCommandRepository(), getCommandQueue(), getGameSessionRepository());
};
