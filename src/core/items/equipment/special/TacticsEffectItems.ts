/**
 * TacticsEffectItems.ts
 * 계략/전술 효과 특수 아이템 (집중, 환술, 저격)
 * 
 * PHP 참조:
 * - che_집중_전국책.php
 * - che_환술_논어집해.php
 * - che_저격_매화수전.php
 * - che_저격_비도.php
 * - che_저격_수극.php
 */

import { SpecialItemBase, IBattleTriggerItem, IStatModifierItem } from './SpecialItemBase';
import { ItemRarity } from '../ItemBase';

// ============================================
// 집중 아이템 (계략 대미지 증가)
// ============================================

/**
 * 전국책(집중) - 계략 성공 시 대미지 +30%
 */
export class JeongukChaek extends SpecialItemBase implements IStatModifierItem {
  constructor() {
    super({
      id: 'special_jipjung_jeongukcheak',
      rawName: '전국책',
      effectName: '집중',
      info: '[전투] 계략 성공 시 대미지 +30%',
      cost: 200,
      rarity: ItemRarity.LEGENDARY
    });
  }

  override onCalcStat(statName: string, value: number): number {
    if (statName === 'warMagicSuccessDamage') {
      return value * 1.3;
    }
    return value;
  }
}

// ============================================
// 환술 아이템 (계략 성공률/대미지 증가)
// ============================================

/**
 * 논어집해(환술) - 계략 성공 확률 +10%p, 대미지 +20%
 */
export class NoneojipHae extends SpecialItemBase implements IStatModifierItem {
  constructor() {
    super({
      id: 'special_hwansul_noneojiphae',
      rawName: '논어집해',
      effectName: '환술',
      info: '[전투] 계략 성공 확률 +10%p, 계략 성공 시 대미지 +20%',
      cost: 200,
      rarity: ItemRarity.LEGENDARY
    });
  }

  override onCalcStat(statName: string, value: number): number {
    if (statName === 'warMagicSuccessProb') {
      return value + 0.1;
    }
    if (statName === 'warMagicSuccessDamage') {
      return value * 1.2;
    }
    return value;
  }
}

// ============================================
// 저격 아이템 (초반 기습)
// ============================================

/**
 * 매화수전(저격) - 새로운 상대와 전투 시 50% 확률로 저격 발동
 */
export class MaehwaSujeon extends SpecialItemBase implements IBattleTriggerItem {
  constructor() {
    super({
      id: 'special_jeogyeok_maehwasujeon',
      rawName: '매화수전',
      effectName: '저격',
      info: '[전투] 새로운 상대와 전투 시 50% 확률로 저격 발동, 성공 시 사기+20',
      cost: 200,
      rarity: ItemRarity.LEGENDARY
    });
  }

  getBattlePhaseSkillTriggerList(unit: unknown): unknown {
    // 저격 트리거 (50% 확률, 사기+20, 대미지 40)
    return null;
  }
}

/**
 * 비도(저격) - 새로운 상대와 전투 시 40% 확률로 저격 발동
 */
export class Bido extends SpecialItemBase implements IBattleTriggerItem {
  constructor() {
    super({
      id: 'special_jeogyeok_bido',
      rawName: '비도',
      effectName: '저격',
      info: '[전투] 새로운 상대와 전투 시 40% 확률로 저격 발동, 성공 시 사기+15',
      cost: 200,
      rarity: ItemRarity.EPIC
    });
  }

  getBattlePhaseSkillTriggerList(unit: unknown): unknown {
    // 저격 트리거 (40% 확률, 사기+15, 대미지 30)
    return null;
  }
}

/**
 * 수극(저격) - 새로운 상대와 전투 시 35% 확률로 저격 발동
 */
export class Sugeuk extends SpecialItemBase implements IBattleTriggerItem {
  constructor() {
    super({
      id: 'special_jeogyeok_sugeuk',
      rawName: '수극',
      effectName: '저격',
      info: '[전투] 새로운 상대와 전투 시 35% 확률로 저격 발동, 성공 시 사기+10',
      cost: 200,
      rarity: ItemRarity.RARE
    });
  }

  getBattlePhaseSkillTriggerList(unit: unknown): unknown {
    // 저격 트리거 (35% 확률, 사기+10, 대미지 25)
    return null;
  }
}

// ============================================
// 내보내기
// ============================================

export const TacticsEffectItemCreators = {
  // 집중
  jeongukChaek: () => new JeongukChaek(),
  
  // 환술
  noneojipHae: () => new NoneojipHae(),
  
  // 저격
  maehwaSujeon: () => new MaehwaSujeon(),
  bido: () => new Bido(),
  sugeuk: () => new Sugeuk()
};




