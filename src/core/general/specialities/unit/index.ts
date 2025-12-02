/**
 * 병종 특기 모듈
 */

export { Gibyeong } from './Gibyeong';
export { Bobyeong } from './Bobyeong';
export { Gungbyeong } from './Gungbyeong';
export { Changbyeong } from './Changbyeong';
export { Sugun } from './Sugun';

import { Gibyeong } from './Gibyeong';
import { Bobyeong } from './Bobyeong';
import { Gungbyeong } from './Gungbyeong';
import { Changbyeong } from './Changbyeong';
import { Sugun } from './Sugun';
import { UnitSpecialityBase } from '../SpecialityBase';

/**
 * 모든 병종 특기 클래스 목록
 */
export const UnitSpecialities: Array<new () => UnitSpecialityBase> = [
  Gibyeong,
  Bobyeong,
  Gungbyeong,
  Changbyeong,
  Sugun,
];

/**
 * 병종 특기 ID로 찾기
 */
export function getUnitSpecialityById(
  id: number
): (new () => UnitSpecialityBase) | undefined {
  return UnitSpecialities.find((SpecClass) => {
    const instance = new SpecClass();
    return instance.id === id;
  });
}

/**
 * 병종 특기 이름으로 찾기
 */
export function getUnitSpecialityByName(
  name: string
): (new () => UnitSpecialityBase) | undefined {
  return UnitSpecialities.find((SpecClass) => {
    const instance = new SpecClass();
    return instance.name === name;
  });
}

/**
 * 병종 타입에 맞는 특기 찾기
 */
export function getUnitSpecialityByUnitType(
  unitType: string
): (new () => UnitSpecialityBase) | undefined {
  return UnitSpecialities.find((SpecClass) => {
    const instance = new SpecClass();
    return instance.matchesUnitType(unitType);
  });
}


