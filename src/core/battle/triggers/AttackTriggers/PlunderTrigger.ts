/**
 * PlunderTrigger - 약탈 트리거
 * 
 * PHP che_약탈시도.php, che_약탈발동.php 참조
 * 
 * 약탈: 상대 자원 탈취
 */

import {
  BaseTrigger,
  TriggerContext,
  TriggerResult,
  TriggerPriority,
  TriggerTiming,
} from '../TriggerManager';

// ============================================================================
// 약탈 시도 트리거
// ============================================================================

/**
 * 약탈 시도 트리거
 * PHP che_약탈시도.php 참조
 */
export class PlunderAttemptTrigger extends BaseTrigger {
  id = 'plunder_attempt';
  name = '약탈시도';
  timing: TriggerTiming = 'before_attack';
  priority = TriggerPriority.PRE + 140;
  
  // 약탈 비율
  private readonly THEFT_RATIO = 0.1;  // 10%
  
  condition(ctx: TriggerContext): boolean {
    const { selfEnv, self } = ctx;
    
    // 약탈불가 스킬 보유시 발동 불가
    if (selfEnv.activatedSkills.has('약탈불가')) {
      return false;
    }
    
    // 약탈 특기 보유 확인
    if (!self.skills?.includes('약탈')) {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { selfEnv, rng, self } = ctx;
    
    // 약탈 확률 계산 (통솔 기반)
    const plunderRatio = self.leadership / 300;  // 최대 33%
    
    if (!rng.nextBool(plunderRatio)) {
      return this.notTriggered();
    }
    
    // 약탈 비율 설정
    selfEnv.theftRatio = this.THEFT_RATIO;
    
    return this.triggered({
      activateSkills: ['약탈시도', '약탈'],
    });
  }
}

// ============================================================================
// 약탈 발동 트리거
// ============================================================================

/**
 * 약탈 발동 트리거
 * PHP che_약탈발동.php 참조
 */
export class PlunderActivateTrigger extends BaseTrigger {
  id = 'plunder_activate';
  name = '약탈발동';
  timing: TriggerTiming = 'after_attack';
  priority = TriggerPriority.POST + 350;
  
  condition(ctx: TriggerContext): boolean {
    const { selfEnv } = ctx;
    
    // 약탈 스킬 활성화 확인
    if (!selfEnv.activatedSkills.has('약탈')) {
      return false;
    }
    
    // 중복 발동 방지
    if (selfEnv.triggeredFlags.get('약탈발동')) {
      return false;
    }
    
    // 약탈 비율 확인
    if (!selfEnv.theftRatio) {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { selfEnv, opposeEnv, self, oppose } = ctx;
    
    // 발동 플래그 설정
    selfEnv.triggeredFlags.set('약탈발동', true);
    
    const theftRatio = selfEnv.theftRatio!;
    
    // 상대 자원 계산 (실제로는 General에서 가져와야 함)
    // 여기서는 custom 필드 사용
    const opposeGold = opposeEnv.custom['gold'] || 0;
    const opposeRice = opposeEnv.custom['rice'] || 0;
    
    const theftGold = Math.floor(opposeGold * theftRatio);
    const theftRice = Math.floor(opposeRice * theftRatio);
    
    // 자원 이동
    opposeEnv.custom['gold'] = opposeGold - theftGold;
    opposeEnv.custom['rice'] = opposeRice - theftRice;
    selfEnv.custom['gold'] = (selfEnv.custom['gold'] || 0) + theftGold;
    selfEnv.custom['rice'] = (selfEnv.custom['rice'] || 0) + theftRice;
    
    return this.triggered({
      goldChange: theftGold,
      riceChange: theftRice,
      selfMessage: `상대에게서 금 ${theftGold}, 쌀 ${theftRice} 만큼을 <C>약탈</>했다!`,
      opposeMessage: `상대에게 금 ${theftGold}, 쌀 ${theftRice} 만큼을 <R>약탈</>당했다!`,
    });
  }
}

// ============================================================================
// Export
// ============================================================================

export const plunderTriggers = [
  new PlunderAttemptTrigger(),
  new PlunderActivateTrigger(),
];


