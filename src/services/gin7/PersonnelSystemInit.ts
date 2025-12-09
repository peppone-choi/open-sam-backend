/**
 * GIN7 Personnel System Initializer
 * 
 * 인사 시스템의 모든 서비스를 초기화하고 연결합니다.
 * 서버 시작 시 호출하세요.
 * 
 * @see agents/gin7-agents/gin7-personnel/CHECKLIST.md
 */

import { RankLadderService } from './RankLadderService';
import { PromotionService } from './PromotionService';
import { AppointmentService } from './AppointmentService';
import { StatsGrowthService } from './StatsGrowthService';
import { LifeCycleService } from './LifeCycleService';
import { logger } from '../../common/logger';

export interface PersonnelSystemOptions {
  /** 자동 승진 활성화 여부 */
  enableAutoPromotion: boolean;
  /** 노화 시스템 활성화 여부 */
  enableAging: boolean;
  /** 자연사 시스템 활성화 여부 */
  enableNaturalDeath: boolean;
}

const DEFAULT_OPTIONS: PersonnelSystemOptions = {
  enableAutoPromotion: true,
  enableAging: true,
  enableNaturalDeath: true,
};

/**
 * Personnel System 초기화
 * 
 * @example
 * ```ts
 * import { initPersonnelSystem } from './services/gin7/PersonnelSystemInit';
 * 
 * // 서버 시작 시
 * await initPersonnelSystem();
 * 
 * // 서버 종료 시
 * await shutdownPersonnelSystem();
 * ```
 */
export async function initPersonnelSystem(
  options: Partial<PersonnelSystemOptions> = {}
): Promise<void> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  logger.info('[PersonnelSystem] Initializing...');
  
  // 서비스 인스턴스 획득
  const ladderService = RankLadderService.getInstance();
  const promotionService = PromotionService.getInstance();
  const appointmentService = AppointmentService.getInstance();
  const growthService = StatsGrowthService.getInstance();
  const lifeCycleService = LifeCycleService.getInstance();
  
  // TimeEngine 구독 설정
  if (config.enableAutoPromotion) {
    promotionService.subscribe();
    logger.info('[PersonnelSystem] Auto-promotion enabled');
  }
  
  if (config.enableAging) {
    growthService.subscribe();
    logger.info('[PersonnelSystem] Aging system enabled');
  }
  
  if (config.enableNaturalDeath) {
    lifeCycleService.subscribe();
    logger.info('[PersonnelSystem] Natural death system enabled');
  }
  
  // 서비스 간 이벤트 연결
  setupEventConnections(ladderService, promotionService, growthService, lifeCycleService);
  
  logger.info('[PersonnelSystem] Initialization complete');
}

/**
 * Personnel System 종료
 */
export async function shutdownPersonnelSystem(): Promise<void> {
  logger.info('[PersonnelSystem] Shutting down...');
  
  const promotionService = PromotionService.getInstance();
  const growthService = StatsGrowthService.getInstance();
  const lifeCycleService = LifeCycleService.getInstance();
  
  // 구독 해제
  promotionService.unsubscribe();
  growthService.unsubscribe();
  lifeCycleService.unsubscribe();
  
  // 캐시 정리
  growthService.clearCache();
  
  logger.info('[PersonnelSystem] Shutdown complete');
}

/**
 * 서비스 간 이벤트 연결
 */
function setupEventConnections(
  ladderService: RankLadderService,
  promotionService: PromotionService,
  growthService: StatsGrowthService,
  lifeCycleService: LifeCycleService
): void {
  // 승진 시 공적치 리셋 로깅
  promotionService.on('promotion:executed', (event) => {
    logger.info('[PersonnelSystem] Promotion executed', {
      characterId: event.characterId,
      oldRank: event.oldRank,
      newRank: event.newRank,
    });
  });
  
  // 레벨업 시 로깅
  growthService.on('stats:levelup', (event) => {
    logger.info('[PersonnelSystem] Stats level up', {
      characterId: event.characterId,
      levelUps: event.levelUps,
    });
  });
  
  // 사망 시 로깅
  lifeCycleService.on('death:processed', (event) => {
    logger.info('[PersonnelSystem] Character died', {
      characterId: event.characterId,
      deathType: event.deathType,
    });
  });
  
  // 후계자 생성 시 로깅
  lifeCycleService.on('successor:created', (event) => {
    logger.info('[PersonnelSystem] Successor created', {
      deceasedId: event.deceasedCharacterId,
      successorId: event.successorId,
    });
  });
}

// Export services for direct access
export { RankLadderService } from './RankLadderService';
export { PromotionService } from './PromotionService';
export { AppointmentService } from './AppointmentService';
export { StatsGrowthService, StatType } from './StatsGrowthService';
export { LifeCycleService, RetirementType, DeathType } from './LifeCycleService';

