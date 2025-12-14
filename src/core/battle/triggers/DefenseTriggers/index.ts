/**
 * DefenseTriggers - 방어 트리거 모음
 * 
 * 9개의 방어 관련 트리거:
 * - 회피 (시도, 발동)
 * - 저지 (시도, 발동)
 * - 부상무효 (기본, 성벽, 퇴각)
 * - 방어력증가 (5%, 10%, 지형)
 */

export * from './EvadeTrigger';
export * from './BlockTrigger';
export * from './InjuryImmuneTrigger';
export * from './DefenseBoostTrigger';

import { evadeTriggers } from './EvadeTrigger';
import { blockTriggers } from './BlockTrigger';
import { injuryImmuneTriggers } from './InjuryImmuneTrigger';
import { defenseBoostTriggers } from './DefenseBoostTrigger';
import { ITrigger } from '../TriggerManager';

/**
 * 모든 방어 트리거
 */
export const allDefenseTriggers: ITrigger[] = [
  ...evadeTriggers,
  ...blockTriggers,
  ...injuryImmuneTriggers,
  ...defenseBoostTriggers,
];
