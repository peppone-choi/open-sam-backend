/**
 * 성격: 대의
 * PHP 대응: ActionPersonality\che_대의
 * 
 * 효과: 국가 충성도 보너스, 반란 시 페널티
 */

import { BasePersonality } from '../BasePersonality';

export class CheDaeuiPersonality extends BasePersonality {
  get id(): string {
    return 'che_대의';
  }
  
  getName(): string {
    return '대의';
  }
  
  getInfo(): string {
    return '명성 +10%, 훈련 -5';
  }

  onCalcStat(general: any, statName: string, value: any, aux?: any): any {
    if (statName === 'experience') {
      return value * 1.1;
    }
    if (statName === 'bonusTrain') {
      return value - 5;
    }
    return value;
  }
}




