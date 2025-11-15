/**
 * 엔진 레지스트리
 *
 * 모든 액션 핸들러를 등록하고 관리
 */

import { UniversalGameEngine } from './UniversalGameEngine';
import { CacheManager } from '../cache/CacheManager';
import { logger } from '../common/logger';

// 삼국지 핸들러
import { CultivateFarmHandler } from './handlers/sangokushi/CultivateFarmHandler';

// 은하영웅전설 핸들러
import { BuildFleetHandler } from './handlers/logh/BuildFleetHandler';

/**
 * 엔진 레지스트리 싱글톤
 */
export class EngineRegistry {
  private static instance: EngineRegistry;
  private engine: UniversalGameEngine;

  private constructor() {
    const cacheManager = CacheManager.getInstance();
    this.engine = new UniversalGameEngine(cacheManager);

    this.registerAllHandlers();
  }

  /**
   * 싱글톤 인스턴스
   */
  static getInstance(): EngineRegistry {
    if (!EngineRegistry.instance) {
      EngineRegistry.instance = new EngineRegistry();
    }
    return EngineRegistry.instance;
  }

  /**
   * 모든 핸들러 등록
   */
  private registerAllHandlers(): void {
    logger.info('액션 핸들러 등록 시작...');

    // 삼국지 핸들러
    this.registerSangokushiHandlers();

    // 은하영웅전설 핸들러
    this.registerLoghHandlers();

    const stats = this.engine.getStats();
    logger.info('액션 핸들러 등록 완료', stats);
  }

  /**
   * 삼국지 핸들러 등록
   */
  private registerSangokushiHandlers(): void {
    // 내정
    this.engine.registerHandler(new CultivateFarmHandler(this.engine));

    
    // - CultivateLandHandler (토지 개간)
    // - BoostCommerceHandler (상업 투자)
    // - BoostSecurityHandler (치안 투자)
    // - BoostWallHandler (성벽 보수)
    //
    // 군사
    // - TrainTroopsHandler (훈련)
    // - RecruitTroopsHandler (징병)
    // - DeployTroopsHandler (배치)
    // - MoveHandler (이동)
    // - OccupyHandler (점령)
    //
    // 외교
    // - DiplomacyAllyHandler (동맹)
    // - DiplomacyDeclareWarHandler (선전포고)
    // - DiplomacyPeaceHandler (강화)
    //
    // 인사
    // - AppointHandler (임명)
    // - DismissHandler (해임)
    // - RecruitGeneralHandler (등용)
    //
    // 훈련
    // - TrainLeadershipHandler (통솔 수련)
    // - TrainStrengthHandler (무력 수련)
    // - TrainIntelligenceHandler (지력 수련)
  }

  /**
   * 은하영웅전설 핸들러 등록
   */
  private registerLoghHandlers(): void {
    // 군사
    this.engine.registerHandler(new BuildFleetHandler(this.engine));

    
    // - TrainFleetHandler (함대 훈련)
    // - DeployFleetHandler (함대 배치)
    // - MoveFleetHandler (함대 이동)
    // - AttackHandler (공격)
    //
    // 내정
    // - DevelopEconomyHandler (경제 개발)
    // - DevelopTechnologyHandler (기술 개발)
    // - DevelopFacilityHandler (시설 개발)
    //
    // 외교
    // - DiplomacyNegotiateHandler (외교 협상)
    // - DiplomacyTradeAgreementHandler (무역 협정)
    //
    // 인사
    // - AppointCommanderHandler (사령관 임명)
    // - TrainCommanderHandler (사령관 훈련)
  }

  /**
   * 엔진 인스턴스 반환
   */
  getEngine(): UniversalGameEngine {
    return this.engine;
  }

  /**
   * 통계 조회
   */
  getStats() {
    return this.engine.getStats();
  }
}

/**
 * 엔진 인스턴스 export (편의성)
 */
export function getEngine(): UniversalGameEngine {
  return EngineRegistry.getInstance().getEngine();
}
