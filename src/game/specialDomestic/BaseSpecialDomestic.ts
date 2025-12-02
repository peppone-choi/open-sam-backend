/**
 * 내정 특기 베이스 클래스
 * PHP 대응: core/hwe/sammo/ActionSpecialDomestic/BaseSpecial.php
 */

import type { GameAction } from '../actions/Action';
import type { WarUnit } from '../../battle/WarUnit';
import type { WarUnitTriggerCaller } from '../triggers/WarUnitTriggerCaller';

export abstract class BaseSpecialDomestic implements GameAction {
  /** 특기 ID */
  abstract get id(): string;
  
  /** 특기 이름 (한글) */
  abstract getName(): string;
  
  /** 특기 설명 */
  abstract getInfo(): string;
  
  /**
   * 내정 계산 보정
   * PHP 대응: onCalcDomestic()
   */
  onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    return value;
  }
  
  /**
   * 스탯 계산 보정
   * PHP 대응: onCalcStat()
   */
  onCalcStat(general: any, statName: string, value: any, aux?: any): any {
    return value;
  }
  
  /**
   * 상대 스탯 계산 보정
   * PHP 대응: onCalcOpposeStat()
   */
  onCalcOpposeStat(general: any, statName: string, value: any, aux?: any): any {
    return value;
  }
  
  /**
   * 국가 수입 계산 보정
   */
  onCalcNationalIncome(type: string, amount: number): number {
    return amount;
  }
  
  /**
   * 전략 계산 보정
   */
  onCalcStrategic(turnType: string, varType: string, value: any, aux?: any): any {
    return value;
  }
  
  /**
   * 전투력 배수 (내정 특기는 보통 전투에 영향 없음)
   */
  getWarPowerMultiplier(unit: WarUnit): [number, number] {
    return [1, 1];
  }
  
  getBattleInitSkillTriggerList(unit: WarUnit): WarUnitTriggerCaller | null {
    return null;
  }
  
  getBattlePhaseSkillTriggerList(unit: WarUnit): WarUnitTriggerCaller | null {
    return null;
  }
}




