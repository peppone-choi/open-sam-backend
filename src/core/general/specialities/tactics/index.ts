/**
 * 계략 특기 모듈
 */

export { Cheonjae } from './Cheonjae';
export { Gwimo } from './Gwimo';
export { Hwagong } from './Hwagong';
export { Sugong } from './Sugong';
export { Doksal } from './Doksal';

import { Cheonjae } from './Cheonjae';
import { Gwimo } from './Gwimo';
import { Hwagong } from './Hwagong';
import { Sugong } from './Sugong';
import { Doksal } from './Doksal';
import { TacticsSpecialityBase } from '../SpecialityBase';

/**
 * 모든 계략 특기 클래스 목록
 */
export const TacticsSpecialities: Array<new () => TacticsSpecialityBase> = [
  Cheonjae,
  Gwimo,
  Hwagong,
  Sugong,
  Doksal,
];

/**
 * 계략 특기 ID로 찾기
 */
export function getTacticsSpecialityById(
  id: number
): (new () => TacticsSpecialityBase) | undefined {
  return TacticsSpecialities.find((SpecClass) => {
    const instance = new SpecClass();
    return instance.id === id;
  });
}

/**
 * 계략 특기 이름으로 찾기
 */
export function getTacticsSpecialityByName(
  name: string
): (new () => TacticsSpecialityBase) | undefined {
  return TacticsSpecialities.find((SpecClass) => {
    const instance = new SpecClass();
    return instance.name === name;
  });
}


