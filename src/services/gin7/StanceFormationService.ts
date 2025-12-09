/**
 * StanceFormationService - 태세/진형 시스템 서비스
 * 
 * 유닛의 전투 태세(Stance)와 지상전 진형(Formation)을 관리합니다.
 * - 태세 종류 (공격/방어/돌격/후퇴)
 * - 진형 종류 (종대/횡대/학익/어린)
 * - 태세 변환 시간
 * - 태세별 스탯 보정
 * 
 * 참고: 함대 진형(FleetFormationService)과 별개로 유닛 단위 태세/지상전 진형 관리
 */

import { EventEmitter } from 'events';
import {
  BattleStance,
  GroundFormationType,
  StanceModifiers,
  GroundFormationModifiers,
  UnitStanceState,
  ChangeStanceCommand,
  ChangeGroundFormationCommand,
  StanceChangeEvent,
  FormationChangeGroundEvent,
  STANCE_MODIFIERS,
  GROUND_FORMATION_MODIFIERS,
  STANCE_CONSTANTS,
} from '../../types/gin7/morale.types';
import { logger } from '../../common/logger';

// ============================================================
// StanceFormationService Class
// ============================================================

export class StanceFormationService extends EventEmitter {
  // 유닛별 태세/진형 상태
  private stanceStates: Map<string, UnitStanceState> = new Map();
  
  constructor() {
    super();
    logger.info('[StanceFormationService] Initialized');
  }
  
  // ============================================================
  // Initialization
  // ============================================================
  
  /**
   * 유닛 태세/진형 초기화
   */
  initializeStance(
    unitId: string,
    options?: {
      initialStance?: BattleStance;
      initialFormation?: GroundFormationType;
    }
  ): UnitStanceState {
    const state: UnitStanceState = {
      unitId,
      currentStance: options?.initialStance ?? BattleStance.DEFENSIVE,
      stanceChangeProgress: 1, // 완료 상태
      stanceChangeTicks: 0,
      currentFormation: options?.initialFormation,
      formationChangeProgress: 1,
      formationChangeTicks: 0,
      stanceHoldTicks: 0,
      holdBonus: 0,
    };
    
    this.stanceStates.set(unitId, state);
    
    logger.debug('[StanceFormationService] Stance initialized', {
      unitId,
      stance: state.currentStance,
      formation: state.currentFormation,
    });
    
    return state;
  }
  
  /**
   * 배치 초기화
   */
  initializeStanceBatch(
    units: Array<{
      unitId: string;
      initialStance?: BattleStance;
      initialFormation?: GroundFormationType;
    }>
  ): void {
    for (const unit of units) {
      this.initializeStance(unit.unitId, {
        initialStance: unit.initialStance,
        initialFormation: unit.initialFormation,
      });
    }
    logger.info('[StanceFormationService] Batch initialized', { count: units.length });
  }
  
  // ============================================================
  // Stance Management (태세)
  // ============================================================
  
  /**
   * 태세 변경 시작
   */
  changeStance(command: ChangeStanceCommand): {
    success: boolean;
    message: string;
    estimatedTicks: number;
  } {
    const state = this.stanceStates.get(command.unitId);
    
    if (!state) {
      return { success: false, message: '유닛을 찾을 수 없습니다.', estimatedTicks: 0 };
    }
    
    // 이미 같은 태세면 스킵
    if (state.currentStance === command.targetStance) {
      return { success: false, message: '이미 해당 태세입니다.', estimatedTicks: 0 };
    }
    
    // 변경 중이면 취소하고 새로 시작
    if (state.stanceChangeProgress < 1) {
      logger.debug('[StanceFormationService] Cancelling ongoing stance change', {
        unitId: command.unitId,
      });
    }
    
    // 변경 시간 계산
    const baseTime = STANCE_CONSTANTS.BASE_CHANGE_TIME;
    const timeMultiplier = command.priority === 'URGENT' 
      ? STANCE_CONSTANTS.URGENT_TIME_MULTIPLIER 
      : 1.0;
    const estimatedTicks = Math.ceil(baseTime * timeMultiplier);
    
    // 이전 태세 저장
    state.previousStance = state.currentStance;
    
    // 변경 시작
    state.stanceChangeProgress = 0;
    state.stanceChangeTicks = estimatedTicks;
    state.stanceHoldTicks = 0;
    state.holdBonus = 0;
    
    // 목표 태세를 임시 저장 (업데이트에서 사용)
    (state as UnitStanceState & { _targetStance?: BattleStance })._targetStance = command.targetStance;
    (state as UnitStanceState & { _isUrgent?: boolean })._isUrgent = command.priority === 'URGENT';
    
    logger.info('[StanceFormationService] Stance change started', {
      unitId: command.unitId,
      from: state.previousStance,
      to: command.targetStance,
      estimatedTicks,
    });
    
    return {
      success: true,
      message: `태세 변경 시작: ${this.getStanceName(state.previousStance)} → ${this.getStanceName(command.targetStance)}`,
      estimatedTicks,
    };
  }
  
  /**
   * 태세 변경 진행 업데이트
   */
  private updateStanceChange(unitId: string, state: UnitStanceState): void {
    if (state.stanceChangeProgress >= 1) return;
    
    const targetStance = (state as UnitStanceState & { _targetStance?: BattleStance })._targetStance;
    if (!targetStance) return;
    
    // 진행도 증가
    state.stanceChangeProgress = Math.min(1, state.stanceChangeProgress + (1 / state.stanceChangeTicks));
    
    // 완료 체크
    if (state.stanceChangeProgress >= 1) {
      const previousStance = state.currentStance;
      state.currentStance = targetStance;
      state.stanceChangeTicks = 0;
      
      // 임시 저장 제거
      delete (state as UnitStanceState & { _targetStance?: BattleStance })._targetStance;
      delete (state as UnitStanceState & { _isUrgent?: boolean })._isUrgent;
      
      // 이벤트 발생
      const event: StanceChangeEvent = {
        unitId,
        previousStance,
        newStance: state.currentStance,
        timestamp: Date.now(),
      };
      this.emit('STANCE_CHANGED', event);
      
      logger.info('[StanceFormationService] Stance change completed', {
        unitId,
        from: previousStance,
        to: state.currentStance,
      });
    }
  }
  
  /**
   * 태세 유지 보너스 업데이트
   */
  private updateHoldBonus(state: UnitStanceState): void {
    if (state.stanceChangeProgress < 1) return; // 변경 중이면 보너스 없음
    
    state.stanceHoldTicks++;
    state.holdBonus = Math.min(
      STANCE_CONSTANTS.HOLD_BONUS_MAX,
      state.stanceHoldTicks * STANCE_CONSTANTS.HOLD_BONUS_PER_TICK
    );
  }
  
  // ============================================================
  // Ground Formation Management (지상전 진형)
  // ============================================================
  
  /**
   * 지상전 진형 변경 시작
   */
  changeFormation(command: ChangeGroundFormationCommand): {
    success: boolean;
    message: string;
    estimatedTicks: number;
  } {
    const state = this.stanceStates.get(command.unitId);
    
    if (!state) {
      return { success: false, message: '유닛을 찾을 수 없습니다.', estimatedTicks: 0 };
    }
    
    // 이미 같은 진형이면 스킵
    if (state.currentFormation === command.targetFormation) {
      return { success: false, message: '이미 해당 진형입니다.', estimatedTicks: 0 };
    }
    
    // 변경 시간 계산
    const formationDef = GROUND_FORMATION_MODIFIERS[command.targetFormation];
    const baseTime = formationDef.changeTime;
    const timeMultiplier = command.priority === 'URGENT'
      ? STANCE_CONSTANTS.URGENT_TIME_MULTIPLIER
      : 1.0;
    const estimatedTicks = Math.ceil(baseTime * timeMultiplier);
    
    // 이전 진형 저장
    state.previousFormation = state.currentFormation;
    
    // 변경 시작
    state.formationChangeProgress = 0;
    state.formationChangeTicks = estimatedTicks;
    
    // 목표 진형 임시 저장
    (state as UnitStanceState & { _targetFormation?: GroundFormationType })._targetFormation = command.targetFormation;
    (state as UnitStanceState & { _formationUrgent?: boolean })._formationUrgent = command.priority === 'URGENT';
    
    logger.info('[StanceFormationService] Formation change started', {
      unitId: command.unitId,
      from: state.previousFormation,
      to: command.targetFormation,
      estimatedTicks,
    });
    
    return {
      success: true,
      message: `진형 변경 시작: ${this.getFormationName(state.previousFormation)} → ${this.getFormationName(command.targetFormation)}`,
      estimatedTicks,
    };
  }
  
  /**
   * 진형 변경 진행 업데이트
   */
  private updateFormationChange(unitId: string, state: UnitStanceState): void {
    if (state.formationChangeProgress >= 1) return;
    if (!state.formationChangeTicks) return;
    
    const targetFormation = (state as UnitStanceState & { _targetFormation?: GroundFormationType })._targetFormation;
    if (!targetFormation) return;
    
    // 진행도 증가
    state.formationChangeProgress = Math.min(1, state.formationChangeProgress + (1 / state.formationChangeTicks));
    
    // 완료 체크
    if (state.formationChangeProgress >= 1) {
      const previousFormation = state.currentFormation;
      state.currentFormation = targetFormation;
      state.formationChangeTicks = 0;
      
      // 임시 저장 제거
      delete (state as UnitStanceState & { _targetFormation?: GroundFormationType })._targetFormation;
      delete (state as UnitStanceState & { _formationUrgent?: boolean })._formationUrgent;
      
      // 이벤트 발생
      if (previousFormation) {
        const event: FormationChangeGroundEvent = {
          unitId,
          previousFormation,
          newFormation: state.currentFormation,
          timestamp: Date.now(),
        };
        this.emit('FORMATION_CHANGED', event);
      }
      
      logger.info('[StanceFormationService] Formation change completed', {
        unitId,
        from: previousFormation,
        to: state.currentFormation,
      });
    }
  }
  
  // ============================================================
  // Tick Update
  // ============================================================
  
  /**
   * 틱 업데이트
   */
  updateTick(): void {
    for (const [unitId, state] of this.stanceStates) {
      // 태세 변경 처리
      this.updateStanceChange(unitId, state);
      
      // 진형 변경 처리
      this.updateFormationChange(unitId, state);
      
      // 유지 보너스 업데이트
      this.updateHoldBonus(state);
    }
  }
  
  // ============================================================
  // Combat Modifiers
  // ============================================================
  
  /**
   * 태세 보정 계수 조회
   */
  getStanceModifiers(unitId: string): StanceModifiers {
    const state = this.stanceStates.get(unitId);
    
    if (!state) {
      return STANCE_MODIFIERS[BattleStance.DEFENSIVE];
    }
    
    const baseModifiers = STANCE_MODIFIERS[state.currentStance];
    
    // 변경 중이면 보정치 감소
    if (state.stanceChangeProgress < 1) {
      const changePenalty = (state as UnitStanceState & { _isUrgent?: boolean })._isUrgent
        ? STANCE_CONSTANTS.URGENT_PENALTY
        : STANCE_CONSTANTS.URGENT_PENALTY / 2;
      
      return {
        ...baseModifiers,
        attackMod: baseModifiers.attackMod * (1 - changePenalty),
        defenseMod: baseModifiers.defenseMod * (1 - changePenalty),
        accuracyMod: baseModifiers.accuracyMod * (1 - changePenalty),
        evasionMod: baseModifiers.evasionMod * (1 - changePenalty),
        speedMod: baseModifiers.speedMod * 0.5, // 변경 중 속도 대폭 감소
      };
    }
    
    // 유지 보너스 적용
    const holdBonus = state.holdBonus;
    return {
      ...baseModifiers,
      attackMod: baseModifiers.attackMod * (1 + holdBonus),
      defenseMod: baseModifiers.defenseMod * (1 + holdBonus),
      accuracyMod: baseModifiers.accuracyMod * (1 + holdBonus * 0.5),
      evasionMod: baseModifiers.evasionMod * (1 + holdBonus * 0.5),
    };
  }
  
  /**
   * 지상전 진형 보정 계수 조회
   */
  getFormationModifiers(unitId: string): GroundFormationModifiers | null {
    const state = this.stanceStates.get(unitId);
    
    if (!state || !state.currentFormation) {
      return null;
    }
    
    const baseModifiers = GROUND_FORMATION_MODIFIERS[state.currentFormation];
    
    // 변경 중이면 보정치 감소
    if (state.formationChangeProgress < 1) {
      const changePenalty = (state as UnitStanceState & { _formationUrgent?: boolean })._formationUrgent
        ? STANCE_CONSTANTS.URGENT_PENALTY
        : STANCE_CONSTANTS.URGENT_PENALTY / 2;
      
      return {
        ...baseModifiers,
        attackMod: baseModifiers.attackMod * (1 - changePenalty),
        defenseMod: baseModifiers.defenseMod * (1 - changePenalty),
        flankDefense: baseModifiers.flankDefense * (1 - changePenalty),
        rearDefense: baseModifiers.rearDefense * (1 - changePenalty),
        movementSpeed: baseModifiers.movementSpeed * 0.5,
      };
    }
    
    return baseModifiers;
  }
  
  /**
   * 통합 전투 보정 계수 조회
   */
  getCombinedModifiers(unitId: string): {
    attackMod: number;
    defenseMod: number;
    accuracyMod: number;
    evasionMod: number;
    speedMod: number;
  } {
    const stanceMods = this.getStanceModifiers(unitId);
    const formationMods = this.getFormationModifiers(unitId);
    
    if (formationMods) {
      return {
        attackMod: stanceMods.attackMod * formationMods.attackMod,
        defenseMod: stanceMods.defenseMod * formationMods.defenseMod,
        accuracyMod: stanceMods.accuracyMod,
        evasionMod: stanceMods.evasionMod,
        speedMod: stanceMods.speedMod * formationMods.movementSpeed,
      };
    }
    
    return {
      attackMod: stanceMods.attackMod,
      defenseMod: stanceMods.defenseMod,
      accuracyMod: stanceMods.accuracyMod,
      evasionMod: stanceMods.evasionMod,
      speedMod: stanceMods.speedMod,
    };
  }
  
  // ============================================================
  // Queries
  // ============================================================
  
  /**
   * 태세/진형 상태 조회
   */
  getStanceState(unitId: string): UnitStanceState | undefined {
    return this.stanceStates.get(unitId);
  }
  
  /**
   * 현재 태세 조회
   */
  getCurrentStance(unitId: string): BattleStance {
    return this.stanceStates.get(unitId)?.currentStance ?? BattleStance.DEFENSIVE;
  }
  
  /**
   * 현재 진형 조회
   */
  getCurrentFormation(unitId: string): GroundFormationType | undefined {
    return this.stanceStates.get(unitId)?.currentFormation;
  }
  
  /**
   * 태세 변경 중인지 확인
   */
  isChangingStance(unitId: string): boolean {
    const state = this.stanceStates.get(unitId);
    return state ? state.stanceChangeProgress < 1 : false;
  }
  
  /**
   * 진형 변경 중인지 확인
   */
  isChangingFormation(unitId: string): boolean {
    const state = this.stanceStates.get(unitId);
    return state ? state.formationChangeProgress < 1 : false;
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
  getStanceName(stance?: BattleStance): string {
    if (!stance) return '없음';
    
    const names: Record<BattleStance, string> = {
      [BattleStance.ASSAULT]: '공격 태세',
      [BattleStance.DEFENSIVE]: '방어 태세',
      [BattleStance.CHARGE]: '돌격 태세',
      [BattleStance.RETREAT]: '후퇴 태세',
      [BattleStance.HOLD]: '대기 태세',
      [BattleStance.PURSUIT]: '추격 태세',
    };
    
    return names[stance];
  }
  
  /**
   * 진형 이름 조회
   */
  getFormationName(formation?: GroundFormationType): string {
    if (!formation) return '없음';
    
    const names: Record<GroundFormationType, string> = {
      [GroundFormationType.COLUMN]: '종대(縱隊)',
      [GroundFormationType.LINE]: '횡대(橫隊)',
      [GroundFormationType.WEDGE]: '쐐기진',
      [GroundFormationType.CRANE_WING]: '학익진(鶴翼陣)',
      [GroundFormationType.FISH_SCALE]: '어린진(魚鱗陣)',
      [GroundFormationType.CIRCULAR]: '원진(圓陣)',
      [GroundFormationType.GUERRILLA]: '산개(散開)',
    };
    
    return names[formation];
  }
  
  /**
   * 유닛 상태 제거
   */
  removeStanceState(unitId: string): void {
    this.stanceStates.delete(unitId);
  }
  
  /**
   * 세션 정리
   */
  clearSession(): void {
    this.stanceStates.clear();
    logger.info('[StanceFormationService] Session cleared');
  }
  
  /**
   * 전체 정리
   */
  cleanup(): void {
    this.clearSession();
    this.removeAllListeners();
    logger.info('[StanceFormationService] Cleaned up');
  }
}

// 싱글톤 인스턴스
export const stanceFormationService = new StanceFormationService();





