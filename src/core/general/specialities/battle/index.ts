/**
 * 전투 특기 모듈
 * PHP ActionSpecialWar/*.php 기반 마이그레이션
 */

// 기존 특기
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

// 신규 추가 특기 (PHP 기반)
export { Gyukno } from './Gyukno';           // 격노
export { Gongseong } from './Gongseong';     // 공성
export { Gungbyeong } from './Gungbyeong';   // 궁병
export { Gwibyeong } from './Gwibyeong';     // 귀병
export { Gibyeong } from './Gibyeong';       // 기병
export { Bobyeong } from './Bobyeong';       // 보병
export { Bangye } from './Bangye';           // 반계
export { Sinsan } from './Sinsan';           // 신산
export { Wiap } from './Wiap';               // 위압
export { Uisul } from './Uisul';             // 의술
export { Jeogyeok } from './Jeogyeok';       // 저격
export { Jipjung } from './Jipjung';         // 집중
export { Jingbyeong } from './Jingbyeong';   // 징병
export { Hwansul } from './Hwansul';         // 환술

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

// 신규 특기 import
import { Gyukno } from './Gyukno';
import { Gongseong } from './Gongseong';
import { Gungbyeong } from './Gungbyeong';
import { Gwibyeong } from './Gwibyeong';
import { Gibyeong } from './Gibyeong';
import { Bobyeong } from './Bobyeong';
import { Bangye } from './Bangye';
import { Sinsan } from './Sinsan';
import { Wiap } from './Wiap';
import { Uisul } from './Uisul';
import { Jeogyeok } from './Jeogyeok';
import { Jipjung } from './Jipjung';
import { Jingbyeong } from './Jingbyeong';
import { Hwansul } from './Hwansul';

import { BattleSpecialityBase } from '../SpecialityBase';

/**
 * 모든 전투 특기 클래스 목록
 * PHP 원본: 20개 특기
 */
export const BattleSpecialities: Array<new () => BattleSpecialityBase> = [
  // 기존 특기
  Musang,       // 무쌍
  Sinjung,      // 신중
  Cheoksa,      // 척사
  Indeok,       // 인덕
  Dolgyeok,     // 돌격
  Cheolbyeok,   // 철벽(견고)
  Myeongsa,     // 명사
  Jilpung,      // 질풍
  Giseup,       // 기습
  Pilsal,       // 필살
  
  // 신규 추가 특기
  Gyukno,       // 격노
  Gongseong,    // 공성
  Gungbyeong,   // 궁병
  Gwibyeong,    // 귀병
  Gibyeong,     // 기병
  Bobyeong,     // 보병
  Bangye,       // 반계
  Sinsan,       // 신산
  Wiap,         // 위압
  Uisul,        // 의술
  Jeogyeok,     // 저격
  Jipjung,      // 집중
  Jingbyeong,   // 징병
  Hwansul,      // 환술
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


