/**
 * PhaseAdjustTrigger - 페이즈 조정 트리거
 * 
 * PHP che_전멸시페이즈증가.php, che_기병병종전투.php 참조
 * 
 * 페이즈 조정: 특수 조건에서 전투 페이즈 증가/감소
 */

import {
  BaseTrigger,
  TriggerContext,
  TriggerResult,
  TriggerPriority,
  TriggerTiming,
} from '../TriggerManager';

// ============================================================================
// 전멸 시 페이즈 증가 트리거
// ============================================================================

/**
 * 전멸 시 페이즈 증가 트리거
 * PHP che_전멸시페이즈증가.php 참조
 * 
 * 상대를 전멸시키면 추가 페이즈 획득
 */
export class DestroyPhaseIncreaseTrigger extends BaseTrigger {
  id = 'destroy_phase_increase';
  name = '전멸시페이즈증가';
  timing: TriggerTiming = 'on_death';
  priority = TriggerPriority.POST + 100;
  
  // 전멸 시 추가 페이즈
  private readonly BONUS_PHASE = 1;
  
  condition(ctx: TriggerContext): boolean {
    const { oppose } = ctx;
    
    // 상대가 전멸(HP 또는 병력 0) 확인
    if (oppose.hp > 0 && oppose.troops > 0) {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { self } = ctx;
    
    return this.triggered({
      bonusPhaseAdjust: this.BONUS_PHASE,
      selfMessage: `적 <C>전멸</>! 보너스 페이즈 획득!`,
      effects: [`${self.name} 보너스 페이즈 +${this.BONUS_PHASE}`],
    });
  }
}

// ============================================================================
// 기병 병종 전투 트리거
// ============================================================================

/**
 * 기병 병종 전투 트리거
 * PHP che_기병병종전투.php 참조
 * 
 * 기병 특수 전투 효과
 */
export class CavalryBattleTrigger extends BaseTrigger {
  id = 'cavalry_battle';
  name = '기병병종전투';
  timing: TriggerTiming = 'before_attack';
  priority = TriggerPriority.BEGIN + 20;
  
  // 기병 데미지 보너스
  private readonly CAVALRY_DAMAGE_BONUS = 0.15;
  
  condition(ctx: TriggerContext): boolean {
    const { self } = ctx;
    
    // 기병 병종인지 확인
    if (self.unitType !== 'CAVALRY') {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { oppose } = ctx;
    
    // 상대 병종에 따른 보너스 계산
    let bonus = this.CAVALRY_DAMAGE_BONUS;
    
    // 궁병 상대 시 추가 보너스
    if (oppose.unitType === 'ARCHER') {
      bonus += 0.1;
    }
    
    // 보병 상대 시 추가 보너스
    if (oppose.unitType === 'FOOTMAN') {
      bonus += 0.05;
    }
    
    // 공성 상대 시 추가 보너스
    if (oppose.unitType === 'SIEGE') {
      bonus += 0.15;
    }
    
    return this.triggered({
      damageMultiplier: 1 + bonus,
    });
  }
}

// ============================================================================
// 보병 병종 전투 트리거
// ============================================================================

/**
 * 보병 병종 전투 트리거
 * 보병 특수 전투 효과 - 상대 회피율 감소
 */
export class FootmanBattleTrigger extends BaseTrigger {
  id = 'footman_battle';
  name = '보병병종전투';
  timing: TriggerTiming = 'before_attack';
  priority = TriggerPriority.BEGIN + 21;
  
  condition(ctx: TriggerContext): boolean {
    const { self } = ctx;
    
    // 보병 병종인지 확인
    if (self.unitType !== 'FOOTMAN') {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { opposeEnv } = ctx;
    
    // 상대 회피 확률 감소 효과 (환경 변수로 전달)
    opposeEnv.custom['evadeReduction'] = 0.25;  // 25% 감소
    
    return this.triggered();
  }
}

// ============================================================================
// Export
// ============================================================================

export const phaseAdjustTriggers = [
  new DestroyPhaseIncreaseTrigger(),
  new CavalryBattleTrigger(),
  new FootmanBattleTrigger(),
];


