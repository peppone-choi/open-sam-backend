/**
 * ItemBase.ts
 * 아이템 시스템 기본 클래스
 * 
 * PHP 참조: core/hwe/sammo/BaseItem.php
 */

import { ItemSlot, StatBonus, BattleBonus, SkillBonus, BattleContext } from './types';

// ============================================
// 타입 정의
// ============================================

export enum ItemRarity {
  COMMON = 1,       // 일반
  UNCOMMON = 2,     // 고급
  RARE = 3,         // 희귀
  EPIC = 4,         // 영웅
  LEGENDARY = 5     // 전설
}

export enum ItemCategory {
  WEAPON = 'weapon',
  ARMOR = 'armor',
  BOOK = 'book',
  MOUNT = 'mount',
  ACCESSORY = 'accessory',
  CONSUMABLE = 'consumable'
}

export interface ItemEffect {
  statBonus?: StatBonus;
  battleBonus?: BattleBonus;
  skillBonus?: SkillBonus;
  special?: string[];
}

export interface ItemConfig {
  id: string;
  rawName: string;
  name: string;
  description: string;
  slot: ItemSlot;
  category: ItemCategory;
  rarity: ItemRarity;
  cost: number;
  consumable: boolean;
  buyable: boolean;
  reqSecu?: number;  // 구매 필요 치안
  effect: ItemEffect;
}

// ============================================
// 아이템 기본 클래스
// ============================================

export abstract class ItemBase {
  readonly id: string;
  readonly rawName: string;
  readonly name: string;
  readonly description: string;
  readonly slot: ItemSlot;
  readonly category: ItemCategory;
  readonly rarity: ItemRarity;
  readonly cost: number;
  readonly consumable: boolean;
  readonly buyable: boolean;
  readonly reqSecu: number;
  readonly effect: ItemEffect;

  constructor(config: ItemConfig) {
    this.id = config.id;
    this.rawName = config.rawName;
    this.name = config.name;
    this.description = config.description;
    this.slot = config.slot;
    this.category = config.category;
    this.rarity = config.rarity;
    this.cost = config.cost;
    this.consumable = config.consumable;
    this.buyable = config.buyable;
    this.reqSecu = config.reqSecu ?? 0;
    this.effect = config.effect;
  }

  // ============================================
  // 기본 메서드
  // ============================================

  getRawName(): string {
    return this.rawName;
  }

  getName(): string {
    return this.name;
  }

  getCost(): number {
    return this.cost;
  }

  isConsumable(): boolean {
    return this.consumable;
  }

  isBuyable(): boolean {
    return this.buyable;
  }

  getReqSecu(): number {
    return this.reqSecu;
  }

  getRarityLabel(): string {
    const labels: Record<ItemRarity, string> = {
      [ItemRarity.COMMON]: '일반',
      [ItemRarity.UNCOMMON]: '고급',
      [ItemRarity.RARE]: '희귀',
      [ItemRarity.EPIC]: '영웅',
      [ItemRarity.LEGENDARY]: '전설'
    };
    return labels[this.rarity];
  }

  // ============================================
  // 효과 계산 메서드 (override 가능)
  // ============================================

  /**
   * 스탯 보너스 계산
   * @param statName 스탯 이름
   * @param value 현재 값
   * @returns 보정된 값
   */
  onCalcStat(statName: string, value: number): number {
    if (!this.effect.statBonus) return value;
    
    const bonus = this.effect.statBonus as Record<string, number | undefined>;
    return value + (bonus[statName] ?? 0);
  }

  /**
   * 전투 스탯 보너스 계산
   * @param statName 전투 스탯 이름
   * @param value 현재 값
   * @returns 보정된 값
   */
  onCalcBattleStat(statName: string, value: number): number {
    if (!this.effect.battleBonus) return value;
    
    const bonus = this.effect.battleBonus as Record<string, number | undefined>;
    return value + (bonus[statName] ?? 0);
  }

  /**
   * 스킬 보너스 계산
   * @param skillName 스킬 이름
   * @param value 현재 값
   * @returns 보정된 값
   */
  onCalcSkillBonus(skillName: string, value: number): number {
    if (!this.effect.skillBonus) return value;
    
    const bonus = this.effect.skillBonus as Record<string, number | undefined>;
    return value + (bonus[skillName] ?? 0);
  }

  /**
   * 상대방 스탯 감소 효과
   * @param statName 스탯 이름
   * @param value 현재 값
   * @returns 감소된 값
   */
  onCalcOpposeStat(statName: string, value: number): number {
    return value;
  }

  /**
   * 내정 명령 효과 계산
   * @param turnType 턴 타입 (계략, 내정 등)
   * @param varType 변수 타입 (success, effect 등)
   * @param value 현재 값
   * @returns 보정된 값
   */
  onCalcDomestic(turnType: string, varType: string, value: number): number {
    return value;
  }

  /**
   * 전투 대미지 배율 계산
   * @param ctx 전투 컨텍스트
   * @returns [공격 배율, 방어 배율]
   */
  getWarPowerMultiplier(ctx: BattleContext): [number, number] {
    return [1, 1];
  }

  /**
   * 소비 아이템 사용 시도
   * @param actionType 액션 타입
   * @param command 명령어
   * @returns 소비 여부
   */
  tryConsumeNow(actionType: string, command: string): boolean {
    return false;
  }

  /**
   * 아이템 정보 객체 반환
   */
  toJSON(): object {
    return {
      id: this.id,
      rawName: this.rawName,
      name: this.name,
      description: this.description,
      slot: this.slot,
      category: this.category,
      rarity: this.rarity,
      cost: this.cost,
      consumable: this.consumable,
      buyable: this.buyable,
      reqSecu: this.reqSecu,
      effect: this.effect
    };
  }
}

// ============================================
// 스탯 아이템 기본 클래스
// ============================================

export interface StatItemConfig {
  id: string;
  rawName: string;
  statType: 'strength' | 'intel' | 'leadership';
  statValue: number;
  cost: number;
  buyable?: boolean;
  reqSecu?: number;
  slot: ItemSlot;
  category: ItemCategory;
  rarity?: ItemRarity;
}

const STAT_LABELS: Record<string, string> = {
  strength: '무력',
  intel: '지력',
  leadership: '통솔'
};

export abstract class StatItemBase extends ItemBase {
  readonly statType: string;
  readonly statValue: number;

  constructor(config: StatItemConfig) {
    const statLabel = STAT_LABELS[config.statType];
    const name = `${config.rawName}(+${config.statValue})`;
    const description = `${statLabel} +${config.statValue}`;
    
    super({
      id: config.id,
      rawName: config.rawName,
      name,
      description,
      slot: config.slot,
      category: config.category,
      rarity: config.rarity ?? ItemRarity.COMMON,
      cost: config.cost,
      consumable: false,
      buyable: config.buyable ?? true,
      reqSecu: config.reqSecu,
      effect: {
        statBonus: {
          [config.statType]: config.statValue
        }
      }
    });

    this.statType = config.statType;
    this.statValue = config.statValue;
  }

  override onCalcStat(statName: string, value: number): number {
    if (statName === this.statType) {
      return value + this.statValue;
    }
    return value;
  }
}

