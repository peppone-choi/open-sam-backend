/**
 * ChargeTrigger - 돌격 지속 트리거
 * 
 * PHP che_돌격지속.php 참조
 * 
 * 돌격: 기병 특수 효과, 연속 공격 시 위력 증가
 */

import {
  BaseTrigger,
  TriggerContext,
  TriggerResult,
  TriggerPriority,
  TriggerTiming,
} from '../TriggerManager';

// ============================================================================
// 돌격 지속 트리거
// ============================================================================

/**
 * 돌격 지속 트리거
 * PHP che_돌격지속.php 참조
 * 
 * 기병이 연속 공격 시 데미지 증가
 */
export class ChargeContinueTrigger extends BaseTrigger {
  id = 'charge_continue';
  name = '돌격지속';
  timing: TriggerTiming = 'before_attack';
  priority = TriggerPriority.PRE + 60;
  
  // 돌격 데미지 증가율 (페이즈당)
  private readonly CHARGE_BONUS_PER_PHASE = 0.1;  // 10%
  private readonly MAX_CHARGE_BONUS = 0.5;        // 최대 50%
  
  condition(ctx: TriggerContext): boolean {
    const { self, selfEnv } = ctx;
    
    // 기병 병종인지 확인
    if (self.unitType !== 'CAVALRY') {
      return false;
    }
    
    // 돌격 스킬 활성화 확인 (이전 페이즈에서 발동)
    if (!selfEnv.activatedSkills.has('돌격')) {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { selfEnv, phase } = ctx;
    
    // 현재 돌격 카운트 가져오기
    const chargeCount = (selfEnv.custom['chargeCount'] || 0) + 1;
    selfEnv.custom['chargeCount'] = chargeCount;
    
    // 돌격 보너스 계산
    const chargeBonus = Math.min(
      chargeCount * this.CHARGE_BONUS_PER_PHASE,
      this.MAX_CHARGE_BONUS
    );
    
    return this.triggered({
      damageMultiplier: 1 + chargeBonus,
      selfMessage: `돌격 지속! (${Math.round(chargeBonus * 100)}% 증가)`,
    });
  }
}

// ============================================================================
// 돌격 시작 트리거
// ============================================================================

/**
 * 돌격 시작 트리거
 * 첫 공격 시 돌격 효과 활성화
 */
export class ChargeStartTrigger extends BaseTrigger {
  id = 'charge_start';
  name = '돌격시작';
  timing: TriggerTiming = 'before_attack';
  priority = TriggerPriority.BEGIN + 30;
  
  condition(ctx: TriggerContext): boolean {
    const { self, selfEnv } = ctx;
    
    // 기병 병종인지 확인
    if (self.unitType !== 'CAVALRY') {
      return false;
    }
    
    // 이미 돌격 중이면 스킵
    if (selfEnv.activatedSkills.has('돌격')) {
      return false;
    }
    
    // 돌격 특기 보유 확인
    if (!self.skills?.includes('돌격')) {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { selfEnv, rng, self } = ctx;
    
    // 돌격 발동 확률 (통솔 기반)
    const chargeProb = self.leadership / 200;  // 최대 50%
    
    if (!rng.nextBool(chargeProb)) {
      return this.notTriggered();
    }
    
    // 돌격 카운트 초기화
    selfEnv.custom['chargeCount'] = 0;
    
    return this.triggered({
      activateSkills: ['돌격'],
      selfMessage: `<C>돌격</> 개시!`,
    });
  }
}

// ============================================================================
// Export
// ============================================================================

export const chargeTriggers = [
  new ChargeStartTrigger(),
  new ChargeContinueTrigger(),
];


