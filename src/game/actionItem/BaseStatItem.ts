/**
 * 스탯 증가 아이템 베이스 클래스
 * PHP 대응: sammo\BaseStatItem
 * 명마(통솔), 무기(무력), 서적(지력) 아이템용
 */

import { BaseItem } from './BaseItem';

export type ItemType = '명마' | '무기' | '서적' | '인장' | '장신구';
export type StatType = 'leadership' | 'strength' | 'intel' | 'politics' | 'charm';
export type StatNick = '통솔' | '무력' | '지력' | '정치' | '매력';

const ITEM_TYPE_MAP: Record<ItemType, [StatNick, StatType]> = {
  '명마': ['통솔', 'leadership'],
  '무기': ['무력', 'strength'],
  '서적': ['지력', 'intel'],
  '인장': ['정치', 'politics'],
  '장신구': ['매력', 'charm'],
};

export abstract class BaseStatItem extends BaseItem {
  protected statNick: StatNick = '통솔';
  protected statType: StatType = 'leadership';
  protected statValue: number = 1;
  protected itemType: ItemType = '명마';

  constructor(itemType: ItemType, grade: number, rawName: string, cost: number = 100, buyable: boolean = true) {
    super();
    this.itemType = itemType;
    this.statValue = grade;
    this.rawName = rawName;
    this.buyable = buyable;
    this.cost = cost;
    this.consumable = false;

    const [statNick, statType] = ITEM_TYPE_MAP[itemType];
    this.statNick = statNick;
    this.statType = statType;

    this.name = `${rawName}(+${grade})`;
    this.info = `${statNick} +${grade}`;
  }

  /**
   * 스탯 계산 - 해당 스탯에 등급만큼 추가
   */
  override onCalcStat(_general: any, statName: string, value: number, _aux?: any): number {
    if (statName === this.statType) {
      return value + this.statValue;
    }
    return value;
  }

  /**
   * 등급 반환
   */
  getGrade(): number {
    return this.statValue;
  }

  /**
   * 아이템 타입 반환
   */
  getItemType(): ItemType {
    return this.itemType;
  }

  /**
   * 스탯 타입 반환
   */
  getStatType(): StatType {
    return this.statType;
  }
}

/**
 * 무기 아이템 팩토리
 */
export function createWeaponItem(
  id: string,
  grade: number,
  rawName: string,
  cost: number = 100,
  buyable: boolean = true
): BaseStatItem {
  return new (class extends BaseStatItem {
    get id(): string { return id; }
    constructor() {
      super('무기', grade, rawName, cost, buyable);
    }
  })();
}

/**
 * 명마 아이템 팩토리
 */
export function createHorseItem(
  id: string,
  grade: number,
  rawName: string,
  cost: number = 100,
  buyable: boolean = true
): BaseStatItem {
  return new (class extends BaseStatItem {
    get id(): string { return id; }
    constructor() {
      super('명마', grade, rawName, cost, buyable);
    }
  })();
}

/**
 * 서적 아이템 팩토리
 */
export function createBookItem(
  id: string,
  grade: number,
  rawName: string,
  cost: number = 100,
  buyable: boolean = true
): BaseStatItem {
  return new (class extends BaseStatItem {
    get id(): string { return id; }
    constructor() {
      super('서적', grade, rawName, cost, buyable);
    }
  })();
}

/**
 * 인장 아이템 팩토리 (정치 증가)
 */
export function createSealItem(
  id: string,
  grade: number,
  rawName: string,
  cost: number = 100,
  buyable: boolean = true
): BaseStatItem {
  return new (class extends BaseStatItem {
    get id(): string { return id; }
    constructor() {
      super('인장', grade, rawName, cost, buyable);
    }
  })();
}

/**
 * 장신구 아이템 팩토리 (매력 증가)
 */
export function createAccessoryItem(
  id: string,
  grade: number,
  rawName: string,
  cost: number = 100,
  buyable: boolean = true
): BaseStatItem {
  return new (class extends BaseStatItem {
    get id(): string { return id; }
    constructor() {
      super('장신구', grade, rawName, cost, buyable);
    }
  })();
}
