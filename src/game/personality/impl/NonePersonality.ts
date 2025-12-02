/**
 * 성격 없음 / 중립
 * PHP 대응: ActionPersonality\None 또는 che_중립
 */

import { BasePersonality } from '../BasePersonality';

export class NonePersonality extends BasePersonality {
  get id(): string {
    return 'None';
  }
  
  getName(): string {
    return '중립';
  }
  
  getInfo(): string {
    return '특별한 성향 없음';
  }
}




