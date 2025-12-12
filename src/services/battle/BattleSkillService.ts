import { BattleSkillSystem, type BattleSkillContext } from '../../battle/BattleSkillSystem';
import type { WarUnit } from '../../battle/WarUnit';

/**
 * BattleSkillService
 * - 전투 스킬/책략 트리거 실행을 담당하는 얇은 서비스 계층
 * - ProcessWar 등 전투 루프에서 스킬 실행 흐름을 일관되게 관리한다.
 */
export type BattleSkillContextState = BattleSkillContext;

export class BattleSkillService {
  /**
   * 전투 시작 시 한 번 호출되는 초기 스킬 트리거 실행.
   * 수비자가 없을 경우 null을 반환하여 호출 측에서 안전하게 처리하도록 한다.
   */
  static initializeBattle(attacker: WarUnit, defender: WarUnit | null): BattleSkillContextState | null {
    if (!defender) {
      return null;
    }

    return BattleSkillSystem.runBattleInitTriggers(attacker, defender);
  }

  /**
   * 페이즈마다 호출되는 스킬 트리거 실행.
   * context가 없을 경우 그대로 null을 반환하여 불필요한 호출을 방지한다.
   */
  static runPhaseTriggers(context: BattleSkillContextState | null): BattleSkillContextState | null {
    if (!context) {
      return null;
    }

    return BattleSkillSystem.runBattlePhaseTriggers(context);
  }
}








