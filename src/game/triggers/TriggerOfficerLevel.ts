/**
 * 관직 레벨 트리거
 * PHP 대응: core/hwe/sammo/TriggerOfficerLevel.php
 * 
 * 관직에 따른 내정/전투 보너스 적용
 */

import type { GameAction } from '../actions/Action';
import type { WarUnit } from '../../battle/WarUnit';
import type { WarUnitTriggerCaller } from './WarUnitTriggerCaller';

/**
 * 관직 레벨에 따른 통솔 보너스 계산
 * PHP 대응: calcLeadershipBonus()
 */
export function calcLeadershipBonus(officerLevel: number, nationLevel: number): number {
  if (officerLevel === 12) {
    return nationLevel * 2;
  } else if (officerLevel >= 5) {
    return nationLevel;
  } else {
    return 0;
  }
}

export class TriggerOfficerLevel implements GameAction {
  private officerLevel: number;
  private nationLevel: number;
  private lbonus: number;
  
  /**
   * @param general 장수 데이터 객체
   * @param nationLevel 국가 레벨
   */
  constructor(general: any, nationLevel: number) {
    const genData = general.data || general;
    let officerLevel = genData.officer_level ?? 0;
    const officerCity = genData.officer_city ?? 0;
    const currentCity = genData.city ?? 0;
    
    this.nationLevel = nationLevel;
    
    // 태수(2-4)가 담당 도시가 아닌 곳에 있으면 평민 취급
    if (officerLevel >= 2 && officerLevel <= 4 && officerCity !== currentCity) {
      officerLevel = 1;
    }
    
    this.officerLevel = officerLevel;
    this.lbonus = calcLeadershipBonus(officerLevel, nationLevel);
  }
  
  /**
   * 통솔 보너스 조회
   */
  getLbonus(): number {
    return this.lbonus;
  }
  
  /**
   * 내정 계산 보정
   * PHP 대응: onCalcDomestic()
   */
  onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    if (varType === 'score') {
      // 농업/상업: 군주(12), 군사(11), 장군(9), 대장군(7), 수뇌(5), 태수(3)
      if (turnType === '농업' || turnType === '상업') {
        if ([12, 11, 9, 7, 5, 3].includes(this.officerLevel)) {
          return value * 1.05;
        }
      }
      // 기술: 군주(12), 군사(11), 장군(9), 대장군(7), 수뇌(5)
      else if (turnType === '기술') {
        if ([12, 11, 9, 7, 5].includes(this.officerLevel)) {
          return value * 1.05;
        }
      }
      // 민심/인구: 군주(12), 군사(11), 내정관(2)
      else if (turnType === '민심' || turnType === '인구') {
        if ([12, 11, 2].includes(this.officerLevel)) {
          return value * 1.05;
        }
      }
      // 수비/성벽/치안: 군주(12), 군사(11), 대도독(10), 도독(8), 사령관(6), 태수(4)
      else if (turnType === '수비' || turnType === '성벽' || turnType === '치안') {
        if ([12, 11, 10, 8, 6, 4].includes(this.officerLevel)) {
          return value * 1.05;
        }
      }
    }
    
    return value;
  }
  
  /**
   * 스탯 계산 보정
   * PHP 대응: onCalcStat()
   */
  onCalcStat(general: any, statName: string, value: any, aux?: any): any {
    // 통솔력에 관직 보너스 추가
    if (statName === 'leadership') {
      return value + this.lbonus;
    }
    return value;
  }
  
  /**
   * 상대 스탯 계산 보정
   */
  onCalcOpposeStat(general: any, statName: string, value: any, aux?: any): any {
    return value;
  }
  
  /**
   * 전투력 배수
   * PHP 대응: getWarPowerMultiplier()
   */
  getWarPowerMultiplier(unit: WarUnit): [number, number] {
    const officerLevel = this.officerLevel;
    let warPowerMultiply = 1;
    let opposeWarPowerMultiply = 1;
    
    if (officerLevel === 12) {
      // 군주: 공격 +7%, 상대 방어 -7%
      warPowerMultiply = 1.07;
      opposeWarPowerMultiply = 0.93;
    } else if (officerLevel === 11) {
      // 군사: 공격 +5%, 상대 방어 -5%
      warPowerMultiply = 1.05;
      opposeWarPowerMultiply = 0.95;
    } else if ([10, 8, 6].includes(officerLevel)) {
      // 대도독/도독/사령관: 공격 +10%
      warPowerMultiply = 1.10;
    } else if ([9, 7, 5].includes(officerLevel)) {
      // 장군/대장군/수뇌: 상대 방어 -10%
      opposeWarPowerMultiply = 0.90;
    } else if ([4, 3, 2].includes(officerLevel)) {
      // 태수/내정관: 공격 +5%, 상대 방어 -5%
      warPowerMultiply = 1.05;
      opposeWarPowerMultiply = 0.95;
    }
    
    return [warPowerMultiply, opposeWarPowerMultiply];
  }
  
  getBattleInitSkillTriggerList(unit: WarUnit): WarUnitTriggerCaller | null {
    return null;
  }
  
  getBattlePhaseSkillTriggerList(unit: WarUnit): WarUnitTriggerCaller | null {
    return null;
  }
}

/**
 * 관직 레벨 트리거 팩토리
 * @param general 장수 객체
 * @param nationLevel 국가 레벨 (기본값 0)
 */
export function createOfficerLevelTrigger(general: any, nationLevel: number = 0): TriggerOfficerLevel {
  return new TriggerOfficerLevel(general, nationLevel);
}

