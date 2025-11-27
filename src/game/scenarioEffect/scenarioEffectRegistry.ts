/**
 * 시나리오 효과 레지스트리
 * PHP 대응: func_converter.php buildScenarioEffectClass()
 */

import { BaseScenarioEffect } from './BaseScenarioEffect';
import { NoneScenarioEffect } from './impl/NoneScenarioEffect';
import { MoreEffectScenarioEffect } from './impl/MoreEffectScenarioEffect';
import { StrongAttackerScenarioEffect } from './impl/StrongAttackerScenarioEffect';

const registry: Record<string, () => BaseScenarioEffect> = {
  None: () => new NoneScenarioEffect(),
  'event_MoreEffect': () => new MoreEffectScenarioEffect(),
  'event_StrongAttacker': () => new StrongAttackerScenarioEffect(),
  // 추가 시나리오 효과는 여기에 등록
};

const cache = new Map<string, BaseScenarioEffect>();

/**
 * 시나리오 효과 Action 조회
 * @param key 시나리오 효과 키
 * @returns BaseScenarioEffect 인스턴스
 */
export function getScenarioEffectAction(key?: string | null): BaseScenarioEffect | null {
  if (!key || key === 'None' || !registry[key]) {
    return null;
  }
  
  if (!cache.has(key)) {
    cache.set(key, registry[key]());
  }
  return cache.get(key)!;
}

/**
 * 시나리오 효과 존재 여부 확인
 */
export function hasScenarioEffect(key: string): boolean {
  return key in registry && key !== 'None';
}

