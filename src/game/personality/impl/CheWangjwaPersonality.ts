/**
 * 왕좌 성격
 * PHP 대응: ActionPersonality/che_왕좌.php
 */

import { BasePersonality } from '../BasePersonality';

export class CheWangjwaPersonality extends BasePersonality {
  get id(): string {
    return 'che_왕좌';
  }

  getName(): string {
    return '왕좌';
  }

  getInfo(): string {
    return '명성 +10%, 사기 -5';
  }

  override onCalcStat(_general: any, statName: string, value: any, _aux?: any): any {
    if (statName === 'experience') {
      return value * 1.1;
    }
    if (statName === 'bonusAtmos') {
      return value - 5;
    }
    return value;
  }
}
