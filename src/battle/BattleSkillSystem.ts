/**
 * BattleSkillSystem - 전투 특기/스킬 트리거 파사드
 *
 * PHP 측 특기 시스템(special_war)은 각 특기 클래스가
 * `getBattleInitSkillTriggerList()`, `getBattlePhaseSkillTriggerList()` 를
 * 구현하고, `WarUnitTriggerCaller` 가 이를 실행하는 구조이다.
 *
 * 이 파일은 그 트리거 시스템 위에 올라가는 얇은 헬퍼 계층으로,
 * 전투 초깃값/페이즈별 트리거를 일관된 방식으로 실행할 수 있게 한다.
 */

import type { WarUnit } from './WarUnit';
import { WarUnitTriggerCaller } from '../game/triggers/WarUnitTriggerCaller';
import { ensureTriggerEnv, type TriggerEnv } from '../game/triggers/TriggerEnv';

/**
 * BattleTriggerMethod - 장수 모델이 제공하는 배틀 트리거 메서드 키
 */
type BattleTriggerMethod = 'getBattleInitSkillTriggerList' | 'getBattlePhaseSkillTriggerList';

function resolveBattleTriggerCaller(unit: WarUnit | null | undefined, method: BattleTriggerMethod): WarUnitTriggerCaller | null {
  if (!unit) {
    return null;
  }
  const general: any = unit.getGeneral?.();
  if (!general || typeof general[method] !== 'function') {
    return null;
  }

  try {
    return (general[method](unit) as WarUnitTriggerCaller | null) ?? null;
  } catch (error) {
    // 트리거 하나 때문에 전투 전체가 죽지 않도록 보호
    console.error(`[BattleSkillSystem] Failed to resolve ${method}:`, error);
    return null;
  }
}

function fireBattleTriggers(
  attackerCaller: WarUnitTriggerCaller | null,
  defenderCaller: WarUnitTriggerCaller | null,
  attacker: WarUnit,
  defender: WarUnit | null,
  env?: TriggerEnv | null,
): TriggerEnv | null {
  if ((!attackerCaller && !defenderCaller) || !defender) {
    return env ?? null;
  }

  let currentEnv = ensureTriggerEnv(env || undefined);

  if (attackerCaller) {
    currentEnv = attackerCaller.fire(attacker.rng, currentEnv, [attacker, defender]);
  }

  if (defenderCaller) {
    currentEnv = defenderCaller.fire(attacker.rng, currentEnv, [attacker, defender]);
  }

  return currentEnv;
}

/**
 * 전투 스킬 실행 컨텍스트
 * - init/phase 트리거 호출자와 TriggerEnv 를 보관한다.
 */
export interface BattleSkillContext {
  attacker: WarUnit;
  defender: WarUnit;
  env: TriggerEnv | null;
  attackerInitCaller: WarUnitTriggerCaller | null;
  defenderInitCaller: WarUnitTriggerCaller | null;
  attackerPhaseCaller: WarUnitTriggerCaller | null;
  defenderPhaseCaller: WarUnitTriggerCaller | null;
}

export class BattleSkillSystem {
  /**
   * 전투 시작 시 한 번 호출되는 초기 스킬 트리거 실행.
   * PHP 의 `getBattleInitSkillTriggerList()` 사용.
   */
  static runBattleInitTriggers(attacker: WarUnit, defender: WarUnit): BattleSkillContext {
    const attackerInitCaller = resolveBattleTriggerCaller(attacker, 'getBattleInitSkillTriggerList');
    const defenderInitCaller = resolveBattleTriggerCaller(defender, 'getBattleInitSkillTriggerList');

    const env = fireBattleTriggers(attackerInitCaller, defenderInitCaller, attacker, defender, null);

    const attackerPhaseCaller = resolveBattleTriggerCaller(attacker, 'getBattlePhaseSkillTriggerList');
    const defenderPhaseCaller = resolveBattleTriggerCaller(defender, 'getBattlePhaseSkillTriggerList');

    return {
      attacker,
      defender,
      env,
      attackerInitCaller,
      defenderInitCaller,
      attackerPhaseCaller,
      defenderPhaseCaller,
    };
  }

  /**
   * 페이즈마다 호출되는 스킬 트리거 실행.
   *
   * - `context.env` 를 in/out 으로 사용하여 TriggerEnv 를 유지한다.
   */
  static runBattlePhaseTriggers(context: BattleSkillContext): BattleSkillContext {
    const { attacker, defender, attackerPhaseCaller, defenderPhaseCaller, env } = context;
    const nextEnv = fireBattleTriggers(attackerPhaseCaller, defenderPhaseCaller, attacker, defender, env);

    return {
      ...context,
      env: nextEnv,
    };
  }
}
