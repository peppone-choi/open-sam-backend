/**
 * SupportEffectItems.ts
 * 지원/보조 효과 특수 아이템 (의술, 훈련, 사기, 내정)
 * 
 * PHP 참조:
 * - che_의술_청낭서.php
 * - che_의술_상한잡병론.php
 * - che_의술_정력견혈산.php
 * - che_의술_태평청령.php
 * - che_훈련_과실주.php
 * - che_훈련_단결도.php
 * - che_훈련_이강주.php
 * - che_훈련_철벽서.php
 * - che_훈련_청주.php
 * - che_사기_*.php
 * - che_내정_납금박산로.php
 */

import { SpecialItemBase, IBattleTriggerItem, IStatModifierItem } from './SpecialItemBase';
import { ItemRarity } from '../ItemBase';

// ============================================
// 의술 아이템
// ============================================

/**
 * 청낭서(의술) - 부상 회복 + 전투 치료
 */
export class CheongnangSeo extends SpecialItemBase implements IBattleTriggerItem {
  constructor() {
    super({
      id: 'special_uisul_cheongnangseo',
      rawName: '청낭서',
      effectName: '의술',
      info: '[군사] 매 턴마다 자신(100%)과 소속 도시 장수(적 포함 50%) 부상 회복\n[전투] 페이즈마다 40% 확률로 치료 발동(아군 피해 30% 감소, 부상 회복)',
      cost: 200,
      rarity: ItemRarity.LEGENDARY
    });
  }

  getBattlePhaseSkillTriggerList(unit: unknown): unknown {
    // 전투치료시도, 전투치료발동 트리거
    return null;
  }
}

/**
 * 상한잡병론(의술) - 부상 회복
 */
export class SanghanJapbyeongRon extends SpecialItemBase {
  constructor() {
    super({
      id: 'special_uisul_sanghanjapbyeongron',
      rawName: '상한잡병론',
      effectName: '의술',
      info: '[군사] 매 턴마다 자신(100%)과 소속 도시 아군 장수(50%) 부상 회복',
      cost: 200,
      rarity: ItemRarity.EPIC
    });
  }
}

/**
 * 정력견혈산(의술) - 부상 면역
 */
export class JeongryeokGyeonhyeolSan extends SpecialItemBase {
  constructor() {
    super({
      id: 'special_uisul_jeongryeokgyeonhyeolsan',
      rawName: '정력견혈산',
      effectName: '의술',
      info: '[군사] 부상 면역',
      cost: 200,
      rarity: ItemRarity.EPIC
    });
  }
}

/**
 * 태평청령(의술) - 소속 도시 장수 부상 회복
 */
export class TaepyeongCheongryeong extends SpecialItemBase {
  constructor() {
    super({
      id: 'special_uisul_taepyeongcheongryeong',
      rawName: '태평청령',
      effectName: '의술',
      info: '[군사] 매 턴마다 소속 도시 장수(적 포함) 부상 회복(30%)',
      cost: 200,
      rarity: ItemRarity.RARE
    });
  }
}

// ============================================
// 훈련 아이템
// ============================================

/**
 * 과실주(훈련) - 훈련 보정 +10
 */
export class GwasilJu extends SpecialItemBase implements IStatModifierItem {
  constructor() {
    super({
      id: 'special_hullyeon_gwasiju',
      rawName: '과실주',
      effectName: '훈련',
      info: '[전투] 훈련 보정 +10',
      cost: 200,
      rarity: ItemRarity.LEGENDARY
    });
  }

  override onCalcStat(statName: string, value: number): number {
    if (statName === 'bonusTrain') {
      return value + 10;
    }
    return value;
  }
}

/**
 * 단결도(훈련) - 훈련 보정 +7
 */
export class DangyeolDo extends SpecialItemBase implements IStatModifierItem {
  constructor() {
    super({
      id: 'special_hullyeon_dangyeoldo',
      rawName: '단결도',
      effectName: '훈련',
      info: '[전투] 훈련 보정 +7',
      cost: 200,
      rarity: ItemRarity.EPIC
    });
  }

  override onCalcStat(statName: string, value: number): number {
    if (statName === 'bonusTrain') {
      return value + 7;
    }
    return value;
  }
}

/**
 * 이강주(훈련) - 훈련 보정 +5
 */
export class IgangJu extends SpecialItemBase implements IStatModifierItem {
  constructor() {
    super({
      id: 'special_hullyeon_igangju',
      rawName: '이강주',
      effectName: '훈련',
      info: '[전투] 훈련 보정 +5',
      cost: 200,
      rarity: ItemRarity.RARE
    });
  }

  override onCalcStat(statName: string, value: number): number {
    if (statName === 'bonusTrain') {
      return value + 5;
    }
    return value;
  }
}

/**
 * 철벽서(훈련) - 훈련 보정 +3
 */
export class CheolbyeokSeo extends SpecialItemBase implements IStatModifierItem {
  constructor() {
    super({
      id: 'special_hullyeon_cheolbyeokseo',
      rawName: '철벽서',
      effectName: '훈련',
      info: '[전투] 훈련 보정 +3',
      cost: 200,
      rarity: ItemRarity.UNCOMMON
    });
  }

  override onCalcStat(statName: string, value: number): number {
    if (statName === 'bonusTrain') {
      return value + 3;
    }
    return value;
  }
}

/**
 * 청주(훈련) - 훈련 보정 +1
 */
export class CheongJu extends SpecialItemBase implements IStatModifierItem {
  constructor() {
    super({
      id: 'special_hullyeon_cheongju',
      rawName: '청주',
      effectName: '훈련',
      info: '[전투] 훈련 보정 +1',
      cost: 1000,
      buyable: true,
      reqSecu: 1000,
      rarity: ItemRarity.COMMON
    });
  }

  override onCalcStat(statName: string, value: number): number {
    if (statName === 'bonusTrain') {
      return value + 1;
    }
    return value;
  }
}

// ============================================
// 사기 아이템
// ============================================

/**
 * 두강주(사기) - 사기 보정 +10
 */
export class DugangJuSagi extends SpecialItemBase implements IStatModifierItem {
  constructor() {
    super({
      id: 'special_sagi_dugangju',
      rawName: '두강주',
      effectName: '사기',
      info: '[전투] 사기 보정 +10',
      cost: 200,
      rarity: ItemRarity.LEGENDARY
    });
  }

  override onCalcStat(statName: string, value: number): number {
    if (statName === 'bonusAtmos') {
      return value + 10;
    }
    return value;
  }
}

/**
 * 보령압주(사기) - 사기 보정 +7
 */
export class BoryeongApJuSagi extends SpecialItemBase implements IStatModifierItem {
  constructor() {
    super({
      id: 'special_sagi_boryeongapju',
      rawName: '보령압주',
      effectName: '사기',
      info: '[전투] 사기 보정 +7',
      cost: 200,
      rarity: ItemRarity.EPIC
    });
  }

  override onCalcStat(statName: string, value: number): number {
    if (statName === 'bonusAtmos') {
      return value + 7;
    }
    return value;
  }
}

/**
 * 의적주(사기) - 사기 보정 +5
 */
export class UijeokJu extends SpecialItemBase implements IStatModifierItem {
  constructor() {
    super({
      id: 'special_sagi_uijeokju',
      rawName: '의적주',
      effectName: '사기',
      info: '[전투] 사기 보정 +5',
      cost: 200,
      rarity: ItemRarity.RARE
    });
  }

  override onCalcStat(statName: string, value: number): number {
    if (statName === 'bonusAtmos') {
      return value + 5;
    }
    return value;
  }
}

/**
 * 탁주(사기) - 사기 보정 +1
 */
export class TakJu extends SpecialItemBase implements IStatModifierItem {
  constructor() {
    super({
      id: 'special_sagi_takju',
      rawName: '탁주',
      effectName: '사기',
      info: '[전투] 사기 보정 +1',
      cost: 1000,
      buyable: true,
      reqSecu: 1000,
      rarity: ItemRarity.COMMON
    });
  }

  override onCalcStat(statName: string, value: number): number {
    if (statName === 'bonusAtmos') {
      return value + 1;
    }
    return value;
  }
}

/**
 * 초선화(사기) - 사기 보정 +3
 */
export class ChoSeonHwa extends SpecialItemBase implements IStatModifierItem {
  constructor() {
    super({
      id: 'special_sagi_choseonhwa',
      rawName: '초선화',
      effectName: '사기',
      info: '[전투] 사기 보정 +3',
      cost: 200,
      rarity: ItemRarity.UNCOMMON
    });
  }

  override onCalcStat(statName: string, value: number): number {
    if (statName === 'bonusAtmos') {
      return value + 3;
    }
    return value;
  }
}

/**
 * 춘화첩(사기) - 사기 보정 +5
 */
export class ChunHwaCheop extends SpecialItemBase implements IStatModifierItem {
  constructor() {
    super({
      id: 'special_sagi_chunhwacheop',
      rawName: '춘화첩',
      effectName: '사기',
      info: '[전투] 사기 보정 +5',
      cost: 200,
      rarity: ItemRarity.RARE
    });
  }

  override onCalcStat(statName: string, value: number): number {
    if (statName === 'bonusAtmos') {
      return value + 5;
    }
    return value;
  }
}

// ============================================
// 내정 아이템
// ============================================

/**
 * 납금박산로(내정) - 내정 효율 증가
 */
export class NapgeumBaksanRo extends SpecialItemBase {
  constructor() {
    super({
      id: 'special_naejeong_napgeumbaksanro',
      rawName: '납금박산로',
      effectName: '내정',
      info: '[내정] 농업/상업/기술 투자 시 효율 +30%',
      cost: 200,
      rarity: ItemRarity.LEGENDARY
    });
  }

  override onCalcDomestic(turnType: string, varType: string, value: number): number {
    if (['농업', '상업', '기술'].includes(turnType) && varType === 'score') {
      return value * 1.3;
    }
    return value;
  }
}

// ============================================
// 내보내기
// ============================================

export const SupportEffectItemCreators = {
  // 의술
  cheongnangSeo: () => new CheongnangSeo(),
  sanghanJapbyeongRon: () => new SanghanJapbyeongRon(),
  jeongryeokGyeonhyeolSan: () => new JeongryeokGyeonhyeolSan(),
  taepyeongCheongryeong: () => new TaepyeongCheongryeong(),
  
  // 훈련
  gwasilJu: () => new GwasilJu(),
  dangyeolDo: () => new DangyeolDo(),
  igangJu: () => new IgangJu(),
  cheolbyeokSeo: () => new CheolbyeokSeo(),
  cheongJu: () => new CheongJu(),
  
  // 사기
  dugangJuSagi: () => new DugangJuSagi(),
  boryeongApJuSagi: () => new BoryeongApJuSagi(),
  uijeokJu: () => new UijeokJu(),
  takJu: () => new TakJu(),
  choSeonHwa: () => new ChoSeonHwa(),
  chunHwaCheop: () => new ChunHwaCheop(),
  
  // 내정
  napgeumBaksanRo: () => new NapgeumBaksanRo()
};










