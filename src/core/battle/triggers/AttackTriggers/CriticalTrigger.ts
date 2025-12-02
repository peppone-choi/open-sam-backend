/**
 * CriticalTrigger - 필살 트리거
 * 
 * PHP che_필살시도.php, che_필살발동.php, che_필살강화_회피불가.php 참조
 * 
 * 필살: 높은 무력 기반 추가 데미지
 */

import {
  BaseTrigger,
  TriggerContext,
  TriggerResult,
  TriggerPriority,
  TriggerTiming,
} from '../TriggerManager';

// ============================================================================
// 필살 시도 트리거
// ============================================================================

/**
 * 필살 시도 트리거
 * PHP che_필살시도.php 참조
 * 
 * 조건: 
 * - General 유닛만 발동 가능
 * - '특수' 스킬 미보유
 * - '필살불가' 스킬 미보유
 * - 무력 기반 확률 판정 통과
 */
export class CriticalAttemptTrigger extends BaseTrigger {
  id = 'critical_attempt';
  name = '필살시도';
  timing: TriggerTiming = 'before_attack';
  priority = TriggerPriority.PRE + 120;
  
  condition(ctx: TriggerContext): boolean {
    const { selfEnv, self } = ctx;
    
    // 특수 스킬 보유시 발동 불가
    if (selfEnv.activatedSkills.has('특수')) {
      return false;
    }
    
    // 필살불가 스킬 보유시 발동 불가
    if (selfEnv.activatedSkills.has('필살불가')) {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { self, selfEnv, rng } = ctx;
    
    // 필살 확률 계산 (PHP getComputedCriticalRatio 참조)
    // 무력 65 이상부터 효과 시작
    const criticalRatio = this.computeCriticalRatio(self.strength);
    
    // 확률 판정
    if (!rng.nextBool(criticalRatio)) {
      return this.notTriggered();
    }
    
    // 필살시도, 필살 스킬 활성화
    return this.triggered({
      activateSkills: ['필살시도', '필살'],
    });
  }
  
  /**
   * 필살 확률 계산
   * PHP getComputedCriticalRatio() 참조
   */
  private computeCriticalRatio(strength: number): number {
    // 무력 65 이상부터 효과
    const effective = Math.max(0, strength - 65);
    // 최대 50%
    return Math.min(effective * 0.5 / 100, 0.5);
  }
}

// ============================================================================
// 필살 발동 트리거
// ============================================================================

/**
 * 필살 발동 트리거
 * PHP che_필살발동.php 참조
 * 
 * 조건:
 * - '필살' 스킬 활성화됨
 * - 중복 발동 방지
 */
export class CriticalActivateTrigger extends BaseTrigger {
  id = 'critical_activate';
  name = '필살발동';
  timing: TriggerTiming = 'after_attack';
  priority = TriggerPriority.POST + 400;
  
  condition(ctx: TriggerContext): boolean {
    const { selfEnv } = ctx;
    
    // 필살 스킬 활성화 확인
    if (!selfEnv.activatedSkills.has('필살')) {
      return false;
    }
    
    // 중복 발동 방지
    if (selfEnv.triggeredFlags.get('필살발동')) {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { selfEnv, self, oppose } = ctx;
    
    // 발동 플래그 설정
    selfEnv.triggeredFlags.set('필살발동', true);
    
    // 크리티컬 데미지 배율 계산
    const criticalDamage = this.calculateCriticalDamage(ctx);
    
    return this.triggered({
      damageMultiplier: criticalDamage,
      selfMessage: `<C>필살</>공격!`,
      opposeMessage: `상대의 <R>필살</>공격!`,
    });
  }
}

// ============================================================================
// 필살 강화 (회피 불가) 트리거
// ============================================================================

/**
 * 필살 강화 트리거 - 회피 불가
 * PHP che_필살강화_회피불가.php 참조
 * 
 * 필살 발동 시 상대 회피 불가 효과 추가
 */
export class CriticalEnhanceNoEvadeTrigger extends BaseTrigger {
  id = 'critical_enhance_no_evade';
  name = '필살강화_회피불가';
  timing: TriggerTiming = 'before_attack';
  priority = TriggerPriority.PRE + 121;
  
  condition(ctx: TriggerContext): boolean {
    const { selfEnv, self } = ctx;
    
    // 필살 스킬 활성화 확인
    if (!selfEnv.activatedSkills.has('필살')) {
      return false;
    }
    
    // 강화 특기 보유 확인 (예: 필살강화 특기)
    if (!self.skills?.includes('필살강화')) {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    // 상대에게 회피불가 효과 부여
    ctx.opposeEnv.activatedSkills.add('회피불가');
    
    return this.triggered({
      selfMessage: `필살 강화로 상대 회피 불가!`,
    });
  }
}

// ============================================================================
// Export
// ============================================================================

export const criticalTriggers = [
  new CriticalAttemptTrigger(),
  new CriticalActivateTrigger(),
  new CriticalEnhanceNoEvadeTrigger(),
];


