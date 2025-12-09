/**
 * FormationService - 진형 시스템 서비스
 * 
 * 함대/유닛의 전투 진형을 관리합니다.
 * - FormationType: COLUMN(종대), LINE(횡대), WEDGE(쐐기), CRANE_WING(학익), 
 *                  FISH_SCALE(어린), HOLLOW_SQUARE(방진), SCATTERED(산개)
 * - 진형 설정, 진형별 스탯 수정, 진형 전환 시간
 */

import { EventEmitter } from 'events';
import { logger } from '../../common/logger';

// ============================================================
// Formation Types & Constants
// ============================================================

/**
 * 진형 타입
 */
export enum FormationType {
  COLUMN = 'COLUMN',              // 종대 - 이동/돌파 특화
  LINE = 'LINE',                  // 횡대 - 화력 집중 특화
  WEDGE = 'WEDGE',                // 쐐기 - 돌격 특화
  CRANE_WING = 'CRANE_WING',      // 학익진 - 포위 특화
  FISH_SCALE = 'FISH_SCALE',      // 어린진 - 방어 특화
  HOLLOW_SQUARE = 'HOLLOW_SQUARE', // 방진(方陣) - 전방위 방어
  SCATTERED = 'SCATTERED',        // 산개 - 피해 분산
}

/**
 * 진형별 스탯 수정치
 */
export interface FormationStats {
  attackMod: number;         // 공격력 배율
  defenseMod: number;        // 방어력 배율
  accuracyMod: number;       // 명중률 배율
  evasionMod: number;        // 회피율 배율
  speedMod: number;          // 이동속도 배율
  flankDefense: number;      // 측면 방어율
  rearDefense: number;       // 후방 방어율
  chargePower: number;       // 돌격 위력
  chargeResist: number;      // 돌격 저항
  detectionRange: number;    // 감지 범위 배율
  transitionTime: number;    // 진형 전환 소요 시간 (틱)
  minUnits: number;          // 최소 유닛 수
  optimalUnits: number;      // 최적 유닛 수
}

/**
 * 진형별 기본 스탯
 */
export const FORMATION_STATS: Record<FormationType, FormationStats> = {
  [FormationType.COLUMN]: {
    attackMod: 0.9,
    defenseMod: 0.85,
    accuracyMod: 0.85,
    evasionMod: 1.0,
    speedMod: 1.4,
    flankDefense: 0.6,
    rearDefense: 0.5,
    chargePower: 1.3,
    chargeResist: 0.7,
    detectionRange: 1.1,
    transitionTime: 10,
    minUnits: 3,
    optimalUnits: 10,
  },
  [FormationType.LINE]: {
    attackMod: 1.2,
    defenseMod: 1.0,
    accuracyMod: 1.3,
    evasionMod: 0.9,
    speedMod: 0.9,
    flankDefense: 0.7,
    rearDefense: 0.6,
    chargePower: 0.8,
    chargeResist: 1.2,
    detectionRange: 1.3,
    transitionTime: 15,
    minUnits: 5,
    optimalUnits: 15,
  },
  [FormationType.WEDGE]: {
    attackMod: 1.3,
    defenseMod: 0.9,
    accuracyMod: 1.0,
    evasionMod: 0.85,
    speedMod: 1.1,
    flankDefense: 0.75,
    rearDefense: 0.7,
    chargePower: 1.5,
    chargeResist: 0.8,
    detectionRange: 1.0,
    transitionTime: 20,
    minUnits: 5,
    optimalUnits: 12,
  },
  [FormationType.CRANE_WING]: {
    attackMod: 1.15,
    defenseMod: 0.95,
    accuracyMod: 1.2,
    evasionMod: 0.95,
    speedMod: 0.85,
    flankDefense: 1.1,
    rearDefense: 0.8,
    chargePower: 0.7,
    chargeResist: 1.0,
    detectionRange: 1.4,
    transitionTime: 25,
    minUnits: 7,
    optimalUnits: 20,
  },
  [FormationType.FISH_SCALE]: {
    attackMod: 1.0,
    defenseMod: 1.3,
    accuracyMod: 1.0,
    evasionMod: 0.95,
    speedMod: 0.8,
    flankDefense: 1.2,
    rearDefense: 1.1,
    chargePower: 0.6,
    chargeResist: 1.4,
    detectionRange: 1.0,
    transitionTime: 20,
    minUnits: 6,
    optimalUnits: 15,
  },
  [FormationType.HOLLOW_SQUARE]: {
    attackMod: 0.85,
    defenseMod: 1.5,
    accuracyMod: 0.9,
    evasionMod: 0.8,
    speedMod: 0.5,
    flankDefense: 1.4,
    rearDefense: 1.4,
    chargePower: 0.4,
    chargeResist: 1.6,
    detectionRange: 1.2,
    transitionTime: 30,
    minUnits: 8,
    optimalUnits: 16,
  },
  [FormationType.SCATTERED]: {
    attackMod: 0.8,
    defenseMod: 0.7,
    accuracyMod: 1.1,
    evasionMod: 1.3,
    speedMod: 1.2,
    flankDefense: 1.0,
    rearDefense: 1.0,
    chargePower: 0.5,
    chargeResist: 0.5,
    detectionRange: 1.5,
    transitionTime: 8,
    minUnits: 2,
    optimalUnits: 10,
  },
};

/**
 * 진형 상성 관계 (공격자 진형 vs 방어자 진형 -> 보너스)
 */
export const FORMATION_COUNTER: Partial<Record<FormationType, Partial<Record<FormationType, number>>>> = {
  [FormationType.WEDGE]: {
    [FormationType.LINE]: 1.2,      // 쐐기가 횡대에 효과적
    [FormationType.COLUMN]: 1.1,
  },
  [FormationType.CRANE_WING]: {
    [FormationType.WEDGE]: 1.2,     // 학익이 쐐기 포위
    [FormationType.COLUMN]: 1.15,
  },
  [FormationType.LINE]: {
    [FormationType.CRANE_WING]: 1.1, // 횡대 화력이 넓은 학익에 효과
    [FormationType.SCATTERED]: 1.15,
  },
  [FormationType.HOLLOW_SQUARE]: {
    [FormationType.WEDGE]: 1.3,     // 방진이 돌격 방어
    [FormationType.CRANE_WING]: 1.1,
  },
  [FormationType.SCATTERED]: {
    [FormationType.HOLLOW_SQUARE]: 1.2, // 산개가 밀집진에 효과
    [FormationType.FISH_SCALE]: 1.1,
  },
};

/**
 * 진형 상태
 */
export interface UnitFormationState {
  unitId: string;
  currentFormation: FormationType;
  targetFormation?: FormationType;
  transitionProgress: number;        // 0-1 (전환 진행도)
  transitionStartTick: number;
  transitionTotalTicks: number;
  lastChangeTime: number;            // 마지막 변경 시간
  formationEfficiency: number;       // 진형 효율 (유닛 수 기반)
}

/**
 * 진형 변경 이벤트
 */
export interface UnitFormationChangeEvent {
  unitId: string;
  previousFormation: FormationType;
  newFormation: FormationType;
  timestamp: number;
}

/**
 * 진형 전환 시작 이벤트
 */
export interface FormationTransitionStartEvent {
  unitId: string;
  fromFormation: FormationType;
  toFormation: FormationType;
  estimatedTicks: number;
  timestamp: number;
}

// ============================================================
// FormationService Class
// ============================================================

export class FormationService extends EventEmitter {
  // 유닛별 진형 상태
  private formationStates: Map<string, UnitFormationState> = new Map();
  
  // 유닛 수 캐시
  private unitCounts: Map<string, number> = new Map();
  
  constructor() {
    super();
    logger.info('[FormationService] Initialized');
  }
  
  // ============================================================
  // Initialization
  // ============================================================
  
  /**
   * 유닛 진형 초기화
   */
  initializeFormation(
    unitId: string,
    options?: {
      initialFormation?: FormationType;
      unitCount?: number;
    }
  ): UnitFormationState {
    const formation = options?.initialFormation ?? FormationType.LINE;
    const unitCount = options?.unitCount ?? 10;
    
    const state: UnitFormationState = {
      unitId,
      currentFormation: formation,
      transitionProgress: 1,  // 완료 상태
      transitionStartTick: 0,
      transitionTotalTicks: 0,
      lastChangeTime: Date.now(),
      formationEfficiency: this.calculateEfficiency(formation, unitCount),
    };
    
    this.formationStates.set(unitId, state);
    this.unitCounts.set(unitId, unitCount);
    
    logger.debug('[FormationService] Formation initialized', {
      unitId,
      formation,
      efficiency: state.formationEfficiency,
    });
    
    return state;
  }
  
  /**
   * 배치 초기화
   */
  initializeFormationBatch(
    units: Array<{
      unitId: string;
      initialFormation?: FormationType;
      unitCount?: number;
    }>
  ): void {
    for (const unit of units) {
      this.initializeFormation(unit.unitId, {
        initialFormation: unit.initialFormation,
        unitCount: unit.unitCount,
      });
    }
    logger.info('[FormationService] Batch initialized', { count: units.length });
  }
  
  // ============================================================
  // Formation Management
  // ============================================================
  
  /**
   * 진형 설정 (즉시 또는 전환 시작)
   */
  setFormation(
    unitId: string,
    targetFormation: FormationType,
    options?: {
      immediate?: boolean;        // 즉시 변경 (전환 시간 무시)
      urgentMultiplier?: number;  // 긴급 전환 (시간 단축, 효율 감소)
    }
  ): {
    success: boolean;
    message: string;
    estimatedTicks?: number;
  } {
    const state = this.formationStates.get(unitId);
    
    if (!state) {
      return { success: false, message: '유닛을 찾을 수 없습니다.' };
    }
    
    // 이미 같은 진형이면 스킵
    if (state.currentFormation === targetFormation && state.transitionProgress >= 1) {
      return { success: false, message: '이미 해당 진형입니다.' };
    }
    
    // 전환 중이면 새 전환으로 대체
    if (state.transitionProgress < 1) {
      logger.debug('[FormationService] Cancelling ongoing transition', { unitId });
    }
    
    // 유닛 수 검증
    const unitCount = this.unitCounts.get(unitId) ?? 10;
    const targetStats = FORMATION_STATS[targetFormation];
    
    if (unitCount < targetStats.minUnits) {
      return {
        success: false,
        message: `유닛 수가 부족합니다. (최소 ${targetStats.minUnits}명 필요)`,
      };
    }
    
    // 즉시 변경
    if (options?.immediate) {
      const previousFormation = state.currentFormation;
      state.currentFormation = targetFormation;
      state.targetFormation = undefined;
      state.transitionProgress = 1;
      state.lastChangeTime = Date.now();
      state.formationEfficiency = this.calculateEfficiency(targetFormation, unitCount);
      
      this.emit('FORMATION_CHANGED', {
        unitId,
        previousFormation,
        newFormation: targetFormation,
        timestamp: Date.now(),
      } as UnitFormationChangeEvent);
      
      return {
        success: true,
        message: `진형이 ${this.getFormationName(targetFormation)}으로 변경되었습니다.`,
        estimatedTicks: 0,
      };
    }
    
    // 전환 시간 계산
    const baseTime = targetStats.transitionTime;
    const urgentMult = options?.urgentMultiplier ?? 1.0;
    const estimatedTicks = Math.ceil(baseTime * urgentMult);
    
    // 전환 시작
    state.targetFormation = targetFormation;
    state.transitionProgress = 0;
    state.transitionStartTick = Date.now();
    state.transitionTotalTicks = estimatedTicks;
    
    this.emit('FORMATION_TRANSITION_START', {
      unitId,
      fromFormation: state.currentFormation,
      toFormation: targetFormation,
      estimatedTicks,
      timestamp: Date.now(),
    } as FormationTransitionStartEvent);
    
    logger.info('[FormationService] Formation transition started', {
      unitId,
      from: state.currentFormation,
      to: targetFormation,
      estimatedTicks,
    });
    
    return {
      success: true,
      message: `${this.getFormationName(state.currentFormation)} → ${this.getFormationName(targetFormation)} 전환 시작`,
      estimatedTicks,
    };
  }
  
  /**
   * 진형 전환 시작 (setFormation alias)
   */
  startTransition(
    unitId: string,
    targetFormation: FormationType,
    urgent: boolean = false
  ): {
    success: boolean;
    message: string;
    estimatedTicks?: number;
  } {
    return this.setFormation(unitId, targetFormation, {
      immediate: false,
      urgentMultiplier: urgent ? 0.6 : 1.0,
    });
  }
  
  /**
   * 진형별 스탯 수정치 조회
   */
  getFormationStats(unitId: string): FormationStats & { efficiency: number } {
    const state = this.formationStates.get(unitId);
    
    if (!state) {
      return {
        ...FORMATION_STATS[FormationType.LINE],
        efficiency: 1.0,
      };
    }
    
    const baseStats = FORMATION_STATS[state.currentFormation];
    
    // 전환 중이면 스탯 감소
    if (state.transitionProgress < 1) {
      const transitionPenalty = 0.3; // 전환 중 30% 감소
      const factor = 1 - (transitionPenalty * (1 - state.transitionProgress));
      
      return {
        ...baseStats,
        attackMod: baseStats.attackMod * factor,
        defenseMod: baseStats.defenseMod * factor,
        accuracyMod: baseStats.accuracyMod * factor,
        evasionMod: baseStats.evasionMod * factor,
        speedMod: baseStats.speedMod * 0.5, // 전환 중 속도 대폭 감소
        efficiency: state.formationEfficiency * factor,
      };
    }
    
    return {
      ...baseStats,
      efficiency: state.formationEfficiency,
    };
  }
  
  /**
   * 상성 보너스 계산
   */
  getCounterBonus(
    attackerUnitId: string,
    defenderUnitId: string
  ): number {
    const attackerState = this.formationStates.get(attackerUnitId);
    const defenderState = this.formationStates.get(defenderUnitId);
    
    if (!attackerState || !defenderState) return 1.0;
    
    const counterMap = FORMATION_COUNTER[attackerState.currentFormation];
    if (!counterMap) return 1.0;
    
    return counterMap[defenderState.currentFormation] ?? 1.0;
  }
  
  // ============================================================
  // Tick Update
  // ============================================================
  
  /**
   * 틱 업데이트 (전환 진행)
   */
  updateTick(): void {
    for (const [unitId, state] of this.formationStates) {
      if (state.transitionProgress >= 1 || !state.targetFormation) continue;
      
      // 진행도 업데이트
      state.transitionProgress = Math.min(
        1,
        state.transitionProgress + (1 / state.transitionTotalTicks)
      );
      
      // 전환 완료
      if (state.transitionProgress >= 1) {
        const previousFormation = state.currentFormation;
        state.currentFormation = state.targetFormation;
        state.targetFormation = undefined;
        state.lastChangeTime = Date.now();
        
        // 효율 재계산
        const unitCount = this.unitCounts.get(unitId) ?? 10;
        state.formationEfficiency = this.calculateEfficiency(state.currentFormation, unitCount);
        
        this.emit('FORMATION_CHANGED', {
          unitId,
          previousFormation,
          newFormation: state.currentFormation,
          timestamp: Date.now(),
        } as UnitFormationChangeEvent);
        
        logger.info('[FormationService] Formation transition completed', {
          unitId,
          from: previousFormation,
          to: state.currentFormation,
        });
      }
    }
  }
  
  // ============================================================
  // Queries
  // ============================================================
  
  /**
   * 현재 진형 조회
   */
  getCurrentFormation(unitId: string): FormationType | undefined {
    return this.formationStates.get(unitId)?.currentFormation;
  }
  
  /**
   * 진형 상태 조회
   */
  getFormationState(unitId: string): UnitFormationState | undefined {
    return this.formationStates.get(unitId);
  }
  
  /**
   * 전환 중인지 확인
   */
  isTransitioning(unitId: string): boolean {
    const state = this.formationStates.get(unitId);
    return state ? state.transitionProgress < 1 : false;
  }
  
  /**
   * 전환 진행률 조회
   */
  getTransitionProgress(unitId: string): number {
    return this.formationStates.get(unitId)?.transitionProgress ?? 1;
  }
  
  /**
   * 유닛 수 업데이트
   */
  updateUnitCount(unitId: string, count: number): void {
    this.unitCounts.set(unitId, count);
    
    const state = this.formationStates.get(unitId);
    if (state) {
      state.formationEfficiency = this.calculateEfficiency(state.currentFormation, count);
    }
  }
  
  // ============================================================
  // Utility
  // ============================================================
  
  /**
   * 진형 효율 계산
   */
  private calculateEfficiency(formation: FormationType, unitCount: number): number {
    const stats = FORMATION_STATS[formation];
    
    if (unitCount < stats.minUnits) {
      return 0.5; // 최소 인원 미달
    }
    
    if (unitCount >= stats.optimalUnits) {
      return 1.0; // 최적 인원 이상
    }
    
    // 최소와 최적 사이 선형 보간
    const range = stats.optimalUnits - stats.minUnits;
    const current = unitCount - stats.minUnits;
    return 0.5 + (0.5 * (current / range));
  }
  
  /**
   * 진형 이름 조회
   */
  getFormationName(formation: FormationType): string {
    const names: Record<FormationType, string> = {
      [FormationType.COLUMN]: '종대(縱隊)',
      [FormationType.LINE]: '횡대(橫隊)',
      [FormationType.WEDGE]: '쐐기진(楔形陣)',
      [FormationType.CRANE_WING]: '학익진(鶴翼陣)',
      [FormationType.FISH_SCALE]: '어린진(魚鱗陣)',
      [FormationType.HOLLOW_SQUARE]: '방진(方陣)',
      [FormationType.SCATTERED]: '산개(散開)',
    };
    return names[formation];
  }
  
  /**
   * 진형 설명 조회
   */
  getFormationDescription(formation: FormationType): string {
    const descriptions: Record<FormationType, string> = {
      [FormationType.COLUMN]: '이동 및 돌파에 유리한 세로 진형. 측면 방어 취약.',
      [FormationType.LINE]: '화력 집중에 유리한 가로 진형. 기동력 저하.',
      [FormationType.WEDGE]: '적진 돌파에 특화된 뾰족한 진형. 돌격 시 위력 증가.',
      [FormationType.CRANE_WING]: '적을 포위하기 좋은 V자 진형. 넓은 시야 확보.',
      [FormationType.FISH_SCALE]: '방어에 특화된 비늘 형태 진형. 돌격 저항 우수.',
      [FormationType.HOLLOW_SQUARE]: '전방위 방어가 가능한 사각 진형. 기동성 최악.',
      [FormationType.SCATTERED]: '피해 분산을 위한 산개 대형. 회피율 증가.',
    };
    return descriptions[formation];
  }
  
  /**
   * 유닛 진형 상태 제거
   */
  removeFormationState(unitId: string): void {
    this.formationStates.delete(unitId);
    this.unitCounts.delete(unitId);
  }
  
  /**
   * 세션 정리
   */
  clearSession(): void {
    this.formationStates.clear();
    this.unitCounts.clear();
    logger.info('[FormationService] Session cleared');
  }
  
  /**
   * 전체 정리
   */
  cleanup(): void {
    this.clearSession();
    this.removeAllListeners();
    logger.info('[FormationService] Cleaned up');
  }
}

// 싱글톤 인스턴스
export const formationService = new FormationService();






