import { ScenarioId } from '../@types/role.types';

/**
 * 자원 종류
 */
export type ResourceKind = 'currency' | 'consumable' | 'energy' | 'rare' | 'special';

/**
 * 자원 정의
 */
export interface ResourceDefinition {
  id: string;
  kind: ResourceKind;
  label: Record<string, string>; // locale -> label
  max?: number;
  min?: number;
  precision?: number; // 소수점 자리수 (기본 0)
  transferable?: boolean; // 거래 가능 여부 (기본 true)
}

/**
 * 자원 변환 규칙
 */
export interface ConversionRule {
  from: string;
  to: string;
  rate: number;
  fee?: number; // 수수료
}

/**
 * 자원 레지스트리
 * 
 * 시나리오별 자원 정의 및 변환 규칙 관리
 */
export class ResourceRegistry {
  private static resources = new Map<ScenarioId, Map<string, ResourceDefinition>>();
  private static conversions = new Map<ScenarioId, ConversionRule[]>();

  /**
   * 시나리오 자원 등록
   */
  static register(
    scenarioId: ScenarioId,
    resources: ResourceDefinition[],
    conversions: ConversionRule[] = []
  ): void {
    const resourceMap = new Map<string, ResourceDefinition>();
    
    for (const res of resources) {
      resourceMap.set(res.id, res);
    }
    
    this.resources.set(scenarioId, resourceMap);
    this.conversions.set(scenarioId, conversions);
  }

  /**
   * 자원 정의 조회
   */
  static getResource(scenarioId: ScenarioId, resourceId: string): ResourceDefinition | undefined {
    return this.resources.get(scenarioId)?.get(resourceId);
  }

  /**
   * 시나리오의 모든 자원 조회
   */
  static getAll(scenarioId: ScenarioId): ResourceDefinition[] {
    const map = this.resources.get(scenarioId);
    return map ? Array.from(map.values()) : [];
  }

  /**
   * 변환 규칙 조회
   */
  static getConversionRule(
    scenarioId: ScenarioId,
    from: string,
    to: string
  ): ConversionRule | undefined {
    const rules = this.conversions.get(scenarioId) || [];
    return rules.find(r => r.from === from && r.to === to);
  }

  /**
   * 변환 가능 여부
   */
  static canConvert(scenarioId: ScenarioId, from: string, to: string): boolean {
    return !!this.getConversionRule(scenarioId, from, to);
  }
}

// 기본 삼국지 시나리오 자원 등록
ResourceRegistry.register('sangokushi', [
  {
    id: 'gold',
    kind: 'currency',
    label: { ko: '금', en: 'Gold' },
    max: 999999999,
    min: 0
  },
  {
    id: 'rice',
    kind: 'consumable',
    label: { ko: '쌀', en: 'Rice' },
    max: 999999999,
    min: 0
  }
], [
  { from: 'gold', to: 'rice', rate: 2, fee: 0.01 },
  { from: 'rice', to: 'gold', rate: 0.5, fee: 0.01 }
]);
