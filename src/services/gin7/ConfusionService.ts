/**
 * ConfusionService - 혼란 시스템 서비스
 * 
 * 유닛의 혼란(Confusion) 상태를 관리합니다.
 * - 혼란 상태 (Normal/Confused/Routed)
 * - 혼란 발생 조건 (급격한 손실, 지휘관 전사)
 * - 혼란 전파 (인접 유닛)
 * - 혼란 회복
 */

import { EventEmitter } from 'events';
import {
  ConfusionLevel,
  ConfusionEffects,
  ConfusionTrigger,
  UnitConfusionState,
  ConfusionChangeEvent,
  ConfusionSpreadEvent,
  CONFUSION_EFFECTS,
  CONFUSION_TRIGGER_LEVELS,
  CONFUSION_CONSTANTS,
  MoraleState,
} from '../../types/gin7/morale.types';
import { Vector3 } from '../../types/gin7/tactical.types';
import { logger } from '../../common/logger';

// ============================================================
// ConfusionService Class
// ============================================================

export class ConfusionService extends EventEmitter {
  // 유닛별 혼란 상태 관리
  private confusionStates: Map<string, UnitConfusionState> = new Map();
  
  // 유닛 위치 캐시 (전파 계산용)
  private unitPositions: Map<string, Vector3> = new Map();
  
  // 유닛 세력 캐시 (아군 판별용)
  private unitFactions: Map<string, string> = new Map();
  
  constructor() {
    super();
    logger.info('[ConfusionService] Initialized');
  }
  
  // ============================================================
  // State Management
  // ============================================================
  
  /**
   * 유닛 혼란 상태 초기화
   */
  initializeConfusion(
    unitId: string,
    factionId: string,
    position?: Vector3
  ): UnitConfusionState {
    const state: UnitConfusionState = {
      unitId,
      level: ConfusionLevel.NONE,
      startTick: 0,
      remainingTicks: 0,
      recoveryProgress: 0,
      recoveryRate: CONFUSION_CONSTANTS.RECOVERY_PER_TICK,
      spreadImmunityTicks: 0,
    };
    
    this.confusionStates.set(unitId, state);
    this.unitFactions.set(unitId, factionId);
    
    if (position) {
      this.unitPositions.set(unitId, position);
    }
    
    return state;
  }
  
  /**
   * 유닛 위치 업데이트
   */
  updateUnitPosition(unitId: string, position: Vector3): void {
    this.unitPositions.set(unitId, position);
  }
  
  /**
   * 배치 초기화
   */
  initializeConfusionBatch(
    units: Array<{ unitId: string; factionId: string; position?: Vector3 }>
  ): void {
    for (const unit of units) {
      this.initializeConfusion(unit.unitId, unit.factionId, unit.position);
    }
    logger.info('[ConfusionService] Batch initialized', { count: units.length });
  }
  
  // ============================================================
  // Confusion Triggers
  // ============================================================
  
  /**
   * 혼란 트리거 발생
   */
  triggerConfusion(
    unitId: string,
    trigger: ConfusionTrigger,
    currentTick: number
  ): { success: boolean; newLevel: ConfusionLevel } {
    const state = this.confusionStates.get(unitId);
    
    if (!state) {
      return { success: false, newLevel: ConfusionLevel.NONE };
    }
    
    // 전파 면역 체크 (전파로 인한 혼란이면)
    if (trigger === ConfusionTrigger.ALLY_ROUTED && state.spreadImmunityTicks > 0) {
      return { success: false, newLevel: state.level };
    }
    
    const targetLevel = CONFUSION_TRIGGER_LEVELS[trigger];
    
    // 더 심각한 혼란으로만 전환
    if (this.getLevelSeverity(targetLevel) <= this.getLevelSeverity(state.level)) {
      return { success: false, newLevel: state.level };
    }
    
    const previousLevel = state.level;
    
    // 혼란 상태 설정
    state.level = targetLevel;
    state.trigger = trigger;
    state.startTick = currentTick;
    state.remainingTicks = CONFUSION_EFFECTS[targetLevel].duration;
    state.recoveryProgress = 0;
    
    // 이벤트 발생
    const event: ConfusionChangeEvent = {
      unitId,
      previousLevel,
      newLevel: targetLevel,
      trigger,
      timestamp: Date.now(),
    };
    this.emit('CONFUSION_CHANGED', event);
    
    logger.info('[ConfusionService] Confusion triggered', {
      unitId,
      trigger,
      level: targetLevel,
    });
    
    // 패주 상태면 추가 이벤트
    if (targetLevel === ConfusionLevel.ROUTED) {
      this.emit('UNIT_ROUTED', { unitId, trigger });
    }
    
    return { success: true, newLevel: targetLevel };
  }
  
  /**
   * 급격한 손실로 인한 혼란 체크
   */
  checkHeavyCasualties(
    unitId: string,
    previousStrength: number,
    currentStrength: number,
    currentTick: number
  ): boolean {
    const lossPercentage = (previousStrength - currentStrength) / previousStrength;
    
    if (lossPercentage >= CONFUSION_CONSTANTS.HEAVY_CASUALTY_THRESHOLD) {
      this.triggerConfusion(unitId, ConfusionTrigger.HEAVY_CASUALTIES, currentTick);
      return true;
    }
    
    return false;
  }
  
  /**
   * 사기 상태에 따른 혼란 체크
   */
  checkMoraleConfusion(
    unitId: string,
    moraleState: MoraleState,
    currentTick: number
  ): boolean {
    if (moraleState === MoraleState.CRITICAL) {
      const result = this.triggerConfusion(
        unitId,
        ConfusionTrigger.CRITICAL_MORALE,
        currentTick
      );
      return result.success;
    }
    return false;
  }
  
  // ============================================================
  // Confusion Spread
  // ============================================================
  
  /**
   * 혼란 전파 처리 (매 틱 호출)
   */
  processConfusionSpread(currentTick: number): ConfusionSpreadEvent[] {
    const spreadEvents: ConfusionSpreadEvent[] = [];
    
    // 전파 체크 간격
    if (currentTick % CONFUSION_CONSTANTS.SPREAD_CHECK_INTERVAL !== 0) {
      return spreadEvents;
    }
    
    // 패주/심각한 혼란 상태의 유닛 찾기
    const confusedUnits: Array<{ unitId: string; factionId: string; position: Vector3; level: ConfusionLevel }> = [];
    
    for (const [unitId, state] of this.confusionStates) {
      if (state.level === ConfusionLevel.MAJOR || state.level === ConfusionLevel.ROUTED) {
        const position = this.unitPositions.get(unitId);
        const factionId = this.unitFactions.get(unitId);
        
        if (position && factionId) {
          confusedUnits.push({ unitId, factionId, position, level: state.level });
        }
      }
    }
    
    // 각 혼란 유닛에서 인접 아군에게 전파
    for (const confused of confusedUnits) {
      const spreadChance = CONFUSION_EFFECTS[confused.level].spreadChance;
      
      // 범위 내 아군 찾기
      for (const [targetId, targetState] of this.confusionStates) {
        if (targetId === confused.unitId) continue;
        if (targetState.spreadImmunityTicks > 0) continue;
        if (targetState.level !== ConfusionLevel.NONE) continue;
        
        const targetFaction = this.unitFactions.get(targetId);
        if (targetFaction !== confused.factionId) continue;
        
        const targetPosition = this.unitPositions.get(targetId);
        if (!targetPosition) continue;
        
        // 거리 계산
        const distance = this.calculateDistance(confused.position, targetPosition);
        if (distance > CONFUSION_CONSTANTS.SPREAD_RADIUS) continue;
        
        // 전파 확률 체크 (거리가 가까울수록 높음)
        const distanceFactor = 1 - (distance / CONFUSION_CONSTANTS.SPREAD_RADIUS);
        const actualChance = spreadChance * distanceFactor;
        
        if (Math.random() < actualChance) {
          // 전파 - 한 단계 낮은 혼란
          const spreadLevel = confused.level === ConfusionLevel.ROUTED 
            ? ConfusionLevel.MAJOR 
            : ConfusionLevel.MINOR;
          
          this.triggerConfusion(targetId, ConfusionTrigger.ALLY_ROUTED, currentTick);
          
          spreadEvents.push({
            sourceUnitId: confused.unitId,
            targetUnitId: targetId,
            level: spreadLevel,
            timestamp: Date.now(),
          });
          
          this.emit('CONFUSION_SPREAD', spreadEvents[spreadEvents.length - 1]);
        }
      }
    }
    
    return spreadEvents;
  }
  
  // ============================================================
  // Recovery
  // ============================================================
  
  /**
   * 틱 업데이트 (회복 처리)
   */
  updateTick(currentTick: number): void {
    for (const [unitId, state] of this.confusionStates) {
      // 면역 틱 감소
      if (state.spreadImmunityTicks > 0) {
        state.spreadImmunityTicks--;
      }
      
      // 혼란 상태가 아니면 스킵
      if (state.level === ConfusionLevel.NONE) continue;
      
      // 남은 시간 감소
      state.remainingTicks--;
      
      // 회복 진행
      state.recoveryProgress += state.recoveryRate;
      
      // 회복 완료 또는 시간 만료
      if (state.recoveryProgress >= 1 || state.remainingTicks <= 0) {
        this.recover(unitId, currentTick);
      }
    }
    
    // 전파 처리
    this.processConfusionSpread(currentTick);
  }
  
  /**
   * 혼란 회복
   */
  recover(unitId: string, currentTick: number): boolean {
    const state = this.confusionStates.get(unitId);
    if (!state || state.level === ConfusionLevel.NONE) {
      return false;
    }
    
    const previousLevel = state.level;
    
    // 한 단계 회복 또는 완전 회복
    if (previousLevel === ConfusionLevel.MINOR) {
      state.level = ConfusionLevel.NONE;
    } else if (previousLevel === ConfusionLevel.MAJOR) {
      state.level = ConfusionLevel.MINOR;
      state.remainingTicks = CONFUSION_EFFECTS[ConfusionLevel.MINOR].duration;
    } else if (previousLevel === ConfusionLevel.ROUTED) {
      state.level = ConfusionLevel.MAJOR;
      state.remainingTicks = CONFUSION_EFFECTS[ConfusionLevel.MAJOR].duration;
    }
    
    state.recoveryProgress = 0;
    
    // 완전 회복 시 면역 부여
    if (state.level === ConfusionLevel.NONE) {
      state.spreadImmunityTicks = CONFUSION_CONSTANTS.IMMUNITY_AFTER_RECOVERY;
      state.trigger = undefined;
    }
    
    // 이벤트 발생
    const event: ConfusionChangeEvent = {
      unitId,
      previousLevel,
      newLevel: state.level,
      timestamp: Date.now(),
    };
    this.emit('CONFUSION_RECOVERED', event);
    
    logger.info('[ConfusionService] Confusion recovered', {
      unitId,
      from: previousLevel,
      to: state.level,
    });
    
    return true;
  }
  
  /**
   * 강제 회복 (명령/아이템)
   */
  forceRecover(unitId: string): boolean {
    const state = this.confusionStates.get(unitId);
    if (!state) return false;
    
    const previousLevel = state.level;
    
    state.level = ConfusionLevel.NONE;
    state.remainingTicks = 0;
    state.recoveryProgress = 0;
    state.spreadImmunityTicks = CONFUSION_CONSTANTS.IMMUNITY_AFTER_RECOVERY;
    state.trigger = undefined;
    
    if (previousLevel !== ConfusionLevel.NONE) {
      this.emit('CONFUSION_RECOVERED', {
        unitId,
        previousLevel,
        newLevel: ConfusionLevel.NONE,
        timestamp: Date.now(),
      } as ConfusionChangeEvent);
    }
    
    return true;
  }
  
  // ============================================================
  // Combat Effects
  // ============================================================
  
  /**
   * 명령 무시 체크
   */
  checkCommandIgnored(unitId: string): boolean {
    const state = this.confusionStates.get(unitId);
    if (!state || state.level === ConfusionLevel.NONE) {
      return false;
    }
    
    const effects = CONFUSION_EFFECTS[state.level];
    return Math.random() < effects.commandIgnoreChance;
  }
  
  /**
   * 명령 지연 틱 조회
   */
  getCommandDelay(unitId: string): number {
    const state = this.confusionStates.get(unitId);
    if (!state) return 0;
    
    return CONFUSION_EFFECTS[state.level].commandDelay;
  }
  
  /**
   * 전투 보정 계수 조회
   */
  getCombatModifiers(unitId: string): {
    attackMod: number;
    defenseMod: number;
    speedMod: number;
  } {
    const state = this.confusionStates.get(unitId);
    
    if (!state || state.level === ConfusionLevel.NONE) {
      return { attackMod: 1, defenseMod: 1, speedMod: 1 };
    }
    
    const effects = CONFUSION_EFFECTS[state.level];
    return {
      attackMod: effects.attackMod,
      defenseMod: effects.defenseMod,
      speedMod: effects.speedMod,
    };
  }
  
  /**
   * 패주 상태인지 확인
   */
  isRouted(unitId: string): boolean {
    const state = this.confusionStates.get(unitId);
    return state?.level === ConfusionLevel.ROUTED;
  }
  
  /**
   * 혼란 상태인지 확인
   */
  isConfused(unitId: string): boolean {
    const state = this.confusionStates.get(unitId);
    return state?.level !== ConfusionLevel.NONE && state?.level !== undefined;
  }
  
  // ============================================================
  // Queries
  // ============================================================
  
  /**
   * 혼란 상태 조회
   */
  getConfusionState(unitId: string): UnitConfusionState | undefined {
    return this.confusionStates.get(unitId);
  }
  
  /**
   * 혼란 레벨 조회
   */
  getConfusionLevel(unitId: string): ConfusionLevel {
    return this.confusionStates.get(unitId)?.level ?? ConfusionLevel.NONE;
  }
  
  /**
   * 혼란 효과 조회
   */
  getConfusionEffects(unitId: string): ConfusionEffects {
    const state = this.confusionStates.get(unitId);
    if (!state) return CONFUSION_EFFECTS[ConfusionLevel.NONE];
    return CONFUSION_EFFECTS[state.level];
  }
  
  /**
   * 세력별 혼란 통계
   */
  getConfusionStats(factionId: string): {
    total: number;
    none: number;
    minor: number;
    major: number;
    routed: number;
  } {
    let total = 0, none = 0, minor = 0, major = 0, routed = 0;
    
    for (const [unitId, state] of this.confusionStates) {
      const unitFaction = this.unitFactions.get(unitId);
      if (unitFaction !== factionId) continue;
      
      total++;
      switch (state.level) {
        case ConfusionLevel.NONE: none++; break;
        case ConfusionLevel.MINOR: minor++; break;
        case ConfusionLevel.MAJOR: major++; break;
        case ConfusionLevel.ROUTED: routed++; break;
      }
    }
    
    return { total, none, minor, major, routed };
  }
  
  // ============================================================
  // Utility
  // ============================================================
  
  /**
   * 혼란 심각도 수준 반환
   */
  private getLevelSeverity(level: ConfusionLevel): number {
    switch (level) {
      case ConfusionLevel.NONE: return 0;
      case ConfusionLevel.MINOR: return 1;
      case ConfusionLevel.MAJOR: return 2;
      case ConfusionLevel.ROUTED: return 3;
      default: return 0;
    }
  }
  
  /**
   * 거리 계산
   */
  private calculateDistance(a: Vector3, b: Vector3): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  
  /**
   * 유닛 상태 제거
   */
  removeConfusionState(unitId: string): void {
    this.confusionStates.delete(unitId);
    this.unitPositions.delete(unitId);
    this.unitFactions.delete(unitId);
  }
  
  /**
   * 세션 정리
   */
  clearSession(): void {
    this.confusionStates.clear();
    this.unitPositions.clear();
    this.unitFactions.clear();
    logger.info('[ConfusionService] Session cleared');
  }
  
  /**
   * 전체 정리
   */
  cleanup(): void {
    this.clearSession();
    this.removeAllListeners();
    logger.info('[ConfusionService] Cleaned up');
  }
}

// 싱글톤 인스턴스
export const confusionService = new ConfusionService();





