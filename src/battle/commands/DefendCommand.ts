/**
 * 방어 명령
 * 방어 태세로 전환하여 피해 감소
 */

import { BattleCommand, BattleCommandType, CommandContext, CommandResult, CommandRequirement } from './BattleCommand';
import { JosaUtil } from '../../func/josaUtil';
import { ARM_TYPE } from '../../const/GameUnitConst';

export class DefendCommand extends BattleCommand {
  readonly type = BattleCommandType.DEFEND;
  readonly name = '방어';
  readonly description = '방어 태세로 전환하여 받는 피해를 줄입니다.';
  readonly requirements: CommandRequirement = {
    minHpRatio: 0,
    minAtmos: 20
  };

  execute(ctx: CommandContext): CommandResult {
    const { executor, rng } = ctx;
    const logs: string[] = [];

    // 방어 보너스 계산
    let defenseBonus = 0.3; // 기본 30% 피해 감소

    // 병종별 보정
    if (executor.unit.armType === ARM_TYPE.FOOTMAN) {
      defenseBonus += 0.1; // 보병 방어 유리
    } else if (executor.unit.armType === ARM_TYPE.CAVALRY) {
      defenseBonus -= 0.1; // 기병 방어 불리
    }

    // 훈련도에 따른 보정
    const trainBonus = (executor.train - 70) / 200;
    defenseBonus += trainBonus;

    // 통솔력에 따른 보정
    const leadership = executor.stats.leadership ?? 50;
    defenseBonus += (leadership - 50) / 200;

    // 최종 방어 보너스 제한 (최대 60%)
    defenseBonus = Math.min(0.6, Math.max(0.1, defenseBonus));

    // 방어 상태 설정
    executor.isDefending = true;
    executor.defenseBonus = defenseBonus;
    executor.defendTurn = ctx.turn;

    // 사기 회복 (방어 중 약간 회복)
    const atmosRecovery = rng.nextRangeInt(2, 5);
    executor.atmos = Math.min(130, executor.atmos + atmosRecovery);

    // 군량 소모 감소 (방어 중 이동 없음)
    const riceSaved = Math.round(executor.hp / 2000);

    const josa = JosaUtil.pick(executor.name, '이');
    logs.push(`<Y>${executor.name}</>${josa} <C>방어 태세</>로 전환했습니다.`);
    logs.push(`받는 피해 <C>${Math.round(defenseBonus * 100)}%</> 감소`);
    logs.push(`사기 <S>+${atmosRecovery}</>`);

    return {
      success: true,
      logs,
      data: {
        defenseBonus,
        atmosRecovery,
        riceSaved,
        defendTurn: ctx.turn
      }
    };
  }

  /**
   * 방어 중 피해 계산 (외부에서 호출)
   */
  static calculateDefendedDamage(originalDamage: number, defenseBonus: number): number {
    return Math.round(originalDamage * (1 - defenseBonus));
  }
}
