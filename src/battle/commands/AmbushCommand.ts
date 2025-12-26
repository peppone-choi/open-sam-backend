/**
 * 매복 명령
 * 적을 기습 공격하는 매복 설정
 */

import { BattleCommand, BattleCommandType, CommandContext, CommandResult, CommandRequirement } from './BattleCommand';
import { BattleType, TerrainType, WeatherType } from '../engines/BattleType';
import { JosaUtil } from '../../func/josaUtil';
import { ARM_TYPE } from '../../const/GameUnitConst';

export class AmbushCommand extends BattleCommand {
  readonly type = BattleCommandType.AMBUSH;
  readonly name = '매복';
  readonly description = '적을 기습 공격하기 위해 매복합니다.';
  readonly requirements: CommandRequirement = {
    minHpRatio: 0.3,
    minAtmos: 50,
    allowedBattleTypes: [BattleType.FIELD],
    allowedTerrains: [TerrainType.MOUNTAIN, TerrainType.PLAIN],
    requiresSkill: '매복'
  };

  execute(ctx: CommandContext): CommandResult {
    const { executor, targetPosition, rng, battleContext } = ctx;
    const logs: string[] = [];

    // 매복 위치 설정
    const ambushPos = targetPosition ?? executor.position ?? { x: 0, y: 0 };

    // 매복 성공 확률 계산
    let ambushSuccessChance = 0.7;

    // 지력에 따른 보정
    const intel = executor.stats.intel ?? 50;
    ambushSuccessChance += (intel - 50) / 200;

    // 병종에 따른 보정
    if (executor.unit.armType === ARM_TYPE.FOOTMAN) {
      ambushSuccessChance += 0.1; // 보병 유리
    } else if (executor.unit.armType === ARM_TYPE.CAVALRY) {
      ambushSuccessChance -= 0.1; // 기병 불리 (소음)
    }

    // 지형에 따른 보정
    if (battleContext.terrain === TerrainType.MOUNTAIN) {
      ambushSuccessChance += 0.15; // 산지 유리
    }

    // 날씨에 따른 보정
    if (battleContext.weather === WeatherType.FOG) {
      ambushSuccessChance += 0.2; // 안개 매우 유리
    }

    // 성공 여부 결정
    const isAmbushSet = rng.nextBool(ambushSuccessChance);

    if (!isAmbushSet) {
      return {
        success: false,
        logs: [`<Y>${executor.name}</>의 매복 설정이 <R>실패</>했습니다.`],
        failReason: '매복 설정 실패'
      };
    }

    // 매복 상태 설정
    executor.isAmbushing = true;
    executor.ambushPosition = ambushPos;

    // 매복 대미지 보너스 (발동 시)
    const ambushDamageBonus = 0.3 + (intel / 200);

    const josa = JosaUtil.pick(executor.name, '이');
    logs.push(`<Y>${executor.name}</>${josa} (${ambushPos.x},${ambushPos.y})에 <C>매복</>을 설정했습니다.`);

    return {
      success: true,
      logs,
      data: {
        ambushPosition: ambushPos,
        ambushSuccessChance,
        ambushDamageBonus
      }
    };
  }

  /**
   * 매복 발동 (적이 매복 위치에 진입할 때 호출)
   */
  triggerAmbush(ctx: CommandContext): CommandResult {
    const { executor, target, rng } = ctx;
    const logs: string[] = [];

    if (!executor.isAmbushing || !target) {
      return {
        success: false,
        logs: [],
        failReason: '매복 상태가 아니거나 대상이 없습니다'
      };
    }

    // 매복 해제
    executor.isAmbushing = false;
    executor.ambushPosition = undefined;

    // 기습 공격 대미지 계산
    const baseAttack = executor.unit.attack + (executor.stats.strength ?? 50) / 10;
    const intel = executor.stats.intel ?? 50;
    const ambushBonus = 1.3 + (intel / 200);

    const damage = Math.round(baseAttack * ambushBonus * rng.range(0.9, 1.2));
    const actualDamage = Math.min(damage, target.hp);

    // 대미지 적용
    target.hp -= actualDamage;
    target.deadCurrent += actualDamage;
    target.deadTotal += actualDamage;
    executor.killedCurrent += actualDamage;
    executor.killedTotal += actualDamage;

    // 사기 타격
    const atmosLoss = Math.min(15, Math.round(actualDamage / target.maxHP * 30));
    target.atmos = Math.max(0, target.atmos - atmosLoss);

    const josa = JosaUtil.pick(executor.name, '이');
    logs.push(`<Y>${executor.name}</>${josa} <R>기습 공격</>! <Y>${target.name}</>에게 <C>${actualDamage}</> 피해!`);
    logs.push(`<Y>${target.name}</> 사기 <R>-${atmosLoss}</>`);

    return {
      success: true,
      logs,
      data: {
        damage: actualDamage,
        atmosLoss,
        ambushBonus
      }
    };
  }
}
