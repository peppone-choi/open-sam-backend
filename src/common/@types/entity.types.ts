/**
 * 완전 중립 Entity 모델
 * 
 * 모든 게임 엔티티를 하나의 유연한 구조로 통합
 */

import { Role, RoleRef, ScenarioId, EntityId } from './role.types';

/**
 * 슬롯 (생산/건물 등)
 */
export interface Slot {
  value: number;
  max: number;
  level?: number;
  progress?: number;
  meta?: any;
}

/**
 * 속성 (동적 능력치)
 */
export type AttributeMap = Record<string, number>;

/**
 * 자원 가방
 */
export type ResourceBag = Record<string, number>;

/**
 * 슬롯 맵
 */
export type SlotMap = Record<string, Slot>;

/**
 * 참조 맵
 */
export type RefMap = Record<string, RoleRef | RoleRef[]>;

/**
 * 시스템 상태 맵
 */
export type SystemStateMap = Record<string, any>;

/**
 * 완전 중립 Entity
 */
export interface Entity {
  // 기본 메타데이터
  id: EntityId;
  scenario: ScenarioId;
  role: Role;
  name?: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  
  // 동적 능력치 (완전 중립)
  attributes: AttributeMap;
  
  // 동적 생산/건물 슬롯 (완전 중립)
  slots: SlotMap;
  
  // 동적 자원
  resources: ResourceBag;
  
  // 관계 참조 (빠른 조회용)
  refs: RefMap;
  
  // 시스템별 로컬 상태
  systems: SystemStateMap;
  
  // 시나리오 전용 추가 필드
  ext?: Record<string, any>;
}

/**
 * Edge (관계) - 그래프 쿼리용
 */
export interface Edge {
  id: string;
  scenario: ScenarioId;
  key: string; // RelationKey 또는 커스텀
  from: RoleRef;
  to: RoleRef;
  payload?: any;
  createdAt: Date;
}

/**
 * 시스템 상태 (Faction/Scenario 스코프용)
 */
export interface SystemState {
  id: string;
  scenario: ScenarioId;
  systemId: string;
  scope: 'faction' | 'scenario';
  ownerRef?: RoleRef;
  state: any;
  version: number;
  updatedAt: Date;
}

/**
 * 속성 정의
 */
export interface AttributeDefinition {
  id: string;
  label: Record<string, string>;
  description?: Record<string, string>;
  type: 'number';
  min?: number;
  max?: number;
  default?: number;
  indexed?: boolean;
  derived?: boolean;
  formulaId?: string;
  tags?: string[]; // 'combat', 'command', 'magic' 등
}

/**
 * 슬롯 정의
 */
export interface SlotDefinition {
  id: string;
  label: Record<string, string>;
  description?: Record<string, string>;
  maxDefault?: number;
  levelMax?: number;
  upgradeFormulaId?: string;
  productionFormulaId?: string;
  visible?: boolean;
  icon?: string;
}

/**
 * Entity 생성 DTO
 */
export interface CreateEntityDto {
  scenario: ScenarioId;
  role: Role;
  name?: string;
  attributes?: AttributeMap;
  slots?: SlotMap;
  resources?: ResourceBag;
  refs?: RefMap;
  systems?: SystemStateMap;
  ext?: Record<string, any>;
}

/**
 * Entity 업데이트 DTO
 */
export interface UpdateEntityDto {
  name?: string;
  attributes?: Partial<AttributeMap>;
  slots?: Partial<SlotMap>;
  resources?: Partial<ResourceBag>;
  refs?: Partial<RefMap>;
  systems?: Partial<SystemStateMap>;
  ext?: Record<string, any>;
}

/**
 * Entity 쿼리 필터
 */
export interface EntityQuery {
  scenario?: ScenarioId;
  role?: Role;
  name?: string;
  attributes?: Record<string, number | { $gte?: number; $lte?: number; $gt?: number; $lt?: number }>;
  resources?: Record<string, number | { $gte?: number }>;
  refs?: Record<string, RoleRef>;
}
