/**
 * 성격: 은둔
 * PHP 대응: ActionPersonality\che_은둔
 * 
 * 효과: 재야 시 이점
 */

import { BasePersonality } from '../BasePersonality';

export class CheEundunPersonality extends BasePersonality {
  get id(): string {
    return 'che_은둔';
  }
  
  getName(): string {
    return '은둔';
  }
  
  getInfo(): string {
    return '명성 -10%, 계급 -10%, 사기 -5, 훈련 -5, 단련 성공률 +10%';
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, _aux?: any): number {
    if (turnType === '단련') {
      if (varType === 'success') {
        return value + 0.1;
      }
    }
    return value;
  }

  override onCalcStat(_general: any, statName: string, value: any, _aux?: any): any {
    if (statName === 'bonusAtmos') {
      return value - 5;
    }
    if (statName === 'bonusTrain') {
      return value - 5;
    }
    if (statName === 'experience') {
      return value * 0.9;
    }
    if (statName === 'dedication') {
      return value * 0.9;
    }
    return value;
  }
}




