/**
 * 재간 성격
 * PHP 대응: ActionPersonality/che_재간.php
 */

import { BasePersonality } from '../BasePersonality';

export class CheJaeganPersonality extends BasePersonality {
  get id(): string {
    return 'che_재간';
  }

  getName(): string {
    return '재간';
  }

  getInfo(): string {
    return '명성 -10%, 징·모병 비용 -20%';
  }

  override onCalcDomestic(turnType: string, varType: string, value: number, _aux?: any): number {
    if (turnType === '징병' || turnType === '모병') {
      if (varType === 'cost') {
        return value * 0.8;
      }
    }
    return value;
  }

  override onCalcStat(_general: any, statName: string, value: any, _aux?: any): any {
    if (statName === 'experience') {
      return value * 0.9;
    }
    return value;
  }
}
