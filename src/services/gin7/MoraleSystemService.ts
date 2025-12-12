/**
 * MoraleSystemService - 사기 시스템 서비스
 * 
 * 유닛의 사기(Morale)를 관리합니다.
 * - MoraleState: FANATIC(95+), EXCELLENT(80-94), GOOD(60-79), 
 *                NORMAL(40-59), LOW(20-39), CRITICAL(1-19), BROKEN(0)
 * - 사기 조회, 사기 변동, 사기 붕괴 체크, 사기 회복
 */

import { EventEmitter } from 'events';
import { logger } from '../../common/logger';

// ============================================================
// Morale Types & Constants
// ============================================================

/**
 * 사기 상태 레벨
 */
export enum MoraleStateLevel {
  FANATIC = 'FANATIC',     // 95+ : 광신/맹렬, 최강 보너스
  EXCELLENT = 'EXCELLENT', // 80-94 : 우수, 강력한 보너스
  GOOD = 'GOOD',           // 60-79 : 양호, 경미한 보너스
  NORMAL = 'NORMAL',       // 40-59 : 보통, 보정 없음
  LOW = 'LOW',             // 20-39 : 저하, 페널티 시작
  CRITICAL = 'CRITICAL',   // 1-19 : 위기, 심각한 페널티
  BROKEN = 'BROKEN',       // 0 : 붕괴, 전투 불능
}

/**
 * 사기 임계값 정의
 */
export const MORALE_STATE_THRESHOLDS: Record<MoraleStateLevel, { min: number; max: number }> = {
  [MoraleStateLevel.FANATIC]: { min: 95, max: 100 },
  [MoraleStateLevel.EXCELLENT]: { min: 80, max: 94 },
  [MoraleStateLevel.GOOD]: { min: 60, max: 79 },
  [MoraleStateLevel.NORMAL]: { min: 40, max: 59 },
  [MoraleStateLevel.LOW]: { min: 20, max: 39 },
  [MoraleStateLevel.CRITICAL]: { min: 1, max: 19 },
  [MoraleStateLevel.BROKEN]: { min: 0, max: 0 },
};

/**
 * 사기 상태별 효과
 */
export interface MoraleStateEffect {
  attackMod: number;         // 공격력 배율
  defenseMod: number;        // 방어력 배율
  accuracyMod: number;       // 명중률 배율
  evasionMod: number;        // 회피율 배율
  criticalMod: number;       // 치명타 확률 배율
  retreatChance: number;     // 명령 거부/탈영 확률 (0-1)
  recoveryRate: number;      // 자연 회복률 배율
  rallyCpCost: number;       // 사기 진작 CP 비용
  canAttack: boolean;        // 공격 가능 여부
  canMove: boolean;          // 이동 가능 여부
  description: string;       // 상태 설명
}

/**
 * 사기 상태별 효과 정의
 */
export const MORALE_STATE_EFFECTS: Record<MoraleStateLevel, MoraleStateEffect> = {
  [MoraleStateLevel.FANATIC]: {
    attackMod: 1.4,
    defenseMod: 1.2,
    accuracyMod: 1.2,
    evasionMod: 1.15,
    criticalMod: 1.5,
    retreatChance: 0,
    recoveryRate: 0.5,  // 광신 상태는 자연 감소
    rallyCpCost: 0,
    canAttack: true,
    canMove: true,
    description: '광신/맹렬 상태! 공격력 40% 증가, 치명타 50% 증가',
  },
  [MoraleStateLevel.EXCELLENT]: {
    attackMod: 1.2,
    defenseMod: 1.15,
    accuracyMod: 1.1,
    evasionMod: 1.1,
    criticalMod: 1.2,
    retreatChance: 0,
    recoveryRate: 0.8,
    rallyCpCost: 0,
    canAttack: true,
    canMove: true,
    description: '사기 충천! 전투력 15-20% 증가',
  },
  [MoraleStateLevel.GOOD]: {
    attackMod: 1.1,
    defenseMod: 1.05,
    accuracyMod: 1.05,
    evasionMod: 1.05,
    criticalMod: 1.1,
    retreatChance: 0,
    recoveryRate: 1.0,
    rallyCpCost: 0,
    canAttack: true,
    canMove: true,
    description: '양호한 상태. 경미한 보너스',
  },
  [MoraleStateLevel.NORMAL]: {
    attackMod: 1.0,
    defenseMod: 1.0,
    accuracyMod: 1.0,
    evasionMod: 1.0,
    criticalMod: 1.0,
    retreatChance: 0,
    recoveryRate: 1.0,
    rallyCpCost: 10,
    canAttack: true,
    canMove: true,
    description: '보통 상태. 보정 없음',
  },
  [MoraleStateLevel.LOW]: {
    attackMod: 0.85,
    defenseMod: 0.9,
    accuracyMod: 0.9,
    evasionMod: 0.85,
    criticalMod: 0.8,
    retreatChance: 0.1,  // 10% 명령 거부
    recoveryRate: 1.2,
    rallyCpCost: 25,
    canAttack: true,
    canMove: true,
    description: '사기 저하. 전투력 10-15% 감소',
  },
  [MoraleStateLevel.CRITICAL]: {
    attackMod: 0.6,
    defenseMod: 0.7,
    accuracyMod: 0.7,
    evasionMod: 0.6,
    criticalMod: 0.5,
    retreatChance: 0.3,  // 30% 탈영/도주
    recoveryRate: 1.5,
    rallyCpCost: 50,
    canAttack: true,
    canMove: true,
    description: '위기 상태! 전투력 30-40% 감소, 탈영 위험',
  },
  [MoraleStateLevel.BROKEN]: {
    attackMod: 0.0,
    defenseMod: 0.3,
    accuracyMod: 0.0,
    evasionMod: 0.4,
    criticalMod: 0.0,
    retreatChance: 1.0,  // 100% 도주
    recoveryRate: 2.0,
    rallyCpCost: 100,
    canAttack: false,
    canMove: true,  // 도주만 가능
    description: '사기 붕괴! 전투 불능, 도주만 가능',
  },
};

/**
 * 사기 변화 원인
 */
export enum MoraleChangeSource {
  // 증가 요인
  VICTORY = 'VICTORY',                    // 전투 승리
  ENEMY_DESTROYED = 'ENEMY_DESTROYED',    // 적 격파
  COMMANDER_INSPIRE = 'COMMANDER_INSPIRE', // 지휘관 고무
  SUPPLY_RESTORED = 'SUPPLY_RESTORED',    // 보급 복구
  RALLY_COMMAND = 'RALLY_COMMAND',        // 사기 진작 명령
  REST = 'REST',                          // 휴식
  REINFORCEMENT = 'REINFORCEMENT',        // 지원군 도착
  HEROIC_ACT = 'HEROIC_ACT',              // 영웅적 행동
  NATURAL_RECOVERY = 'NATURAL_RECOVERY',  // 자연 회복
  
  // 감소 요인
  DEFEAT = 'DEFEAT',                      // 전투 패배
  HEAVY_DAMAGE = 'HEAVY_DAMAGE',          // 큰 피해
  ALLY_DESTROYED = 'ALLY_DESTROYED',      // 아군 전멸
  COMMANDER_KILLED = 'COMMANDER_KILLED',  // 지휘관 전사
  SUPPLY_CUT = 'SUPPLY_CUT',              // 보급선 차단
  SURROUNDED = 'SURROUNDED',              // 포위됨
  ALLY_ROUTED = 'ALLY_ROUTED',            // 아군 패주
  FATIGUE = 'FATIGUE',                    // 장시간 전투
  AMBUSH = 'AMBUSH',                      // 기습 당함
  FLAGSHIP_LOST = 'FLAGSHIP_LOST',        // 기함 상실
}

/**
 * 사기 변화량 기본값
 */
export const MORALE_CHANGE_AMOUNTS: Record<MoraleChangeSource, number> = {
  // 증가 (+)
  [MoraleChangeSource.VICTORY]: 15,
  [MoraleChangeSource.ENEMY_DESTROYED]: 3,
  [MoraleChangeSource.COMMANDER_INSPIRE]: 8,
  [MoraleChangeSource.SUPPLY_RESTORED]: 5,
  [MoraleChangeSource.RALLY_COMMAND]: 12,
  [MoraleChangeSource.REST]: 5,
  [MoraleChangeSource.REINFORCEMENT]: 10,
  [MoraleChangeSource.HEROIC_ACT]: 20,
  [MoraleChangeSource.NATURAL_RECOVERY]: 1,
  
  // 감소 (-)
  [MoraleChangeSource.DEFEAT]: -20,
  [MoraleChangeSource.HEAVY_DAMAGE]: -8,
  [MoraleChangeSource.ALLY_DESTROYED]: -10,
  [MoraleChangeSource.COMMANDER_KILLED]: -30,
  [MoraleChangeSource.SUPPLY_CUT]: -12,
  [MoraleChangeSource.SURROUNDED]: -15,
  [MoraleChangeSource.ALLY_ROUTED]: -10,
  [MoraleChangeSource.FATIGUE]: -3,
  [MoraleChangeSource.AMBUSH]: -15,
  [MoraleChangeSource.FLAGSHIP_LOST]: -25,
};

/**
 * 사기 붕괴 조건
 */
export interface MoraleBreakCondition {
  type: MoraleBreakType;
  threshold: number;
  description: string;
}

/**
 * 사기 붕괴 원인 유형
 */
export enum MoraleBreakType {
  MORALE_ZERO = 'MORALE_ZERO',               // 사기 0 도달
  COMMANDER_KILLED = 'COMMANDER_KILLED',      // 지휘관 전사
  HEAVY_CASUALTIES = 'HEAVY_CASUALTIES',      // 대량 사상 (50%+)
  FLAGSHIP_DESTROYED = 'FLAGSHIP_DESTROYED',  // 기함 격침
  SURROUNDED = 'SURROUNDED',                  // 완전 포위
  CHAIN_ROUT = 'CHAIN_ROUT',                  // 연쇄 패주 (주변 50%+ 패주)
}

/**
 * 유닛 사기 데이터
 */
export interface UnitMoraleData {
  unitId: string;
  currentMorale: number;       // 0-100
  maxMorale: number;           // 기본 100, 특성으로 변동
  moraleState: MoraleStateLevel;
  
  // 회복 관련
  recoveryRate: number;        // 틱당 자연 회복량
  lastRecoveryTick: number;
  
  // 면역/저항
  immunityTicks: number;       // 사기 저하 면역 남은 틱
  moraleResistance: number;    // 사기 저항력 (0-1)
  
  // 붕괴 상태
  isBroken: boolean;
  breakReason?: MoraleBreakType;
  breakRecoveryProgress: number; // 붕괴 회복 진행도 (0-1)
  
  // 기록
  lastChangeSource?: MoraleChangeSource;
  lastChangeAmount?: number;
  history: MoraleHistoryItem[];
}

/**
 * 사기 변화 기록
 */
export interface MoraleHistoryItem {
  tick: number;
  source: MoraleChangeSource;
  change: number;
  moraleBefore: number;
  moraleAfter: number;
}

/**
 * 사기 변화 이벤트
 */
export interface MoraleChangeEventData {
  unitId: string;
  previousMorale: number;
  newMorale: number;
  previousState: MoraleStateLevel;
  newState: MoraleStateLevel;
  source: MoraleChangeSource;
  timestamp: number;
}

/**
 * 사기 붕괴 이벤트
 */
export interface MoraleBreakEventData {
  unitId: string;
  breakType: MoraleBreakType;
  finalMorale: number;
  timestamp: number;
}

// ============================================================
// MoraleSystemService Class
// ============================================================

export class MoraleSystemService extends EventEmitter {
  // 유닛별 사기 데이터
  private moraleData: Map<string, UnitMoraleData> = new Map();
  
  // 자연 회복 간격 (틱)
  private readonly RECOVERY_INTERVAL = 60;
  
  // 히스토리 최대 크기
  private readonly MAX_HISTORY = 50;
  
  constructor() {
    super();
    logger.info('[MoraleSystemService] Initialized');
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
      moraleResistance?: number;
    }
  ): UnitMoraleData {
    const startMorale = options?.startMorale ?? 70;
    const maxMorale = options?.maxMorale ?? 100;
    
    const data: UnitMoraleData = {
      unitId,
      currentMorale: Math.min(startMorale, maxMorale),
      maxMorale,
      moraleState: this.calculateMoraleState(startMorale),
      recoveryRate: options?.recoveryRate ?? 2,
      lastRecoveryTick: 0,
      immunityTicks: 0,
      moraleResistance: options?.moraleResistance ?? 0,
      isBroken: false,
      breakRecoveryProgress: 0,
      history: [],
    };
    
    this.moraleData.set(unitId, data);
    
    logger.debug('[MoraleSystemService] Morale initialized', {
      unitId,
      morale: data.currentMorale,
      state: data.moraleState,
    });
    
    return data;
  }
  
  /**
   * 배치 초기화
   */
  initializeMoraleBatch(
    units: Array<{
      unitId: string;
      startMorale?: number;
      maxMorale?: number;
      moraleResistance?: number;
    }>
  ): void {
    for (const unit of units) {
      this.initializeMorale(unit.unitId, unit);
    }
    logger.info('[MoraleSystemService] Batch initialized', { count: units.length });
  }
  
  // ============================================================
  // Morale Access
  // ============================================================
  
  /**
   * 사기 조회
   */
  getMorale(unitId: string): {
    current: number;
    max: number;
    state: MoraleStateLevel;
    effect: MoraleStateEffect;
    isBroken: boolean;
  } | null {
    const data = this.moraleData.get(unitId);
    if (!data) return null;
    
    return {
      current: data.currentMorale,
      max: data.maxMorale,
      state: data.moraleState,
      effect: MORALE_STATE_EFFECTS[data.moraleState],
      isBroken: data.isBroken,
    };
  }
  
  /**
   * 현재 사기값만 조회
   */
  getCurrentMorale(unitId: string): number {
    return this.moraleData.get(unitId)?.currentMorale ?? 0;
  }
  
  /**
   * 사기 상태 조회
   */
  getMoraleState(unitId: string): MoraleStateLevel {
    return this.moraleData.get(unitId)?.moraleState ?? MoraleStateLevel.NORMAL;
  }
  
  /**
   * 사기 효과 조회
   */
  getMoraleEffect(unitId: string): MoraleStateEffect {
    const data = this.moraleData.get(unitId);
    if (!data) return MORALE_STATE_EFFECTS[MoraleStateLevel.NORMAL];
    return MORALE_STATE_EFFECTS[data.moraleState];
  }
  
  // ============================================================
  // Morale Modification
  // ============================================================
  
  /**
   * 사기 변동 적용
   */
  applyMoraleChange(
    unitId: string,
    source: MoraleChangeSource,
    customAmount?: number
  ): {
    success: boolean;
    previousMorale: number;
    newMorale: number;
    stateChanged: boolean;
    broke?: boolean;
  } {
    const data = this.moraleData.get(unitId);
    
    if (!data) {
      return { success: false, previousMorale: 0, newMorale: 0, stateChanged: false };
    }
    
    // 붕괴 상태면 회복만 가능
    if (data.isBroken && MORALE_CHANGE_AMOUNTS[source] < 0) {
      return {
        success: false,
        previousMorale: data.currentMorale,
        newMorale: data.currentMorale,
        stateChanged: false,
      };
    }
    
    // 면역 상태 확인 (감소일 경우만)
    const changeAmount = customAmount ?? MORALE_CHANGE_AMOUNTS[source];
    if (changeAmount < 0 && data.immunityTicks > 0) {
      return {
        success: false,
        previousMorale: data.currentMorale,
        newMorale: data.currentMorale,
        stateChanged: false,
      };
    }
    
    // 저항력 적용 (감소일 경우만)
    let finalAmount = changeAmount;
    if (changeAmount < 0) {
      finalAmount = changeAmount * (1 - data.moraleResistance);
    }
    
    const previousMorale = data.currentMorale;
    const previousState = data.moraleState;
    
    // 사기 변경 적용
    data.currentMorale = Math.max(0, Math.min(data.maxMorale, data.currentMorale + finalAmount));
    data.moraleState = this.calculateMoraleState(data.currentMorale);
    data.lastChangeSource = source;
    data.lastChangeAmount = finalAmount;
    
    // 히스토리 기록
    data.history.push({
      tick: Date.now(),
      source,
      change: finalAmount,
      moraleBefore: previousMorale,
      moraleAfter: data.currentMorale,
    });
    
    if (data.history.length > this.MAX_HISTORY) {
      data.history.shift();
    }
    
    const stateChanged = previousState !== data.moraleState;
    
    // 상태 변경 이벤트
    if (stateChanged) {
      this.emit('MORALE_STATE_CHANGED', {
        unitId,
        previousMorale,
        newMorale: data.currentMorale,
        previousState,
        newState: data.moraleState,
        source,
        timestamp: Date.now(),
      } as MoraleChangeEventData);
      
      logger.info('[MoraleSystemService] Morale state changed', {
        unitId,
        from: previousState,
        to: data.moraleState,
        morale: data.currentMorale,
      });
    }
    
    // 붕괴 체크
    let broke = false;
    if (data.currentMorale === 0 && !data.isBroken) {
      this.triggerMoraleBreak(unitId, MoraleBreakType.MORALE_ZERO);
      broke = true;
    }
    
    return {
      success: true,
      previousMorale,
      newMorale: data.currentMorale,
      stateChanged,
      broke,
    };
  }
  
  /**
   * 직접 사기 설정
   */
  setMorale(unitId: string, morale: number): boolean {
    const data = this.moraleData.get(unitId);
    if (!data) return false;
    
    const previousState = data.moraleState;
    data.currentMorale = Math.max(0, Math.min(data.maxMorale, morale));
    data.moraleState = this.calculateMoraleState(data.currentMorale);
    
    if (data.currentMorale > 0 && data.isBroken) {
      data.isBroken = false;
      data.breakReason = undefined;
    }
    
    return true;
  }
  
  // ============================================================
  // Morale Break
  // ============================================================
  
  /**
   * 사기 붕괴 체크
   */
  checkMoraleBreak(
    unitId: string,
    conditions: {
      hpLost?: number;           // 손실 HP 비율 (0-1)
      commanderKilled?: boolean;
      flagshipDestroyed?: boolean;
      isSurrounded?: boolean;
      routedAlliesRatio?: number; // 주변 패주 아군 비율 (0-1)
    }
  ): {
    willBreak: boolean;
    breakType?: MoraleBreakType;
    breakChance?: number;
  } {
    const data = this.moraleData.get(unitId);
    if (!data || data.isBroken) {
      return { willBreak: false };
    }
    
    // 사기 0 체크
    if (data.currentMorale === 0) {
      return { willBreak: true, breakType: MoraleBreakType.MORALE_ZERO, breakChance: 1 };
    }
    
    // 지휘관 전사
    if (conditions.commanderKilled) {
      // 위기 상태에서 지휘관 전사 시 높은 확률로 붕괴
      if (data.moraleState === MoraleStateLevel.CRITICAL) {
        return { willBreak: true, breakType: MoraleBreakType.COMMANDER_KILLED, breakChance: 0.8 };
      }
      if (data.moraleState === MoraleStateLevel.LOW) {
        const chance = 0.4;
        return { willBreak: Math.random() < chance, breakType: MoraleBreakType.COMMANDER_KILLED, breakChance: chance };
      }
    }
    
    // 대량 사상
    if (conditions.hpLost && conditions.hpLost >= 0.5) {
      const baseChance = (conditions.hpLost - 0.5) * 2; // 50%에서 0%, 100%에서 100%
      const stateMultiplier = data.moraleState === MoraleStateLevel.CRITICAL ? 2 : 1;
      const chance = Math.min(0.9, baseChance * stateMultiplier);
      return { willBreak: Math.random() < chance, breakType: MoraleBreakType.HEAVY_CASUALTIES, breakChance: chance };
    }
    
    // 기함 격침
    if (conditions.flagshipDestroyed) {
      if (data.moraleState === MoraleStateLevel.CRITICAL || data.moraleState === MoraleStateLevel.LOW) {
        return { willBreak: true, breakType: MoraleBreakType.FLAGSHIP_DESTROYED, breakChance: 0.9 };
      }
    }
    
    // 완전 포위
    if (conditions.isSurrounded && data.moraleState === MoraleStateLevel.CRITICAL) {
      return { willBreak: true, breakType: MoraleBreakType.SURROUNDED, breakChance: 0.7 };
    }
    
    // 연쇄 패주
    if (conditions.routedAlliesRatio && conditions.routedAlliesRatio >= 0.5) {
      const chance = conditions.routedAlliesRatio * 0.6;
      return { willBreak: Math.random() < chance, breakType: MoraleBreakType.CHAIN_ROUT, breakChance: chance };
    }
    
    return { willBreak: false };
  }
  
  /**
   * 사기 붕괴 발생
   */
  triggerMoraleBreak(unitId: string, breakType: MoraleBreakType): boolean {
    const data = this.moraleData.get(unitId);
    if (!data || data.isBroken) return false;
    
    data.isBroken = true;
    data.breakReason = breakType;
    data.currentMorale = 0;
    data.moraleState = MoraleStateLevel.BROKEN;
    data.breakRecoveryProgress = 0;
    
    this.emit('MORALE_BROKEN', {
      unitId,
      breakType,
      finalMorale: 0,
      timestamp: Date.now(),
    } as MoraleBreakEventData);
    
    logger.warn('[MoraleSystemService] Unit morale broken!', {
      unitId,
      breakType,
    });
    
    return true;
  }
  
  // ============================================================
  // Recovery
  // ============================================================
  
  /**
   * 사기 회복 (Rally 명령)
   */
  recoverMorale(
    unitId: string,
    cpAvailable: number,
    commanderCharisma: number = 50
  ): {
    success: boolean;
    cpCost: number;
    moraleGain: number;
    message: string;
  } {
    const data = this.moraleData.get(unitId);
    
    if (!data) {
      return { success: false, cpCost: 0, moraleGain: 0, message: '유닛을 찾을 수 없습니다.' };
    }
    
    // 붕괴 상태 회복
    if (data.isBroken) {
      const breakRecoveryCp = 100;
      if (cpAvailable < breakRecoveryCp) {
        return { success: false, cpCost: breakRecoveryCp, moraleGain: 0, message: `CP가 부족합니다. (필요: ${breakRecoveryCp})` };
      }
      
      // 붕괴 회복은 점진적
      data.breakRecoveryProgress += 0.25 + (commanderCharisma / 200); // 카리스마에 따라 회복 속도 증가
      
      if (data.breakRecoveryProgress >= 1) {
        data.isBroken = false;
        data.breakReason = undefined;
        data.currentMorale = 20; // 위기 상태로 회복
        data.moraleState = MoraleStateLevel.CRITICAL;
        data.breakRecoveryProgress = 0;
        data.immunityTicks = 60; // 회복 후 면역
        
        return { success: true, cpCost: breakRecoveryCp, moraleGain: 20, message: '사기 붕괴에서 회복되었습니다!' };
      }
      
      return { success: true, cpCost: breakRecoveryCp, moraleGain: 0, message: `붕괴 회복 중... (${Math.floor(data.breakRecoveryProgress * 100)}%)` };
    }
    
    // 일반 사기 회복
    const effect = MORALE_STATE_EFFECTS[data.moraleState];
    const cpCost = effect.rallyCpCost;
    
    if (cpAvailable < cpCost) {
      return { success: false, cpCost, moraleGain: 0, message: `CP가 부족합니다. (필요: ${cpCost})` };
    }
    
    // 카리스마에 따른 회복량 보정
    const charismaMod = 1 + (commanderCharisma - 50) / 100;
    const baseMoraleGain = MORALE_CHANGE_AMOUNTS[MoraleChangeSource.RALLY_COMMAND];
    const moraleGain = Math.floor(baseMoraleGain * charismaMod);
    
    this.applyMoraleChange(unitId, MoraleChangeSource.RALLY_COMMAND, moraleGain);
    
    // 회복 후 면역 부여
    data.immunityTicks = 30;
    
    return { success: true, cpCost, moraleGain, message: `사기가 ${moraleGain} 회복되었습니다.` };
  }
  
  /**
   * 자연 회복 처리
   */
  processNaturalRecovery(unitId: string, currentTick: number): void {
    const data = this.moraleData.get(unitId);
    if (!data) return;
    
    const ticksSinceRecovery = currentTick - data.lastRecoveryTick;
    if (ticksSinceRecovery < this.RECOVERY_INTERVAL) return;
    
    // 광신 상태는 자연 감소
    if (data.moraleState === MoraleStateLevel.FANATIC) {
      const decay = Math.floor(data.recoveryRate * 0.5);
      if (decay > 0) {
        this.applyMoraleChange(unitId, MoraleChangeSource.NATURAL_RECOVERY, -decay);
      }
    }
    // 붕괴/위기 상태가 아니면 자연 회복
    else if (!data.isBroken && data.moraleState !== MoraleStateLevel.CRITICAL) {
      const effect = MORALE_STATE_EFFECTS[data.moraleState];
      const recovery = Math.floor(data.recoveryRate * effect.recoveryRate);
      
      if (recovery > 0 && data.currentMorale < data.maxMorale) {
        this.applyMoraleChange(unitId, MoraleChangeSource.NATURAL_RECOVERY, recovery);
      }
    }
    
    data.lastRecoveryTick = currentTick;
  }
  
  // ============================================================
  // Tick Update
  // ============================================================
  
  /**
   * 틱 업데이트
   */
  updateTick(currentTick: number): void {
    for (const [unitId, data] of this.moraleData) {
      // 면역 틱 감소
      if (data.immunityTicks > 0) {
        data.immunityTicks--;
      }
      
      // 자연 회복 처리
      this.processNaturalRecovery(unitId, currentTick);
    }
  }
  
  // ============================================================
  // Utility
  // ============================================================
  
  /**
   * 사기 값에서 상태 계산
   */
  private calculateMoraleState(morale: number): MoraleStateLevel {
    if (morale >= 95) return MoraleStateLevel.FANATIC;
    if (morale >= 80) return MoraleStateLevel.EXCELLENT;
    if (morale >= 60) return MoraleStateLevel.GOOD;
    if (morale >= 40) return MoraleStateLevel.NORMAL;
    if (morale >= 20) return MoraleStateLevel.LOW;
    if (morale >= 1) return MoraleStateLevel.CRITICAL;
    return MoraleStateLevel.BROKEN;
  }
  
  /**
   * 사기 상태 이름 조회
   */
  getMoraleStateName(state: MoraleStateLevel): string {
    const names: Record<MoraleStateLevel, string> = {
      [MoraleStateLevel.FANATIC]: '광신/맹렬',
      [MoraleStateLevel.EXCELLENT]: '사기 충천',
      [MoraleStateLevel.GOOD]: '양호',
      [MoraleStateLevel.NORMAL]: '보통',
      [MoraleStateLevel.LOW]: '저하',
      [MoraleStateLevel.CRITICAL]: '위기',
      [MoraleStateLevel.BROKEN]: '붕괴',
    };
    return names[state];
  }
  
  /**
   * 유닛 사기 데이터 제거
   */
  removeMoraleData(unitId: string): void {
    this.moraleData.delete(unitId);
  }
  
  /**
   * 세션 정리
   */
  clearSession(): void {
    this.moraleData.clear();
    logger.info('[MoraleSystemService] Session cleared');
  }
  
  /**
   * 전체 정리
   */
  cleanup(): void {
    this.clearSession();
    this.removeAllListeners();
    logger.info('[MoraleSystemService] Cleaned up');
  }
}

// 싱글톤 인스턴스
export const moraleSystemService = new MoraleSystemService();








