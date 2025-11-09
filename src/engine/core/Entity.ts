/**
 * 범용 게임 엔진 - Entity (엔티티)
 * 장수, 제독, 도시 등 모든 게임 객체를 표현하는 범용 엔티티
 */

import { World, StatDefinition, ResourceDefinition } from './World';

export interface EntityData {
  id: string;
  type: string;
  worldId: string;
  stats: Record<string, number>;
  resources: Record<string, number>;
  properties: Record<string, any>;
}

/**
 * Entity 클래스
 * 게임 세계의 모든 객체 (장수, 도시, 부대 등)을 표현
 */
export class Entity {
  private id: string;
  private type: string;
  private world: World;
  private stats: Map<string, number>;
  private resources: Map<string, number>;
  private properties: Map<string, any>;

  constructor(world: World, data: Partial<EntityData>) {
    this.world = world;
    this.id = data.id || this.generateId();
    this.type = data.type || 'entity';

    // 능력치 초기화
    this.stats = new Map();
    if (data.stats) {
      Object.entries(data.stats).forEach(([key, value]) => {
        this.stats.set(key, value);
      });
    } else {
      // 기본값으로 초기화
      world.getAllStats().forEach(statDef => {
        this.stats.set(statDef.id, statDef.defaultValue);
      });
    }

    // 자원 초기화
    this.resources = new Map();
    if (data.resources) {
      Object.entries(data.resources).forEach(([key, value]) => {
        this.resources.set(key, value);
      });
    } else {
      // 기본값으로 초기화
      world.getAllResources().forEach(resDef => {
        this.resources.set(resDef.id, resDef.defaultValue);
      });
    }

    // 기타 속성
    this.properties = new Map();
    if (data.properties) {
      Object.entries(data.properties).forEach(([key, value]) => {
        this.properties.set(key, value);
      });
    }
  }

  private generateId(): string {
    return `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Getters
  getId(): string {
    return this.id;
  }

  getType(): string {
    return this.type;
  }

  getWorld(): World {
    return this.world;
  }

  /**
   * 능력치 조회 (타입 안전)
   */
  getStat(statId: string): number {
    const value = this.stats.get(statId);
    if (value === undefined) {
      const statDef = this.world.getStatDefinition(statId);
      return statDef?.defaultValue || 0;
    }
    return value;
  }

  /**
   * 능력치 설정 (범위 검증)
   */
  setStat(statId: string, value: number): void {
    const statDef = this.world.getStatDefinition(statId);
    if (!statDef) {
      throw new Error(`Unknown stat: ${statId} in world ${this.world.getId()}`);
    }

    const clamped = Math.min(Math.max(value, statDef.minValue), statDef.maxValue);
    this.stats.set(statId, clamped);
  }

  /**
   * 능력치 증감
   */
  modifyStat(statId: string, delta: number): number {
    const current = this.getStat(statId);
    const newValue = current + delta;
    this.setStat(statId, newValue);
    return this.getStat(statId);
  }

  /**
   * 모든 능력치 조회
   */
  getAllStats(): Record<string, number> {
    const result: Record<string, number> = {};
    this.stats.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  /**
   * 자원 조회
   */
  getResource(resourceId: string): number {
    const value = this.resources.get(resourceId);
    if (value === undefined) {
      const resDef = this.world.getResourceDefinition(resourceId);
      return resDef?.defaultValue || 0;
    }
    return value;
  }

  /**
   * 자원 설정 (범위 검증)
   */
  setResource(resourceId: string, value: number): void {
    const resDef = this.world.getResourceDefinition(resourceId);
    if (!resDef) {
      throw new Error(`Unknown resource: ${resourceId} in world ${this.world.getId()}`);
    }

    const clamped = Math.min(Math.max(value, resDef.minValue), resDef.maxValue);
    this.resources.set(resourceId, clamped);
  }

  /**
   * 자원 증감
   */
  modifyResource(resourceId: string, delta: number): number {
    const current = this.getResource(resourceId);
    const newValue = current + delta;
    this.setResource(resourceId, newValue);
    return this.getResource(resourceId);
  }

  /**
   * 모든 자원 조회
   */
  getAllResources(): Record<string, number> {
    const result: Record<string, number> = {};
    this.resources.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  /**
   * 속성 조회
   */
  getProperty(key: string): any {
    return this.properties.get(key);
  }

  /**
   * 속성 설정
   */
  setProperty(key: string, value: any): void {
    this.properties.set(key, value);
  }

  /**
   * 모든 속성 조회
   */
  getAllProperties(): Record<string, any> {
    const result: Record<string, any> = {};
    this.properties.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  /**
   * 직렬화 (DB 저장용)
   */
  toJSON(): EntityData {
    return {
      id: this.id,
      type: this.type,
      worldId: this.world.getId(),
      stats: this.getAllStats(),
      resources: this.getAllResources(),
      properties: this.getAllProperties()
    };
  }

  /**
   * 역직렬화 (DB 로드용)
   */
  static fromJSON(world: World, data: EntityData): Entity {
    return new Entity(world, data);
  }
}
