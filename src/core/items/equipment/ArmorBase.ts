/**
 * ArmorBase.ts
 * 방어구 아이템 기본 클래스
 * 
 * 방어구 종류: 갑옷, 투구, 방패
 */

import { ItemSlot, BattleContext } from './types';
import { ItemBase, ItemRarity, ItemCategory, ItemConfig, ItemEffect } from './ItemBase';

// ============================================
// 방어구 타입 정의
// ============================================

export enum ArmorType {
  BODY = 'body',       // 갑옷/의복
  HELMET = 'helmet',   // 투구
  SHIELD = 'shield'    // 방패
}

export enum ArmorMaterial {
  CLOTH = 'cloth',     // 천/포
  LEATHER = 'leather', // 피갑
  CHAIN = 'chain',     // 쇄갑
  PLATE = 'plate',     // 철갑/판금
  SCALE = 'scale',     // 용린갑
  SPECIAL = 'special'  // 특수
}

export interface ArmorConfig {
  id: string;
  rawName: string;
  name?: string;
  description?: string;
  armorType: ArmorType;
  material: ArmorMaterial;
  defenseValue: number;
  rarity?: ItemRarity;
  cost: number;
  buyable?: boolean;
  reqSecu?: number;
  additionalEffect?: Partial<ItemEffect>;
}

// ============================================
// 방어구 기본 클래스
// ============================================

export class ArmorBase extends ItemBase {
  readonly armorType: ArmorType;
  readonly material: ArmorMaterial;
  readonly defenseValue: number;

  constructor(config: ArmorConfig) {
    const slot = ArmorBase.getSlotFromType(config.armorType);
    const name = config.name ?? `${config.rawName}(방어 +${config.defenseValue})`;
    const description = config.description ?? `방어력 +${config.defenseValue}`;

    super({
      id: config.id,
      rawName: config.rawName,
      name,
      description,
      slot,
      category: ItemCategory.ARMOR,
      rarity: config.rarity ?? ArmorBase.getRarityFromValue(config.defenseValue),
      cost: config.cost,
      consumable: false,
      buyable: config.buyable ?? true,
      reqSecu: config.reqSecu,
      effect: {
        battleBonus: {
          defense: config.defenseValue
        },
        ...config.additionalEffect
      }
    });

    this.armorType = config.armorType;
    this.material = config.material;
    this.defenseValue = config.defenseValue;
  }

  static getSlotFromType(type: ArmorType): ItemSlot {
    switch (type) {
      case ArmorType.BODY:
        return ItemSlot.ARMOR;
      case ArmorType.HELMET:
        return ItemSlot.HELMET;
      case ArmorType.SHIELD:
        return ItemSlot.ACCESSORY;
      default:
        return ItemSlot.ARMOR;
    }
  }

  static getRarityFromValue(value: number): ItemRarity {
    if (value >= 30) return ItemRarity.LEGENDARY;
    if (value >= 20) return ItemRarity.EPIC;
    if (value >= 15) return ItemRarity.RARE;
    if (value >= 10) return ItemRarity.UNCOMMON;
    return ItemRarity.COMMON;
  }

  override onCalcBattleStat(statName: string, value: number): number {
    if (statName === 'defense') {
      return value + this.defenseValue;
    }
    return super.onCalcBattleStat(statName, value);
  }

  override getWarPowerMultiplier(ctx: BattleContext): [number, number] {
    // 방어구는 방어력에 영향
    const defenseMultiplier = 1 + (this.defenseValue * 0.01);
    return [1, defenseMultiplier];
  }

  getArmorTypeLabel(): string {
    const labels: Record<ArmorType, string> = {
      [ArmorType.BODY]: '갑옷',
      [ArmorType.HELMET]: '투구',
      [ArmorType.SHIELD]: '방패'
    };
    return labels[this.armorType];
  }

  getMaterialLabel(): string {
    const labels: Record<ArmorMaterial, string> = {
      [ArmorMaterial.CLOTH]: '천',
      [ArmorMaterial.LEATHER]: '피갑',
      [ArmorMaterial.CHAIN]: '쇄갑',
      [ArmorMaterial.PLATE]: '철갑',
      [ArmorMaterial.SCALE]: '용린',
      [ArmorMaterial.SPECIAL]: '특수'
    };
    return labels[this.material];
  }
}

// ============================================
// 전설급 방어구 클래스
// ============================================

export interface LegendaryArmorConfig extends ArmorConfig {
  legendaryEffect?: {
    damageReduction?: number;    // 피해 감소율
    evadeBonus?: number;         // 회피 보너스
    specialAbility?: string[];
  };
}

export class LegendaryArmor extends ArmorBase {
  readonly legendaryEffect?: {
    damageReduction?: number;
    evadeBonus?: number;
    specialAbility?: string[];
  };

  constructor(config: LegendaryArmorConfig) {
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
      if (statName === 'evade' && this.legendaryEffect.evadeBonus) {
        result += this.legendaryEffect.evadeBonus;
      }
    }

    return result;
  }

  override getWarPowerMultiplier(ctx: BattleContext): [number, number] {
    const [atk, def] = super.getWarPowerMultiplier(ctx);
    
    if (this.legendaryEffect?.damageReduction) {
      return [atk, def * (1 + this.legendaryEffect.damageReduction)];
    }
    
    return [atk, def];
  }
}

// ============================================
// 방어구 인스턴스 생성 함수
// ============================================

// 갑옷류

// 피갑 (기본)
export function createPigap(): ArmorBase {
  return new ArmorBase({
    id: 'armor_body_pigap',
    rawName: '피갑',
    armorType: ArmorType.BODY,
    material: ArmorMaterial.LEATHER,
    defenseValue: 5,
    cost: 500,
    buyable: true,
    reqSecu: 500
  });
}

// 쇄갑
export function createSwaegap(): ArmorBase {
  return new ArmorBase({
    id: 'armor_body_swaegap',
    rawName: '쇄갑',
    armorType: ArmorType.BODY,
    material: ArmorMaterial.CHAIN,
    defenseValue: 10,
    cost: 1000,
    buyable: true,
    reqSecu: 1000
  });
}

// 철갑
export function createCheolgap(): ArmorBase {
  return new ArmorBase({
    id: 'armor_body_cheolgap',
    rawName: '철갑',
    armorType: ArmorType.BODY,
    material: ArmorMaterial.PLATE,
    defenseValue: 15,
    rarity: ItemRarity.RARE,
    cost: 2000,
    buyable: true,
    reqSecu: 1500
  });
}

// 명광갑 (명물급)
export function createMyeonggwanggap(): ArmorBase {
  return new ArmorBase({
    id: 'armor_body_myeonggwanggap',
    rawName: '명광갑',
    armorType: ArmorType.BODY,
    material: ArmorMaterial.PLATE,
    defenseValue: 20,
    rarity: ItemRarity.EPIC,
    cost: 5000,
    buyable: false
  });
}

// 용린갑 (전설급)
export function createYonglingap(): LegendaryArmor {
  return new LegendaryArmor({
    id: 'armor_legendary_yonglingap',
    rawName: '용린갑',
    name: '용린갑(방어 +30)',
    description: '방어력 +30, 피해 감소 15%',
    armorType: ArmorType.BODY,
    material: ArmorMaterial.SCALE,
    defenseValue: 30,
    cost: 200,
    legendaryEffect: {
      damageReduction: 0.15,
      specialAbility: ['용의 가호']
    }
  });
}

// 연환갑 (전설급)
export function createYeonhwangap(): LegendaryArmor {
  return new LegendaryArmor({
    id: 'armor_legendary_yeonhwangap',
    rawName: '연환갑',
    name: '연환갑(방어 +25)',
    description: '방어력 +25, 회피 +10%',
    armorType: ArmorType.BODY,
    material: ArmorMaterial.CHAIN,
    defenseValue: 25,
    cost: 200,
    legendaryEffect: {
      evadeBonus: 0.1,
      specialAbility: ['유연한 방어']
    }
  });
}

// 투구류

// 철두건
export function createCheoldugeon(): ArmorBase {
  return new ArmorBase({
    id: 'armor_helmet_cheoldugeon',
    rawName: '철두건',
    armorType: ArmorType.HELMET,
    material: ArmorMaterial.PLATE,
    defenseValue: 3,
    cost: 300,
    buyable: true,
    reqSecu: 300
  });
}

// 철투구
export function createCheoltugu(): ArmorBase {
  return new ArmorBase({
    id: 'armor_helmet_cheoltugu',
    rawName: '철투구',
    armorType: ArmorType.HELMET,
    material: ArmorMaterial.PLATE,
    defenseValue: 5,
    cost: 500,
    buyable: true,
    reqSecu: 500
  });
}

// 금관
export function createGeumgwan(): ArmorBase {
  return new ArmorBase({
    id: 'armor_helmet_geumgwan',
    rawName: '금관',
    armorType: ArmorType.HELMET,
    material: ArmorMaterial.SPECIAL,
    defenseValue: 8,
    rarity: ItemRarity.RARE,
    cost: 2000,
    buyable: false
  });
}

// 비익투구 (전설급)
export function createBiiktugu(): LegendaryArmor {
  return new LegendaryArmor({
    id: 'armor_legendary_biiktugu',
    rawName: '비익투구',
    name: '비익투구(방어 +15)',
    description: '방어력 +15, 회피 +5%',
    armorType: ArmorType.HELMET,
    material: ArmorMaterial.SPECIAL,
    defenseValue: 15,
    cost: 200,
    legendaryEffect: {
      evadeBonus: 0.05,
      specialAbility: ['날개의 기세']
    }
  });
}

// 방패류

// 목패
export function createMokpae(): ArmorBase {
  return new ArmorBase({
    id: 'armor_shield_mokpae',
    rawName: '목패',
    armorType: ArmorType.SHIELD,
    material: ArmorMaterial.CLOTH,
    defenseValue: 3,
    cost: 200,
    buyable: true,
    reqSecu: 200
  });
}

// 철패
export function createCheolpae(): ArmorBase {
  return new ArmorBase({
    id: 'armor_shield_cheolpae',
    rawName: '철패',
    armorType: ArmorType.SHIELD,
    material: ArmorMaterial.PLATE,
    defenseValue: 7,
    cost: 700,
    buyable: true,
    reqSecu: 700
  });
}

// 대방패
export function createDaebangpae(): ArmorBase {
  return new ArmorBase({
    id: 'armor_shield_daebangpae',
    rawName: '대방패',
    armorType: ArmorType.SHIELD,
    material: ArmorMaterial.PLATE,
    defenseValue: 12,
    rarity: ItemRarity.RARE,
    cost: 1500,
    buyable: true,
    reqSecu: 1500
  });
}

// 용면방패 (전설급)
export function createYongmyeonbangpae(): LegendaryArmor {
  return new LegendaryArmor({
    id: 'armor_legendary_yongmyeonbangpae',
    rawName: '용면방패',
    name: '용면방패(방어 +20)',
    description: '방어력 +20, 피해 감소 10%',
    armorType: ArmorType.SHIELD,
    material: ArmorMaterial.SPECIAL,
    defenseValue: 20,
    cost: 200,
    legendaryEffect: {
      damageReduction: 0.1,
      specialAbility: ['용의 위엄']
    }
  });
}

// ============================================
// 모든 방어구 생성 함수
// ============================================

export const AllArmorCreators = {
  // 갑옷
  pigap: createPigap,
  swaegap: createSwaegap,
  cheolgap: createCheolgap,
  myeonggwanggap: createMyeonggwanggap,
  yonglingap: createYonglingap,
  yeonhwangap: createYeonhwangap,

  // 투구
  cheoldugeon: createCheoldugeon,
  cheoltugu: createCheoltugu,
  geumgwan: createGeumgwan,
  biiktugu: createBiiktugu,

  // 방패
  mokpae: createMokpae,
  cheolpae: createCheolpae,
  daebangpae: createDaebangpae,
  yongmyeonbangpae: createYongmyeonbangpae
};

