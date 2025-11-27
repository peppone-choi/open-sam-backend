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
    return '전쟁을 통한 영토 확장 추구. 공격 시 사기 보너스';
  }
  
  onCalcDomestic(turnType: string, varType: string, value: number, aux?: any): number {
    // 전투 시 사기 보너스
    if (turnType === '전투' && varType === 'atmos') {
      return value * 1.1;
    }
    return value;
  }
}

