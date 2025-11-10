import { ScenarioRegistry } from '../../common/registry/scenario-registry';
import { Role } from '../../common/@types/role.types';

/**
 * 은하영웅전설 시나리오 등록
 * 
 * Legend of Galactic Heroes (LOGH) 시나리오
 * - 우주 전략 시뮬레이션
 * - 행성/성계 기반 영토 시스템
 * - 함대 전투 시스템
 */

// 제독(Commander) 속성 정의
export const COMMANDER_ATTRIBUTES = {
  leadership: { label: '지휘력', min: 1, max: 100, default: 50 },
  tactics: { label: '전술력', min: 1, max: 100, default: 50 },
  charisma: { label: '카리스마', min: 1, max: 100, default: 50 },
  age: { label: '나이', min: 18, max: 100, default: 30 },
  loyalty: { label: '충성도', min: 0, max: 100, default: 70 },
  experience: { label: '경험치', min: 0, max: 999999, default: 0 }
};

// 행성(Settlement) 속성 정의
export const PLANET_ATTRIBUTES = {
  population: { label: '인구', min: 0, max: 9999999, default: 100000 },
  industry: { label: '공업력', min: 0, max: 100, default: 30 },
  technology: { label: '기술력', min: 0, max: 100, default: 30 },
  defense: { label: '방어력', min: 0, max: 100, default: 30 },
  resources: { label: '자원', min: 0, max: 100, default: 40 },
  loyalty: { label: '충성도', min: 0, max: 100, default: 50 }
};

// 진영(Faction) 속성 정의
export const FACTION_ATTRIBUTES = {
  technology: { label: '기술 수준', min: 0, max: 100, default: 50 },
  morale: { label: '사기', min: 0, max: 100, default: 50 },
  prestige: { label: '명성', min: 0, max: 100, default: 50 }
};

// 행성 슬롯 정의
export const PLANET_SLOTS = {
  shipyard: {
    label: '조병공창',
    icon: '🏭',
    description: '함선 건조 시설',
    maxLevel: 10
  },
  defense_facility: {
    label: '방위사령부',
    icon: '🛡️',
    description: '방어 시설',
    maxLevel: 10
  },
  warehouse: {
    label: '창고',
    icon: '📦',
    description: '물자 저장 시설',
    maxLevel: 10
  },
  research_center: {
    label: '연구소',
    icon: '🔬',
    description: '기술 연구 시설',
    maxLevel: 10
  },
  government_office: {
    label: '정청',
    icon: '🏛️',
    description: '행정 시설',
    maxLevel: 5
  }
};

// 시스템 정의
export const SYSTEMS = {
  fleet_management: {
    id: 'fleet_management',
    label: '함대 관리',
    description: '함대 편성, 이동, 전투 관리',
    enabled: true
  },
  production: {
    id: 'production',
    label: '생산 시스템',
    description: '함선 및 자원 생산',
    enabled: true
  },
  diplomacy: {
    id: 'diplomacy',
    label: '외교 시스템',
    description: '진영 간 외교 관계',
    enabled: true
  },
  navigation: {
    id: 'navigation',
    label: '항행 시스템',
    description: '워프 항행 및 맵 이동',
    enabled: true
  }
};

// ScenarioRegistry에 등록
ScenarioRegistry.register({
  id: 'logh',
  name: '은하영웅전설',
  description: 'Legend of Galactic Heroes - 우주 전략 시뮬레이션',
  
  roles: {
    [Role.SETTLEMENT]: {
      collection: 'planets',
      label: { ko: '행성', en: 'Planet', ja: '惑星' },
      schema: {
        attributes: PLANET_ATTRIBUTES,
        slots: PLANET_SLOTS
      }
    },
    [Role.COMMANDER]: {
      collection: 'commanders',
      label: { ko: '제독', en: 'Admiral', ja: '提督' },
      schema: {
        attributes: COMMANDER_ATTRIBUTES
      }
    },
    [Role.FACTION]: {
      collection: 'factions',
      label: { ko: '진영', en: 'Faction', ja: '陣営' },
      schema: {
        attributes: FACTION_ATTRIBUTES
      }
    },
    [Role.FORCE]: {
      collection: 'fleets',
      label: { ko: '함대', en: 'Fleet', ja: '艦隊' }
    },
    [Role.DIPLOMACY]: {
      collection: 'diplomacy',
      label: { ko: '외교', en: 'Diplomacy', ja: '外交' }
    }
  },
  
  relations: {
    ASSIGNED_SETTLEMENT: {
      from: Role.COMMANDER,
      to: Role.SETTLEMENT,
      viaField: 'assignedPlanet'
    },
    MEMBER_OF: {
      from: Role.COMMANDER,
      to: Role.FACTION,
      viaField: 'faction'
    },
    OWNS: {
      from: Role.FACTION,
      to: Role.SETTLEMENT,
      viaField: 'owner',
      inverse: 'planets'
    },
    LEADS: {
      from: Role.COMMANDER,
      to: Role.FORCE,
      viaField: 'commanderId'
    }
  },
  
  config: {
    systems: SYSTEMS,
    resources: ['supplies', 'ships', 'manpower'],
    mapType: 'grid',
    gridSize: { width: 100, height: 50 }
  }
});

export default {
  COMMANDER_ATTRIBUTES,
  PLANET_ATTRIBUTES,
  FACTION_ATTRIBUTES,
  PLANET_SLOTS,
  SYSTEMS
};
