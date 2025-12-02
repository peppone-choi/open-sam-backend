/**
 * IntimidateTrigger - 위압 트리거
 * 
 * PHP che_위압시도.php, che_위압발동.php 참조
 * 
 * 위압: 상대 사기 감소 효과
 */

import {
  BaseTrigger,
  TriggerContext,
  TriggerResult,
  TriggerPriority,
  TriggerTiming,
} from '../TriggerManager';

// ============================================================================
// 위압 시도 트리거
// ============================================================================

/**
 * 위압 시도 트리거
 * PHP che_위압시도.php 참조
 */
export class IntimidateAttemptTrigger extends BaseTrigger {
  id = 'intimidate_attempt';
  name = '위압시도';
  timing: TriggerTiming = 'before_attack';
  priority = TriggerPriority.PRE + 160;
  
  condition(ctx: TriggerContext): boolean {
    const { selfEnv, self } = ctx;
    
    // 위압불가 스킬 보유시 발동 불가
    if (selfEnv.activatedSkills.has('위압불가')) {
      return false;
    }
    
    // 위압 특기 보유 확인
    if (!self.skills?.includes('위압')) {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { self, oppose, rng } = ctx;
    
    // 위압 확률 계산 (통솔 기반)
    let intimidateProb = (self.leadership - 60) / 200;
    intimidateProb = Math.max(0, Math.min(0.4, intimidateProb));
    
    // 상대 사기가 낮으면 확률 증가
    if (oppose.morale < 50) {
      intimidateProb += 0.1;
    }
    
    if (!rng.nextBool(intimidateProb)) {
      return this.notTriggered();
    }
    
    return this.triggered({
      activateSkills: ['위압시도', '위압'],
    });
  }
}

// ============================================================================
// 위압 발동 트리거
// ============================================================================

/**
 * 위압 발동 트리거
 * PHP che_위압발동.php 참조
 */
export class IntimidateActivateTrigger extends BaseTrigger {
  id = 'intimidate_activate';
  name = '위압발동';
  timing: TriggerTiming = 'after_attack';
  priority = TriggerPriority.POST + 200;
  
  // 위압으로 감소시킬 사기
  private readonly MORALE_REDUCTION = 10;
  
  condition(ctx: TriggerContext): boolean {
    const { selfEnv } = ctx;
    
    // 위압 스킬 활성화 확인
    if (!selfEnv.activatedSkills.has('위압')) {
      return false;
    }
    
    // 중복 발동 방지
    if (selfEnv.triggeredFlags.get('위압발동')) {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { selfEnv, opposeEnv, self } = ctx;
    
    // 발동 플래그 설정
    selfEnv.triggeredFlags.set('위압발동', true);
    
    // 사기 감소량 계산 (통솔에 따라 변동)
    const moraleReduction = this.MORALE_REDUCTION + Math.floor((self.leadership - 70) / 10);
    
    // 상대 사기 감소 효과 설정
    opposeEnv.custom['moraleReduction'] = (opposeEnv.custom['moraleReduction'] || 0) + moraleReduction;
    
    return this.triggered({
      selfMessage: `<C>위압</>으로 상대 사기 ${moraleReduction} 감소!`,
      opposeMessage: `상대의 <R>위압</>으로 사기 ${moraleReduction} 감소!`,
      effects: [`상대 사기 -${moraleReduction}`],
    });
  }
}

// ============================================================================
// Export
// ============================================================================

export const intimidateTriggers = [
  new IntimidateAttemptTrigger(),
  new IntimidateActivateTrigger(),
];


