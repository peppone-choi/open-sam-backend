/**
 * MoraleService - 사기 시스템 서비스
 * 
 * 유닛의 사기(Morale)를 관리합니다.
 * - 사기 파라미터 (0-100)
 * - 사기 영향 요인 (승리/패배/보급/지휘관)
 * - 사기 저하 시 효과 (명령 거부, 탈영)
 * - 사기 회복 로직
 */

import { EventEmitter } from 'events';
import {
  MoraleState,
  MoraleModifiers,
  MoraleChangeReason,
  UnitMoraleState,
  MoraleHistoryEntry,
  MoraleChangeEvent,
  MORALE_THRESHOLDS,
  MORALE_MODIFIERS,
  MORALE_CHANGE_VALUES,
  MORALE_CONSTANTS,
} from '../../types/gin7/morale.types';
import { logger } from '../../common/logger';

// ============================================================
// MoraleService Class
// ============================================================

export class MoraleService extends EventEmitter {
  // 유닛별 사기 상태 관리
  private moraleStates: Map<string, UnitMoraleState> = new Map();
  
  // 세션별 글로벌 사기 보정
  private globalModifiers: Map<string, number> = new Map(); // sessionId -> modifier
  
  constructor() {
    super();
    logger.info('[MoraleService] Initialized');
  }
  
  // ============================================================
  // Initialization
  // ============================================================
  
  /**
   * 유닛 사기 초기화
   */
  initializeMorale(
    unitId: string,
    options?: {
      startMorale?: number;
      maxMorale?: number;
      recoveryRate?: number;
      commanderBonus?: number;
    }
  ): UnitMoraleState {
    const startMorale = options?.startMorale ?? MORALE_CONSTANTS.DEFAULT_START_MORALE;
    const maxMorale = options?.maxMorale ?? MORALE_CONSTANTS.DEFAULT_MAX_MORALE;
    const commanderBonus = options?.commanderBonus ?? 0;
    
    const state: UnitMoraleState = {
      unitId,
      currentMorale: Math.min(startMorale + commanderBonus, maxMorale),
      maxMorale: maxMorale + commanderBonus,
      moraleState: this.calculateMoraleState(startMorale),
      recoveryRate: options?.recoveryRate ?? MORALE_CONSTANTS.BASE_RECOVERY_RATE,
      lastRecoveryTick: 0,
      immunityTicks: 0,
      moraleHistory: [],
    };
    
    this.moraleStates.set(unitId, state);
    
    logger.debug('[MoraleService] Morale initialized', {
      unitId,
      morale: state.currentMorale,
      state: state.moraleState,
    });
    
    return state;
  }
  
  /**
   * 배치 초기화 (여러 유닛 한번에)
   */
  initializeMoraleBatch(
    units: Array<{
      unitId: string;
      commanderBonus?: number;
      startMorale?: number;
    }>
  ): void {
    for (const unit of units) {
      this.initializeMorale(unit.unitId, {
        startMorale: unit.startMorale,
        commanderBonus: unit.commanderBonus,
      });
    }
    
    logger.info('[MoraleService] Batch initialized', { count: units.length });
  }
  
  // ============================================================
  // Morale Modification
  // ============================================================
  
  /**
   * 사기 변경 (이유 기반)
   */
  changeMorale(
    unitId: string,
    reason: MoraleChangeReason,
    customValue?: number
  ): { success: boolean; newMorale: number; stateChanged: boolean } {
    const state = this.moraleStates.get(unitId);
    
    if (!state) {
      logger.warn('[MoraleService] Unit not found', { unitId });
      return { success: false, newMorale: 0, stateChanged: false };
    }
    
    // 면역 상태 확인 (감소일 경우만)
    const changeValue = customValue ?? MORALE_CHANGE_VALUES[reason];
    if (changeValue < 0 && state.immunityTicks > 0) {
      logger.debug('[MoraleService] Morale change blocked (immunity)', { unitId });
      return { success: false, newMorale: state.currentMorale, stateChanged: false };
    }
    
    const previousMorale = state.currentMorale;
    const previousState = state.moraleState;
    
    // 사기 변경 적용
    state.currentMorale = Math.max(0, Math.min(state.maxMorale, state.currentMorale + changeValue));
    state.moraleState = this.calculateMoraleState(state.currentMorale);
    
    // 기록 추가
    const historyEntry: MoraleHistoryEntry = {
      tick: Date.now(),
      reason,
      change: changeValue,
      newMorale: state.currentMorale,
    };
    state.moraleHistory.push(historyEntry);
    
    // 기록 제한
    if (state.moraleHistory.length > MORALE_CONSTANTS.MAX_HISTORY_ENTRIES) {
      state.moraleHistory.shift();
    }
    
    const stateChanged = previousState !== state.moraleState;
    
    // 상태 변경 시 이벤트 발생
    if (stateChanged) {
      const event: MoraleChangeEvent = {
        unitId,
        previousMorale,
        newMorale: state.currentMorale,
        previousState,
        newState: state.moraleState,
        reason,
        timestamp: Date.now(),
      };
      
      this.emit('MORALE_STATE_CHANGED', event);
      
      logger.info('[MoraleService] Morale state changed', {
        unitId,
        from: previousState,
        to: state.moraleState,
        morale: state.currentMorale,
      });
    }
    
    // 위기 상태 진입 시 추가 이벤트
    if (state.moraleState === MoraleState.CRITICAL) {
      this.emit('MORALE_CRITICAL', { unitId, morale: state.currentMorale });
    }
    
    return {
      success: true,
      newMorale: state.currentMorale,
      stateChanged,
    };
  }
  
  /**
   * 직접 사기 설정 (치트/디버그용)
   */
  setMorale(unitId: string, morale: number): boolean {
    const state = this.moraleStates.get(unitId);
    if (!state) return false;
    
    state.currentMorale = Math.max(0, Math.min(state.maxMorale, morale));
    state.moraleState = this.calculateMoraleState(state.currentMorale);
    
    return true;
  }
  
  /**
   * 사기 진작 (Rally) - CP 소모
   */
  rally(
    unitId: string,
    cpAvailable: number,
    commanderCharisma: number = 50
  ): { success: boolean; cpCost: number; moraleGain: number } {
    const state = this.moraleStates.get(unitId);
    
    if (!state) {
      return { success: false, cpCost: 0, moraleGain: 0 };
    }
    
    const modifiers = MORALE_MODIFIERS[state.moraleState];
    const cpCost = modifiers.rallyCost;
    
    if (cpAvailable < cpCost) {
      return { success: false, cpCost, moraleGain: 0 };
    }
    
    // 지휘관 카리스마에 따른 회복량 보정
    const charismaMod = 1 + (commanderCharisma - 50) / 100;
    const baseMoraleGain = MORALE_CHANGE_VALUES[MoraleChangeReason.RALLY];
    const moraleGain = Math.floor(baseMoraleGain * charismaMod);
    
    this.changeMorale(unitId, MoraleChangeReason.RALLY, moraleGain);
    
    // 면역 부여
    state.immunityTicks = MORALE_CONSTANTS.IMMUNITY_AFTER_RALLY;
    
    logger.info('[MoraleService] Rally executed', {
      unitId,
      cpCost,
      moraleGain,
      newMorale: state.currentMorale,
    });
    
    return { success: true, cpCost, moraleGain };
  }
  
  // ============================================================
  // Recovery & Updates
  // ============================================================
  
  /**
   * 틱 업데이트 (자연 회복 및 면역 감소)
   */
  updateTick(currentTick: number): void {
    for (const [unitId, state] of this.moraleStates) {
      // 면역 틱 감소
      if (state.immunityTicks > 0) {
        state.immunityTicks--;
      }
      
      // 자연 회복 체크
      const ticksSinceRecovery = currentTick - state.lastRecoveryTick;
      
      if (ticksSinceRecovery >= MORALE_CONSTANTS.RECOVERY_INTERVAL_TICKS) {
        this.naturalRecovery(unitId, state);
        state.lastRecoveryTick = currentTick;
      }
    }
  }
  
  /**
   * 자연 회복
   */
  private naturalRecovery(unitId: string, state: UnitMoraleState): void {
    if (state.currentMorale >= state.maxMorale) return;
    if (state.moraleState === MoraleState.CRITICAL) return; // 위기 상태는 자연 회복 불가
    
    const recovery = state.recoveryRate;
    const previousMorale = state.currentMorale;
    
    state.currentMorale = Math.min(state.maxMorale, state.currentMorale + recovery);
    state.moraleState = this.calculateMoraleState(state.currentMorale);
    
    // 상태 전환 시 이벤트
    const previousState = this.calculateMoraleState(previousMorale);
    if (previousState !== state.moraleState) {
      this.emit('MORALE_STATE_CHANGED', {
        unitId,
        previousMorale,
        newMorale: state.currentMorale,
        previousState,
        newState: state.moraleState,
        reason: MoraleChangeReason.REST,
        timestamp: Date.now(),
      } as MoraleChangeEvent);
    }
  }
  
  // ============================================================
  // Combat Effects
  // ============================================================
  
  /**
   * 명령 거부 체크
   */
  checkCommandRefusal(unitId: string): boolean {
    const state = this.moraleStates.get(unitId);
    if (!state) return false;
    
    const modifiers = MORALE_MODIFIERS[state.moraleState];
    
    if (modifiers.retreatChance > 0) {
      const roll = Math.random();
      if (roll < modifiers.retreatChance) {
        this.emit('COMMAND_REFUSED', { unitId, morale: state.currentMorale });
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * 탈영 체크 (위기 상태에서)
   */
  checkDesertion(unitId: string): { deserted: boolean; percentage: number } {
    const state = this.moraleStates.get(unitId);
    if (!state) return { deserted: false, percentage: 0 };
    
    if (state.moraleState !== MoraleState.CRITICAL) {
      return { deserted: false, percentage: 0 };
    }
    
    const roll = Math.random();
    const desertionChance = MORALE_MODIFIERS[MoraleState.CRITICAL].retreatChance;
    
    if (roll < desertionChance) {
      // 탈영 비율 (사기가 낮을수록 높음)
      const percentage = Math.floor((30 - state.currentMorale) * 2);
      
      this.emit('DESERTION', {
        unitId,
        morale: state.currentMorale,
        percentage: Math.min(50, Math.max(5, percentage)),
      });
      
      return { deserted: true, percentage: Math.min(50, Math.max(5, percentage)) };
    }
    
    return { deserted: false, percentage: 0 };
  }
  
  /**
   * 전투 보정 계수 조회
   */
  getCombatModifiers(unitId: string): MoraleModifiers {
    const state = this.moraleStates.get(unitId);
    
    if (!state) {
      return MORALE_MODIFIERS[MoraleState.NORMAL];
    }
    
    return MORALE_MODIFIERS[state.moraleState];
  }
  
  // ============================================================
  // Battle Event Handlers
  // ============================================================
  
  /**
   * 전투 이벤트 처리 - 적 격파
   */
  onEnemyKill(unitId: string, killedCount: number = 1): void {
    const bonus = MORALE_CHANGE_VALUES[MoraleChangeReason.ENEMY_KILL] * killedCount;
    this.changeMorale(unitId, MoraleChangeReason.ENEMY_KILL, bonus);
  }
  
  /**
   * 전투 이벤트 처리 - 피해 입음
   */
  onDamageTaken(unitId: string, damagePercentage: number): void {
    // 피해 비율에 따라 사기 감소
    const penalty = MORALE_CHANGE_VALUES[MoraleChangeReason.DAMAGE_TAKEN] * (damagePercentage / 10);
    this.changeMorale(unitId, MoraleChangeReason.DAMAGE_TAKEN, Math.floor(penalty));
  }
  
  /**
   * 전투 이벤트 처리 - 아군 전멸
   */
  onAllyDestroyed(unitIds: string[]): void {
    for (const unitId of unitIds) {
      this.changeMorale(unitId, MoraleChangeReason.ALLY_DESTROYED);
    }
  }
  
  /**
   * 전투 이벤트 처리 - 지휘관 전사
   */
  onCommanderKilled(unitIds: string[]): void {
    for (const unitId of unitIds) {
      this.changeMorale(unitId, MoraleChangeReason.COMMANDER_KILLED);
    }
  }
  
  /**
   * 전투 이벤트 처리 - 보급선 차단
   */
  onSupplyCut(unitIds: string[]): void {
    for (const unitId of unitIds) {
      this.changeMorale(unitId, MoraleChangeReason.SUPPLY_CUT);
    }
  }
  
  /**
   * 전투 이벤트 처리 - 전투 승리
   */
  onVictory(unitIds: string[]): void {
    for (const unitId of unitIds) {
      this.changeMorale(unitId, MoraleChangeReason.VICTORY);
    }
  }
  
  /**
   * 전투 이벤트 처리 - 전투 패배
   */
  onDefeat(unitIds: string[]): void {
    for (const unitId of unitIds) {
      this.changeMorale(unitId, MoraleChangeReason.DEFEAT);
    }
  }
  
  // ============================================================
  // Queries
  // ============================================================
  
  /**
   * 사기 상태 조회
   */
  getMoraleState(unitId: string): UnitMoraleState | undefined {
    return this.moraleStates.get(unitId);
  }
  
  /**
   * 현재 사기 값 조회
   */
  getCurrentMorale(unitId: string): number {
    return this.moraleStates.get(unitId)?.currentMorale ?? 0;
  }
  
  /**
   * 사기 레벨 조회
   */
  getMoraleLevel(unitId: string): MoraleState {
    return this.moraleStates.get(unitId)?.moraleState ?? MoraleState.NORMAL;
  }
  
  /**
   * 전체 유닛 사기 통계
   */
  getMoraleStats(unitIds?: string[]): {
    average: number;
    critical: number;
    low: number;
    normal: number;
    good: number;
    excellent: number;
  } {
    const targets = unitIds 
      ? unitIds.map(id => this.moraleStates.get(id)).filter(Boolean) as UnitMoraleState[]
      : Array.from(this.moraleStates.values());
    
    if (targets.length === 0) {
      return { average: 0, critical: 0, low: 0, normal: 0, good: 0, excellent: 0 };
    }
    
    let total = 0;
    let critical = 0, low = 0, normal = 0, good = 0, excellent = 0;
    
    for (const state of targets) {
      total += state.currentMorale;
      switch (state.moraleState) {
        case MoraleState.CRITICAL: critical++; break;
        case MoraleState.LOW: low++; break;
        case MoraleState.NORMAL: normal++; break;
        case MoraleState.GOOD: good++; break;
        case MoraleState.EXCELLENT: excellent++; break;
      }
    }
    
    return {
      average: Math.round(total / targets.length),
      critical,
      low,
      normal,
      good,
      excellent,
    };
  }
  
  // ============================================================
  // Utility
  // ============================================================
  
  /**
   * 사기 값에서 상태 계산
   */
  private calculateMoraleState(morale: number): MoraleState {
    if (morale >= MORALE_THRESHOLDS[MoraleState.EXCELLENT].min) {
      return MoraleState.EXCELLENT;
    } else if (morale >= MORALE_THRESHOLDS[MoraleState.GOOD].min) {
      return MoraleState.GOOD;
    } else if (morale >= MORALE_THRESHOLDS[MoraleState.NORMAL].min) {
      return MoraleState.NORMAL;
    } else if (morale >= MORALE_THRESHOLDS[MoraleState.LOW].min) {
      return MoraleState.LOW;
    } else {
      return MoraleState.CRITICAL;
    }
  }
  
  /**
   * 유닛 사기 상태 제거
   */
  removeMoraleState(unitId: string): void {
    this.moraleStates.delete(unitId);
    logger.debug('[MoraleService] Morale state removed', { unitId });
  }
  
  /**
   * 세션 정리
   */
  clearSession(sessionId: string): void {
    // sessionId 기반 정리가 필요하면 구현
    // 현재는 전체 정리
    this.moraleStates.clear();
    this.globalModifiers.delete(sessionId);
    logger.info('[MoraleService] Session cleared', { sessionId });
  }
  
  /**
   * 전체 정리
   */
  cleanup(): void {
    this.moraleStates.clear();
    this.globalModifiers.clear();
    this.removeAllListeners();
    logger.info('[MoraleService] Cleaned up');
  }
}

// 싱글톤 인스턴스
export const moraleService = new MoraleService();





