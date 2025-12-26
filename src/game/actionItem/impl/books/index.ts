/**
 * 서적 아이템 모음
 * PHP 대응: ActionItem/che_서적_*.php
 * 지력 스탯 증가 아이템
 */

import { BaseStatItem } from '../../BaseStatItem';

// 서적 데이터 정의: [등급, 이름, 비용, 구매가능여부]
const BOOK_DATA: Array<[number, string, number, boolean]> = [
  // 등급 1~5 (기본 서적)
  [1, '효경전', 50, true],
  [2, '회남자', 60, true],
  [3, '변도론', 70, true],
  [4, '건상역주', 80, true],
  [5, '여씨춘추', 90, true],
  // 등급 6~10 (중급 서적)
  [6, '사민월령', 100, true],
  [7, '논어', 110, true],
  [7, '사마법', 110, true],
  [7, '위료자', 110, true],
  [7, '한서', 110, true],
  [8, '사기', 130, true],
  [8, '전론', 130, true],
  [9, '역경', 150, true],
  [9, '장자', 150, true],
  [10, '구국론', 170, true],
  [10, '시경', 170, true],
  // 등급 11~15 (고급 서적)
  [11, '상군서', 180, true],
  [11, '춘추전', 180, true],
  [12, '맹덕신서', 190, true],
  [12, '산해경', 190, true],
  [13, '관자', 200, true],
  [14, '오자병법', 200, true],
  [15, '손자병법', 200, false],
];

/**
 * 서적 아이템 클래스 정의
 */
class BookItem extends BaseStatItem {
  private _id: string;

  constructor(grade: number, rawName: string, cost: number, buyable: boolean) {
    super('서적', grade, rawName, cost, buyable);
    this._id = `che_서적_${String(grade).padStart(2, '0')}_${rawName}`;
  }

  get id(): string {
    return this._id;
  }
}

// 서적 인스턴스 생성 및 export
export const BOOKS: Record<string, BookItem> = {};

for (const [grade, name, cost, buyable] of BOOK_DATA) {
  const book = new BookItem(grade, name, cost, buyable);
  BOOKS[book.id] = book;
}

// 개별 서적 export (자주 사용되는 서적)
export const 효경전 = BOOKS['che_서적_01_효경전'];
export const 손자병법 = BOOKS['che_서적_15_손자병법'];
export const 오자병법 = BOOKS['che_서적_14_오자병법'];
export const 관자 = BOOKS['che_서적_13_관자'];
export const 맹덕신서 = BOOKS['che_서적_12_맹덕신서'];

/**
 * 서적 ID로 아이템 조회
 */
export function getBookById(id: string): BookItem | null {
  return BOOKS[id] || null;
}

/**
 * 등급으로 서적 목록 조회
 */
export function getBooksByGrade(grade: number): BookItem[] {
  return Object.values(BOOKS).filter(b => b.getGrade() === grade);
}

/**
 * 구매 가능한 서적 목록 조회
 */
export function getBuyableBooks(): BookItem[] {
  return Object.values(BOOKS).filter(b => b.isBuyable());
}

/**
 * 모든 서적 클래스 목록
 */
export const ALL_BOOK_CLASSES = Object.values(BOOKS);
