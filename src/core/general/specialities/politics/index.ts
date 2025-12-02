/**
 * 내정 특기 모듈
 */

export { Nongeop } from './Nongeop';
export { Sangeop } from './Sangeop';
export { Geonseol } from './Geonseol';
export { Jingbyeong } from './Jingbyeong';
export { Hullyeon } from './Hullyeon';

import { Nongeop } from './Nongeop';
import { Sangeop } from './Sangeop';
import { Geonseol } from './Geonseol';
import { Jingbyeong } from './Jingbyeong';
import { Hullyeon } from './Hullyeon';
import { PoliticsSpecialityBase } from '../SpecialityBase';

/**
 * 모든 내정 특기 클래스 목록
 */
export const PoliticsSpecialities: Array<new () => PoliticsSpecialityBase> = [
  Nongeop,
  Sangeop,
  Geonseol,
  Jingbyeong,
  Hullyeon,
];

/**
 * 내정 특기 ID로 찾기
 */
export function getPoliticsSpecialityById(
  id: number
): (new () => PoliticsSpecialityBase) | undefined {
  return PoliticsSpecialities.find((SpecClass) => {
    const instance = new SpecClass();
    return instance.id === id;
  });
}

/**
 * 내정 특기 이름으로 찾기
 */
export function getPoliticsSpecialityByName(
  name: string
): (new () => PoliticsSpecialityBase) | undefined {
  return PoliticsSpecialities.find((SpecClass) => {
    const instance = new SpecClass();
    return instance.name === name;
  });
}


