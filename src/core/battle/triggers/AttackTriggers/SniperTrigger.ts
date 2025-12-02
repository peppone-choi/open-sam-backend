/**
 * SniperTrigger - 저격 트리거
 * 
 * PHP che_저격시도.php, che_저격발동.php 참조
 * 
 * 저격: 상대 장수에게 부상 + 명성 획득
 */

import {
  BaseTrigger,
  TriggerContext,
  TriggerResult,
  TriggerPriority,
  TriggerTiming,
} from '../TriggerManager';

// ============================================================================
// 저격 시도 트리거
// ============================================================================

/**
 * 저격 시도 트리거
 * PHP che_저격시도.php 참조
 */
export class SniperAttemptTrigger extends BaseTrigger {
  id = 'sniper_attempt';
  name = '저격시도';
  timing: TriggerTiming = 'before_attack';
  priority = TriggerPriority.PRE + 130;
  
  // 저격 관련 상수
  private readonly ADD_ATMOS = 5;      // 명성 증가량
  private readonly WOUND_MIN = 5;       // 최소 부상
  private readonly WOUND_MAX = 15;      // 최대 부상
  
  condition(ctx: TriggerContext): boolean {
    const { selfEnv, self } = ctx;
    
    // 저격불가 스킬 보유시 발동 불가
    if (selfEnv.activatedSkills.has('저격불가')) {
      return false;
    }
    
    // 저격 특기 보유 확인
    if (!self.skills?.includes('저격')) {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { self, selfEnv, rng } = ctx;
    
    // 저격 확률 계산 (무력 기반)
    const sniperRatio = this.computeSniperRatio(self.strength);
    
    // 확률 판정
    if (!rng.nextBool(sniperRatio)) {
      return this.notTriggered();
    }
    
    // 저격 정보 설정
    selfEnv.sniperInfo = {
      addAtmos: this.ADD_ATMOS,
      woundMin: this.WOUND_MIN,
      woundMax: this.WOUND_MAX,
      raiseType: 1,  // 발동 타입 (공격자)
    };
    
    // 저격 스킬 활성화
    return this.triggered({
      activateSkills: ['저격시도', '저격'],
    });
  }
  
  private computeSniperRatio(strength: number): number {
    // 무력 70 이상부터 효과
    const effective = Math.max(0, strength - 70);
    return Math.min(effective * 0.3 / 100, 0.3);
  }
}

// ============================================================================
// 저격 발동 트리거
// ============================================================================

/**
 * 저격 발동 트리거
 * PHP che_저격발동.php 참조
 */
export class SniperActivateTrigger extends BaseTrigger {
  id = 'sniper_activate';
  name = '저격발동';
  timing: TriggerTiming = 'after_attack';
  priority = TriggerPriority.POST + 100;
  
  condition(ctx: TriggerContext): boolean {
    const { selfEnv } = ctx;
    
    // 저격 스킬 활성화 확인
    if (!selfEnv.activatedSkills.has('저격')) {
      return false;
    }
    
    // 저격 정보 확인
    if (!selfEnv.sniperInfo) {
      return false;
    }
    
    // 중복 발동 방지
    if (selfEnv.triggeredFlags.get('저격발동')) {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { selfEnv, opposeEnv, self, oppose, rng } = ctx;
    
    // 발동 플래그 설정
    selfEnv.triggeredFlags.set('저격발동', true);
    
    const info = selfEnv.sniperInfo!;
    
    // 명성 증가
    const atmosChange = info.addAtmos;
    
    // 부상 적용 (부상무효 스킬 확인)
    let injury = 0;
    if (!opposeEnv.activatedSkills.has('부상무효')) {
      injury = rng.nextRangeInt(info.woundMin, info.woundMax);
      // 부상 최대 80 제한
      opposeEnv.injury = Math.min((opposeEnv.injury || 0) + injury, 80);
    }
    
    // 상대가 성벽(도시)인 경우 메시지 다르게
    const isCity = oppose.unitType === 'SIEGE';  // 임시 판별 (실제로는 다른 방식)
    
    if (isCity) {
      return this.triggered({
        atmosChange,
        selfMessage: `성벽 수비대장을 <C>저격</>했다!`,
      });
    }
    
    return this.triggered({
      atmosChange,
      selfMessage: `상대를 <C>저격</>했다!`,
      opposeMessage: `상대에게 <R>저격</>당했다!`,
      effects: injury > 0 ? [`${oppose.name} 부상 ${injury}`] : [],
    });
  }
}

// ============================================================================
// Export
// ============================================================================

export const sniperTriggers = [
  new SniperAttemptTrigger(),
  new SniperActivateTrigger(),
];


