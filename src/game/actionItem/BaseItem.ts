/**
 * 아이템 베이스 클래스
 * PHP 대응: sammo\BaseItem
 */

import type { WarUnit } from '../../battle/WarUnit';
import type { WarUnitTriggerCaller } from '../triggers/WarUnitTriggerCaller';

export interface ItemInfo {
  id: string;
  rawName: string;
  name: string;
  info: string;
  cost: number | null;
  consumable: boolean;
  buyable: boolean;
  reqSecu: number;
}

export abstract class BaseItem {
  protected rawName: string = '-';
  protected name: string = '-';
  protected info: string = '';
  protected cost: number | null = null;
  protected consumable: boolean = false;
  protected buyable: boolean = false;
  protected reqSecu: number = 0;

  /**
   * 아이템 ID 반환 (클래스명 기반)
   */
  abstract get id(): string;

  /**
   * 원본 이름 반환
   */
  getRawName(): string {
    return this.rawName;
  }

  /**
   * 표시 이름 반환
   */
  getName(): string {
    return this.name;
  }

  /**
   * 아이템 설명 반환
   */
  getInfo(): string {
    return this.info;
  }

  /**
   * 비용 반환
   */
  getCost(): number | null {
    return this.cost;
  }

  /**
   * 소모품 여부
   */
  isConsumable(): boolean {
    return this.consumable;
  }

  /**
   * 구매 가능 여부
   */
  isBuyable(): boolean {
    return this.buyable;
  }

  /**
   * 필요 치안도 반환
   */
  getReqSecu(): number {
    return this.reqSecu;
  }

  /**
   * 아이템 정보 객체 반환
   */
  getItemInfo(): ItemInfo {
    return {
      id: this.id,
      rawName: this.rawName,
      name: this.name,
      info: this.info,
      cost: this.cost,
      consumable: this.consumable,
      buyable: this.buyable,
      reqSecu: this.reqSecu,
    };
  }

  /**
   * 즉시 소모 시도
   */
  tryConsumeNow(_general: any, _actionType: string, _command: string): boolean {
    return false;
  }

  /**
   * 스탯 계산 훅
   */
  onCalcStat(_general: any, _statName: string, value: number, _aux?: any): number {
    return value;
  }

  /**
   * 상대 스탯 계산 훅
   */
  onCalcOpposeStat(_general: any, _statName: string, value: number, _aux?: any): number {
    return value;
  }

  /**
   * 내정 계산 훅
   */
  onCalcDomestic(_turnType: string, _varType: string, value: number, _aux?: any): number {
    return value;
  }

  /**
   * 전투력 배율 훅
   */
  getWarPowerMultiplier(_unit: WarUnit): [number, number] {
    return [1, 1];
  }

  /**
   * 전투 페이즈 트리거 목록 반환
   */
  getBattlePhaseSkillTriggerList(_unit: WarUnit): WarUnitTriggerCaller | null {
    return null;
  }
}
