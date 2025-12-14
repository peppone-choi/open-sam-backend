/**
 * SpecialItemBase.ts
 * 특수 효과 아이템 기본 클래스
 * 
 * PHP 참조: core/hwe/sammo/ActionItem/che_*.php
 */

import { ItemSlot, BattleContext } from '../types';
import { ItemBase, ItemRarity, ItemCategory, ItemConfig, ItemEffect } from '../ItemBase';

// ============================================
// 특수 효과 아이템 설정
// ============================================

export interface SpecialItemConfig {
  id: string;
  rawName: string;
  effectName: string;  // 격노, 반계, 필살, 회피 등
  info: string;
  cost: number;
  consumable?: boolean;
  buyable?: boolean;
  reqSecu?: number;
  rarity?: ItemRarity;
}

// ============================================
// 특수 효과 아이템 기본 클래스
// ============================================

export class SpecialItemBase extends ItemBase {
  readonly effectName: string;
  readonly info: string;

  constructor(config: SpecialItemConfig) {
    const name = `${config.rawName}(${config.effectName})`;
    
    super({
      id: config.id,
      rawName: config.rawName,
      name,
      description: config.info,
      slot: ItemSlot.ACCESSORY,
      category: ItemCategory.ACCESSORY,
      rarity: config.rarity ?? ItemRarity.LEGENDARY,
      cost: config.cost,
      consumable: config.consumable ?? false,
      buyable: config.buyable ?? false,
      reqSecu: config.reqSecu,
      effect: {}
    });

    this.effectName = config.effectName;
    this.info = config.info;
  }
}

// ============================================
// 전투 트리거 아이템 인터페이스
// ============================================

export interface IBattleTriggerItem {
  getBattlePhaseSkillTriggerList?(unit: unknown): unknown;
}

// ============================================
// 스탯 보정 아이템 인터페이스
// ============================================

export interface IStatModifierItem {
  onCalcStat(statName: string, value: number, aux?: unknown): number;
}

export interface IOpposeStatModifierItem {
  onCalcOpposeStat(statName: string, value: number, aux?: unknown): number;
}

// ============================================
// 내정 보정 아이템 인터페이스
// ============================================

export interface IDomesticModifierItem {
  onCalcDomestic(turnType: string, varType: string, value: number, aux?: unknown): number;
}

// ============================================
// 소모품 아이템 인터페이스
// ============================================

export interface IConsumableItem {
  tryConsumeNow(actionType: string, command: string): boolean;
}

