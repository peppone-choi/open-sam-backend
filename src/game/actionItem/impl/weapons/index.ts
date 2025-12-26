/**
 * 무기 아이템 모음
 * PHP 대응: ActionItem/che_무기_*.php
 * 무력 스탯 증가 아이템
 */

import { BaseStatItem } from '../../BaseStatItem';

// 무기 데이터 정의: [등급, 이름, 비용, 구매가능여부]
const WEAPON_DATA: Array<[number, string, number, boolean]> = [
  // 등급 1~5 (기본 무기)
  [1, '단도', 50, true],
  [2, '단궁', 60, true],
  [3, '단극', 70, true],
  [4, '목검', 80, true],
  [5, '죽창', 90, true],
  // 등급 6~10 (중급 무기)
  [6, '소부', 100, true],
  [7, '동추', 110, true],
  [7, '맥궁', 110, true],
  [7, '철쇄', 110, true],
  [7, '철편', 110, true],
  [8, '유성추', 130, true],
  [8, '철질여골', 130, true],
  [9, '동호비궁', 150, true],
  [9, '쌍철극', 150, true],
  [10, '대부', 170, true],
  [10, '삼첨도', 170, true],
  // 등급 11~15 (고급 무기)
  [11, '고정도', 180, true],
  [11, '이광궁', 180, true],
  [12, '칠성검', 190, true],
  [12, '철척사모', 190, true],
  [13, '사모', 200, true],
  [13, '양유기궁', 200, true],
  [14, '방천화극', 200, true],
  [14, '언월도', 200, true],
  [15, '의천검', 200, false],
  [15, '청홍검', 200, false],
];

/**
 * 무기 아이템 클래스 정의
 */
class WeaponItem extends BaseStatItem {
  private _id: string;

  constructor(grade: number, rawName: string, cost: number, buyable: boolean) {
    super('무기', grade, rawName, cost, buyable);
    this._id = `che_무기_${String(grade).padStart(2, '0')}_${rawName}`;
  }

  get id(): string {
    return this._id;
  }
}

// 무기 인스턴스 생성 및 export
export const WEAPONS: Record<string, WeaponItem> = {};

for (const [grade, name, cost, buyable] of WEAPON_DATA) {
  const weapon = new WeaponItem(grade, name, cost, buyable);
  WEAPONS[weapon.id] = weapon;
}

// 개별 무기 export (자주 사용되는 무기)
export const 단도 = WEAPONS['che_무기_01_단도'];
export const 단궁 = WEAPONS['che_무기_02_단궁'];
export const 단극 = WEAPONS['che_무기_03_단극'];
export const 의천검 = WEAPONS['che_무기_15_의천검'];
export const 청홍검 = WEAPONS['che_무기_15_청홍검'];
export const 방천화극 = WEAPONS['che_무기_14_방천화극'];

/**
 * 무기 ID로 아이템 조회
 */
export function getWeaponById(id: string): WeaponItem | null {
  return WEAPONS[id] || null;
}

/**
 * 등급으로 무기 목록 조회
 */
export function getWeaponsByGrade(grade: number): WeaponItem[] {
  return Object.values(WEAPONS).filter(w => w.getGrade() === grade);
}

/**
 * 구매 가능한 무기 목록 조회
 */
export function getBuyableWeapons(): WeaponItem[] {
  return Object.values(WEAPONS).filter(w => w.isBuyable());
}

/**
 * 모든 무기 클래스 목록
 */
export const ALL_WEAPON_CLASSES = Object.values(WEAPONS);
