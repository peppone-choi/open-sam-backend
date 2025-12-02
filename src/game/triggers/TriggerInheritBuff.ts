/**
 * 유산 버프 트리거
 * PHP 대응: core/hwe/sammo/TriggerInheritBuff.php
 * 
 * 유산 포인트로 구매한 버프 효과 적용
 */

import type { GameAction } from '../actions/Action';
import type { WarUnit } from '../../battle/WarUnit';
import type { WarUnitTriggerCaller } from './WarUnitTriggerCaller';

/**
 * 유산 버프 키
 */
export const InheritBuffKey = {
  WAR_AVOID_RATIO: 'warAvoidRatio',           // 회피 확률 증가
  WAR_CRITICAL_RATIO: 'warCriticalRatio',     // 필살 확률 증가
  WAR_MAGIC_TRIAL_PROB: 'warMagicTrialProb',  // 전투계략 시도 확률 증가
  DOMESTIC_SUCCESS_PROB: 'domesticSuccessProb', // 내정 성공률 증가
  DOMESTIC_FAIL_PROB: 'domesticFailProb',       // 내정 실패율 감소
  OPPOSE_WAR_AVOID_RATIO: 'warAvoidRatioOppose',       // 상대 회피 확률 감소
  OPPOSE_WAR_CRITICAL_RATIO: 'warCriticalRatioOppose', // 상대 필살 확률 감소
  OPPOSE_WAR_MAGIC_TRIAL_PROB: 'warMagicTrialProbOppose', // 상대 전투계략 시도 확률 감소
} as const;

export type InheritBuffKeyType = typeof InheritBuffKey[keyof typeof InheritBuffKey];

/**
 * 버프 설명 텍스트
 */
export const BUFF_KEY_TEXT: Record<string, string> = {
  [InheritBuffKey.WAR_AVOID_RATIO]: '회피 확률 증가',
  [InheritBuffKey.WAR_CRITICAL_RATIO]: '필살 확률 증가',
  [InheritBuffKey.WAR_MAGIC_TRIAL_PROB]: '전투계략 시도 확률 증가',
  [InheritBuffKey.DOMESTIC_SUCCESS_PROB]: '내정 성공률 증가',
  [InheritBuffKey.DOMESTIC_FAIL_PROB]: '내정 실패율 감소',
  [InheritBuffKey.OPPOSE_WAR_AVOID_RATIO]: '상대 회피 확률 감소',
  [InheritBuffKey.OPPOSE_WAR_CRITICAL_RATIO]: '상대 필살 확률 감소',
  [InheritBuffKey.OPPOSE_WAR_MAGIC_TRIAL_PROB]: '상대 전투계략 시도 확률 감소',
};

/**
 * 내정 대상 턴 타입
 */
const DOMESTIC_TARGET: Record<string, number> = {
  '상업': 1,
  '농업': 1,
  '치안': 1,
  '성벽': 1,
  '수비': 1,
  '민심': 1,
  '인구': 1,
  '기술': 1,
};

/**
 * 내정 계산 매핑
 */
const CALC_DOMESTIC: Record<string, [string, number]> = {
  'success': [InheritBuffKey.DOMESTIC_SUCCESS_PROB, 0.01],
  'fail': [InheritBuffKey.DOMESTIC_FAIL_PROB, -0.01],
};

/**
 * 스탯 계산 매핑
 */
const CALC_STAT: Record<string, [string, number]> = {
  'warAvoidRatio': [InheritBuffKey.WAR_AVOID_RATIO, 0.01],
  'warCriticalRatio': [InheritBuffKey.WAR_CRITICAL_RATIO, 0.01],
  'warMagicTrialProb': [InheritBuffKey.WAR_MAGIC_TRIAL_PROB, 0.01],
};

/**
 * 상대 스탯 계산 매핑
 */
const CALC_OPPOSE_STAT: Record<string, [string, number]> = {
  'warAvoidRatio': [InheritBuffKey.OPPOSE_WAR_AVOID_RATIO, -0.01],
  'warCriticalRatio': [InheritBuffKey.OPPOSE_WAR_CRITICAL_RATIO, -0.01],
  'warMagicTrialProb': [InheritBuffKey.OPPOSE_WAR_MAGIC_TRIAL_PROB, -0.01],
};

export class TriggerInheritBuff implements GameAction {
  private inheritBuffList: Record<string, number>;
  
  constructor(inheritBuffList: Record<string, number>) {
    this.inheritBuffList = inheritBuffList || {};
  }
  
  /**
   * 내정 계산 보정
   * PHP 대응: onCalcDomestic()
   */
  onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    if (Object.keys(this.inheritBuffList).length === 0) {
      return value;
    }
    
    if (!(turnType in DOMESTIC_TARGET)) {
      return value;
    }
    
    if (!(varType in CALC_DOMESTIC)) {
      return value;
    }
    
    const [iKey, coeff] = CALC_DOMESTIC[varType];
    if (!(iKey in this.inheritBuffList)) {
      return value;
    }
    
    return value + coeff * this.inheritBuffList[iKey];
  }
  
  /**
   * 스탯 계산 보정
   * PHP 대응: onCalcStat()
   */
  onCalcStat(general: any, statName: string, value: any, aux?: any): any {
    if (Object.keys(this.inheritBuffList).length === 0) {
      return value;
    }
    
    if (!(statName in CALC_STAT)) {
      return value;
    }
    
    const [iKey, coeff] = CALC_STAT[statName];
    if (!(iKey in this.inheritBuffList)) {
      return value;
    }
    
    return value + coeff * this.inheritBuffList[iKey];
  }
  
  /**
   * 상대 스탯 계산 보정
   * PHP 대응: onCalcOpposeStat()
   */
  onCalcOpposeStat(general: any, statName: string, value: any, aux?: any): any {
    if (Object.keys(this.inheritBuffList).length === 0) {
      return value;
    }
    
    if (!(statName in CALC_OPPOSE_STAT)) {
      return value;
    }
    
    const [iKey, coeff] = CALC_OPPOSE_STAT[statName];
    if (!(iKey in this.inheritBuffList)) {
      return value;
    }
    
    return value + coeff * this.inheritBuffList[iKey];
  }
  
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

/**
 * 유산 버프 트리거 생성
 */
export function createInheritBuffTrigger(inheritBuffList: Record<string, number> | null): TriggerInheritBuff | null {
  if (!inheritBuffList || Object.keys(inheritBuffList).length === 0) {
    return null;
  }
  return new TriggerInheritBuff(inheritBuffList);
}




