import { ScenarioRegistry } from '../../common/registry/scenario-registry';
import { Role } from '../../common/@types/role.types';

/**
 * 삼국지 시나리오 완전 등록
 * 
 * - 속성 정의 (COMMANDER, SETTLEMENT, FACTION별)
 * - 슬롯 정의 (SETTLEMENT)
 * - 자원 정의 (gold, rice는 ResourceRegistry에 이미 등록됨)
 * - 시스템 등록
 */

// 속성 정의
export const COMMANDER_ATTRIBUTES = {
  leadership: { label: '통솔력', min: 1, max: 100, default: 50 },
  strength: { label: '무력', min: 1, max: 100, default: 50 },
  intel: { label: '지력', min: 1, max: 100, default: 50 },
  charm: { label: '매력', min: 1, max: 100, default: 50 },
  age: { label: '나이', min: 15, max: 100, default: 25 },
  injury: { label: '부상도', min: 0, max: 100, default: 0 },
  loyalty: { label: '충성도', min: 0, max: 100, default: 70 },
  exp: { label: '경험치', min: 0, max: 999999, default: 0 }
};

export const SETTLEMENT_ATTRIBUTES = {
  population: { label: '인구', min: 0, max: 999999, default: 10000 },
  defense: { label: '방어도', min: 0, max: 100, default: 50 },
  trust: { label: '민심', min: 0, max: 100, default: 50 },
  development: { label: '개발도', min: 0, max: 100, default: 30 },
  commerce: { label: '상업도', min: 0, max: 100, default: 30 },
  agriculture: { label: '농업도', min: 0, max: 100, default: 30 }
};

export const FACTION_ATTRIBUTES = {
  tech: { label: '기술력', min: 0, max: 100, default: 30 },
  prestige: { label: '명성', min: 0, max: 100, default: 30 },
  legitimacy: { label: '정통성', min: 0, max: 100, default: 50 }
};

// 슬롯 정의 (SETTLEMENT)
export const SETTLEMENT_SLOTS = {
  production_1: {
    label: '농업',
    icon: '🌾',
    description: '농업 생산 시설',
    maxLevel: 10
  },
  production_2: {
    label: '상업',
    icon: '💰',
    description: '상업 생산 시설',
    maxLevel: 10
  },
  production_3: {
    label: '기술',
    icon: '🔬',
    description: '기술 연구 시설',
    maxLevel: 10
  },
  defense: {
    label: '성벽',
    icon: '🏰',
    description: '방어 시설',
    maxLevel: 10
  },
  security: {
    label: '치안',
    icon: '👮',
    description: '치안 시설',
    maxLevel: 10
  }
};

// 시스템 정의
export const SYSTEMS = {
  economy: {
    id: 'economy',
    label: '경제 시스템',
    description: '자원 생산, 거래, 세금 관리',
    enabled: true
  },
  diplomacy: {
    id: 'diplomacy',
    label: '외교 시스템',
    description: '동맹, 전쟁, 협상 관리',
    enabled: true
  },
  warfare: {
    id: 'warfare',
    label: '전쟁 시스템',
    description: '전투, 침략, 방어 관리',
    enabled: true
  }
};

// ScenarioRegistry 확장 등록
ScenarioRegistry.register({
  id: 'sangokushi',
  name: '삼국지',
  description: '후한 말 삼국시대 배경 전략 시뮬레이션',
  
  roles: {
    [Role.SETTLEMENT]: {
      collection: 'cities',
      label: { ko: '도시', en: 'City' },
      schema: {
        attributes: SETTLEMENT_ATTRIBUTES,
        slots: SETTLEMENT_SLOTS
      }
    },
    [Role.COMMANDER]: {
      collection: 'generals',
      label: { ko: '장수', en: 'General' },
      schema: {
        attributes: COMMANDER_ATTRIBUTES
      }
    },
    [Role.FACTION]: {
      collection: 'nations',
      label: { ko: '국가', en: 'Nation' },
      schema: {
        attributes: FACTION_ATTRIBUTES
      }
    },
    [Role.FORCE]: {
      collection: 'forces',
      label: { ko: '부대', en: 'Force' }
    },
    [Role.DIPLOMACY]: {
      collection: 'diplomacy',
      label: { ko: '외교', en: 'Diplomacy' }
    }
  },
  
  relations: {
    ASSIGNED_SETTLEMENT: {
      from: Role.COMMANDER,
      to: Role.SETTLEMENT,
      viaField: 'city'
    },
    MEMBER_OF: {
      from: Role.COMMANDER,
      to: Role.FACTION,
      viaField: 'nation'
    },
    OWNS: {
      from: Role.FACTION,
      to: Role.SETTLEMENT,
      viaField: 'nation',
      inverse: 'cities'
    }
  },
  
  config: {
    systems: SYSTEMS,
    resources: ['gold', 'rice']
  }
});

export default {
  COMMANDER_ATTRIBUTES,
  SETTLEMENT_ATTRIBUTES,
  FACTION_ATTRIBUTES,
  SETTLEMENT_SLOTS,
  SYSTEMS
};
