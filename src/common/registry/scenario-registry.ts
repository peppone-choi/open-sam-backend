import { Role, ScenarioId, RelationKey } from '../@types/role.types';

/**
 * 엔티티 설정
 */
export interface EntityConfig {
  collection: string;
  label: Record<string, string>; // locale -> label
  schema?: any; // Zod/TypeBox schema (추후)
  indexes?: any[];
}

/**
 * 관계 설정
 */
export interface RelationConfig {
  from: Role;
  to: Role;
  viaField: string; // 실제 필드명
  inverse?: string; // 역방향 필드명
}

/**
 * 시나리오 설정
 */
export interface ScenarioConfig {
  id: ScenarioId;
  name: string;
  description?: string;
  
  // 역할 -> 엔티티 매핑
  roles: Partial<Record<Role, EntityConfig>>;
  
  // 관계 매핑
  relations: Partial<Record<RelationKey, RelationConfig>>;
  
  // 커맨드 별칭 (추후)
  commandAliases?: Record<string, any>;
  
  // 밸런스 설정 (추후)
  config?: Record<string, any>;
}

/**
 * 시나리오 레지스트리
 * 
 * Lore 중립 시스템의 핵심
 */
export class ScenarioRegistry {
  private static scenarios = new Map<ScenarioId, ScenarioConfig>();

  /**
   * 시나리오 등록
   */
  static register(config: ScenarioConfig): void {
    this.scenarios.set(config.id, config);
  }

  /**
   * 시나리오 조회
   */
  static get(scenarioId: ScenarioId): ScenarioConfig | undefined {
    return this.scenarios.get(scenarioId);
  }

  /**
   * Role의 엔티티 설정 조회
   */
  static getRole(scenarioId: ScenarioId, role: Role): EntityConfig | undefined {
    const scenario = this.get(scenarioId);
    return scenario?.roles[role];
  }

  /**
   * 관계 설정 조회
   */
  static getRelation(scenarioId: ScenarioId, key: RelationKey): RelationConfig | undefined {
    const scenario = this.get(scenarioId);
    return scenario?.relations[key];
  }

  /**
   * 모든 시나리오 목록
   */
  static getAll(): ScenarioConfig[] {
    return Array.from(this.scenarios.values());
  }

  /**
   * 시나리오 존재 확인
   */
  static has(scenarioId: ScenarioId): boolean {
    return this.scenarios.has(scenarioId);
  }
}

// ==================== 삼국지 시나리오 등록 ====================
ScenarioRegistry.register({
  id: 'sangokushi',
  name: '삼국지',
  description: '후한 말 삼국시대 배경',
  
  roles: {
    [Role.SETTLEMENT]: {
      collection: 'cities',
      label: { ko: '도시', en: 'City' }
    },
    [Role.COMMANDER]: {
      collection: 'generals',
      label: { ko: '장수', en: 'General' }
    },
    [Role.FACTION]: {
      collection: 'nations',
      label: { ko: '국가', en: 'Nation' }
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
  }
});

// ==================== SF 시나리오 예시 ====================
ScenarioRegistry.register({
  id: 'sf',
  name: 'Space Force',
  description: '우주 전쟁 배경',
  
  roles: {
    [Role.SETTLEMENT]: {
      collection: 'planets',
      label: { ko: '행성', en: 'Planet' }
    },
    [Role.COMMANDER]: {
      collection: 'commanders',
      label: { ko: '커맨더', en: 'Commander' }
    },
    [Role.FACTION]: {
      collection: 'factions',
      label: { ko: '세력', en: 'Faction' }
    },
    [Role.FORCE]: {
      collection: 'fleets',
      label: { ko: '함대', en: 'Fleet' }
    }
  },
  
  relations: {
    ASSIGNED_SETTLEMENT: {
      from: Role.COMMANDER,
      to: Role.SETTLEMENT,
      viaField: 'homePlanetId'
    },
    MEMBER_OF: {
      from: Role.COMMANDER,
      to: Role.FACTION,
      viaField: 'factionId'
    },
    OWNS: {
      from: Role.FACTION,
      to: Role.SETTLEMENT,
      viaField: 'ownerFactionId'
    }
  }
});
