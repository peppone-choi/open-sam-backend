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
    return '숨어 지내는 것을 선호. 재야 생활에 유리';
  }
}




