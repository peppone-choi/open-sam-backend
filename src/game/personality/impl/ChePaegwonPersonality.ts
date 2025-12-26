/**
 * 성격: 패권
 * PHP 대응: ActionPersonality\che_패권
 * 
 * 효과: 최강 세력 추구
 */

import { BasePersonality } from '../BasePersonality';

export class ChePaegwonPersonality extends BasePersonality {
  get id(): string {
    return 'che_패권';
  }
  
  getName(): string {
    return '패권';
  }
  
  getInfo(): string {
    return '훈련 +5, 징·모병 비용 +20%';
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, _aux?: any): number {
    if (['징병', '모병'].includes(turnType)) {
      if (varType === 'cost') {
        return value * 1.2;
      }
    }
    return value;
  }

  override onCalcStat(_general: any, statName: string, value: any, _aux?: any): any {
    if (statName === 'bonusTrain') {
      return value + 5;
    }
    return value;
  }
}




