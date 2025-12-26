/**
 * 유지 성격
 * PHP 대응: ActionPersonality/che_유지.php
 */

import { BasePersonality } from '../BasePersonality';

export class CheYujiPersonality extends BasePersonality {
  get id(): string {
    return 'che_유지';
  }

  getName(): string {
    return '유지';
  }

  getInfo(): string {
    return '훈련 -5, 징·모병 비용 -20%';
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
    if (statName === 'bonusTrain') {
      return value - 5;
    }
    return value;
  }
}
