/**
 * DI Container (수동 의존성 주입 팩토리)
 * blackandwhite-dev-back 패턴: 생성자 기반 DI
 */

import { CacheManager } from './infrastructure/cache/cache-manager';
import { RedisService } from './infrastructure/cache/redis.service';
import { CommandQueue } from './infrastructure/queue/command-queue';
import { CommandRepository } from './api/command/repository/command.repository';
import { GeneralRepository } from './api/general/repository/general.repository';
import { CommandService } from './api/command/service/command.service';
import { GeneralService } from './api/general/service/general.service';

/**
 * 싱글톤 인스턴스 저장소
 */
const singletons = {
  cacheManager: null as CacheManager | null,
  redisService: null as RedisService | null,
  commandQueue: null as CommandQueue | null,
  commandRepository: null as CommandRepository | null,
  generalRepository: null as GeneralRepository | null,
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
 * GeneralRepository 싱글톤 반환
 */
export const getGeneralRepository = (): GeneralRepository => {
  if (!singletons.generalRepository) {
    singletons.generalRepository = new GeneralRepository();
  }
  return singletons.generalRepository;
};

/**
 * CommandService 팩토리
 */
export const makeCommandService = (): CommandService => {
  return new CommandService(getCommandRepository(), getCommandQueue());
};

/**
 * GeneralService 팩토리
 */
export const makeGeneralService = (): GeneralService => {
  return new GeneralService(getGeneralRepository(), getCacheManager());
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
