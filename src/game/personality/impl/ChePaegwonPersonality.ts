/**
 * 성격: 패권
 * PHP 대응: ActionPersonality\che_패권
 * 
 * 효과: 최강 세력 추구
 */

import { BasePersonality } from '../BasePersonality';

export class ChePaegwonPersonality extends BasePersonality {
  get id(): string {
    return 'che_패권';
  }
  
  getName(): string {
    return '패권';
  }
  
  getInfo(): string {
    return '천하 패권 추구. 대규모 전쟁에서 유리';
  }
}

