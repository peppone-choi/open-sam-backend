/**
 * 전투 특기 모듈
 */

export { Musang } from './Musang';
export { Sinjung } from './Sinjung';
export { Cheoksa } from './Cheoksa';
export { Indeok } from './Indeok';
export { Dolgyeok } from './Dolgyeok';
export { Cheolbyeok } from './Cheolbyeok';
export { Myeongsa } from './Myeongsa';
export { Jilpung } from './Jilpung';
export { Giseup } from './Giseup';
export { Pilsal } from './Pilsal';

import { Musang } from './Musang';
import { Sinjung } from './Sinjung';
import { Cheoksa } from './Cheoksa';
import { Indeok } from './Indeok';
import { Dolgyeok } from './Dolgyeok';
import { Cheolbyeok } from './Cheolbyeok';
import { Myeongsa } from './Myeongsa';
import { Jilpung } from './Jilpung';
import { Giseup } from './Giseup';
import { Pilsal } from './Pilsal';
import { BattleSpecialityBase } from '../SpecialityBase';

/**
 * 모든 전투 특기 클래스 목록
 */
export const BattleSpecialities: Array<new () => BattleSpecialityBase> = [
  Musang,
  Sinjung,
  Cheoksa,
  Indeok,
  Dolgyeok,
  Cheolbyeok,
  Myeongsa,
  Jilpung,
  Giseup,
  Pilsal,
];

/**
 * 전투 특기 ID로 찾기
 */
export function getBattleSpecialityById(
  id: number
): (new () => BattleSpecialityBase) | undefined {
  return BattleSpecialities.find((SpecClass) => {
    const instance = new SpecClass();
    return instance.id === id;
  });
}

/**
 * 전투 특기 이름으로 찾기
 */
export function getBattleSpecialityByName(
  name: string
): (new () => BattleSpecialityBase) | undefined {
  return BattleSpecialities.find((SpecClass) => {
    const instance = new SpecClass();
    return instance.name === name;
  });
}


