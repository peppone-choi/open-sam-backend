/**
 * Troop 도메인 타입 정의
 * schema.sql의 troop 테이블 기반
 */

export interface ITroop {
  id: string; // troopLeader (장수 ID)
  nation: string; // nationId
  name: string; // 부대명
  
  createdAt: Date;
  updatedAt: Date;
}

// 병종 타입 (unit/basic.php 기반)
export enum CrewType {
  FOOTMAN = 1100, // 보병
  ARCHER = 1200, // 궁병
  CAVALRY = 1300, // 기병
  WIZARD = 1400, // 귀병
  WIZARD_SPECIAL = 1405, // 남귀병
  SIEGE = 1500, // 정란
  SIEGE_SPECIAL = 1501, // 충차
}

export interface ICrewTypeInfo {
  id: number;
  type: 'FOOTMAN' | 'ARCHER' | 'CAVALRY' | 'WIZARD' | 'SIEGE' | 'CASTLE';
  name: string;
  
  // 비용
  goldCost: number;
  riceCost: number;
  
  // 전투력
  atk: number;
  def: number;
  dex: number;
  
  // 상성
  atkBonus: Record<string, number>; // 공격 상성
  defBonus: Record<string, number>; // 방어 상성
  
  description: string[];
  specialAbilities?: string[];
}
