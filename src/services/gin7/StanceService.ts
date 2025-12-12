/**
 * StanceService - 태세 시스템 서비스
 * 
 * 유닛의 전투 태세를 관리합니다.
 * - StanceType: ATTACK, DEFENSE, CHARGE, RETREAT, PURSUIT, STANDBY
 * - 태세 설정, 태세 효과, 자동 태세 조정
 */

import { EventEmitter } from 'events';
import { logger } from '../../common/logger';

// ============================================================
// Stance Types & Constants
// ============================================================

/**
 * 태세 타입
 */
export enum StanceType {
  ATTACK = 'ATTACK',     // 공격 태세 - 공격력 증가, 방어력 감소
  DEFENSE = 'DEFENSE',   // 방어 태세 - 방어력 증가, 공격력 감소
  CHARGE = 'CHARGE',     // 돌격 태세 - 근접 특화, 피해 무시
  RETREAT = 'RETREAT',   // 후퇴 태세 - 이탈 특화, 전투력 대폭 감소
  PURSUIT = 'PURSUIT',   // 추격 태세 - 도주 적 추적 특화
  STANDBY = 'STANDBY',   // 대기 태세 - 회피/회복 특화
}

/**
 * 태세별 효과
 */
export interface StanceEffect {
  damageMod: number;        // 데미지 배율
  defenseMod: number;       // 방어력 배율
  accuracyMod: number;      // 명중률 배율
  evasionMod: number;       // 회피율 배율
  speedMod: number;         // 이동속도 배율
  moraleRecovery: number;   // 사기 회복 배율
  criticalMod: number;      // 치명타 확률 배율
  cpCostMod: number;        // CP 소모 배율
  changeTime: number;       // 태세 변경 소요 시간 (틱)
  description: string;      // 태세 설명
}

/**
 * 태세별 효과 정의
 */
export const STANCE_EFFECTS: Record<StanceType, StanceEffect> = {
  [StanceType.ATTACK]: {
    damageMod: 1.3,
    defenseMod: 0.8,
    accuracyMod: 1.1,
    evasionMod: 0.9,
    speedMod: 1.1,
    moraleRecovery: 0.8,
    criticalMod: 1.2,
    cpCostMod: 1.0,
    changeTime: 10,
    description: '공격력 30% 증가, 방어력 20% 감소',
  },
  [StanceType.DEFENSE]: {
    damageMod: 0.8,
    defenseMod: 1.4,
    accuracyMod: 1.0,
    evasionMod: 1.1,
    speedMod: 0.7,
    moraleRecovery: 1.2,
    criticalMod: 0.8,
    cpCostMod: 0.8,
    changeTime: 8,
    description: '방어력 40% 증가, 공격력 20% 감소',
  },
  [StanceType.CHARGE]: {
    damageMod: 1.5,
    defenseMod: 0.6,
    accuracyMod: 0.9,
    evasionMod: 0.7,
    speedMod: 1.4,
    moraleRecovery: 0.5,
    criticalMod: 1.5,
    cpCostMod: 1.3,
    changeTime: 15,
    description: '공격력 50% 증가, 방어력 40% 감소, 치명타 확률 증가',
  },
  [StanceType.RETREAT]: {
    damageMod: 0.4,
    defenseMod: 0.9,
    accuracyMod: 0.6,
    evasionMod: 1.4,
    speedMod: 1.5,
    moraleRecovery: 0.3,
    criticalMod: 0.5,
    cpCostMod: 0.5,
    changeTime: 5,
    description: '이동속도 50% 증가, 전투력 대폭 감소',
  },
  [StanceType.PURSUIT]: {
    damageMod: 1.1,
    defenseMod: 0.85,
    accuracyMod: 0.85,
    evasionMod: 0.9,
    speedMod: 1.3,
    moraleRecovery: 0.7,
    criticalMod: 1.1,
    cpCostMod: 1.1,
    changeTime: 8,
    description: '이동속도 30% 증가, 도주 적 추적 특화',
  },
  [StanceType.STANDBY]: {
    damageMod: 0.9,
    defenseMod: 1.2,
    accuracyMod: 1.15,
    evasionMod: 1.2,
    speedMod: 0.0,
    moraleRecovery: 1.5,
    criticalMod: 0.9,
    cpCostMod: 0.7,
    changeTime: 5,
    description: '이동 불가, 회피/사기 회복 증가',
  },
};

/**
 * 자동 태세 조정 조건
 */
export interface AutoStanceCondition {
  triggerType: AutoStanceTrigger;
  threshold: number;
  targetStance: StanceType;
  priority: number;  // 높을수록 우선
}

/**
 * 자동 태세 조정 트리거
 */
export enum AutoStanceTrigger {
  HP_LOW = 'HP_LOW',               // HP가 일정 비율 이하
  HP_CRITICAL = 'HP_CRITICAL',     // HP가 위험 수준
  ENEMY_RETREATING = 'ENEMY_RETREATING', // 적이 후퇴 중
  ENEMY_CHARGING = 'ENEMY_CHARGING',     // 적이 돌격 중
  SURROUNDED = 'SURROUNDED',       // 포위됨
  MORALE_LOW = 'MORALE_LOW',       // 사기 저하
  VICTORY_IMMINENT = 'VICTORY_IMMINENT', // 승리 임박
  AMBUSH_DETECTED = 'AMBUSH_DETECTED',   // 기습 감지
}

/**
 * 기본 자동 태세 조정 규칙
 */
export const DEFAULT_AUTO_STANCE_RULES: AutoStanceCondition[] = [
  { triggerType: AutoStanceTrigger.HP_CRITICAL, threshold: 0.2, targetStance: StanceType.RETREAT, priority: 100 },
  { triggerType: AutoStanceTrigger.HP_LOW, threshold: 0.4, targetStance: StanceType.DEFENSE, priority: 80 },
  { triggerType: AutoStanceTrigger.MORALE_LOW, threshold: 0.3, targetStance: StanceType.DEFENSE, priority: 70 },
  { triggerType: AutoStanceTrigger.ENEMY_RETREATING, threshold: 0.5, targetStance: StanceType.PURSUIT, priority: 60 },
  { triggerType: AutoStanceTrigger.ENEMY_CHARGING, threshold: 0, targetStance: StanceType.DEFENSE, priority: 50 },
  { triggerType: AutoStanceTrigger.SURROUNDED, threshold: 0, targetStance: StanceType.DEFENSE, priority: 90 },
  { triggerType: AutoStanceTrigger.VICTORY_IMMINENT, threshold: 0.8, targetStance: StanceType.CHARGE, priority: 40 },
];

/**
 * 유닛 태세 상태
 */
export interface UnitStanceData {
  unitId: string;
  currentStance: StanceType;
  previousStance?: StanceType;
  targetStance?: StanceType;
  changeProgress: number;        // 0-1 (변경 진행도)
  changeTotalTicks: number;
  lastChangeTime: number;
  
  // 태세 유지 보너스
  holdTicks: number;             // 현재 태세 유지 시간
  holdBonus: number;             // 유지 보너스 (0-0.15)
  
  // 자동 조정 설정
  autoAdjustEnabled: boolean;
  autoAdjustRules: AutoStanceCondition[];
  lastAutoAdjustTick: number;
}

/**
 * 태세 변경 이벤트
 */
export interface StanceChangeEventData {
  unitId: string;
  previousStance: StanceType;
  newStance: StanceType;
  reason: 'MANUAL' | 'AUTO';
  timestamp: number;
}

// ============================================================
// StanceService Class
// ============================================================

export class StanceService extends EventEmitter {
  // 유닛별 태세 상태
  private stanceStates: Map<string, UnitStanceData> = new Map();
  
  // 상태 정보 캐시 (자동 조정용)
  private unitStatusCache: Map<string, {
    hpRatio: number;
    moraleRatio: number;
    isSurrounded: boolean;
    nearbyEnemyStances: StanceType[];
  }> = new Map();
  
  constructor() {
    super();
    logger.info('[StanceService] Initialized');
  }
  
  // ============================================================
  // Initialization
  // ============================================================
  
  /**
   * 유닛 태세 초기화
   */
  initializeStance(
    unitId: string,
    options?: {
      initialStance?: StanceType;
      enableAutoAdjust?: boolean;
      customRules?: AutoStanceCondition[];
    }
  ): UnitStanceData {
    const state: UnitStanceData = {
      unitId,
      currentStance: options?.initialStance ?? StanceType.DEFENSE,
      changeProgress: 1,  // 완료 상태
      changeTotalTicks: 0,
      lastChangeTime: Date.now(),
      holdTicks: 0,
      holdBonus: 0,
      autoAdjustEnabled: options?.enableAutoAdjust ?? true,
      autoAdjustRules: options?.customRules ?? [...DEFAULT_AUTO_STANCE_RULES],
      lastAutoAdjustTick: 0,
    };
    
    this.stanceStates.set(unitId, state);
    
    logger.debug('[StanceService] Stance initialized', {
      unitId,
      stance: state.currentStance,
      autoAdjust: state.autoAdjustEnabled,
    });
    
    return state;
  }
  
  /**
   * 배치 초기화
   */
  initializeStanceBatch(
    units: Array<{
      unitId: string;
      initialStance?: StanceType;
      enableAutoAdjust?: boolean;
    }>
  ): void {
    for (const unit of units) {
      this.initializeStance(unit.unitId, {
        initialStance: unit.initialStance,
        enableAutoAdjust: unit.enableAutoAdjust,
      });
    }
    logger.info('[StanceService] Batch initialized', { count: units.length });
  }
  
  // ============================================================
  // Stance Management
  // ============================================================
  
  /**
   * 태세 설정
   */
  setStance(
    unitId: string,
    targetStance: StanceType,
    options?: {
      immediate?: boolean;
      reason?: 'MANUAL' | 'AUTO';
    }
  ): {
    success: boolean;
    message: string;
    estimatedTicks?: number;
  } {
    const state = this.stanceStates.get(unitId);
    
    if (!state) {
      return { success: false, message: '유닛을 찾을 수 없습니다.' };
    }
    
    // 이미 같은 태세면 스킵
    if (state.currentStance === targetStance && state.changeProgress >= 1) {
      return { success: false, message: '이미 해당 태세입니다.' };
    }
    
    const stanceEffect = STANCE_EFFECTS[targetStance];
    const reason = options?.reason ?? 'MANUAL';
    
    // 즉시 변경
    if (options?.immediate) {
      const previousStance = state.currentStance;
      state.currentStance = targetStance;
      state.targetStance = undefined;
      state.changeProgress = 1;
      state.lastChangeTime = Date.now();
      state.holdTicks = 0;
      state.holdBonus = 0;
      
      this.emit('STANCE_CHANGED', {
        unitId,
        previousStance,
        newStance: targetStance,
        reason,
        timestamp: Date.now(),
      } as StanceChangeEventData);
      
      return {
        success: true,
        message: `태세가 ${this.getStanceName(targetStance)}으로 변경되었습니다.`,
        estimatedTicks: 0,
      };
    }
    
    // 변경 시작
    state.previousStance = state.currentStance;
    state.targetStance = targetStance;
    state.changeProgress = 0;
    state.changeTotalTicks = stanceEffect.changeTime;
    state.holdTicks = 0;
    state.holdBonus = 0;
    
    logger.info('[StanceService] Stance change started', {
      unitId,
      from: state.currentStance,
      to: targetStance,
      ticks: stanceEffect.changeTime,
      reason,
    });
    
    return {
      success: true,
      message: `${this.getStanceName(state.currentStance)} → ${this.getStanceName(targetStance)} 전환 시작`,
      estimatedTicks: stanceEffect.changeTime,
    };
  }
  
  /**
   * 태세 효과 조회
   */
  getStanceEffect(unitId: string): StanceEffect & { holdBonus: number } {
    const state = this.stanceStates.get(unitId);
    
    if (!state) {
      return {
        ...STANCE_EFFECTS[StanceType.DEFENSE],
        holdBonus: 0,
      };
    }
    
    const baseEffect = STANCE_EFFECTS[state.currentStance];
    
    // 변경 중이면 효과 감소
    if (state.changeProgress < 1) {
      const penalty = 0.2; // 변경 중 20% 감소
      const factor = 1 - (penalty * (1 - state.changeProgress));
      
      return {
        ...baseEffect,
        damageMod: baseEffect.damageMod * factor,
        defenseMod: baseEffect.defenseMod * factor,
        accuracyMod: baseEffect.accuracyMod * factor,
        evasionMod: baseEffect.evasionMod * factor,
        speedMod: baseEffect.speedMod * 0.5, // 변경 중 속도 대폭 감소
        holdBonus: 0,
      };
    }
    
    // 유지 보너스 적용
    return {
      ...baseEffect,
      damageMod: baseEffect.damageMod * (1 + state.holdBonus),
      defenseMod: baseEffect.defenseMod * (1 + state.holdBonus),
      accuracyMod: baseEffect.accuracyMod * (1 + state.holdBonus * 0.5),
      evasionMod: baseEffect.evasionMod * (1 + state.holdBonus * 0.5),
      holdBonus: state.holdBonus,
    };
  }
  
  /**
   * 자동 태세 조정
   */
  autoAdjustStance(
    unitId: string,
    status: {
      hpRatio: number;           // 0-1
      moraleRatio: number;       // 0-1
      isSurrounded: boolean;
      nearbyEnemyStances: StanceType[];
      victoryProgress?: number;  // 0-1
    }
  ): {
    adjusted: boolean;
    newStance?: StanceType;
    reason?: string;
  } {
    const state = this.stanceStates.get(unitId);
    
    if (!state || !state.autoAdjustEnabled) {
      return { adjusted: false };
    }
    
    // 변경 중이면 스킵
    if (state.changeProgress < 1) {
      return { adjusted: false };
    }
    
    // 상태 캐시 업데이트
    this.unitStatusCache.set(unitId, status);
    
    // 규칙 우선순위 정렬
    const sortedRules = [...state.autoAdjustRules].sort((a, b) => b.priority - a.priority);
    
    for (const rule of sortedRules) {
      const shouldTrigger = this.checkAutoStanceCondition(rule, status);
      
      if (shouldTrigger && rule.targetStance !== state.currentStance) {
        const result = this.setStance(unitId, rule.targetStance, { reason: 'AUTO' });
        
        if (result.success) {
          logger.info('[StanceService] Auto stance adjusted', {
            unitId,
            trigger: rule.triggerType,
            newStance: rule.targetStance,
          });
          
          return {
            adjusted: true,
            newStance: rule.targetStance,
            reason: `자동 조정: ${rule.triggerType}`,
          };
        }
      }
    }
    
    return { adjusted: false };
  }
  
  /**
   * 자동 조정 조건 확인
   */
  private checkAutoStanceCondition(
    rule: AutoStanceCondition,
    status: {
      hpRatio: number;
      moraleRatio: number;
      isSurrounded: boolean;
      nearbyEnemyStances: StanceType[];
      victoryProgress?: number;
    }
  ): boolean {
    switch (rule.triggerType) {
      case AutoStanceTrigger.HP_CRITICAL:
        return status.hpRatio <= rule.threshold;
      case AutoStanceTrigger.HP_LOW:
        return status.hpRatio <= rule.threshold;
      case AutoStanceTrigger.MORALE_LOW:
        return status.moraleRatio <= rule.threshold;
      case AutoStanceTrigger.SURROUNDED:
        return status.isSurrounded;
      case AutoStanceTrigger.ENEMY_RETREATING:
        return status.nearbyEnemyStances.filter(s => s === StanceType.RETREAT).length > 0;
      case AutoStanceTrigger.ENEMY_CHARGING:
        return status.nearbyEnemyStances.filter(s => s === StanceType.CHARGE).length > 0;
      case AutoStanceTrigger.VICTORY_IMMINENT:
        return (status.victoryProgress ?? 0) >= rule.threshold;
      default:
        return false;
    }
  }
  
  /**
   * 자동 조정 활성화/비활성화
   */
  setAutoAdjustEnabled(unitId: string, enabled: boolean): boolean {
    const state = this.stanceStates.get(unitId);
    if (!state) return false;
    
    state.autoAdjustEnabled = enabled;
    return true;
  }
  
  /**
   * 자동 조정 규칙 추가
   */
  addAutoStanceRule(unitId: string, rule: AutoStanceCondition): boolean {
    const state = this.stanceStates.get(unitId);
    if (!state) return false;
    
    state.autoAdjustRules.push(rule);
    return true;
  }
  
  /**
   * 자동 조정 규칙 제거
   */
  removeAutoStanceRule(unitId: string, triggerType: AutoStanceTrigger): boolean {
    const state = this.stanceStates.get(unitId);
    if (!state) return false;
    
    state.autoAdjustRules = state.autoAdjustRules.filter(r => r.triggerType !== triggerType);
    return true;
  }
  
  // ============================================================
  // Tick Update
  // ============================================================
  
  /**
   * 틱 업데이트
   */
  updateTick(): void {
    for (const [unitId, state] of this.stanceStates) {
      // 태세 변경 진행
      if (state.changeProgress < 1 && state.targetStance) {
        state.changeProgress = Math.min(1, state.changeProgress + (1 / state.changeTotalTicks));
        
        // 변경 완료
        if (state.changeProgress >= 1) {
          const previousStance = state.currentStance;
          state.currentStance = state.targetStance;
          state.targetStance = undefined;
          state.lastChangeTime = Date.now();
          
          this.emit('STANCE_CHANGED', {
            unitId,
            previousStance,
            newStance: state.currentStance,
            reason: 'MANUAL',
            timestamp: Date.now(),
          } as StanceChangeEventData);
          
          logger.info('[StanceService] Stance change completed', {
            unitId,
            from: previousStance,
            to: state.currentStance,
          });
        }
      }
      
      // 태세 유지 보너스 업데이트
      if (state.changeProgress >= 1) {
        state.holdTicks++;
        state.holdBonus = Math.min(0.15, state.holdTicks * 0.001); // 최대 15%
      }
    }
  }
  
  // ============================================================
  // Queries
  // ============================================================
  
  /**
   * 현재 태세 조회
   */
  getCurrentStance(unitId: string): StanceType | undefined {
    return this.stanceStates.get(unitId)?.currentStance;
  }
  
  /**
   * 태세 상태 조회
   */
  getStanceState(unitId: string): UnitStanceData | undefined {
    return this.stanceStates.get(unitId);
  }
  
  /**
   * 변경 중인지 확인
   */
  isChangingStance(unitId: string): boolean {
    const state = this.stanceStates.get(unitId);
    return state ? state.changeProgress < 1 : false;
  }
  
  /**
   * 유지 보너스 조회
   */
  getHoldBonus(unitId: string): number {
    return this.stanceStates.get(unitId)?.holdBonus ?? 0;
  }
  
  // ============================================================
  // Utility
  // ============================================================
  
  /**
   * 태세 이름 조회
   */
  getStanceName(stance: StanceType): string {
    const names: Record<StanceType, string> = {
      [StanceType.ATTACK]: '공격 태세',
      [StanceType.DEFENSE]: '방어 태세',
      [StanceType.CHARGE]: '돌격 태세',
      [StanceType.RETREAT]: '후퇴 태세',
      [StanceType.PURSUIT]: '추격 태세',
      [StanceType.STANDBY]: '대기 태세',
    };
    return names[stance];
  }
  
  /**
   * 태세 설명 조회
   */
  getStanceDescription(stance: StanceType): string {
    return STANCE_EFFECTS[stance].description;
  }
  
  /**
   * 유닛 태세 상태 제거
   */
  removeStanceState(unitId: string): void {
    this.stanceStates.delete(unitId);
    this.unitStatusCache.delete(unitId);
  }
  
  /**
   * 세션 정리
   */
  clearSession(): void {
    this.stanceStates.clear();
    this.unitStatusCache.clear();
    logger.info('[StanceService] Session cleared');
  }
  
  /**
   * 전체 정리
   */
  cleanup(): void {
    this.clearSession();
    this.removeAllListeners();
    logger.info('[StanceService] Cleaned up');
  }
}

// 싱글톤 인스턴스
export const stanceService = new StanceService();








