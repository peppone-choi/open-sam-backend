/**
 * DI Container (수동 의존성 주입 팩토리)
 * blackandwhite-dev-back 패턴: 생성자 기반 DI
 */

import { CacheManager } from './infrastructure/cache/cache-manager';
import { RedisService } from './infrastructure/cache/redis.service';
import { CommandQueue } from './infrastructure/queue/command-queue';

// TODO: 도메인별 import 추가
// import { GeneralRepository } from './api/general/repository/general.repository';
// import { GeneralService } from './api/general/service/general.service';
// import { GeneralController } from './api/general/controller/general.controller';

/**
 * 싱글톤 인스턴스 저장소
 */
const singletons = {
  cacheManager: null as CacheManager | null,
  redisService: null as RedisService | null,
  commandQueue: null as CommandQueue | null,
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
 * General Controller 팩토리
 * TODO: Repository, Service 구현 후 활성화
 */
export const makeGeneralController = () => {
  // const repo = new GeneralRepository();
  // const service = new GeneralService(repo, getCacheManager(), getCommandQueue());
  // return new GeneralController(service);
  
  throw new Error('makeGeneralController: Not implemented yet');
};

/**
 * Command Controller 팩토리
 * TODO: Repository, Service 구현 후 활성화
 */
export const makeCommandController = () => {
  // const repo = new CommandRepository();
  // const service = new CommandService(repo, getCommandQueue());
  // return new CommandController(service);
  
  throw new Error('makeCommandController: Not implemented yet');
};

/**
 * City Controller 팩토리
 * TODO: Repository, Service 구현 후 활성화
 */
export const makeCityController = () => {
  throw new Error('makeCityController: Not implemented yet');
};

// TODO: 나머지 도메인 Controller 팩토리 추가
// - makeNationController
// - makeBattleController
// - makeItemController
