/**
 * 명마 아이템 모음
 * PHP 대응: ActionItem/che_명마_*.php
 * 통솔 스탯 증가 아이템
 */

import { BaseStatItem } from '../../BaseStatItem';

// 명마 데이터 정의: [등급, 이름, 비용, 구매가능여부]
const HORSE_DATA: Array<[number, string, number, boolean]> = [
  // 등급 1~5 (기본 말)
  [1, '노기', 50, true],
  [2, '조랑', 60, true],
  [3, '노새', 70, true],
  [4, '나귀', 80, true],
  [5, '갈색마', 90, true],
  // 등급 6~10 (중급 말)
  [6, '흑색마', 100, true],
  [7, '기주마', 110, true],
  [7, '백마', 110, true],
  [7, '백상', 110, true],
  [7, '오환마', 110, true],
  [8, '양주마', 130, true],
  [8, '흉노마', 130, true],
  [9, '과하마', 150, true],
  [9, '의남백마', 150, true],
  [10, '대완마', 170, true],
  [10, '옥추마', 170, true],
  // 등급 11~15 (고급 말)
  [11, '서량마', 180, true],
  [11, '화종마', 180, true],
  [12, '사륜거', 190, true],
  [12, '옥란백용구', 190, true],
  [13, '적로', 200, true],
  [13, '절영', 200, true],
  [14, '적란마', 200, true],
  [14, '조황비전', 200, true],
  [15, '적토마', 200, false],
  [15, '한혈마', 200, false],
];

/**
 * 명마 아이템 클래스 정의
 */
class HorseItem extends BaseStatItem {
  private _id: string;

  constructor(grade: number, rawName: string, cost: number, buyable: boolean) {
    super('명마', grade, rawName, cost, buyable);
    this._id = `che_명마_${String(grade).padStart(2, '0')}_${rawName}`;
  }

  get id(): string {
    return this._id;
  }
}

// 명마 인스턴스 생성 및 export
export const HORSES: Record<string, HorseItem> = {};

for (const [grade, name, cost, buyable] of HORSE_DATA) {
  const horse = new HorseItem(grade, name, cost, buyable);
  HORSES[horse.id] = horse;
}

// 개별 명마 export (자주 사용되는 명마)
export const 노기 = HORSES['che_명마_01_노기'];
export const 적토마 = HORSES['che_명마_15_적토마'];
export const 한혈마 = HORSES['che_명마_15_한혈마'];
export const 적로 = HORSES['che_명마_13_적로'];
export const 절영 = HORSES['che_명마_13_절영'];

/**
 * 명마 ID로 아이템 조회
 */
export function getHorseById(id: string): HorseItem | null {
  return HORSES[id] || null;
}

/**
 * 등급으로 명마 목록 조회
 */
export function getHorsesByGrade(grade: number): HorseItem[] {
  return Object.values(HORSES).filter(h => h.getGrade() === grade);
}

/**
 * 구매 가능한 명마 목록 조회
 */
export function getBuyableHorses(): HorseItem[] {
  return Object.values(HORSES).filter(h => h.isBuyable());
}

/**
 * 모든 명마 클래스 목록
 */
export const ALL_HORSE_CLASSES = Object.values(HORSES);
