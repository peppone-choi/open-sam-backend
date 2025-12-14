/**
 * 내정 특기 모듈
 * PHP ActionSpecialDomestic/*.php 기반 마이그레이션
 */

// 기존 특기
export { Nongeop } from './Nongeop';
export { Sangeop } from './Sangeop';
export { Geonseol } from './Geonseol';
export { Jingbyeong } from './Jingbyeong';
export { Hullyeon } from './Hullyeon';

// 신규 추가 특기 (PHP 원본 기반)
export { Gyeongjak } from './Gyeongjak';   // 경작 (id=1)
export { Sangjae } from './Sangjae';       // 상재 (id=2)
export { Balmyeong } from './Balmyeong';   // 발명 (id=3)
export { Chukseong } from './Chukseong';   // 축성 (id=10)
export { Subi } from './Subi';             // 수비 (id=11)
export { Tongchal } from './Tongchal';     // 통찰 (id=12)
export { Indeok } from './Indeok';         // 인덕 (id=20)
export { Gwimo } from './Gwimo';           // 귀모 (id=31)

import { Nongeop } from './Nongeop';
import { Sangeop } from './Sangeop';
import { Geonseol } from './Geonseol';
import { Jingbyeong } from './Jingbyeong';
import { Hullyeon } from './Hullyeon';

// 신규 특기 import
import { Gyeongjak } from './Gyeongjak';
import { Sangjae } from './Sangjae';
import { Balmyeong } from './Balmyeong';
import { Chukseong } from './Chukseong';
import { Subi } from './Subi';
import { Tongchal } from './Tongchal';
import { Indeok } from './Indeok';
import { Gwimo } from './Gwimo';

import { PoliticsSpecialityBase } from '../SpecialityBase';

/**
 * 모든 내정 특기 클래스 목록
 * PHP 원본: 9개 특기 (거상은 비활성화)
 */
export const PoliticsSpecialities: Array<new () => PoliticsSpecialityBase> = [
  // 기존 특기
  Nongeop,      // 농업 (확장)
  Sangeop,      // 상업 (확장)
  Geonseol,     // 건설
  Jingbyeong,   // 징병
  Hullyeon,     // 훈련
  
  // PHP 원본 기반 추가
  Gyeongjak,    // 경작 (농업 +10%)
  Sangjae,      // 상재 (상업 +10%)
  Balmyeong,    // 발명 (기술 +10%)
  Chukseong,    // 축성 (성벽 +10%)
  Subi,         // 수비 (수비 +10%)
  Tongchal,     // 통찰 (치안 +10%)
  Indeok,       // 인덕 (민심/인구 +10%)
  Gwimo,        // 귀모 (계략 성공률 +20%p)
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


