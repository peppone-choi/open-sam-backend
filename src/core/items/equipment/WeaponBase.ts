/**
 * WeaponBase.ts
 * 무기 아이템 기본 클래스
 * 
 * PHP 참조: core/hwe/sammo/ActionItem/che_무기_*.php
 */

import { ItemSlot, BattleContext } from './types';
import { ItemBase, StatItemBase, ItemRarity, ItemCategory, ItemConfig, ItemEffect } from './ItemBase';

// ============================================
// 무기 타입 정의
// ============================================

export enum WeaponType {
  SWORD = 'sword',       // 검
  BLADE = 'blade',       // 도
  SPEAR = 'spear',       // 창
  HALBERD = 'halberd',   // 극/화극
  BOW = 'bow',           // 궁
  AXE = 'axe',           // 부
  HAMMER = 'hammer',     // 추
  WHIP = 'whip',         // 편/철쇄
  SPECIAL = 'special'    // 특수
}

export interface WeaponConfig {
  id: string;
  rawName: string;
  name?: string;
  description?: string;
  weaponType: WeaponType;
  statValue: number;     // 무력 보너스
  rarity?: ItemRarity;
  cost: number;
  buyable?: boolean;
  reqSecu?: number;
  additionalEffect?: Partial<ItemEffect>;
}

// ============================================
// 무기 기본 클래스
// ============================================

export class WeaponBase extends StatItemBase {
  readonly weaponType: WeaponType;

  constructor(config: WeaponConfig) {
    super({
      id: config.id,
      rawName: config.rawName,
      statType: 'strength',
      statValue: config.statValue,
      cost: config.cost,
      buyable: config.buyable ?? true,
      reqSecu: config.reqSecu,
      slot: ItemSlot.WEAPON,
      category: ItemCategory.WEAPON,
      rarity: config.rarity ?? WeaponBase.getRarityFromValue(config.statValue)
    });

    this.weaponType = config.weaponType;

    // 추가 효과가 있으면 병합
    if (config.additionalEffect) {
      Object.assign(this.effect, config.additionalEffect);
    }
  }

  static getRarityFromValue(value: number): ItemRarity {
    if (value >= 15) return ItemRarity.LEGENDARY;
    if (value >= 13) return ItemRarity.EPIC;
    if (value >= 10) return ItemRarity.RARE;
    if (value >= 7) return ItemRarity.UNCOMMON;
    return ItemRarity.COMMON;
  }

  getWeaponTypeLabel(): string {
    const labels: Record<WeaponType, string> = {
      [WeaponType.SWORD]: '검',
      [WeaponType.BLADE]: '도',
      [WeaponType.SPEAR]: '창',
      [WeaponType.HALBERD]: '극',
      [WeaponType.BOW]: '궁',
      [WeaponType.AXE]: '부',
      [WeaponType.HAMMER]: '추',
      [WeaponType.WHIP]: '편',
      [WeaponType.SPECIAL]: '특수'
    };
    return labels[this.weaponType];
  }
}

// ============================================
// 전설급 무기 클래스
// ============================================

export interface LegendaryWeaponConfig extends WeaponConfig {
  legendaryEffect?: {
    criticalBonus?: number;
    attackMultiplier?: number;
    specialAbility?: string[];
  };
}

export class LegendaryWeapon extends WeaponBase {
  readonly legendaryEffect?: {
    criticalBonus?: number;
    attackMultiplier?: number;
    specialAbility?: string[];
  };

  constructor(config: LegendaryWeaponConfig) {
    super({
      ...config,
      rarity: ItemRarity.LEGENDARY,
      buyable: false
    });

    this.legendaryEffect = config.legendaryEffect;
  }

  override onCalcBattleStat(statName: string, value: number): number {
    let result = super.onCalcBattleStat(statName, value);
    
    if (this.legendaryEffect) {
      if (statName === 'critical' && this.legendaryEffect.criticalBonus) {
        result += this.legendaryEffect.criticalBonus;
      }
    }

    return result;
  }

  override getWarPowerMultiplier(ctx: BattleContext): [number, number] {
    if (this.legendaryEffect?.attackMultiplier) {
      return [this.legendaryEffect.attackMultiplier, 1];
    }
    return [1, 1];
  }
}

// ============================================
// 전설 무기 인스턴스 생성 함수
// ============================================

// 청룡언월도 (관우의 명물)
export function createCheongryongUnwoldo(): LegendaryWeapon {
  return new LegendaryWeapon({
    id: 'weapon_legendary_cheongryong_unwoldo',
    rawName: '청룡언월도',
    name: '청룡언월도(+15)',
    description: '무력 +15, 필살 확률 +10%',
    weaponType: WeaponType.BLADE,
    statValue: 15,
    cost: 200,
    legendaryEffect: {
      criticalBonus: 0.1,
      specialAbility: ['청룡의 기세']
    }
  });
}

// 방천화극 (여포의 명물)
export function createBangcheonHwageuk(): LegendaryWeapon {
  return new LegendaryWeapon({
    id: 'weapon_legendary_bangcheon_hwageuk',
    rawName: '방천화극',
    name: '방천화극(+14)',
    description: '무력 +14, 공격력 +20%',
    weaponType: WeaponType.HALBERD,
    statValue: 14,
    cost: 200,
    legendaryEffect: {
      attackMultiplier: 1.2,
      specialAbility: ['천하무적']
    }
  });
}

// 의천검 (조조의 명물)
export function createUicheonGeom(): LegendaryWeapon {
  return new LegendaryWeapon({
    id: 'weapon_legendary_uicheon_geom',
    rawName: '의천검',
    name: '의천검(+15)',
    description: '무력 +15, 필살 확률 +5%',
    weaponType: WeaponType.SWORD,
    statValue: 15,
    cost: 200,
    legendaryEffect: {
      criticalBonus: 0.05,
      specialAbility: ['천자의 검']
    }
  });
}

// 청홍검 (유비의 명물 - 쌍검)
export function createCheonghongGeom(): LegendaryWeapon {
  return new LegendaryWeapon({
    id: 'weapon_legendary_cheonghong_geom',
    rawName: '청홍검',
    name: '청홍검(+15)',
    description: '무력 +15, 연속 공격 확률 +10%',
    weaponType: WeaponType.SWORD,
    statValue: 15,
    cost: 200,
    legendaryEffect: {
      criticalBonus: 0.1,
      specialAbility: ['쌍검술']
    }
  });
}

// 언월도 (명물급)
export function createUnwoldo(): LegendaryWeapon {
  return new LegendaryWeapon({
    id: 'weapon_legendary_unwoldo',
    rawName: '언월도',
    name: '언월도(+14)',
    description: '무력 +14',
    weaponType: WeaponType.BLADE,
    statValue: 14,
    cost: 200
  });
}

// 칠성검 (명물급)
export function createChilseongGeom(): WeaponBase {
  return new WeaponBase({
    id: 'weapon_epic_chilseong_geom',
    rawName: '칠성검',
    weaponType: WeaponType.SWORD,
    statValue: 12,
    rarity: ItemRarity.EPIC,
    cost: 200,
    buyable: false
  });
}

// 철척사모 (명물급)
export function createCheolcheokSamo(): WeaponBase {
  return new WeaponBase({
    id: 'weapon_epic_cheolcheok_samo',
    rawName: '철척사모',
    weaponType: WeaponType.SPEAR,
    statValue: 12,
    rarity: ItemRarity.EPIC,
    cost: 200,
    buyable: false
  });
}

// 양유기궁
export function createYangyugiGung(): WeaponBase {
  return new WeaponBase({
    id: 'weapon_epic_yangyugi_gung',
    rawName: '양유기궁',
    weaponType: WeaponType.BOW,
    statValue: 13,
    rarity: ItemRarity.EPIC,
    cost: 200,
    buyable: false
  });
}

// 사모 (명물급)
export function createSamo(): WeaponBase {
  return new WeaponBase({
    id: 'weapon_epic_samo',
    rawName: '사모',
    weaponType: WeaponType.SPEAR,
    statValue: 13,
    rarity: ItemRarity.EPIC,
    cost: 200,
    buyable: false
  });
}

// 이광궁
export function createIgwangGung(): WeaponBase {
  return new WeaponBase({
    id: 'weapon_rare_igwang_gung',
    rawName: '이광궁',
    weaponType: WeaponType.BOW,
    statValue: 11,
    rarity: ItemRarity.RARE,
    cost: 200,
    buyable: false
  });
}

// 고정도
export function createGojeongdo(): WeaponBase {
  return new WeaponBase({
    id: 'weapon_rare_gojeongdo',
    rawName: '고정도',
    weaponType: WeaponType.BLADE,
    statValue: 11,
    rarity: ItemRarity.RARE,
    cost: 200,
    buyable: false
  });
}

// ============================================
// 일반 무기 생성 함수
// ============================================

// 단도 (레벨 1)
export function createDando(): WeaponBase {
  return new WeaponBase({
    id: 'weapon_01_dando',
    rawName: '단도',
    weaponType: WeaponType.BLADE,
    statValue: 1,
    cost: 1000,
    buyable: true,
    reqSecu: 1000
  });
}

// 단궁 (레벨 2)
export function createDangung(): WeaponBase {
  return new WeaponBase({
    id: 'weapon_02_dangung',
    rawName: '단궁',
    weaponType: WeaponType.BOW,
    statValue: 2,
    cost: 1000,
    buyable: true,
    reqSecu: 1000
  });
}

// 단극 (레벨 3)
export function createDangeuk(): WeaponBase {
  return new WeaponBase({
    id: 'weapon_03_dangeuk',
    rawName: '단극',
    weaponType: WeaponType.HALBERD,
    statValue: 3,
    cost: 1000,
    buyable: true,
    reqSecu: 1000
  });
}

// 목검 (레벨 4)
export function createMokgeom(): WeaponBase {
  return new WeaponBase({
    id: 'weapon_04_mokgeom',
    rawName: '목검',
    weaponType: WeaponType.SWORD,
    statValue: 4,
    cost: 1000,
    buyable: true,
    reqSecu: 1000
  });
}

// 죽창 (레벨 5)
export function createJukchang(): WeaponBase {
  return new WeaponBase({
    id: 'weapon_05_jukchang',
    rawName: '죽창',
    weaponType: WeaponType.SPEAR,
    statValue: 5,
    cost: 1000,
    buyable: true,
    reqSecu: 1000
  });
}

// 소부 (레벨 6)
export function createSobu(): WeaponBase {
  return new WeaponBase({
    id: 'weapon_06_sobu',
    rawName: '소부',
    weaponType: WeaponType.AXE,
    statValue: 6,
    cost: 1000,
    buyable: true,
    reqSecu: 1000
  });
}

// 맥궁 (레벨 7)
export function createMaekgung(): WeaponBase {
  return new WeaponBase({
    id: 'weapon_07_maekgung',
    rawName: '맥궁',
    weaponType: WeaponType.BOW,
    statValue: 7,
    cost: 1000,
    buyable: true,
    reqSecu: 1000
  });
}

// 동추 (레벨 7)
export function createDongchu(): WeaponBase {
  return new WeaponBase({
    id: 'weapon_07_dongchu',
    rawName: '동추',
    weaponType: WeaponType.HAMMER,
    statValue: 7,
    cost: 1000,
    buyable: true,
    reqSecu: 1000
  });
}

// 철쇄 (레벨 7)
export function createCheolswae(): WeaponBase {
  return new WeaponBase({
    id: 'weapon_07_cheolswae',
    rawName: '철쇄',
    weaponType: WeaponType.WHIP,
    statValue: 7,
    cost: 1000,
    buyable: true,
    reqSecu: 1000
  });
}

// 철편 (레벨 7)
export function createCheolpyeon(): WeaponBase {
  return new WeaponBase({
    id: 'weapon_07_cheolpyeon',
    rawName: '철편',
    weaponType: WeaponType.WHIP,
    statValue: 7,
    cost: 1000,
    buyable: true,
    reqSecu: 1000
  });
}

// 유성추 (레벨 8)
export function createYuseongchu(): WeaponBase {
  return new WeaponBase({
    id: 'weapon_08_yuseongchu',
    rawName: '유성추',
    weaponType: WeaponType.HAMMER,
    statValue: 8,
    cost: 1000,
    buyable: true,
    reqSecu: 1000
  });
}

// 동호비궁 (레벨 9)
export function createDonghoBigung(): WeaponBase {
  return new WeaponBase({
    id: 'weapon_09_dongho_bigong',
    rawName: '동호비궁',
    weaponType: WeaponType.BOW,
    statValue: 9,
    rarity: ItemRarity.UNCOMMON,
    cost: 1000,
    buyable: true,
    reqSecu: 1000
  });
}

// 쌍철극 (레벨 9)
export function createSsangcheolgeuk(): WeaponBase {
  return new WeaponBase({
    id: 'weapon_09_ssangcheolgeuk',
    rawName: '쌍철극',
    weaponType: WeaponType.HALBERD,
    statValue: 9,
    rarity: ItemRarity.UNCOMMON,
    cost: 1000,
    buyable: true,
    reqSecu: 1000
  });
}

// 대부 (레벨 10)
export function createDaebu(): WeaponBase {
  return new WeaponBase({
    id: 'weapon_10_daebu',
    rawName: '대부',
    weaponType: WeaponType.AXE,
    statValue: 10,
    rarity: ItemRarity.RARE,
    cost: 1000,
    buyable: true,
    reqSecu: 1000
  });
}

// 삼첨도 (레벨 10)
export function createSamcheomndo(): WeaponBase {
  return new WeaponBase({
    id: 'weapon_10_samcheomdo',
    rawName: '삼첨도',
    weaponType: WeaponType.BLADE,
    statValue: 10,
    rarity: ItemRarity.RARE,
    cost: 1000,
    buyable: true,
    reqSecu: 1000
  });
}

// ============================================
// 모든 무기 생성 함수 배열
// ============================================

export const AllWeaponCreators = {
  // 일반 무기
  dando: createDando,
  dangung: createDangung,
  dangeuk: createDangeuk,
  mokgeom: createMokgeom,
  jukchang: createJukchang,
  sobu: createSobu,
  maekgung: createMaekgung,
  dongchu: createDongchu,
  cheolswae: createCheolswae,
  cheolpyeon: createCheolpyeon,
  yuseongchu: createYuseongchu,
  donghoBigung: createDonghoBigung,
  ssangcheolgeuk: createSsangcheolgeuk,
  daebu: createDaebu,
  samcheomdo: createSamcheomndo,

  // 희귀/영웅급
  igwangGung: createIgwangGung,
  gojeongdo: createGojeongdo,
  chilseongGeom: createChilseongGeom,
  cheolcheokSamo: createCheolcheokSamo,
  yangyugiGung: createYangyugiGung,
  samo: createSamo,

  // 전설급
  unwoldo: createUnwoldo,
  bangcheonHwageuk: createBangcheonHwageuk,
  uicheonGeom: createUicheonGeom,
  cheonghongGeom: createCheonghongGeom,
  cheongryongUnwoldo: createCheongryongUnwoldo
};

