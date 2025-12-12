/**
 * BattleTimeLimitService
 * 
 * 전투 시간 제한 및 강제 종료 조건 관리
 * 
 * 종료 조건:
 * 1. 최대 시간 초과 (기본 1시간 = 36000 틱)
 * 2. 양측 보급 고갈
 * 3. 교착 상태 (일정 시간 데미지 없음)
 * 4. 게임 내 작전 기간 초과
 */

import { EventEmitter } from 'events';
import { IRealtimeBattle, RealtimeBattle } from '../../../models/gin7/RealtimeBattle';
import { supplyService } from '../SupplyService';

/**
 * 시간 제한 설정
 */
export const TIME_LIMIT_CONFIG = {
  // 기본 최대 전투 시간 (틱)
  defaultMaxTicks: 36000,        // 1시간 (10틱/초 × 3600초)
  
  // 교착 상태 감지
  stalemateThreshold: 1800,      // 3분간 데미지 없으면 교착 (10틱 × 180초)
  stalemateCheckInterval: 100,   // 100틱마다 교착 체크
  
  // 보급 고갈 대기 시간
  supplyDepletionGracePeriod: 300, // 보급 고갈 후 30초 대기
  
  // 게임 내 시간 제한 (옵션)
  inGameDayLimit: 30,            // 게임 내 30일 제한
  realTimeToGameDayRatio: 2.5,   // 현실 1시간 = 게임 24시간 (1분 = 0.4일)
  
  // 강제 종료 전 경고
  warningBeforeEnd: 600,         // 종료 1분 전 경고
};

/**
 * 전투 종료 사유
 */
export type BattleEndReason =
  | 'VICTORY'              // 일방 승리 (상대 전멸/퇴각)
  | 'DRAW'                 // 무승부 (양측 전멸)
  | 'TIMEOUT'              // 시간 초과
  | 'STALEMATE'            // 교착 상태
  | 'SUPPLY_DEPLETION'     // 양측 보급 고갈
  | 'OPERATION_PERIOD'     // 작전 기간 초과
  | 'CANCELLED'            // 취소 (관리자/시스템)
  | 'SERVER_SHUTDOWN';     // 서버 종료

/**
 * 시간 제한 상태
 */
export interface ITimeLimitStatus {
  battleId: string;
  
  // 현재 시간
  currentTick: number;
  elapsedSeconds: number;
  
  // 최대 시간
  maxTicks: number;
  maxSeconds: number;
  
  // 남은 시간
  remainingTicks: number;
  remainingSeconds: number;
  remainingPercent: number;
  
  // 교착 상태
  ticksSinceLastDamage: number;
  isStalemate: boolean;
  
  // 보급 상태
  allFleetsOutOfSupply: boolean;
  supplyDepletedAt?: number;  // 틱
  
  // 경고
  isNearingEnd: boolean;      // 종료 임박
  estimatedEndReason?: BattleEndReason;
}

/**
 * 교착 감지 데이터
 */
interface IStalemateData {
  lastDamageTick: number;
  lastDamageByFaction: Map<string, number>;  // factionId -> lastDamageTick
  totalDamageThisPeriod: number;
}

/**
 * 전투 시간 제한 결과
 */
export interface ITimeLimitCheckResult {
  shouldEnd: boolean;
  reason?: BattleEndReason;
  winner?: string;           // factionId or undefined for draw
  message?: string;
}

/**
 * BattleTimeLimitService 클래스
 */
class BattleTimeLimitService extends EventEmitter {
  private static instance: BattleTimeLimitService;
  
  // 전투별 교착 데이터
  private stalemateData: Map<string, IStalemateData> = new Map();
  
  // 전투별 보급 고갈 시간
  private supplyDepletionTime: Map<string, number> = new Map();
  
  // 경고 발송 추적
  private warningsSent: Map<string, Set<string>> = new Map();

  private constructor() {
    super();
  }

  static getInstance(): BattleTimeLimitService {
    if (!BattleTimeLimitService.instance) {
      BattleTimeLimitService.instance = new BattleTimeLimitService();
    }
    return BattleTimeLimitService.instance;
  }

  /**
   * 전투 시간 제한 초기화
   */
  initializeBattle(battleId: string, maxTicks?: number): void {
    this.stalemateData.set(battleId, {
      lastDamageTick: 0,
      lastDamageByFaction: new Map(),
      totalDamageThisPeriod: 0
    });
    
    this.warningsSent.set(battleId, new Set());
  }

  /**
   * 시간 제한 상태 조회
   */
  async getTimeLimitStatus(
    battleId: string,
    currentTick: number
  ): Promise<ITimeLimitStatus | null> {
    const battle = await RealtimeBattle.findOne({ battleId });
    if (!battle) return null;

    const maxTicks = battle.maxTicks || TIME_LIMIT_CONFIG.defaultMaxTicks;
    const remainingTicks = Math.max(0, maxTicks - currentTick);
    const stalemate = this.stalemateData.get(battleId);
    const ticksSinceLastDamage = stalemate 
      ? currentTick - stalemate.lastDamageTick 
      : 0;

    const supplyDepletedAt = this.supplyDepletionTime.get(battleId);
    
    return {
      battleId,
      currentTick,
      elapsedSeconds: currentTick / 10,
      maxTicks,
      maxSeconds: maxTicks / 10,
      remainingTicks,
      remainingSeconds: remainingTicks / 10,
      remainingPercent: (remainingTicks / maxTicks) * 100,
      ticksSinceLastDamage,
      isStalemate: ticksSinceLastDamage >= TIME_LIMIT_CONFIG.stalemateThreshold,
      allFleetsOutOfSupply: supplyDepletedAt !== undefined,
      supplyDepletedAt,
      isNearingEnd: remainingTicks <= TIME_LIMIT_CONFIG.warningBeforeEnd,
      estimatedEndReason: this.estimateEndReason(
        remainingTicks, 
        ticksSinceLastDamage, 
        supplyDepletedAt, 
        currentTick
      )
    };
  }

  /**
   * 시간 제한 체크 (매 틱 호출)
   */
  async checkTimeLimit(
    battleId: string,
    currentTick: number
  ): Promise<ITimeLimitCheckResult> {
    const battle = await RealtimeBattle.findOne({ battleId });
    if (!battle) {
      return { shouldEnd: false };
    }

    const maxTicks = battle.maxTicks || TIME_LIMIT_CONFIG.defaultMaxTicks;

    // 1. 최대 시간 초과 체크
    if (currentTick >= maxTicks) {
      return {
        shouldEnd: true,
        reason: 'TIMEOUT',
        winner: await this.determineWinnerByAdvantage(battle),
        message: '전투 시간이 초과되었습니다.'
      };
    }

    // 경고 체크 (종료 1분 전)
    if (maxTicks - currentTick === TIME_LIMIT_CONFIG.warningBeforeEnd) {
      this.emitWarning(battleId, 'TIME_RUNNING_OUT', `전투 종료까지 ${TIME_LIMIT_CONFIG.warningBeforeEnd / 10}초 남았습니다.`);
    }

    return { shouldEnd: false };
  }

  /**
   * 보급 제한 체크
   */
  async checkSupplyLimit(
    battleId: string,
    sessionId: string,
    fleetIds: string[],
    currentTick: number
  ): Promise<ITimeLimitCheckResult> {
    // 모든 함대의 보급 상태 확인
    let allDepleted = true;
    let anyCanContinue = false;

    for (const fleetId of fleetIds) {
      const canContinue = await supplyService.canContinueBattle(sessionId, fleetId);
      if (canContinue) {
        allDepleted = false;
        anyCanContinue = true;
        break;
      }
    }

    if (allDepleted) {
      // 보급 고갈 시작 시간 기록
      if (!this.supplyDepletionTime.has(battleId)) {
        this.supplyDepletionTime.set(battleId, currentTick);
        this.emitWarning(battleId, 'ALL_SUPPLY_DEPLETED', '모든 함대의 보급이 고갈되었습니다.');
      }

      // 유예 기간 체크
      const depletedAt = this.supplyDepletionTime.get(battleId)!;
      if (currentTick - depletedAt >= TIME_LIMIT_CONFIG.supplyDepletionGracePeriod) {
        return {
          shouldEnd: true,
          reason: 'SUPPLY_DEPLETION',
          winner: await this.determineWinnerBySupply(battleId, sessionId, fleetIds),
          message: '양측 모두 보급이 고갈되어 전투가 종료됩니다.'
        };
      }
    } else {
      // 보급 회복됨 - 타이머 리셋
      this.supplyDepletionTime.delete(battleId);
    }

    return { shouldEnd: false };
  }

  /**
   * 교착 상태 체크
   */
  checkStalemate(
    battleId: string,
    currentTick: number
  ): ITimeLimitCheckResult {
    const stalemate = this.stalemateData.get(battleId);
    if (!stalemate) {
      return { shouldEnd: false };
    }

    const ticksSinceLastDamage = currentTick - stalemate.lastDamageTick;

    if (ticksSinceLastDamage >= TIME_LIMIT_CONFIG.stalemateThreshold) {
      return {
        shouldEnd: true,
        reason: 'STALEMATE',
        winner: undefined, // 교착은 무승부
        message: `${TIME_LIMIT_CONFIG.stalemateThreshold / 10}초간 전투가 없어 교착 상태로 종료됩니다.`
      };
    }

    // 경고 (절반 지점)
    if (ticksSinceLastDamage === Math.floor(TIME_LIMIT_CONFIG.stalemateThreshold / 2)) {
      this.emitWarning(battleId, 'STALEMATE_WARNING', '전투가 진행되지 않고 있습니다. 교착 상태가 지속되면 무승부로 종료됩니다.');
    }

    return { shouldEnd: false };
  }

  /**
   * 데미지 기록 (교착 감지용)
   */
  recordDamage(
    battleId: string,
    currentTick: number,
    factionId: string,
    damage: number
  ): void {
    let stalemate = this.stalemateData.get(battleId);
    if (!stalemate) {
      stalemate = {
        lastDamageTick: currentTick,
        lastDamageByFaction: new Map(),
        totalDamageThisPeriod: 0
      };
      this.stalemateData.set(battleId, stalemate);
    }

    stalemate.lastDamageTick = currentTick;
    stalemate.lastDamageByFaction.set(factionId, currentTick);
    stalemate.totalDamageThisPeriod += damage;
  }

  /**
   * 최대 전투 시간 계산
   */
  getMaxBattleDuration(
    options: {
      baseMaxTicks?: number;
      participantCount?: number;
      totalUnits?: number;
      hasSupplyLine?: boolean;
    } = {}
  ): number {
    let maxTicks = options.baseMaxTicks || TIME_LIMIT_CONFIG.defaultMaxTicks;

    // 참가자 수에 따른 조정
    if (options.participantCount && options.participantCount > 4) {
      maxTicks = Math.floor(maxTicks * 1.2); // 20% 증가
    }

    // 유닛 수에 따른 조정
    if (options.totalUnits && options.totalUnits > 400) {
      maxTicks = Math.floor(maxTicks * 1.3); // 30% 증가
    }

    // 보급선 있으면 시간 증가
    if (options.hasSupplyLine) {
      maxTicks = Math.floor(maxTicks * 1.5); // 50% 증가
    }

    return maxTicks;
  }

  /**
   * 강제 전투 종료
   */
  async forceBattleEnd(
    battleId: string,
    reason: BattleEndReason,
    winner?: string,
    message?: string
  ): Promise<void> {
    this.emit('battle:force_end', {
      battleId,
      reason,
      winner,
      message: message || `전투가 강제 종료되었습니다: ${reason}`
    });

    // 데이터 정리
    this.cleanup(battleId);
  }

  /**
   * 종합 체크 (매 틱 호출용)
   */
  async checkAllLimits(
    battleId: string,
    sessionId: string,
    currentTick: number,
    fleetIds: string[]
  ): Promise<ITimeLimitCheckResult> {
    // 1. 시간 제한
    const timeResult = await this.checkTimeLimit(battleId, currentTick);
    if (timeResult.shouldEnd) return timeResult;

    // 2. 보급 제한 (10틱마다 체크)
    if (currentTick % 10 === 0) {
      const supplyResult = await this.checkSupplyLimit(battleId, sessionId, fleetIds, currentTick);
      if (supplyResult.shouldEnd) return supplyResult;
    }

    // 3. 교착 상태 (100틱마다 체크)
    if (currentTick % TIME_LIMIT_CONFIG.stalemateCheckInterval === 0) {
      const stalemateResult = this.checkStalemate(battleId, currentTick);
      if (stalemateResult.shouldEnd) return stalemateResult;
    }

    return { shouldEnd: false };
  }

  // === 내부 헬퍼 함수 ===

  /**
   * 우세에 따른 승자 결정 (시간 초과 시)
   */
  private async determineWinnerByAdvantage(
    battle: IRealtimeBattle
  ): Promise<string | undefined> {
    const factionStats = new Map<string, { ships: number; hp: number }>();

    for (const participant of battle.participants) {
      if (participant.isDefeated) continue;

      const faction = participant.faction;
      const current = factionStats.get(faction) || { ships: 0, hp: 0 };
      
      current.ships += participant.shipCount - participant.shipsLost;
      // HP는 평균으로 가정
      current.hp += (participant.shipCount - participant.shipsLost) * 50;

      factionStats.set(faction, current);
    }

    // 가장 많은 함선 보유 진영이 승리
    let winner: string | undefined;
    let maxShips = 0;
    let tied = false;

    for (const [faction, stats] of factionStats) {
      if (stats.ships > maxShips) {
        maxShips = stats.ships;
        winner = faction;
        tied = false;
      } else if (stats.ships === maxShips) {
        tied = true;
      }
    }

    return tied ? undefined : winner;
  }

  /**
   * 보급 기준 승자 결정
   */
  private async determineWinnerBySupply(
    battleId: string,
    sessionId: string,
    fleetIds: string[]
  ): Promise<string | undefined> {
    // 가장 보급이 많이 남은 측이 승리
    const battle = await RealtimeBattle.findOne({ battleId });
    if (!battle) return undefined;

    const factionSupply = new Map<string, number>();

    for (const fleetId of fleetIds) {
      const supply = await supplyService.getFleetSupply(sessionId, fleetId);
      if (!supply) continue;

      const participant = battle.participants.find(p => p.fleetId === fleetId);
      if (!participant || participant.isDefeated) continue;

      const faction = participant.faction;
      const current = factionSupply.get(faction) || 0;
      const totalSupply = supply.fuel + supply.ammo + supply.supplies;
      factionSupply.set(faction, current + totalSupply);
    }

    let winner: string | undefined;
    let maxSupply = 0;

    for (const [faction, total] of factionSupply) {
      if (total > maxSupply) {
        maxSupply = total;
        winner = faction;
      }
    }

    return maxSupply > 0 ? winner : undefined;
  }

  /**
   * 예상 종료 사유
   */
  private estimateEndReason(
    remainingTicks: number,
    ticksSinceLastDamage: number,
    supplyDepletedAt: number | undefined,
    currentTick: number
  ): BattleEndReason | undefined {
    // 교착이 가장 임박
    if (ticksSinceLastDamage >= TIME_LIMIT_CONFIG.stalemateThreshold * 0.8) {
      return 'STALEMATE';
    }

    // 보급 고갈 임박
    if (supplyDepletedAt !== undefined) {
      const ticksSinceDepletion = currentTick - supplyDepletedAt;
      if (ticksSinceDepletion >= TIME_LIMIT_CONFIG.supplyDepletionGracePeriod * 0.8) {
        return 'SUPPLY_DEPLETION';
      }
    }

    // 시간 초과 임박
    if (remainingTicks <= TIME_LIMIT_CONFIG.warningBeforeEnd) {
      return 'TIMEOUT';
    }

    return undefined;
  }

  /**
   * 경고 발송
   */
  private emitWarning(battleId: string, type: string, message: string): void {
    const sent = this.warningsSent.get(battleId);
    if (sent?.has(type)) return;

    sent?.add(type);
    this.emit('battle:warning', { battleId, type, message });
  }

  /**
   * 전투 데이터 정리
   */
  cleanup(battleId: string): void {
    this.stalemateData.delete(battleId);
    this.supplyDepletionTime.delete(battleId);
    this.warningsSent.delete(battleId);
  }

  /**
   * 서비스 정리
   */
  destroy(): void {
    this.stalemateData.clear();
    this.supplyDepletionTime.clear();
    this.warningsSent.clear();
    this.removeAllListeners();
  }
}

export const battleTimeLimitService = BattleTimeLimitService.getInstance();
export default BattleTimeLimitService;
