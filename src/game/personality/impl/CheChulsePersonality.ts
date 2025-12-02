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
    return '관직 승진 추구. 공헌도 획득 +10%';
  }
  
  onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    // 공헌도 획득 보너스
    if (varType === 'dedication') {
      return value * 1.1;
    }
    return value;
  }
}




