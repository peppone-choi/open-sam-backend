/**
 * StrategyTrigger - 계략 트리거
 * 
 * PHP che_계략시도.php, che_계략발동.php, che_계략실패.php 참조
 * 
 * 계략: 지능 기반 특수 공격
 */

import {
  BaseTrigger,
  TriggerContext,
  TriggerResult,
  TriggerPriority,
  TriggerTiming,
} from '../TriggerManager';

// ============================================================================
// 계략 종류 및 데미지 테이블
// ============================================================================

/**
 * 대장수 계략 테이블
 * [성공 데미지 배율, 실패 데미지 배율]
 */
const STRATEGY_TABLE_GENERAL: Record<string, [number, number]> = {
  '위보': [1.2, 1.1],
  '매복': [1.4, 1.2],
  '반목': [1.6, 1.3],
  '화계': [1.8, 1.4],
  '혼란': [2.0, 1.5],
};

/**
 * 대도시 계략 테이블
 */
const STRATEGY_TABLE_CITY: Record<string, [number, number]> = {
  '급습': [1.2, 1.1],
  '위보': [1.4, 1.2],
  '혼란': [1.6, 1.3],
};

// ============================================================================
// 계략 시도 트리거
// ============================================================================

/**
 * 계략 시도 트리거
 * PHP che_계략시도.php 참조
 */
export class StrategyAttemptTrigger extends BaseTrigger {
  id = 'strategy_attempt';
  name = '계략시도';
  timing: TriggerTiming = 'on_tactics';
  priority = TriggerPriority.PRE + 300;
  
  condition(ctx: TriggerContext): boolean {
    const { selfEnv } = ctx;
    
    // 계략불가 스킬 보유시 발동 불가
    if (selfEnv.activatedSkills.has('계략불가')) {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { self, oppose, selfEnv, opposeEnv, rng, phase } = ctx;
    
    // 계략 시도 확률 계산
    let magicTrialProb = self.intelligence / 100;
    
    // 병종 계수 적용 (술사는 계략 강화)
    if (self.unitType === 'WIZARD') {
      magicTrialProb *= 1.5;
    }
    
    // 첫 페이즈 + 지능형 장수 보너스
    const rawIntel = self.intelligence;
    const allStat = self.leadership + self.strength + rawIntel;
    
    if (phase === 0 && rawIntel * 3 >= allStat) {
      magicTrialProb *= 3;
    }
    
    // 확률 판정
    if (!rng.nextBool(magicTrialProb)) {
      return this.notTriggered();
    }
    
    // 성공 확률 계산
    let magicSuccessProb = 0.7;  // 기본 70%
    
    // 지능 차이로 보정
    const intelDiff = self.intelligence - oppose.intelligence;
    magicSuccessProb += intelDiff / 200;  // 지능 차이 100당 ±50%
    magicSuccessProb = Math.max(0.2, Math.min(0.95, magicSuccessProb));
    
    // 계략 종류 선택
    const isCity = oppose.unitType === 'SIEGE';  // 임시 판별
    const table = isCity ? STRATEGY_TABLE_CITY : STRATEGY_TABLE_GENERAL;
    const magicName = rng.choice(Object.keys(table));
    const [successDamage, failDamage] = table[magicName];
    
    // 활성화 스킬 및 정보 설정
    selfEnv.activatedSkills.add('계략시도');
    selfEnv.activatedSkills.add(magicName);
    
    // 성공/실패 판정
    if (rng.nextBool(magicSuccessProb)) {
      selfEnv.activatedSkills.add('계략');
      selfEnv.magic = { name: magicName, damage: successDamage };
    } else {
      selfEnv.activatedSkills.add('계략실패');
      selfEnv.magic = { name: magicName, damage: failDamage };
    }
    
    return this.triggered({
      activateSkills: ['계략시도', magicName],
    });
  }
}

// ============================================================================
// 계략 발동 트리거
// ============================================================================

/**
 * 계략 발동 트리거
 * PHP che_계략발동.php 참조
 */
export class StrategyActivateTrigger extends BaseTrigger {
  id = 'strategy_activate';
  name = '계략발동';
  timing: TriggerTiming = 'on_tactics';
  priority = TriggerPriority.POST + 300;
  
  condition(ctx: TriggerContext): boolean {
    const { selfEnv } = ctx;
    
    // 계략 스킬 활성화 확인
    if (!selfEnv.activatedSkills.has('계략')) {
      return false;
    }
    
    // 중복 발동 방지
    if (selfEnv.triggeredFlags.get('계략발동')) {
      return false;
    }
    
    // 계략 정보 확인
    if (!selfEnv.magic) {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { selfEnv } = ctx;
    
    // 발동 플래그 설정
    selfEnv.triggeredFlags.set('계략발동', true);
    
    const magic = selfEnv.magic!;
    
    return this.triggered({
      damageMultiplier: magic.damage,
      selfMessage: `<D>${magic.name}</>을(를) <C>성공</>했다!`,
      opposeMessage: `<D>${magic.name}</>에 당했다!`,
    });
  }
}

// ============================================================================
// 계략 실패 트리거
// ============================================================================

/**
 * 계략 실패 트리거
 * PHP che_계략실패.php 참조
 */
export class StrategyFailTrigger extends BaseTrigger {
  id = 'strategy_fail';
  name = '계략실패';
  timing: TriggerTiming = 'on_tactics';
  priority = TriggerPriority.POST + 310;
  
  condition(ctx: TriggerContext): boolean {
    const { selfEnv } = ctx;
    
    // 계략실패 스킬 활성화 확인
    if (!selfEnv.activatedSkills.has('계략실패')) {
      return false;
    }
    
    // 계략 정보 확인
    if (!selfEnv.magic) {
      return false;
    }
    
    return true;
  }
  
  execute(ctx: TriggerContext): TriggerResult {
    const { selfEnv } = ctx;
    
    const magic = selfEnv.magic!;
    
    return this.triggered({
      damageMultiplier: magic.damage,  // 실패해도 약한 데미지
      selfMessage: `<D>${magic.name}</>이(가) <R>실패</>했다...`,
      opposeMessage: `상대의 <D>${magic.name}</>을(를) 막아냈다!`,
    });
  }
}

// ============================================================================
// Export
// ============================================================================

export const strategyTriggers = [
  new StrategyAttemptTrigger(),
  new StrategyActivateTrigger(),
  new StrategyFailTrigger(),
];


