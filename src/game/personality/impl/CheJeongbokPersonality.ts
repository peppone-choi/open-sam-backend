/**
 * 성격: 정복
 * PHP 대응: ActionPersonality\che_정복
 * 
 * 효과: 전쟁 관련 보너스
 */

import { BasePersonality } from '../BasePersonality';

export class CheJeongbokPersonality extends BasePersonality {
  get id(): string {
    return 'che_정복';
  }
  
  getName(): string {
    return '정복';
  }
  
  getInfo(): string {
    return '명성 -10%, 사기 +5';
  }
  
  override onCalcStat(_general: any, statName: string, value: any, _aux?: any): any {
    if (statName === 'experience') {
      return value * 0.9;
    }
    if (statName === 'bonusAtmos') {
      return value + 5;
    }
    return value;
  }
}




