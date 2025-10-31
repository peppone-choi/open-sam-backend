/**
 * Archetype (원형) 인터페이스
 * 
 * 시나리오 간 공통으로 사용되는 최소한의 필드만 정의
 */

import { Role, RoleRef, ScenarioId, EntityId } from './role.types';

/**
 * 자원 가방 (동적 자원)
 */
export type ResourceBag = Record<string, number>;

/**
 * 기본 엔티티 (모든 엔티티의 공통 필드)
 */
export interface EntityBase {
  id: EntityId;
  scenario: ScenarioId;
  role: Role;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 거점 원형 (도시/행성/마을)
 */
export interface SettlementBase extends EntityBase {
  role: Role.SETTLEMENT;
  name: string;
  population: number;
  defenseValue: number;
  
  // 자원 (동적)
  resources: ResourceBag;
  
  // 관계
  ownerRef?: RoleRef<Role.FACTION>;
  
  // 시나리오 전용 필드
  ext?: Record<string, any>;
}

/**
 * 지휘관 원형 (장수/영웅/커맨더)
 */
export interface CommanderBase extends EntityBase {
  role: Role.COMMANDER;
  name: string;
  
  // 능력치 (공통)
  leadership: number;
  strength: number;
  intel: number;
  
  // 병력 (예약 모델)
  crew_total: number;
  crew_reserved: number;
  crew_available: number;
  reservations?: Record<string, number>;
  in_combat_delta?: Record<string, number>;
  
  // 자원 (동적)
  resources: ResourceBag;
  
  // 상태
  status: 'alive' | 'dead' | 'captured' | 'retired';
  death_cause?: 'combat_kia' | 'disease' | 'old_age' | 'execution' | 'other';
  death_at?: Date;
  death_context?: any;
  
  // 관계
  assignedSettlementRef?: RoleRef<Role.SETTLEMENT>;
  factionRef?: RoleRef<Role.FACTION>;
  
  // 시나리오 전용 필드
  ext?: Record<string, any>;
}

/**
 * 세력 원형 (국가/왕국/세력)
 */
export interface FactionBase extends EntityBase {
  role: Role.FACTION;
  name: string;
  
  // 자원 (동적)
  resources: ResourceBag;
  
  // 관계
  capitalRef?: RoleRef<Role.SETTLEMENT>;
  leaderRef?: RoleRef<Role.COMMANDER>;
  
  // 시나리오 전용 필드
  ext?: Record<string, any>;
}

/**
 * 병력 원형 (부대/군단/함대)
 */
export interface ForceBase extends EntityBase {
  role: Role.FORCE;
  
  // 지휘관
  commanderRef: RoleRef<Role.COMMANDER>;
  
  // 병력
  troops: number;
  unitType: number;
  
  // 전투력
  attack: number;
  defense: number;
  morale: number;
  
  // 위치
  settlementRef?: RoleRef<Role.SETTLEMENT>;
  
  // 시나리오 전용 필드
  ext?: Record<string, any>;
}

/**
 * 외교 관계 원형
 */
export interface DiplomacyBase extends EntityBase {
  role: Role.DIPLOMACY;
  
  // 관계 대상
  factionARef: RoleRef<Role.FACTION>;
  factionBRef: RoleRef<Role.FACTION>;
  
  // 관계 상태
  status: 'neutral' | 'allied' | 'war' | 'non_aggression';
  
  // 시나리오 전용 필드
  ext?: Record<string, any>;
}
