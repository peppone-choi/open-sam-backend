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

  /**
   * 모든 시나리오 초기화 (테스트용)
   */
  static clear(): void {
    this.scenarios.clear();
  }
}
