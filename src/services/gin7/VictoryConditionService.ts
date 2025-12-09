/**
 * VictoryConditionService - 승리 조건 판정 시스템
 * 매뉴얼 443-469행 기반 구현
 *
 * 승리 조건:
 * - 결정적 승리: 모든 조건 충족
 * - 한정적 승리: 일부 조건 미충족
 * - 국지적 승리: 수도 미점령, 인구 우위
 * - 패배: 위 조건 모두 미충족
 */

import { EventEmitter } from 'events';
import { Planet, IPlanet } from '../../models/gin7/Planet';
import { Fleet, IFleet } from '../../models/gin7/Fleet';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { Gin7GameSession } from '../../models/gin7/GameSession';
import { TimeEngine, GIN7_EVENTS, DayStartPayload } from '../../core/gin7/TimeEngine';
import { logger } from '../../common/logger';

// ============================================================
// Types & Enums
// ============================================================

export enum VictoryType {
  DECISIVE = 'DECISIVE',           // 결정적 승리
  LIMITED = 'LIMITED',             // 한정적 승리
  LOCAL = 'LOCAL',                 // 국지적 승리
  DEFEAT = 'DEFEAT',               // 패배
  DRAW = 'DRAW',                   // 무승부
  ONGOING = 'ONGOING',             // 진행 중
}

export interface VictoryConditionStatus {
  // 인구 지배율 (90% 이상 필요)
  populationDominance: {
    ours: number;
    theirs: number;
    ratio: number;
    met: boolean;
  };
  
  // 함정 비율 (10배 이상 필요)
  fleetRatio: {
    ours: number;
    theirs: number;
    ratio: number;
    met: boolean;
  };
  
  // 쿠데타 미발생
  noCoup: {
    coupOccurred: boolean;
    met: boolean;
  };
  
  // 수도 점령 여부
  capitalCaptured: {
    ourCapitalCaptured: boolean;
    theirCapitalCaptured: boolean;
  };
  
  // 황제/최고사령관 이동 (제국만)
  leaderAtEnemyCapital: {
    applicable: boolean;  // 제국만 해당
    atEnemyCapital: boolean;
    met: boolean;
  };
}

export interface VictoryCheckResult {
  victoryType: VictoryType;
  conditionStatus: VictoryConditionStatus;
  explanation: string;
}

// ============================================================
// VictoryConditionService Class
// ============================================================

export class VictoryConditionService extends EventEmitter {
  private static instance: VictoryConditionService;
  
  // 승리 임계값
  private readonly POPULATION_THRESHOLD = 0.9;   // 90% 인구 지배
  private readonly FLEET_RATIO_THRESHOLD = 10;   // 10배 함정 비율

  private constructor() {
    super();
    logger.info('[VictoryConditionService] Initialized');
  }

  public static getInstance(): VictoryConditionService {
    if (!VictoryConditionService.instance) {
      VictoryConditionService.instance = new VictoryConditionService();
    }
    return VictoryConditionService.instance;
  }

  // ============================================================
  // 승리 조건 체크
  // ============================================================

  /**
   * 승리 조건 판정
   * 매뉴얼 443-469행 기준
   */
  public async checkVictoryCondition(
    sessionId: string,
    factionId: string,
  ): Promise<VictoryCheckResult> {
    // 1. 각 조건 상태 조회
    const conditionStatus = await this.getConditionStatus(sessionId, factionId);
    
    // 2. 승리 타입 결정
    const victoryType = this.determineVictoryType(factionId, conditionStatus);
    
    // 3. 설명 생성
    const explanation = this.generateExplanation(victoryType, conditionStatus);
    
    // 4. 결과가 승리/패배면 이벤트 발생
    if (victoryType !== VictoryType.ONGOING) {
      this.emit('victory:determined', {
        sessionId,
        factionId,
        victoryType,
        conditionStatus,
      });
      
      logger.info(`[VictoryConditionService] Victory determined for ${factionId}: ${victoryType}`);
    }
    
    return {
      victoryType,
      conditionStatus,
      explanation,
    };
  }

  /**
   * 각 조건 상태 조회
   */
  private async getConditionStatus(
    sessionId: string,
    factionId: string,
  ): Promise<VictoryConditionStatus> {
    const isEmpire = factionId === 'EMPIRE' || factionId.toLowerCase().includes('empire');
    const enemyFactionId = isEmpire ? 'ALLIANCE' : 'EMPIRE';
    
    // TODO: 실제 데이터베이스에서 조회
    // 임시로 기본값 반환
    
    // 인구 지배율
    const ourPopulation = await this.getTotalPopulation(sessionId, factionId);
    const enemyPopulation = await this.getTotalPopulation(sessionId, enemyFactionId);
    const totalPopulation = ourPopulation + enemyPopulation;
    const populationRatio = totalPopulation > 0 ? ourPopulation / totalPopulation : 0;
    
    // 함정 비율
    const ourFleetCount = await this.getTotalFleetCount(sessionId, factionId);
    const enemyFleetCount = await this.getTotalFleetCount(sessionId, enemyFactionId);
    const fleetRatio = enemyFleetCount > 0 ? ourFleetCount / enemyFleetCount : Infinity;
    
    // 쿠데타 발생 여부
    const coupOccurred = await this.hasCoupOccurred(sessionId, factionId);
    
    // 수도 점령 여부
    const ourCapitalCaptured = await this.isCapitalCaptured(sessionId, factionId);
    const theirCapitalCaptured = await this.isCapitalCaptured(sessionId, enemyFactionId);
    
    // 황제/최고사령관 위치 (제국만)
    const leaderAtEnemyCapital = isEmpire 
      ? await this.isLeaderAtEnemyCapital(sessionId, factionId, enemyFactionId)
      : false;
    
    return {
      populationDominance: {
        ours: ourPopulation,
        theirs: enemyPopulation,
        ratio: populationRatio,
        met: populationRatio >= this.POPULATION_THRESHOLD,
      },
      fleetRatio: {
        ours: ourFleetCount,
        theirs: enemyFleetCount,
        ratio: fleetRatio,
        met: fleetRatio >= this.FLEET_RATIO_THRESHOLD,
      },
      noCoup: {
        coupOccurred,
        met: !coupOccurred,
      },
      capitalCaptured: {
        ourCapitalCaptured,
        theirCapitalCaptured,
      },
      leaderAtEnemyCapital: {
        applicable: isEmpire,
        atEnemyCapital: leaderAtEnemyCapital,
        met: !isEmpire || leaderAtEnemyCapital,
      },
    };
  }

  /**
   * 승리 타입 결정
   */
  private determineVictoryType(
    factionId: string,
    status: VictoryConditionStatus,
  ): VictoryType {
    const isEmpire = factionId === 'EMPIRE' || factionId.toLowerCase().includes('empire');
    
    // 아군 수도가 점령당했으면 패배
    if (status.capitalCaptured.ourCapitalCaptured) {
      return VictoryType.DEFEAT;
    }
    
    // 적 수도 점령
    if (status.capitalCaptured.theirCapitalCaptured) {
      // 결정적 승리 조건 확인
      const decisiveConditions = [
        status.populationDominance.met,
        status.fleetRatio.met,
        status.noCoup.met,
        status.leaderAtEnemyCapital.met, // 제국만 해당
      ];
      
      const allMet = decisiveConditions.every(c => c);
      const someMet = decisiveConditions.some(c => c);
      
      if (allMet) {
        return VictoryType.DECISIVE;
      } else if (someMet) {
        return VictoryType.LIMITED;
      }
    }
    
    // 수도 미점령, 인구 우위
    if (!status.capitalCaptured.theirCapitalCaptured && 
        status.populationDominance.ratio > 0.5) {
      return VictoryType.LOCAL;
    }
    
    // 진행 중
    return VictoryType.ONGOING;
  }

  /**
   * 설명 생성
   */
  private generateExplanation(
    victoryType: VictoryType,
    status: VictoryConditionStatus,
  ): string {
    switch (victoryType) {
      case VictoryType.DECISIVE:
        return '모든 승리 조건을 충족하여 결정적 승리를 달성했습니다.';
      
      case VictoryType.LIMITED:
        const unmet: string[] = [];
        if (!status.populationDominance.met) unmet.push('인구 90% 지배');
        if (!status.fleetRatio.met) unmet.push('함정 10배 우위');
        if (!status.noCoup.met) unmet.push('쿠데타 미발생');
        if (!status.leaderAtEnemyCapital.met) unmet.push('황제의 적 수도 이동');
        return `적 수도를 점령했으나 일부 조건 미충족으로 한정적 승리입니다. (미충족: ${unmet.join(', ')})`;
      
      case VictoryType.LOCAL:
        return `적 수도를 점령하지 못했으나 인구 우위(${(status.populationDominance.ratio * 100).toFixed(1)}%)로 국지적 승리입니다.`;
      
      case VictoryType.DEFEAT:
        return '수도가 점령당하여 패배했습니다.';
      
      case VictoryType.DRAW:
        return '무승부입니다.';
      
      case VictoryType.ONGOING:
        return '전쟁이 진행 중입니다.';
      
      default:
        return '';
    }
  }

  // ============================================================
  // 데이터 조회 헬퍼 (실제 구현)
  // ============================================================

  private async getTotalPopulation(sessionId: string, factionId: string): Promise<number> {
    try {
      const planets = await Planet.find({ 
        sessionId, 
        ownerId: factionId 
      }).lean();
      
      return planets.reduce((sum, p) => sum + (p.population || 0), 0);
    } catch (error) {
      logger.error('[VictoryConditionService] getTotalPopulation error:', error);
      return 0;
    }
  }

  private async getTotalFleetCount(sessionId: string, factionId: string): Promise<number> {
    try {
      const fleets = await Fleet.find({ 
        sessionId, 
        factionId 
      }).lean();
      
      return fleets.reduce((sum, f) => {
        const unitTotal = f.units?.reduce((unitSum, u) => 
          unitSum + (u.currentShipCount || 0), 0) || 0;
        return sum + unitTotal;
      }, 0);
    } catch (error) {
      logger.error('[VictoryConditionService] getTotalFleetCount error:', error);
      return 0;
    }
  }

  private async hasCoupOccurred(sessionId: string, factionId: string): Promise<boolean> {
    try {
      const session = await Gin7GameSession.findOne({ sessionId }).lean();
      const events = session?.data?.events || [];
      
      // 세션 이벤트에서 쿠데타 발생 여부 확인
      return events.some((e: any) => 
        e.type === 'COUP' && 
        e.factionId === factionId &&
        e.status === 'SUCCESS'
      );
    } catch (error) {
      logger.error('[VictoryConditionService] hasCoupOccurred error:', error);
      return false;
    }
  }

  private async isCapitalCaptured(sessionId: string, factionId: string): Promise<boolean> {
    try {
      const isEmpire = factionId === 'EMPIRE' || factionId.toLowerCase().includes('empire');
      const capitalId = isEmpire ? 'ODIN' : 'HEINESSEN';
      
      const capital = await Planet.findOne({ 
        sessionId, 
        planetId: capitalId 
      }).lean();
      
      if (!capital) return false;
      
      // 수도의 소유자가 다른 진영인지 확인
      return capital.ownerId !== factionId;
    } catch (error) {
      logger.error('[VictoryConditionService] isCapitalCaptured error:', error);
      return false;
    }
  }

  private async isLeaderAtEnemyCapital(
    sessionId: string,
    factionId: string,
    enemyFactionId: string,
  ): Promise<boolean> {
    try {
      const isEmpire = factionId === 'EMPIRE' || factionId.toLowerCase().includes('empire');
      const enemyCapitalId = isEmpire ? 'HEINESSEN' : 'ODIN';
      
      // 황제/최고사령관 찾기
      const leader = await Gin7Character.findOne({
        sessionId,
        factionId,
        $or: [
          { 'position.positionId': 'EMPEROR' },
          { 'position.positionId': 'SUPREME_COMMANDER' },
          { 'data.isLeader': true },
        ],
      }).lean();
      
      if (!leader) return false;
      
      // 리더의 현재 위치가 적 수도인지 확인
      return leader.data?.currentPlanetId === enemyCapitalId ||
             leader.data?.locationId === enemyCapitalId;
    } catch (error) {
      logger.error('[VictoryConditionService] isLeaderAtEnemyCapital error:', error);
      return false;
    }
  }

  // ============================================================
  // TimeEngine 연동
  // ============================================================

  public setupTimeEngineEvents(): void {
    try {
      const timeEngine = TimeEngine.getInstance();
      
      // 일일 승리 조건 체크
      timeEngine.on(GIN7_EVENTS.DAY_START, async (payload: DayStartPayload) => {
        await this.dailyVictoryCheck(payload.sessionId);
      });
    } catch (error) {
      logger.warn('[VictoryConditionService] TimeEngine not available yet');
    }
  }

  private async dailyVictoryCheck(sessionId: string): Promise<void> {
    const results = await this.checkAllFactions(sessionId);
    
    for (const [factionId, result] of results) {
      if (result.victoryType === VictoryType.DECISIVE ||
          result.victoryType === VictoryType.LIMITED ||
          result.victoryType === VictoryType.DEFEAT) {
        
        this.emit('victory:conditionMet', {
          sessionId,
          winnerId: result.victoryType !== VictoryType.DEFEAT ? factionId : null,
          conditionType: result.victoryType,
          explanation: result.explanation,
        });
      }
    }
  }

  // ============================================================
  // 주기적 체크
  // ============================================================

  /**
   * 모든 진영의 승리 조건 체크
   */
  public async checkAllFactions(sessionId: string): Promise<Map<string, VictoryCheckResult>> {
    const results = new Map<string, VictoryCheckResult>();
    
    const factions = ['EMPIRE', 'ALLIANCE'];
    for (const factionId of factions) {
      const result = await this.checkVictoryCondition(sessionId, factionId);
      results.set(factionId, result);
    }
    
    return results;
  }

  // ============================================================
  // 정리
  // ============================================================

  public cleanup(sessionId: string): void {
    logger.info(`[VictoryConditionService] Cleaned up session: ${sessionId}`);
  }
}

export const victoryConditionService = VictoryConditionService.getInstance();
export default VictoryConditionService;

