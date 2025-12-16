/**
 * EventItemBase.ts
 * 이벤트 아이템 (비급) 기본 클래스
 * 전투특기를 부여하는 아이템
 * 
 * PHP 참조: core/hwe/sammo/ActionItem/event_전투특기_*.php
 */

import { ItemSlot, BattleContext } from '../types';
import { ItemBase, ItemRarity, ItemCategory } from '../ItemBase';

// ============================================
// 병종 타입 상수 (GameUnitConst 대응)
// ============================================

export enum ArmType {
  FOOTMAN = 0,   // 보병
  CAVALRY = 1,   // 기병
  ARCHER = 2,    // 궁병
  WIZARD = 3,    // 귀병
  SIEGE = 4      // 차병/공성
}

// ============================================
// 이벤트 아이템 설정
// ============================================

export interface EventItemConfig {
  id: string;
  specialityName: string;  // 격노, 필살, 환술 등
  info: string;
  cost?: number;
  reqSecu?: number;
  rarity?: ItemRarity;
}

// ============================================
// 이벤트 아이템 기본 클래스
// ============================================

export class EventItemBase extends ItemBase {
  readonly specialityName: string;
  readonly info: string;

  constructor(config: EventItemConfig) {
    const rawName = '비급';
    const name = `비급(${config.specialityName})`;
    
    super({
      id: config.id,
      rawName,
      name,
      description: config.info,
      slot: ItemSlot.ACCESSORY,
      category: ItemCategory.ACCESSORY,
      rarity: config.rarity ?? ItemRarity.EPIC,
      cost: config.cost ?? 100,
      consumable: false,
      buyable: true,
      reqSecu: config.reqSecu ?? 3000,
      effect: {}
    });

    this.specialityName = config.specialityName;
    this.info = config.info;
  }

  /**
   * 전투력 배율 반환 (override 가능)
   * @returns [공격 배율, 방어 배율]
   */
  override getWarPowerMultiplier(ctx: BattleContext): [number, number] {
    return [1, 1];
  }
}

// ============================================
// 인터페이스
// ============================================

export interface IStatModifierEventItem {
  onCalcStat(statName: string, value: number, aux?: unknown): number;
}

export interface IOpposeStatModifierEventItem {
  onCalcOpposeStat(statName: string, value: number, aux?: unknown): number;
}

export interface IDomesticModifierEventItem {
  onCalcDomestic(turnType: string, varType: string, value: number, aux?: unknown): number;
}

export interface IBattleTriggerEventItem {
  getBattlePhaseSkillTriggerList?(unit: unknown): unknown;
  getBattleInitSkillTriggerList?(unit: unknown): unknown;
}







