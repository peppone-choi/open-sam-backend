/**
 * 성격: 출세
 * PHP 대응: ActionPersonality\che_출세
 * 
 * 효과: 공헌도 획득 보너스
 */

import { BasePersonality } from '../BasePersonality';

export class CheChulsePersonality extends BasePersonality {
  get id(): string {
    return 'che_출세';
  }
  
  getName(): string {
    return '출세';
  }
  
  getInfo(): string {
    return '명성 +10%, 징·모병 비용 +20%';
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
    if (statName === 'experience') {
      return value * 1.1;
    }
    return value;
  }
}




