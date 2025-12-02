/**
 * CounterStrategyTrigger - 반계 트리거
 * 
 * PHP che_반계시도.php, che_반계발동.php 참조
 * 
 * 반계: 상대 계략을 되돌려 역으로 피해
 */

import {
  BaseTrigger,
  TriggerContext,
  TriggerResult,
  TriggerPriority,
  TriggerTiming,
} from '../TriggerManager';

// ============================================================================
// 반계 시도 트리거
// ============================================================================

/**
 * 반계 시도 트리거
 * PHP che_반계시도.php 참조
 */
export class CounterStrategyAttemptTrigger extends BaseTrigger {
  id = 'counter_strategy_attempt';
  name = '반계시도';
  timing: TriggerTiming = 'on_tactics';
  priority = TriggerPriority.PRE + 280;  // 계략시도보다 먼저
  
  condition(ctx: TriggerContext): boolean {
    const { selfEnv, opposeEnv, self } = ctx;
    
    // 반계불가 스킬 보유시 발동 불가
    if (selfEnv.activatedSkills.has('반계불가')) {
      return false;
    }
    
    // 상대가 계략시도 중인지 확인
    if (!opposeEnv.activatedSkills.has('계략시도')) {
      return false;
    }
    
    // 반계 특기 보유 확인
    if (!self.skills?.includes('반계')) {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { self, oppose, selfEnv, rng } = ctx;
    
    // 반계 확률 계산 (지능 기반)
    let counterProb = (self.intelligence - 50) / 200;  // 지능 150에서 50%
    counterProb = Math.max(0.1, Math.min(0.7, counterProb));  // 10% ~ 70%
    
    // 상대 지능이 높으면 반계 확률 감소
    const intelDiff = oppose.intelligence - self.intelligence;
    if (intelDiff > 0) {
      counterProb -= intelDiff / 400;
    }
    
    if (!rng.nextBool(counterProb)) {
      return this.notTriggered();
    }
    
    return this.triggered({
      activateSkills: ['반계시도', '반계'],
    });
  }
}

// ============================================================================
// 반계 발동 트리거
// ============================================================================

/**
 * 반계 발동 트리거
 * PHP che_반계발동.php 참조
 */
export class CounterStrategyActivateTrigger extends BaseTrigger {
  id = 'counter_strategy_activate';
  name = '반계발동';
  timing: TriggerTiming = 'on_tactics';
  priority = TriggerPriority.POST + 250;
  
  condition(ctx: TriggerContext): boolean {
    const { selfEnv } = ctx;
    
    // 반계 스킬 활성화 확인
    if (!selfEnv.activatedSkills.has('반계')) {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { selfEnv, opposeEnv } = ctx;
    
    // 상대 계략 정보 가져오기
    const opposeMagic = opposeEnv.magic;
    if (!opposeMagic) {
      return this.notTriggered();
    }
    
    // 상대 계략 무효화
    opposeEnv.activatedSkills.delete('계략');
    opposeEnv.activatedSkills.add('계략실패');
    opposeEnv.warPowerMultiplier = 1.0;  // 계략 데미지 리셋
    
    // 자신에게 계략 효과 적용
    selfEnv.warPowerMultiplier *= opposeMagic.damage;
    
    return this.triggered({
      damageMultiplier: opposeMagic.damage,
      selfMessage: `<C>반계</>로 상대의 <D>${opposeMagic.name}</>을(를) 되돌렸다!`,
      opposeMessage: `<D>${opposeMagic.name}</>을(를) <R>역으로</> 당했다!`,
    });
  }
}

// ============================================================================
// Export
// ============================================================================

export const counterStrategyTriggers = [
  new CounterStrategyAttemptTrigger(),
  new CounterStrategyActivateTrigger(),
];


