/**
 * StatBoostItems.ts
 * 능력치 부스트 특수 아이템
 * 
 * PHP 참조:
 * - che_능력치_무력_두강주.php
 * - che_능력치_지력_이강주.php
 * - che_능력치_통솔_보령압주.php
 * - che_상성보정_과실주.php
 * - che_명성_구석.php
 * - che_숙련_동작.php
 */

import { SpecialItemBase, IStatModifierItem } from './SpecialItemBase';
import { ItemRarity } from '../ItemBase';

// ============================================
// 능력치 부스트 아이템
// ============================================

/**
 * 두강주(무력) - 무력 +3
 */
export class DugangJuStrength extends SpecialItemBase implements IStatModifierItem {
  constructor() {
    super({
      id: 'special_stat_dugangju_strength',
      rawName: '두강주',
      effectName: '무력',
      info: '[능력치] 무력 +3',
      cost: 200,
      rarity: ItemRarity.LEGENDARY
    });
  }

  override onCalcStat(statName: string, value: number): number {
    if (statName === 'strength') {
      return value + 3;
    }
    return value;
  }
}

/**
 * 이강주(지력) - 지력 +3
 */
export class IgangJuIntel extends SpecialItemBase implements IStatModifierItem {
  constructor() {
    super({
      id: 'special_stat_igangju_intel',
      rawName: '이강주',
      effectName: '지력',
      info: '[능력치] 지력 +3',
      cost: 200,
      rarity: ItemRarity.LEGENDARY
    });
  }

  override onCalcStat(statName: string, value: number): number {
    if (statName === 'intel') {
      return value + 3;
    }
    return value;
  }
}

/**
 * 보령압주(통솔) - 통솔 +3
 */
export class BoryeongApJuLeadership extends SpecialItemBase implements IStatModifierItem {
  constructor() {
    super({
      id: 'special_stat_boryeongapju_leadership',
      rawName: '보령압주',
      effectName: '통솔',
      info: '[능력치] 통솔 +3',
      cost: 200,
      rarity: ItemRarity.LEGENDARY
    });
  }

  override onCalcStat(statName: string, value: number): number {
    if (statName === 'leadership') {
      return value + 3;
    }
    return value;
  }
}

// ============================================
// 상성 보정 아이템
// ============================================

/**
 * 과실주(상성보정) - 병종 상성 보정
 */
export class GwasilJuPhaseBonus extends SpecialItemBase implements IStatModifierItem {
  constructor() {
    super({
      id: 'special_phase_gwasiju',
      rawName: '과실주',
      effectName: '상성보정',
      info: '[전투] 병종 상성 피해 -30%',
      cost: 200,
      rarity: ItemRarity.EPIC
    });
  }

  override onCalcStat(statName: string, value: number): number {
    if (statName === 'phaseDamageReduction') {
      return value + 0.3;
    }
    return value;
  }
}

// ============================================
// 명성 아이템
// ============================================

/**
 * 구석(명성) - 명성 획득량 증가
 */
export class GuSeok extends SpecialItemBase implements IStatModifierItem {
  constructor() {
    super({
      id: 'special_fame_guseok',
      rawName: '구석',
      effectName: '명성',
      info: '[군사] 명성 획득량 +20%',
      cost: 200,
      rarity: ItemRarity.LEGENDARY
    });
  }

  override onCalcStat(statName: string, value: number): number {
    if (statName === 'fameGain') {
      return value * 1.2;
    }
    return value;
  }
}

// ============================================
// 숙련 아이템
// ============================================

/**
 * 동작(숙련) - 숙련도 획득량 증가
 */
export class DongJak extends SpecialItemBase implements IStatModifierItem {
  constructor() {
    super({
      id: 'special_proficiency_dongjak',
      rawName: '동작',
      effectName: '숙련',
      info: '[군사] 숙련도 획득량 +20%',
      cost: 200,
      rarity: ItemRarity.LEGENDARY
    });
  }

  override onCalcStat(statName: string, value: number): number {
    if (statName === 'proficiencyGain') {
      return value * 1.2;
    }
    return value;
  }
}

// ============================================
// 내보내기
// ============================================

export const StatBoostItemCreators = {
  // 능력치 부스트
  dugangJuStrength: () => new DugangJuStrength(),
  igangJuIntel: () => new IgangJuIntel(),
  boryeongApJuLeadership: () => new BoryeongApJuLeadership(),
  
  // 상성 보정
  gwasilJuPhaseBonus: () => new GwasilJuPhaseBonus(),
  
  // 명성
  guSeok: () => new GuSeok(),
  
  // 숙련
  dongJak: () => new DongJak()
};




