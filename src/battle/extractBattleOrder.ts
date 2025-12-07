/**
 * extractBattleOrder - 수비 순서 결정 래퍼 모듈
 *
 * PHP 참조: core/hwe/process_war.php:192-226 extractBattleOrder()
 *
 * 실제 구현은 `BattleCalculationService.calculateBattleOrder`가 담당하고,
 * 이 모듈은 호환성을 위해 동일한 인터페이스로 래핑해 제공한다.
 */

import type { WarUnit } from './WarUnit';
import { calculateBattleOrder } from '../services/battle/BattleCalculationService';

/**
 * 수비 순서 점수를 계산한다.
 * 점수가 0 이하면 해당 유닛은 수비에 참여하지 못한다.
 */
export function extractBattleOrder(defender: WarUnit, attacker: WarUnit): number {
  return calculateBattleOrder(defender, attacker);
}

/**
 * 주어진 수비 유닛 목록을 수비 순서대로 정렬한다.
 * - PHP와 동일하게 `extractBattleOrder() > 0` 인 유닛만 남긴다.
 * - 점수가 높은 유닛이 먼저 오도록 내림차순 정렬한다.
 */
export function sortDefendersByBattleOrder(defenders: WarUnit[], attacker: WarUnit): WarUnit[] {
  return defenders
    .filter((defender) => extractBattleOrder(defender, attacker) > 0)
    .sort((lhs, rhs) => extractBattleOrder(rhs, attacker) - extractBattleOrder(lhs, attacker));
}
