/**
 * 인장 아이템 모음
 * 정치 스탯 증가 아이템
 * 삼국지 세계관에 맞는 관직/권위 관련 인장
 */

import { BaseStatItem } from '../../BaseStatItem';

// 인장 데이터 정의: [등급, 이름, 비용, 구매가능여부]
const SEAL_DATA: Array<[number, string, number, boolean]> = [
  // 등급 1~5 (기본 인장)
  [1, '동인', 50, true],
  [2, '은인', 60, true],
  [3, '관인', 70, true],
  [4, '현인', 80, true],
  [5, '주인', 90, true],
  // 등급 6~10 (중급 인장 - 장군인)
  [6, '목인', 100, true],
  [7, '비장군인', 110, true],
  [7, '편장군인', 110, true],
  [8, '잡호장군인', 130, true],
  [8, '아문장', 130, true],
  [9, '사중장', 150, true],
  [9, '표기장군인', 150, true],
  [10, '거기장군인', 170, true],
  [10, '대장군인', 170, true],
  // 등급 11~15 (고급 인장 - 삼공/제왕)
  [11, '태위인', 180, true],
  [11, '사공인', 180, true],
  [12, '사도인', 190, true],
  [12, '승상인', 190, true],
  [13, '대사마인', 200, true],
  [14, '옥새', 200, false],
  [15, '전국새', 200, false],
  [15, '천자옥새', 200, false],
];

/**
 * 인장 아이템 클래스 정의
 */
class SealItem extends BaseStatItem {
  private _id: string;

  constructor(grade: number, rawName: string, cost: number, buyable: boolean) {
    super('인장', grade, rawName, cost, buyable);
    this._id = `che_인장_${String(grade).padStart(2, '0')}_${rawName}`;
  }

  get id(): string {
    return this._id;
  }
}

// 인장 인스턴스 생성 및 export
export const SEALS: Record<string, SealItem> = {};

for (const [grade, name, cost, buyable] of SEAL_DATA) {
  const seal = new SealItem(grade, name, cost, buyable);
  SEALS[seal.id] = seal;
}

// 개별 인장 export (자주 사용되는 인장)
export const 동인 = SEALS['che_인장_01_동인'];
export const 천자옥새 = SEALS['che_인장_15_천자옥새'];
export const 전국새 = SEALS['che_인장_15_전국새'];
export const 옥새 = SEALS['che_인장_14_옥새'];
export const 승상인 = SEALS['che_인장_12_승상인'];

/**
 * 인장 ID로 아이템 조회
 */
export function getSealById(id: string): SealItem | null {
  return SEALS[id] || null;
}

/**
 * 등급으로 인장 목록 조회
 */
export function getSealsByGrade(grade: number): SealItem[] {
  return Object.values(SEALS).filter(s => s.getGrade() === grade);
}

/**
 * 구매 가능한 인장 목록 조회
 */
export function getBuyableSeals(): SealItem[] {
  return Object.values(SEALS).filter(s => s.isBuyable());
}

/**
 * 모든 인장 클래스 목록
 */
export const ALL_SEAL_CLASSES = Object.values(SEALS);
