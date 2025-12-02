/**
 * PreemptiveTrigger - 선제사격 트리거
 * 
 * PHP che_선제사격시도.php, che_선제사격발동.php, che_궁병선제사격.php 참조
 * 
 * 선제사격: 상대보다 먼저 공격하여 일방적 피해
 */

import {
  BaseTrigger,
  TriggerContext,
  TriggerResult,
  TriggerPriority,
  TriggerTiming,
} from '../TriggerManager';

// ============================================================================
// 선제사격 시도 트리거
// ============================================================================

/**
 * 선제사격 시도 트리거
 * PHP che_선제사격시도.php 참조
 */
export class PreemptiveAttemptTrigger extends BaseTrigger {
  id = 'preemptive_attempt';
  name = '선제사격시도';
  timing: TriggerTiming = 'before_attack';
  priority = TriggerPriority.PRE + 50;
  
  condition(ctx: TriggerContext): boolean {
    const { selfEnv, self } = ctx;
    
    // 선제불가 스킬 보유시 발동 불가
    if (selfEnv.activatedSkills.has('선제불가')) {
      return false;
    }
    
    // 선제 특기 보유 확인
    if (!self.skills?.includes('선제')) {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    // 선제 스킬 활성화
    return this.triggered({
      activateSkills: ['선제시도', '선제'],
    });
  }
}

// ============================================================================
// 선제사격 발동 트리거
// ============================================================================

/**
 * 선제사격 발동 트리거
 * PHP che_선제사격발동.php 참조
 */
export class PreemptiveActivateTrigger extends BaseTrigger {
  id = 'preemptive_activate';
  name = '선제사격발동';
  timing: TriggerTiming = 'on_phase_start';
  priority = TriggerPriority.BEGIN + 51;
  
  condition(ctx: TriggerContext): boolean {
    const { selfEnv } = ctx;
    
    // 선제 스킬 활성화 확인
    if (!selfEnv.activatedSkills.has('선제')) {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { selfEnv, opposeEnv, isAttacker } = ctx;
    
    // 맞선제 상황 체크
    const opponentHasPreemptive = opposeEnv.activatedSkills.has('선제');
    
    if (opponentHasPreemptive && !isAttacker) {
      // 맞선제인데 공격자가 아니면 공격자가 처리
      return this.notTriggered();
    }
    
    // 페이즈 감소
    const phaseAdjust = -1;
    
    if (opponentHasPreemptive) {
      // 맞선제: 서로 2/3 데미지
      selfEnv.warPowerMultiplier *= 2/3;
      opposeEnv.warPowerMultiplier *= 2/3;
      
      return this.triggered({
        phaseAdjust,
        damageMultiplier: 2/3,
        selfMessage: `서로 <C>선제 사격</>을 주고 받았다!`,
        opposeMessage: `서로 <C>선제 사격</>을 주고 받았다!`,
      });
    }
    
    // 일방 선제: 상대 피해 0, 자신 2/3
    opposeEnv.warPowerMultiplier = 0;
    selfEnv.warPowerMultiplier *= 2/3;
    
    // 상대 스킬 제한
    opposeEnv.activatedSkills.add('회피불가');
    opposeEnv.activatedSkills.add('필살불가');
    opposeEnv.activatedSkills.add('격노불가');
    opposeEnv.activatedSkills.add('계략불가');
    
    // 자신 스킬 제한
    selfEnv.activatedSkills.add('회피불가');
    selfEnv.activatedSkills.add('필살불가');
    selfEnv.activatedSkills.add('계략불가');
    
    return this.triggered({
      phaseAdjust,
      damageMultiplier: 2/3,
      selfMessage: `상대에게 <C>선제 사격</>을 했다!`,
      opposeMessage: `상대에게 <R>선제 사격</>을 받았다!`,
    });
  }
}

// ============================================================================
// 궁병 선제사격 트리거
// ============================================================================

/**
 * 궁병 선제사격 트리거
 * PHP che_궁병선제사격.php 참조
 * 
 * 궁병 병종 기본 선제사격
 */
export class ArcherPreemptiveTrigger extends BaseTrigger {
  id = 'archer_preemptive';
  name = '궁병선제사격';
  timing: TriggerTiming = 'before_attack';
  priority = TriggerPriority.BEGIN + 10;
  
  condition(ctx: TriggerContext): boolean {
    const { self, selfEnv } = ctx;
    
    // 궁병 병종인지 확인
    if (self.unitType !== 'ARCHER') {
      return false;
    }
    
    // 이미 선제 발동 중이면 스킵
    if (selfEnv.activatedSkills.has('선제')) {
      return false;
    }
    
    // 근접전(melee) 상황이면 발동 불가
    // 실제로는 거리 계산 필요
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { rng, self } = ctx;
    
    // 궁병 기본 선제사격 확률 (훈련도 기반)
    const prob = self.training / 200;  // 최대 50%
    
    if (!rng.nextBool(prob)) {
      return this.notTriggered();
    }
    
    return this.triggered({
      activateSkills: ['선제'],
    });
  }
}

// ============================================================================
// Export
// ============================================================================

export const preemptiveTriggers = [
  new PreemptiveAttemptTrigger(),
  new PreemptiveActivateTrigger(),
  new ArcherPreemptiveTrigger(),
];


