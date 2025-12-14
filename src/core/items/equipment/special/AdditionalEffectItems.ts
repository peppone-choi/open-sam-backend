/**
 * AdditionalEffectItems.ts
 * 추가 특수 효과 아이템
 * 
 * PHP 참조:
 * - che_저지_삼황내문.php
 * - che_농성_주서음부.php
 * - che_농성_위공자병법.php
 * - che_공성_묵자.php
 * - che_계략_*.php
 * - che_숙련_동작.php
 */

import { ItemSlot, BattleContext } from '../types';
import { ItemBase, ItemRarity, ItemCategory } from '../ItemBase';
import { 
  SpecialItemBase, 
  IStatModifierItem, 
  IOpposeStatModifierItem,
  IDomesticModifierItem,
  IBattleTriggerItem,
  IConsumableItem
} from './SpecialItemBase';

// ============================================
// 저지 아이템
// ============================================

/**
 * 삼황내문 (저지) - PHP 호환 버전
 * 전투 수비 시 저지 효과
 */
export class SamhwangNaemunBlock extends SpecialItemBase implements IBattleTriggerItem {
  constructor() {
    super({
      id: 'che_jeoji_samhwangnaemun_block',
      rawName: '삼황내문',
      effectName: '저지',
      info: '[전투] 수비 시 첫 페이즈 저지, 50% 확률로 2 페이즈 저지',
      cost: 200,
      consumable: false
    });
  }

  getBattlePhaseSkillTriggerList(ctx: BattleContext): unknown {
    // 수비 시에만 발동 (attacker가 자신이 아닌 경우)
    // 첫 페이즈에만 발동 (phase가 문자열이 아닌 경우에만 숫자 비교)
    const phase = typeof ctx.phase === 'string' ? 0 : (ctx.phase as unknown as number);
    if (phase > 0) return null;
    
    return { skill: '저지', type: 'block' };
  }
}

// ============================================
// 농성 아이템
// ============================================

/**
 * 주서음부 (농성)
 * 계략 방어 효과
 */
export class JuseoEumbu extends SpecialItemBase implements IStatModifierItem, IOpposeStatModifierItem {
  constructor() {
    super({
      id: 'che_nongseong_juseoeumbu',
      rawName: '주서음부',
      effectName: '농성',
      info: '[계략] 장수 주둔 도시 화계·탈취·파괴·선동 : 성공률 -30%p\n[전투] 상대 계략 시도 확률 -10%p, 상대 계략 성공 확률 -10%p',
      cost: 200,
      consumable: false
    });
  }

  onCalcStat(statName: string, value: number, aux?: unknown): number {
    if (statName === 'sabotageDefence') {
      return value + 0.3;
    }
    return value;
  }

  onCalcOpposeStat(statName: string, value: number, aux?: unknown): number {
    if (statName === 'warMagicTrialProb') {
      return value - 0.1;
    }
    if (statName === 'warMagicSuccessProb') {
      return value - 0.1;
    }
    return value;
  }
}

/**
 * 위공자병법 (농성)
 * 계략 방어 효과
 */
export class WigongjaByeongbeop extends SpecialItemBase implements IStatModifierItem, IOpposeStatModifierItem {
  constructor() {
    super({
      id: 'che_nongseong_wigongjabyeongbeop',
      rawName: '위공자병법',
      effectName: '농성',
      info: '[계략] 장수 주둔 도시 화계·탈취·파괴·선동 : 성공률 -30%p\n[전투] 상대 계략 시도 확률 -10%p, 상대 계략 성공 확률 -10%p',
      cost: 200,
      consumable: false
    });
  }

  onCalcStat(statName: string, value: number, aux?: unknown): number {
    if (statName === 'sabotageDefence') {
      return value + 0.3;
    }
    return value;
  }

  onCalcOpposeStat(statName: string, value: number, aux?: unknown): number {
    if (statName === 'warMagicTrialProb') {
      return value - 0.1;
    }
    if (statName === 'warMagicSuccessProb') {
      return value - 0.1;
    }
    return value;
  }
}

// ============================================
// 공성 아이템
// ============================================

/**
 * 묵자 (공성)
 * 성벽 공격 시 대미지 증가
 */
export class Mukja extends SpecialItemBase {
  constructor() {
    super({
      id: 'che_gongseong_mukja',
      rawName: '묵자',
      effectName: '공성',
      info: '[전투] 성벽 공격 시 대미지 +50%',
      cost: 200,
      consumable: false
    });
  }

  override getWarPowerMultiplier(ctx: BattleContext): [number, number] {
    // 상대가 성벽인 경우
    if (ctx.terrain === 'city' || ctx.terrain === 'fort') {
      return [1.5, 1];
    }
    return [1, 1];
  }
}

// ============================================
// 계략 아이템
// ============================================

/**
 * 향낭 (계략)
 * 소모품 - 계략 성공률 +50%p
 */
export class Hyangnang extends SpecialItemBase implements IDomesticModifierItem, IConsumableItem {
  constructor() {
    super({
      id: 'che_gyeryak_hyangnang',
      rawName: '향낭',
      effectName: '계략',
      info: '[계략] 화계·탈취·파괴·선동 : 성공률 +50%p',
      cost: 3000,
      consumable: true,
      buyable: true,
      reqSecu: 2000
    });
  }

  onCalcDomestic(turnType: string, varType: string, value: number, aux?: unknown): number {
    if (turnType === '계략' && varType === 'success') {
      return value + 0.5;
    }
    return value;
  }

  tryConsumeNow(actionType: string, command: string): boolean {
    return actionType === 'GeneralCommand' && command === '계략';
  }
}

/**
 * 이추 (계략)
 * 소모품 - 계략 성공률 +20%p
 */
export class Ichu extends SpecialItemBase implements IDomesticModifierItem, IConsumableItem {
  constructor() {
    super({
      id: 'che_gyeryak_ichu',
      rawName: '이추',
      effectName: '계략',
      info: '[계략] 화계·탈취·파괴·선동 : 성공률 +20%p',
      cost: 1000,
      consumable: true,
      buyable: true,
      reqSecu: 1000
    });
  }

  onCalcDomestic(turnType: string, varType: string, value: number, aux?: unknown): number {
    if (turnType === '계략' && varType === 'success') {
      return value + 0.2;
    }
    return value;
  }

  tryConsumeNow(actionType: string, command: string): boolean {
    return actionType === 'GeneralCommand' && command === '계략';
  }
}

/**
 * 육도 (계략)
 * 계략 성공률 +20%p, 전투 계략 확률 증가
 */
export class Yukdo extends SpecialItemBase implements IStatModifierItem, IDomesticModifierItem {
  constructor() {
    super({
      id: 'che_gyeryak_yukdo',
      rawName: '육도',
      effectName: '계략',
      info: '[계략] 화계·탈취·파괴·선동 : 성공률 +20%p\n[전투] 계략 시도 확률 +10%p, 계략 성공 확률 +10%p',
      cost: 200,
      consumable: false
    });
  }

  onCalcDomestic(turnType: string, varType: string, value: number, aux?: unknown): number {
    if (turnType === '계략' && varType === 'success') {
      return value + 0.2;
    }
    return value;
  }

  onCalcStat(statName: string, value: number, aux?: unknown): number {
    if (statName === 'warMagicTrialProb') {
      return value + 0.1;
    }
    if (statName === 'warMagicSuccessProb') {
      return value + 0.1;
    }
    return value;
  }
}

/**
 * 삼략 (계략)
 * 계략 성공률 +20%p, 전투 계략 확률 증가
 */
export class Samryak extends SpecialItemBase implements IStatModifierItem, IDomesticModifierItem {
  constructor() {
    super({
      id: 'che_gyeryak_samryak',
      rawName: '삼략',
      effectName: '계략',
      info: '[계략] 화계·탈취·파괴·선동 : 성공률 +20%p\n[전투] 계략 시도 확률 +10%p, 계략 성공 확률 +10%p',
      cost: 200,
      consumable: false
    });
  }

  onCalcDomestic(turnType: string, varType: string, value: number, aux?: unknown): number {
    if (turnType === '계략' && varType === 'success') {
      return value + 0.2;
    }
    return value;
  }

  onCalcStat(statName: string, value: number, aux?: unknown): number {
    if (statName === 'warMagicTrialProb') {
      return value + 0.1;
    }
    if (statName === 'warMagicSuccessProb') {
      return value + 0.1;
    }
    return value;
  }
}

// ============================================
// 숙련 아이템
// ============================================

/**
 * 동작 (숙련)
 * 숙련 획득 +20%
 */
export class Dongjak extends SpecialItemBase implements IStatModifierItem {
  constructor() {
    super({
      id: 'che_sukryeon_dongjak',
      rawName: '동작',
      effectName: '숙련',
      info: '숙련 +20%',
      cost: 200,
      consumable: false
    });
  }

  onCalcStat(statName: string, value: number, aux?: unknown): number {
    if (statName === 'addDex') {
      return value * 1.20;
    }
    return value;
  }
}

// ============================================
// 내보내기
// ============================================

export const AdditionalEffectItemCreators = {
  // 저지
  samhwangNaemunBlock: () => new SamhwangNaemunBlock(),
  
  // 농성
  juseoEumbu: () => new JuseoEumbu(),
  wigongjaByeongbeop: () => new WigongjaByeongbeop(),
  
  // 공성
  mukja: () => new Mukja(),
  
  // 계략
  hyangnang: () => new Hyangnang(),
  ichu: () => new Ichu(),
  yukdo: () => new Yukdo(),
  samryak: () => new Samryak(),
  
  // 숙련
  dongjak: () => new Dongjak()
};

