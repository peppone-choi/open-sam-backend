/**
 * BlockTrigger - 저지 트리거
 * 
 * PHP che_저지시도.php, che_저지발동.php 참조
 * 
 * 저지: 상대 공격을 저지하여 양측 데미지 0, 페이즈 감소
 */

import {
  BaseTrigger,
  TriggerContext,
  TriggerResult,
  TriggerPriority,
  TriggerTiming,
} from '../TriggerManager';

// ============================================================================
// 저지 시도 트리거
// ============================================================================

/**
 * 저지 시도 트리거
 * PHP che_저지시도.php 참조
 */
export class BlockAttemptTrigger extends BaseTrigger {
  id = 'block_attempt';
  name = '저지시도';
  timing: TriggerTiming = 'before_defense';
  priority = TriggerPriority.PRE + 180;
  
  condition(ctx: TriggerContext): boolean {
    const { selfEnv, self } = ctx;
    
    // 저지불가 스킬 보유시 발동 불가
    if (selfEnv.activatedSkills.has('저지불가')) {
      return false;
    }
    
    // 저지 특기 보유 확인
    if (!self.skills?.includes('저지')) {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { self, rng } = ctx;
    
    // 저지 확률 계산 (통솔 기반)
    const blockRatio = this.computeBlockRatio(self.leadership);
    
    if (!rng.nextBool(blockRatio)) {
      return this.notTriggered();
    }
    
    return this.triggered({
      activateSkills: ['저지시도', '저지'],
    });
  }
  
  private computeBlockRatio(leadership: number): number {
    // 통솔 70 이상부터 효과
    const effective = Math.max(0, leadership - 70);
    return Math.min(effective * 0.4 / 100, 0.25);  // 최대 25%
  }
}

// ============================================================================
// 저지 발동 트리거
// ============================================================================

/**
 * 저지 발동 트리거
 * PHP che_저지발동.php 참조
 * 
 * 저지: 모든 이벤트를 중지시키고 양측 데미지 0
 */
export class BlockActivateTrigger extends BaseTrigger {
  id = 'block_activate';
  name = '저지발동';
  timing: TriggerTiming = 'after_defense';
  priority = TriggerPriority.POST;  // 최우선 순위
  
  condition(ctx: TriggerContext): boolean {
    const { selfEnv } = ctx;
    
    // 저지 스킬 활성화 확인
    if (!selfEnv.activatedSkills.has('저지')) {
      return false;
    }
    
    // 중복 발동 방지
    if (selfEnv.triggeredFlags.get('저지발동')) {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { selfEnv, opposeEnv, phase, maxPhase } = ctx;
    
    // 발동 플래그 설정
    selfEnv.triggeredFlags.set('저지발동', true);
    
    // 양측 페이즈 감소
    selfEnv.phaseAdjustment -= 1;
    opposeEnv.phaseAdjustment -= 1;
    
    // 페이즈가 남았으면 상대 보너스 페이즈 감소
    if (phase < maxPhase) {
      opposeEnv.bonusPhase -= 1;
    }
    
    // 양측 전투력 0으로
    selfEnv.warPowerMultiplier = 0;
    opposeEnv.warPowerMultiplier = 0;
    
    // 저지는 모든 이벤트를 중지시킴 (continueChain = false)
    return this.stopChain({
      selfMessage: `상대를 <C>저지</>했다!`,
      opposeMessage: `<R>저지</>당했다!`,
      phaseAdjust: -1,
    });
  }
}

// ============================================================================
// Export
// ============================================================================

export const blockTriggers = [
  new BlockAttemptTrigger(),
  new BlockActivateTrigger(),
];


