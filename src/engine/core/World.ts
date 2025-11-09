/**
 * 범용 게임 엔진 - World (세계관)
 * 삼국지, 은하영웅전설 등 여러 세계관을 지원하는 컨테이너
 */

export interface StatDefinition {
  id: string;
  name: string;
  minValue: number;
  maxValue: number;
  defaultValue: number;
  description?: string;
}

export interface ResourceDefinition {
  id: string;
  name: string;
  minValue: number;
  maxValue: number;
  defaultValue: number;
  description?: string;
}

export interface ActionDefinition {
  id: string;
  name: string;
  category: string;
  description?: string;
  costs?: Record<string, string>; // formula strings like "100" or "env.develcost"
  effects?: ActionEffect[];
  constraints?: ActionConstraint[];
  experience?: Record<string, number | string>; // stat experience gains
  _source?: string;
  _parent?: string;
}

export interface ActionEffect {
  target: string; // 'location.comm', 'resource.gold', 'stats.leadership', etc.
  formula: string; // 'stats.intel * 0.7 + random(10, 50)'
  type?: 'set' | 'add' | 'multiply';
  description?: string;
}

export interface ActionConstraint {
  type: 'stat' | 'resource' | 'custom';
  resource?: string; // for type='resource'
  target?: string;
  operator: '>=' | '<=' | '==' | '!=' | '>' | '<';
  value: number | string;
  message: string;
}

export interface WorldConfig {
  id: string;
  name: string;
  description: string;
  stats: StatDefinition[];
  resources: ResourceDefinition[];
  actions: ActionDefinition[];
}

/**
 * World 클래스
 * 게임 세계관의 메타데이터와 규칙을 관리
 */
export class World {
  private config: WorldConfig;
  private statsMap: Map<string, StatDefinition>;
  private resourcesMap: Map<string, ResourceDefinition>;
  private actionsMap: Map<string, ActionDefinition>;

  constructor(config: WorldConfig) {
    this.config = config;
    this.statsMap = new Map(config.stats.map(s => [s.id, s]));
    this.resourcesMap = new Map(config.resources.map(r => [r.id, r]));
    this.actionsMap = new Map(config.actions.map(a => [a.id, a]));
  }

  getId(): string {
    return this.config.id;
  }

  getName(): string {
    return this.config.name;
  }

  getDescription(): string {
    return this.config.description;
  }

  /**
   * 능력치 정의 조회
   */
  getStatDefinition(statId: string): StatDefinition | undefined {
    return this.statsMap.get(statId);
  }

  getAllStats(): StatDefinition[] {
    return this.config.stats;
  }

  /**
   * 자원 정의 조회
   */
  getResourceDefinition(resourceId: string): ResourceDefinition | undefined {
    return this.resourcesMap.get(resourceId);
  }

  getAllResources(): ResourceDefinition[] {
    return this.config.resources;
  }

  /**
   * 액션 정의 조회
   */
  getActionDefinition(actionId: string): ActionDefinition | undefined {
    return this.actionsMap.get(actionId);
  }

  getAllActions(): ActionDefinition[] {
    return this.config.actions;
  }

  /**
   * 카테고리별 액션 조회
   */
  getActionsByCategory(category: string): ActionDefinition[] {
    return this.config.actions.filter(a => a.category === category);
  }

  /**
   * World 설정 전체 조회 (디버깅/관리용)
   */
  getConfig(): WorldConfig {
    return { ...this.config };
  }
}
