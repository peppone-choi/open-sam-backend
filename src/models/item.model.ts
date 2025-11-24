/**
 * Minimal BaseItem model for Session 5 item system.
 *
 * This class is intentionally small and only exposes
 * what is required by the concrete items and tests.
 */

import type { IGeneral } from './general.model';
import type { RandUtil } from '../utils/RandUtil';

/**
 * Optional consume result – kept for compatibility with
 * earlier references but not used directly in the trimmed
 * item implementations.
 */
export interface ItemConsumeResult {
  success: boolean;
  message?: string;
  effects?: Record<string, any>;
}

/**
 * BaseItem: shared core for simple, PHP‑style items.
 */
export abstract class BaseItem {
  protected rawName: string = '-';
  protected name: string = '-';
  protected info: string = '';
  protected cost: number | null = null;
  protected consumable: boolean = false;
  protected buyable: boolean = false;
  protected reqSecu: number = 0;

  getRawName(): string {
    return this.rawName;
  }

  getName(): string {
    return this.name;
  }

  getInfo(): string {
    return this.info;
  }

  getRawClassName(shortName: boolean = true): string {
    // For now we only need the short form.
    if (shortName) {
      return this.constructor.name;
    }
    return this.constructor.name;
  }

  getCost(): number | null {
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

  /**
   * Optional per‑command consumption hook.
   * Concrete items override this to model multi‑charge
   * or conditional consumption rules.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  tryConsumeNow(_general: IGeneral, _actionType: string, _command: string): boolean {
    return false;
  }

  /**
   * Domestic value adjustment hook (계략, 치료 등).
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onCalcDomestic(_turnType: string, _varType: string, value: number, _aux?: any): number {
    return value;
  }

  /**
   * Generic stat adjustment hook (통솔/무력/지력, 전투 보정 등).
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onCalcStat(_general: IGeneral, _statName: string, value: any, _aux?: any): any {
    return value;
  }

  /**
   * Battle‑time trigger hook (사기 증가, 농성 방어 보정 등).
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getBattleInitSkillTriggerList(_unit: any): any | null {
    return null;
  }

  /**
   * Arbitrary action hook (예: 장비매매 시 초기화).
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onArbitraryAction(
    _general: IGeneral,
    _rng: RandUtil,
    _actionType: string,
    _phase: string | null = null,
    aux: any = null
  ): any {
    return aux;
  }

  /**
   * Helpers for working with general.aux.
   */
  protected getAuxVar(general: IGeneral, key: string): any {
    const anyGen = general as any;
    return anyGen.aux?.[key];
  }

  protected setAuxVar(general: IGeneral, key: string, value: any): void {
    const anyGen = general as any;
    if (!anyGen.aux) {
      anyGen.aux = {};
    }
    anyGen.aux[key] = value;
    if (typeof anyGen.markModified === 'function') {
      anyGen.markModified('aux');
    }
  }
}
