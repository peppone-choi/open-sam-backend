/**
 * 할거 성격
 * PHP 대응: ActionPersonality/che_할거.php
 */

import { BasePersonality } from '../BasePersonality';

export class CheHalgeoPersonality extends BasePersonality {
  get id(): string {
    return 'che_할거';
  }

  getName(): string {
    return '할거';
  }

  getInfo(): string {
    return '명성 -10%, 훈련 +5';
  }

  override onCalcStat(_general: any, statName: string, value: any, _aux?: any): any {
    if (statName === 'experience') {
      return value * 0.9;
    }
    if (statName === 'bonusTrain') {
      return value + 5;
    }
    return value;
  }
}
