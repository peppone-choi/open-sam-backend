/**
 * AttackTriggers - 공격 트리거 모음
 * 
 * 11개의 공격 관련 트리거:
 * - 필살 (시도, 발동, 강화)
 * - 저격 (시도, 발동)
 * - 선제사격 (시도, 발동, 궁병)
 * - 돌격 (시작, 지속)
 * - 약탈 (시도, 발동)
 */

export * from './CriticalTrigger';
export * from './SniperTrigger';
export * from './PreemptiveTrigger';
export * from './ChargeTrigger';
export * from './PlunderTrigger';

import { criticalTriggers } from './CriticalTrigger';
import { sniperTriggers } from './SniperTrigger';
import { preemptiveTriggers } from './PreemptiveTrigger';
import { chargeTriggers } from './ChargeTrigger';
import { plunderTriggers } from './PlunderTrigger';
import { ITrigger } from '../TriggerManager';

/**
 * 모든 공격 트리거
 */
export const allAttackTriggers: ITrigger[] = [
  ...criticalTriggers,
  ...sniperTriggers,
  ...preemptiveTriggers,
  ...chargeTriggers,
  ...plunderTriggers,
];


