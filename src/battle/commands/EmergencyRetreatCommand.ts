/**
 * 긴급 퇴각 명령
 * 전투 중 강제로 퇴각
 */

import { BattleCommand, BattleCommandType, CommandContext, CommandResult, CommandRequirement } from './BattleCommand';
import { JosaUtil } from '../../func/josaUtil';
import { getRetreatPenalty } from '../crews/CrewTypeCombat';
import { ARM_TYPE } from '../../const/GameUnitConst';

export class EmergencyRetreatCommand extends BattleCommand {
  readonly type = BattleCommandType.EMERGENCY_RETREAT;
  readonly name = '긴급 퇴각';
  readonly description = '전투를 포기하고 즉시 퇴각합니다. 퇴각 중 손실이 발생합니다.';
  readonly requirements: CommandRequirement = {
    minHpRatio: 0 // HP 상관없이 사용 가능
  };

  execute(ctx: CommandContext): CommandResult {
    const { executor, target, rng, battleContext } = ctx;
    const logs: string[] = [];

    // 퇴각 페널티 계산
    const baseRetreatPenalty = getRetreatPenalty(executor.unit.armType);

    // 적이 있을 경우 추격 대미지
    let pursuitDamage = 0;
    if (target && target.hp > 0) {
      // 적 병종에 따른 추격 강도
      let pursuitMultiplier = 1.0;
      if (target.unit.armType === ARM_TYPE.CAVALRY) {
        pursuitMultiplier = 1.5; // 기병 추격 강함
      } else if (target.unit.armType === ARM_TYPE.ARCHER) {
        pursuitMultiplier = 1.3; // 궁병 원거리 추격
      }

      // 추격 대미지
      const basePursuitDamage = executor.hp * 0.2;
      pursuitDamage = Math.round(basePursuitDamage * pursuitMultiplier * rng.range(0.5, 1.0));
    }

    // 퇴각 손실 계산
    const retreatLoss = Math.round(executor.hp * baseRetreatPenalty * rng.range(0.8, 1.2));

    // 총 손실
    const totalLoss = Math.min(pursuitDamage + retreatLoss, executor.hp - 1); // 최소 1 HP 남김

    // 손실 적용
    executor.hp -= totalLoss;
    executor.deadCurrent += totalLoss;
    executor.deadTotal += totalLoss;

    // 사기 감소
    const atmosLoss = Math.min(20, 10 + Math.round(totalLoss / executor.maxHP * 30));
    executor.atmos = Math.max(0, executor.atmos - atmosLoss);

    // 퇴각 상태 설정
    executor.isRetreating = true;
    executor.retreatTurn = ctx.turn;

    // 로그 생성
    const josa = JosaUtil.pick(executor.name, '이');
    logs.push(`<Y>${executor.name}</>${josa} <R>긴급 퇴각</>을 명령했습니다!`);

    if (pursuitDamage > 0) {
      logs.push(`적의 추격으로 <R>${pursuitDamage}</> 손실!`);
    }
    if (retreatLoss > 0) {
      logs.push(`퇴각 중 <R>${retreatLoss}</> 추가 손실!`);
    }
    logs.push(`총 <C>${totalLoss}</> 병력 손실, 사기 <R>-${atmosLoss}</>`);

    // 기병은 퇴각 보너스
    if (executor.unit.armType === ARM_TYPE.CAVALRY) {
      const cavalryBonus = Math.round(totalLoss * 0.2);
      executor.hp += cavalryBonus;
      executor.deadTotal -= cavalryBonus;
      logs.push(`기병의 신속한 퇴각으로 <C>${cavalryBonus}</> 병력 구출!`);
    }

    return {
      success: true,
      logs,
      data: {
        retreatLoss,
        pursuitDamage,
        totalLoss,
        atmosLoss,
        retreatTurn: ctx.turn
      }
    };
  }
}
