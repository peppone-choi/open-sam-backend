/**
 * HealTrigger - 전투 치료 트리거
 * 
 * PHP che_전투치료시도.php, che_전투치료발동.php 참조
 * 
 * 전투 치료: 전투 중 부상 회복
 */

import {
  BaseTrigger,
  TriggerContext,
  TriggerResult,
  TriggerPriority,
  TriggerTiming,
} from '../TriggerManager';

// ============================================================================
// 전투 치료 시도 트리거
// ============================================================================

/**
 * 전투 치료 시도 트리거
 * PHP che_전투치료시도.php 참조
 */
export class HealAttemptTrigger extends BaseTrigger {
  id = 'heal_attempt';
  name = '전투치료시도';
  timing: TriggerTiming = 'before_attack';
  priority = TriggerPriority.PRE + 170;
  
  condition(ctx: TriggerContext): boolean {
    const { selfEnv, self } = ctx;
    
    // 치료불가 스킬 보유시 발동 불가
    if (selfEnv.activatedSkills.has('치료불가')) {
      return false;
    }
    
    // 부상이 없으면 발동 불필요
    if ((selfEnv.injury || 0) <= 0) {
      return false;
    }
    
    // 치료 아이템 또는 특기 보유 확인
    if (!self.skills?.includes('치료')) {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { self, rng } = ctx;
    
    // 치료 확률 계산 (지능 기반)
    let healProb = (self.intelligence - 50) / 200;
    healProb = Math.max(0.1, Math.min(0.5, healProb));
    
    if (!rng.nextBool(healProb)) {
      return this.notTriggered();
    }
    
    return this.triggered({
      activateSkills: ['치료시도', '치료'],
    });
  }
}

// ============================================================================
// 전투 치료 발동 트리거
// ============================================================================

/**
 * 전투 치료 발동 트리거
 * PHP che_전투치료발동.php 참조
 */
export class HealActivateTrigger extends BaseTrigger {
  id = 'heal_activate';
  name = '전투치료발동';
  timing: TriggerTiming = 'after_attack';
  priority = TriggerPriority.POST + 550;
  
  // 치료 시 상대 데미지 감소 배율
  private readonly HEAL_DAMAGE_MULTIPLIER = 0.7;
  
  condition(ctx: TriggerContext): boolean {
    const { selfEnv } = ctx;
    
    // 치료 스킬 활성화 확인
    if (!selfEnv.activatedSkills.has('치료')) {
      return false;
    }
    
    // 중복 발동 방지
    if (selfEnv.triggeredFlags.get('치료발동')) {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { selfEnv, opposeEnv } = ctx;
    
    // 발동 플래그 설정
    selfEnv.triggeredFlags.set('치료발동', true);
    
    // 상대 전투력 감소
    opposeEnv.warPowerMultiplier *= this.HEAL_DAMAGE_MULTIPLIER;
    
    // 부상 완치
    const healedInjury = selfEnv.injury || 0;
    selfEnv.injury = 0;
    
    return this.triggered({
      injuryHeal: healedInjury,
      selfMessage: `<C>치료</>했다!`,
      opposeMessage: `상대가 <R>치료</>했다!`,
      effects: [`부상 ${healedInjury} 회복`],
    });
  }
}

// ============================================================================
// Export
// ============================================================================

export const healTriggers = [
  new HealAttemptTrigger(),
  new HealActivateTrigger(),
];


