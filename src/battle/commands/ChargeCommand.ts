/**
 * 돌격 명령
 * 기병 전용 강력한 돌격 공격
 */

import { BattleCommand, BattleCommandType, CommandContext, CommandResult, CommandRequirement } from './BattleCommand';
import { BattleType, TerrainType } from '../engines/BattleType';
import { JosaUtil } from '../../func/josaUtil';
import { ARM_TYPE } from '../../const/GameUnitConst';

export class ChargeCommand extends BattleCommand {
  readonly type = BattleCommandType.CHARGE;
  readonly name = '돌격';
  readonly description = '강력한 돌격으로 적에게 큰 피해를 입힙니다.';
  readonly requirements: CommandRequirement = {
    minHpRatio: 0.3,
    minAtmos: 60,
    allowedArmTypes: [ARM_TYPE.CAVALRY],
    allowedBattleTypes: [BattleType.FIELD],
    allowedTerrains: [TerrainType.PLAIN]
  };

  execute(ctx: CommandContext): CommandResult {
    const { executor, target, rng, battleContext } = ctx;
    const logs: string[] = [];

    if (!target) {
      return {
        success: false,
        logs: [],
        failReason: '돌격 대상이 없습니다'
      };
    }

    // 돌격 조건 확인
    if (executor.unit.armType !== ARM_TYPE.CAVALRY) {
      return {
        success: false,
        logs: [],
        failReason: '기병만 돌격을 사용할 수 있습니다'
      };
    }

    // 평지 확인
    if (battleContext.terrain !== TerrainType.PLAIN) {
      return {
        success: false,
        logs: [],
        failReason: '평지에서만 돌격할 수 있습니다'
      };
    }

    // 돌격 대미지 계산
    const baseAttack = executor.unit.attack + (executor.stats.strength ?? 50) / 5;

    // 돌격 보너스 (기본 50%)
    let chargeBonus = 1.5;

    // 무력에 따른 추가 보너스
    const strength = executor.stats.strength ?? 50;
    chargeBonus += (strength - 50) / 100;

    // 사기에 따른 보너스
    chargeBonus *= Math.max(0.8, executor.atmos / 100);

    // 방어측 병종에 따른 보정
    let targetDefenseMultiplier = 1.0;
    if (target.unit.armType === ARM_TYPE.FOOTMAN) {
      // 보병에게 돌격 효과 감소 (창병 대응)
      targetDefenseMultiplier = 0.7;
      logs.push(`보병이 기병 돌격에 대비합니다.`);
    } else if (target.unit.armType === ARM_TYPE.ARCHER) {
      // 궁병에게 돌격 효과 증가
      targetDefenseMultiplier = 1.3;
    }

    // 최종 대미지
    let damage = Math.round(
      baseAttack * chargeBonus * targetDefenseMultiplier * rng.range(0.9, 1.2)
    );

    // 크리티컬 (돌격 시 확률 증가)
    const critChance = Math.min(0.3, (executor.unit.critical ?? 0) / 100 + 0.1);
    const isCritical = rng.nextBool(critChance);
    if (isCritical) {
      damage = Math.round(damage * 1.5);
      logs.push(`<R>치명적인 돌격</>!`);
    }

    const actualDamage = Math.min(damage, target.hp);

    // 대미지 적용
    target.hp -= actualDamage;
    target.deadCurrent += actualDamage;
    target.deadTotal += actualDamage;
    executor.killedCurrent += actualDamage;
    executor.killedTotal += actualDamage;

    // 돌파 효과 (적 전열 붕괴)
    const breakthroughChance = 0.25;
    let isBreakthrough = false;
    if (rng.nextBool(breakthroughChance)) {
      const atmosLoss = Math.min(15, 10 + Math.round(strength / 10));
      target.atmos = Math.max(0, target.atmos - atmosLoss);
      isBreakthrough = true;
      logs.push(`적 전열 <R>돌파</>! 사기 -${atmosLoss}`);
    }

    // 돌격 후 반동 피해 (자신도 일부 피해)
    const recoilDamage = Math.round(actualDamage * 0.1 * rng.range(0.5, 1.0));
    executor.hp -= recoilDamage;
    executor.deadCurrent += recoilDamage;
    executor.deadTotal += recoilDamage;

    // 돌격 사용 후 1턴 쿨다운 설정
    executor.commandCooldowns = executor.commandCooldowns ?? {};
    executor.commandCooldowns[BattleCommandType.CHARGE] = ctx.turn + 1;

    const josa = JosaUtil.pick(executor.name, '이');
    logs.push(`<Y>${executor.name}</>${josa} <R>돌격</>! <Y>${target.name}</>에게 <C>${actualDamage}</> 피해!`);

    if (recoilDamage > 0) {
      logs.push(`돌격 반동으로 <Y>${executor.name}</> <R>${recoilDamage}</> 손실`);
    }

    return {
      success: true,
      logs,
      data: {
        damage: actualDamage,
        recoilDamage,
        isCritical,
        isBreakthrough,
        chargeBonus
      }
    };
  }
}
