/**
 * TacticsTriggers - 계략 트리거 모음
 * 
 * 7개의 계략 관련 트리거:
 * - 계략 (시도, 발동, 실패)
 * - 반계 (시도, 발동)
 * - 위압 (시도, 발동)
 */

export * from './StrategyTrigger';
export * from './CounterStrategyTrigger';
export * from './IntimidateTrigger';

import { strategyTriggers } from './StrategyTrigger';
import { counterStrategyTriggers } from './CounterStrategyTrigger';
import { intimidateTriggers } from './IntimidateTrigger';
import { ITrigger } from '../TriggerManager';

/**
 * 모든 계략 트리거
 */
export const allTacticsTriggers: ITrigger[] = [
  ...strategyTriggers,
  ...counterStrategyTriggers,
  ...intimidateTriggers,
];


