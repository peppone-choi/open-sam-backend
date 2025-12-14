/**
 * CounterStrategyTrigger - 반계 트리거
 * 
 * PHP che_반계시도.php, che_반계발동.php 참조
 * 
 * 반계: 상대 계략을 되돌려 역으로 피해
 * 
 * PHP 원본 로직:
 * - 상대가 '계략' 스킬 활성화 시
 * - 반계불가 스킬 없을 때
 * - 기본 확률 40% (생성자로 조정 가능)
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
 * 
 * PHP 원본:
 * - 기본 확률 40%
 * - 상대 '계략' 활성화 시 발동
 * - 성공 시 상대 '계략' 비활성화
 */
export class CounterStrategyAttemptTrigger extends BaseTrigger {
  id = 'counter_strategy_attempt';
  name = '반계시도';
  timing: TriggerTiming = 'on_tactics';
  // PHP PRIORITY_BODY + 300
  priority = TriggerPriority.NORMAL + 100;
  
  // PHP: protected $prob = 0.4;
  private prob: number;
  
  constructor(prob: number = 0.4) {
    super();
    this.prob = prob;
  }
  
  condition(ctx: TriggerContext): boolean {
    const { selfEnv, opposeEnv } = ctx;
    
    // PHP: if(!$oppose->hasActivatedSkill('계략'))
    if (!opposeEnv.activatedSkills.has('계략')) {
      return false;
    }
    
    // PHP: if($self->hasActivatedSkill('반계불가'))
    if (selfEnv.activatedSkills.has('반계불가')) {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { selfEnv, opposeEnv, rng } = ctx;
    
    // PHP: if(!$self->rng->nextBool($this->prob))
    if (!rng.nextBool(this.prob)) {
      return this.notTriggered();
    }
    
    // PHP: assert(key_exists('magic', $opposeEnv));
    // 계략 정보 복사 (반계 발동에서 사용)
    if (opposeEnv.magic) {
      selfEnv.magic = { ...opposeEnv.magic };
    }
    
    // PHP: $self->activateSkill('반계');
    // PHP: $oppose->deactivateSkill('계략');
    opposeEnv.activatedSkills.delete('계략');
    
    return this.triggered({
      activateSkills: ['반계'],
    });
  }
}

// ============================================================================
// 반계 발동 트리거
// ============================================================================

/**
 * 반계 발동 트리거
 * PHP che_반계발동.php 참조
 * 
 * PHP 원본:
 * - 상대 계략 정보(magic)를 가져와서 자신에게 적용
 * - 한국어 조사 처리 (을/를)
 */
export class CounterStrategyActivateTrigger extends BaseTrigger {
  id = 'counter_strategy_activate';
  name = '반계발동';
  timing: TriggerTiming = 'on_tactics';
  // PHP PRIORITY_POST + 250
  priority = TriggerPriority.POST + 50;
  
  condition(ctx: TriggerContext): boolean {
    const { selfEnv } = ctx;
    
    // PHP: if(!$self->hasActivatedSkill('반계'))
    if (!selfEnv.activatedSkills.has('반계')) {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { selfEnv } = ctx;
    
    // PHP: [$opposeMagic, $damage] = $opposeEnv['magic'];
    // 반계시도에서 복사한 magic 정보 사용
    const magicInfo = selfEnv.magic;
    if (!magicInfo) {
      return this.notTriggered();
    }
    
    const { name: opposeMagic, damage } = magicInfo;
    
    // PHP: $josaUl = \sammo\JosaUtil::pick($opposeMagic, '을');
    const josaUl = this.pickJosa(opposeMagic, '을');
    
    // PHP: $self->multiplyWarPowerMultiply($damage);
    selfEnv.warPowerMultiplier *= damage;
    
    return this.triggered({
      damageMultiplier: damage,
      selfMessage: `<C>반계</>로 상대의 <D>${opposeMagic}</>${josaUl} 되돌렸다!`,
      opposeMessage: `<D>${opposeMagic}</>${josaUl} <R>역으로</> 당했다!`,
    });
  }
  
  /**
   * 한국어 조사 선택 (JosaUtil.pick 간단 구현)
   */
  private pickJosa(word: string, josa: string): string {
    if (!word || word.length === 0) return josa;
    const lastChar = word.charCodeAt(word.length - 1);
    // 한글 범위 체크
    if (lastChar < 0xAC00 || lastChar > 0xD7A3) return josa;
    const hasBatchim = (lastChar - 0xAC00) % 28 !== 0;
    
    if (josa === '을') {
      return hasBatchim ? '을' : '를';
    }
    return josa;
  }
}

// ============================================================================
// Export
// ============================================================================

export const counterStrategyTriggers = [
  new CounterStrategyAttemptTrigger(),
  new CounterStrategyActivateTrigger(),
];


