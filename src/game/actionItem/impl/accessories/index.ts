/**
 * 장신구 아이템 모음
 * 매력 스탯 증가 아이템
 * 삼국지 세계관에 맞는 장신구/장식품
 */

import { BaseStatItem } from '../../BaseStatItem';

// 장신구 데이터 정의: [등급, 이름, 비용, 구매가능여부]
const ACCESSORY_DATA: Array<[number, string, number, boolean]> = [
  // 등급 1~5 (기본 장신구)
  [1, '초화', 50, true],
  [2, '비녀', 60, true],
  [3, '옥패', 70, true],
  [4, '은패', 80, true],
  [5, '금패', 90, true],
  // 등급 6~10 (중급 장신구)
  [6, '옥관', 100, true],
  [7, '금관', 110, true],
  [7, '진주비녀', 110, true],
  [8, '비취팔찌', 130, true],
  [8, '진주목걸이', 130, true],
  [9, '칠보영락', 150, true],
  [9, '황금요대', 150, true],
  [10, '백옥관', 170, true],
  [10, '용문패', 170, true],
  // 등급 11~15 (고급 장신구 - 제왕급)
  [11, '봉황관', 180, true],
  [11, '용안옥', 180, true],
  [12, '용포', 190, true],
  [12, '구슬', 190, true],
  [13, '야명주', 200, true],
  [14, '화씨벽', 200, false],
  [15, '수씨벽', 200, false],
  [15, '전국옥새', 200, false],
];

/**
 * 장신구 아이템 클래스 정의
 */
class AccessoryItem extends BaseStatItem {
  private _id: string;

  constructor(grade: number, rawName: string, cost: number, buyable: boolean) {
    super('장신구', grade, rawName, cost, buyable);
    this._id = `che_장신구_${String(grade).padStart(2, '0')}_${rawName}`;
  }

  get id(): string {
    return this._id;
  }
}

// 장신구 인스턴스 생성 및 export
export const ACCESSORIES: Record<string, AccessoryItem> = {};

for (const [grade, name, cost, buyable] of ACCESSORY_DATA) {
  const accessory = new AccessoryItem(grade, name, cost, buyable);
  ACCESSORIES[accessory.id] = accessory;
}

// 개별 장신구 export (자주 사용되는 장신구)
export const 초화 = ACCESSORIES['che_장신구_01_초화'];
export const 전국옥새 = ACCESSORIES['che_장신구_15_전국옥새'];
export const 수씨벽 = ACCESSORIES['che_장신구_15_수씨벽'];
export const 화씨벽 = ACCESSORIES['che_장신구_14_화씨벽'];
export const 야명주 = ACCESSORIES['che_장신구_13_야명주'];

/**
 * 장신구 ID로 아이템 조회
 */
export function getAccessoryById(id: string): AccessoryItem | null {
  return ACCESSORIES[id] || null;
}

/**
 * 등급으로 장신구 목록 조회
 */
export function getAccessoriesByGrade(grade: number): AccessoryItem[] {
  return Object.values(ACCESSORIES).filter(a => a.getGrade() === grade);
}

/**
 * 구매 가능한 장신구 목록 조회
 */
export function getBuyableAccessories(): AccessoryItem[] {
  return Object.values(ACCESSORIES).filter(a => a.isBuyable());
}

/**
 * 모든 장신구 클래스 목록
 */
export const ALL_ACCESSORY_CLASSES = Object.values(ACCESSORIES);
