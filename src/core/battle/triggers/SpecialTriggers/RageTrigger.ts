/**
 * RageTrigger - 격노 트리거
 * 
 * PHP che_격노시도.php, che_격노발동.php 참조
 * 
 * 격노: 상대 필살/회피에 반응하여 반격
 */

import {
  BaseTrigger,
  TriggerContext,
  TriggerResult,
  TriggerPriority,
  TriggerTiming,
} from '../TriggerManager';

// ============================================================================
// 격노 시도 트리거
// ============================================================================

/**
 * 격노 시도 트리거
 * PHP che_격노시도.php 참조
 */
export class RageAttemptTrigger extends BaseTrigger {
  id = 'rage_attempt';
  name = '격노시도';
  timing: TriggerTiming = 'on_critical';  // 상대 필살 시
  priority = TriggerPriority.PRE + 250;
  
  condition(ctx: TriggerContext): boolean {
    const { selfEnv, opposeEnv, self } = ctx;
    
    // 격노불가 스킬 보유시 발동 불가
    if (selfEnv.activatedSkills.has('격노불가')) {
      return false;
    }
    
    // 상대가 필살 또는 회피를 발동했는지 확인
    const opposeHasCritical = opposeEnv.activatedSkills.has('필살');
    const opposeHasEvade = opposeEnv.activatedSkills.has('회피');
    
    if (!opposeHasCritical && !opposeHasEvade) {
      return false;
    }
    
    // 격노 특기 보유 확인
    if (!self.skills?.includes('격노')) {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { self, rng } = ctx;
    
    // 격노 확률 계산 (무력 기반)
    let rageProb = (self.strength - 60) / 200;
    rageProb = Math.max(0.1, Math.min(0.5, rageProb));
    
    if (!rng.nextBool(rageProb)) {
      return this.notTriggered();
    }
    
    return this.triggered({
      activateSkills: ['격노시도', '격노'],
    });
  }
}

// ============================================================================
// 격노 발동 트리거
// ============================================================================

/**
 * 격노 발동 트리거
 * PHP che_격노발동.php 참조
 */
export class RageActivateTrigger extends BaseTrigger {
  id = 'rage_activate';
  name = '격노발동';
  timing: TriggerTiming = 'on_critical';
  priority = TriggerPriority.POST + 600;
  
  condition(ctx: TriggerContext): boolean {
    const { selfEnv } = ctx;
    
    // 격노 스킬 활성화 확인
    if (!selfEnv.activatedSkills.has('격노')) {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { selfEnv, opposeEnv, self } = ctx;
    
    // 상대 행동 확인
    const targetAct = opposeEnv.activatedSkills.has('필살') ? '필살 공격' : '회피 시도';
    
    // 진노 여부 확인 (강화 버전)
    const is진노 = selfEnv.activatedSkills.has('진노');
    const reaction = is진노 ? '진노' : '격노';
    
    // 크리티컬 데미지 계산
    const criticalDamage = this.calculateCriticalDamage(ctx);
    
    // 진노면 보너스 페이즈 추가
    const bonusPhaseAdjust = is진노 ? 1 : 0;
    
    return this.triggered({
      damageMultiplier: criticalDamage,
      bonusPhaseAdjust,
      selfMessage: `상대의 ${targetAct}에 <C>${reaction}</>했다!`,
      opposeMessage: `${targetAct}에 상대가 <R>${reaction}</>했다!`,
    });
  }
}

// ============================================================================
// 격노 대상 (회피 시) 트리거
// ============================================================================

/**
 * 격노 대상 트리거 (회피 시)
 * 상대가 회피했을 때 격노 발동
 */
export class RageOnEvadeTrigger extends BaseTrigger {
  id = 'rage_on_evade';
  name = '격노_회피시';
  timing: TriggerTiming = 'on_evade';
  priority = TriggerPriority.PRE + 251;
  
  condition(ctx: TriggerContext): boolean {
    const { selfEnv, opposeEnv, self } = ctx;
    
    // 격노불가 스킬 보유시 발동 불가
    if (selfEnv.activatedSkills.has('격노불가')) {
      return false;
    }
    
    // 상대가 회피했는지 확인
    if (!opposeEnv.activatedSkills.has('회피')) {
      return false;
    }
    
    // 격노 특기 보유 확인
    if (!self.skills?.includes('격노')) {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { self, rng } = ctx;
    
    // 격노 확률 계산
    let rageProb = (self.strength - 60) / 200;
    rageProb = Math.max(0.1, Math.min(0.5, rageProb));
    
    if (!rng.nextBool(rageProb)) {
      return this.notTriggered();
    }
    
    return this.triggered({
      activateSkills: ['격노'],
    });
  }
}

// ============================================================================
// Export
// ============================================================================

export const rageTriggers = [
  new RageAttemptTrigger(),
  new RageActivateTrigger(),
  new RageOnEvadeTrigger(),
];


