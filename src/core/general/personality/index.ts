/**
 * 장수 성격 시스템 모듈
 * PHP ActionPersonality/*.php 기반 마이그레이션
 */

export { PersonalityBase, IStatCalcContext, IDomesticCalcContext } from './PersonalityBase';

// 성격 클래스들
export { Wangjwa } from './Wangjwa';       // 왕좌 (id=0)
export { Daeeui } from './Daeeui';         // 대의 (id=1)
export { Uihyeop } from './Uihyeop';       // 의협 (id=2)
export { Paegwon } from './Paegwon';       // 패권 (id=3)
export { Jeongbok } from './Jeongbok';     // 정복 (id=4)
export { Halgeo } from './Halgeo';         // 할거 (id=5)
export { Chulse } from './Chulse';         // 출세 (id=6)
export { Jaegan } from './Jaegan';         // 재간 (id=7)
export { Yuji } from './Yuji';             // 유지 (id=8)
export { Anjeon } from './Anjeon';         // 안전 (id=9)
export { Eundun } from './Eundun';         // 은둔 (id=10)

import { PersonalityBase } from './PersonalityBase';
import { Wangjwa } from './Wangjwa';
import { Daeeui } from './Daeeui';
import { Uihyeop } from './Uihyeop';
import { Paegwon } from './Paegwon';
import { Jeongbok } from './Jeongbok';
import { Halgeo } from './Halgeo';
import { Chulse } from './Chulse';
import { Jaegan } from './Jaegan';
import { Yuji } from './Yuji';
import { Anjeon } from './Anjeon';
import { Eundun } from './Eundun';

/**
 * 모든 성격 클래스 목록
 * PHP 원본: 11개 성격
 */
export const Personalities: Array<new () => PersonalityBase> = [
  Wangjwa,    // 왕좌 (명성 +10%, 사기 -5)
  Daeeui,     // 대의 (명성 +10%, 훈련 -5)
  Uihyeop,    // 의협 (사기 +5, 징모병비 +20%)
  Paegwon,    // 패권 (훈련 +5, 징모병비 +20%)
  Jeongbok,   // 정복 (명성 -10%, 사기 +5)
  Halgeo,     // 할거 (명성 -10%, 훈련 +5)
  Chulse,     // 출세 (명성 +10%, 징모병비 +20%)
  Jaegan,     // 재간 (명성 -10%, 징모병비 -20%)
  Yuji,       // 유지 (훈련 -5, 징모병비 -20%)
  Anjeon,     // 안전 (사기 -5, 징모병비 -20%)
  Eundun,     // 은둔 (명성 -10%, 계급 -10%, 사기 -5, 훈련 -5, 단련 +10%)
];

/**
 * 성격 ID로 찾기
 */
export function getPersonalityById(
  id: number
): (new () => PersonalityBase) | undefined {
  return Personalities.find((PersonClass) => {
    const instance = new PersonClass();
    return instance.id === id;
  });
}

/**
 * 성격 이름으로 찾기
 */
export function getPersonalityByName(
  name: string
): (new () => PersonalityBase) | undefined {
  return Personalities.find((PersonClass) => {
    const instance = new PersonClass();
    return instance.name === name;
  });
}

/**
 * 성격 인스턴스 생성
 */
export function createPersonality(idOrName: number | string): PersonalityBase | null {
  let PersonClass: (new () => PersonalityBase) | undefined;
  
  if (typeof idOrName === 'number') {
    PersonClass = getPersonalityById(idOrName);
  } else {
    PersonClass = getPersonalityByName(idOrName);
  }
  
  if (PersonClass) {
    return new PersonClass();
  }
  
  return null;
}







