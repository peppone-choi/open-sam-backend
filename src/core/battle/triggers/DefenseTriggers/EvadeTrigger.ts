/**
 * EvadeTrigger - 회피 트리거
 * 
 * PHP che_회피시도.php, che_회피발동.php 참조
 * 
 * 회피: 상대 공격을 회피하여 피해 대폭 감소
 */

import {
  BaseTrigger,
  TriggerContext,
  TriggerResult,
  TriggerPriority,
  TriggerTiming,
} from '../TriggerManager';

// ============================================================================
// 회피 시도 트리거
// ============================================================================

/**
 * 회피 시도 트리거
 * PHP che_회피시도.php 참조
 */
export class EvadeAttemptTrigger extends BaseTrigger {
  id = 'evade_attempt';
  name = '회피시도';
  timing: TriggerTiming = 'before_defense';
  priority = TriggerPriority.PRE + 200;
  
  condition(ctx: TriggerContext): boolean {
    const { selfEnv } = ctx;
    
    // 특수 스킬 보유시 발동 불가
    if (selfEnv.activatedSkills.has('특수')) {
      return false;
    }
    
    // 회피불가 스킬 보유시 발동 불가
    if (selfEnv.activatedSkills.has('회피불가')) {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { self, selfEnv, rng } = ctx;
    
    // 회피 확률 계산 (PHP getComputedAvoidRatio 참조)
    const avoidRatio = this.computeAvoidRatio(self);
    
    // 확률 판정
    if (!rng.nextBool(avoidRatio)) {
      return this.notTriggered();
    }
    
    return this.triggered({
      activateSkills: ['회피시도', '회피'],
    });
  }
  
  /**
   * 회피 확률 계산
   * PHP getComputedAvoidRatio() 참조
   */
  private computeAvoidRatio(unit: {
    strength: number;
    intelligence: number;
    training: number;
  }): number {
    // 기본 회피율 10%
    const baseAvoid = 0.1;
    
    // 훈련도 보정
    const trainBonus = unit.training / 100;
    
    // 지능 보정 (지능이 높으면 회피율 증가)
    const intelBonus = Math.max(0, unit.intelligence - 50) / 200;
    
    // 최대 40%
    return Math.min((baseAvoid + intelBonus) * trainBonus, 0.4);
  }
}

// ============================================================================
// 회피 발동 트리거
// ============================================================================

/**
 * 회피 발동 트리거
 * PHP che_회피발동.php 참조
 */
export class EvadeActivateTrigger extends BaseTrigger {
  id = 'evade_activate';
  name = '회피발동';
  timing: TriggerTiming = 'after_defense';
  priority = TriggerPriority.POST + 500;
  
  // 회피 시 데미지 감소 배율 (1/6)
  private readonly EVADE_DAMAGE_MULTIPLIER = 1/6;
  
  condition(ctx: TriggerContext): boolean {
    const { selfEnv } = ctx;
    
    // 회피 스킬 활성화 확인
    if (!selfEnv.activatedSkills.has('회피')) {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { opposeEnv } = ctx;
    
    // 상대 전투력 1/6으로 감소
    opposeEnv.warPowerMultiplier *= this.EVADE_DAMAGE_MULTIPLIER;
    
    return this.triggered({
      selfMessage: `<C>회피</>했다!`,
      opposeMessage: `상대가 <R>회피</>했다!`,
    });
  }
}

// ============================================================================
// Export
// ============================================================================

export const evadeTriggers = [
  new EvadeAttemptTrigger(),
  new EvadeActivateTrigger(),
];


