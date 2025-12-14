/**
 * RageTrigger - 격노 트리거
 * 
 * PHP che_격노시도.php, che_격노발동.php 참조
 * 
 * 격노: 상대 필살/회피에 반응하여 반격
 * 
 * PHP 원본 로직:
 * - 상대 필살 시: 100% 격노 발동, 상대 회피 비활성화
 * - 상대 회피 시: 25% 확률로 격노 발동, 상대 회피 비활성화  
 * - 공격자이면서 격노 발동 시: 50% 확률로 진노 발동
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
 * 
 * PHP 원본 로직:
 * - 상대가 '필살' 또는 '회피' 스킬 활성화 시
 * - 격노불가 스킬 없을 때
 * - 필살: 100% 격노, 회피: 25% 격노
 * - 공격자 + 격노 발동 시: 50% 진노
 */
export class RageAttemptTrigger extends BaseTrigger {
  id = 'rage_attempt';
  name = '격노시도';
  // PHP PRIORITY_BODY + 400
  timing: TriggerTiming = 'on_critical';
  priority = TriggerPriority.NORMAL + 200;
  
  condition(ctx: TriggerContext): boolean {
    const { selfEnv, opposeEnv } = ctx;
    
    // PHP: if(!$oppose->hasActivatedSkill('필살') && !$oppose->hasActivatedSkill('회피'))
    const opposeHasCritical = opposeEnv.activatedSkills.has('필살');
    const opposeHasEvade = opposeEnv.activatedSkills.has('회피');
    
    if (!opposeHasCritical && !opposeHasEvade) {
      return false;
    }
    
    // PHP: if($self->hasActivatedSkill('격노불가'))
    if (selfEnv.activatedSkills.has('격노불가')) {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { selfEnv, opposeEnv, rng, isAttacker } = ctx;
    
    const opposeHasCritical = opposeEnv.activatedSkills.has('필살');
    
    let willRage = false;
    
    if (opposeHasCritical) {
      // PHP: 상대 필살 시 100% 격노 발동
      willRage = true;
      // PHP: $oppose->deactivateSkill('회피');
      opposeEnv.activatedSkills.delete('회피');
      
      // PHP: if($self->isAttacker() && $self->rng->nextBool(1/2))
      if (isAttacker && rng.nextBool(0.5)) {
        return this.triggered({
          activateSkills: ['격노', '진노'],
        });
      }
    } else {
      // PHP: else if($self->rng->nextBool(1/4))
      if (rng.nextBool(0.25)) {
        willRage = true;
        // PHP: $oppose->deactivateSkill('회피');
        opposeEnv.activatedSkills.delete('회피');
        
        // PHP: if($self->isAttacker() && $self->rng->nextBool(1/2))
        if (isAttacker && rng.nextBool(0.5)) {
          return this.triggered({
            activateSkills: ['격노', '진노'],
          });
        }
      }
    }
    
    if (!willRage) {
      return this.notTriggered();
    }
    
    return this.triggered({
      activateSkills: ['격노'],
    });
  }
}

// ============================================================================
// 격노 발동 트리거
// ============================================================================

/**
 * 격노 발동 트리거
 * PHP che_격노발동.php 참조
 * 
 * PHP 원본 로직:
 * - 상대 행동에 따른 메시지 분기 (필살/회피)
 * - 진노 여부에 따른 추가 효과 (보너스 페이즈 +1)
 * - 크리티컬 데미지 배율 적용
 */
export class RageActivateTrigger extends BaseTrigger {
  id = 'rage_activate';
  name = '격노발동';
  timing: TriggerTiming = 'on_critical';
  // PHP PRIORITY_POST + 600
  priority = TriggerPriority.POST + 300;
  
  condition(ctx: TriggerContext): boolean {
    const { selfEnv } = ctx;
    
    // PHP: if(!$self->hasActivatedSkill('격노'))
    if (!selfEnv.activatedSkills.has('격노')) {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { selfEnv, opposeEnv } = ctx;
    
    // PHP: $targetAct = $oppose->hasActivatedSkill('필살')?'필살 공격':'회피 시도';
    const targetAct = opposeEnv.activatedSkills.has('필살') ? '필살 공격' : '회피 시도';
    
    // PHP: $is진노 = $self->hasActivatedSkill('진노');
    // PHP: $reaction = $is진노?'진노':'격노';
    const is진노 = selfEnv.activatedSkills.has('진노');
    const reaction = is진노 ? '진노' : '격노';
    
    // PHP: $self->multiplyWarPowerMultiply($self->criticalDamage());
    const criticalDamage = this.calculateCriticalDamage(ctx);
    
    // PHP: if($is진노) { $self->addBonusPhase(1); }
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
// Note: 격노 회피 시 트리거는 RageAttemptTrigger에 통합됨 (PHP 원본 동일)
// PHP 원본에서는 che_격노시도.php에서 회피와 필살 둘 다 처리
// ============================================================================

// ============================================================================
// Export
// ============================================================================

export const rageTriggers = [
  new RageAttemptTrigger(),
  new RageActivateTrigger(),
];


