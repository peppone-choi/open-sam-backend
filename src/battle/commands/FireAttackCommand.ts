/**
 * 화공 명령
 * 불을 이용한 공격 (공성전/야전)
 */

import { BattleCommand, BattleCommandType, CommandContext, CommandResult, CommandRequirement } from './BattleCommand';
import { BattleType, TerrainType, WeatherType } from '../engines/BattleType';
import { JosaUtil } from '../../func/josaUtil';
import { ARM_TYPE } from '../../const/GameUnitConst';

export class FireAttackCommand extends BattleCommand {
  readonly type = BattleCommandType.FIRE_ATTACK;
  readonly name = '화공';
  readonly description = '불을 이용하여 적에게 큰 피해를 입힙니다.';
  readonly requirements: CommandRequirement = {
    minHpRatio: 0.2,
    minAtmos: 40,
    forbiddenWeathers: [WeatherType.RAIN, WeatherType.SNOW],
    requiresSkill: '화공'
  };

  canExecute(ctx: CommandContext): { canExecute: boolean; reason?: string } {
    const baseCheck = super.canExecute(ctx);
    if (!baseCheck.canExecute) return baseCheck;

    // 비/눈 올 때 화공 불가
    if (ctx.battleContext.weather === WeatherType.RAIN) {
      return { canExecute: false, reason: '비가 와서 화공을 사용할 수 없습니다' };
    }
    if (ctx.battleContext.weather === WeatherType.SNOW) {
      return { canExecute: false, reason: '눈이 와서 화공을 사용할 수 없습니다' };
    }

    return { canExecute: true };
  }

  execute(ctx: CommandContext): CommandResult {
    const { executor, target, rng, battleContext } = ctx;
    const logs: string[] = [];

    if (!target) {
      return {
        success: false,
        logs: [],
        failReason: '화공 대상이 없습니다'
      };
    }

    // 화공 성공 확률
    let fireSuccessChance = 0.5;

    // 지력에 따른 보정
    const intel = executor.stats.intel ?? 50;
    fireSuccessChance += (intel - 50) / 100;

    // 날씨 보정
    if (battleContext.weather === WeatherType.WIND) {
      fireSuccessChance += 0.2; // 바람 불면 화공 유리
    }
    if (battleContext.weather === WeatherType.CLEAR) {
      fireSuccessChance += 0.1;
    }

    // 지형 보정
    if (battleContext.terrain === TerrainType.PLAIN) {
      fireSuccessChance += 0.05;
    }

    // 공성전 보정
    if (battleContext.battleType === BattleType.SIEGE) {
      fireSuccessChance += 0.15; // 공성전에서 화공 유리
    }

    // 귀병(술사) 보정
    if (executor.unit.armType === ARM_TYPE.WIZARD) {
      fireSuccessChance += 0.2;
    }

    // 성공 여부 결정
    const isSuccessful = rng.nextBool(fireSuccessChance);

    if (!isSuccessful) {
      const josa = JosaUtil.pick(executor.name, '이');
      logs.push(`<Y>${executor.name}</>${josa} 화공을 시도했으나 <R>실패</>했습니다.`);

      // 실패 시 역화 확률
      const backfireChance = 0.15;
      if (rng.nextBool(backfireChance)) {
        const backfireDamage = Math.round(executor.hp * 0.1 * rng.range(0.8, 1.2));
        executor.hp -= backfireDamage;
        executor.deadCurrent += backfireDamage;
        executor.deadTotal += backfireDamage;
        logs.push(`불이 역화하여 <Y>${executor.name}</>에게 <R>${backfireDamage}</> 피해!`);
      }

      return {
        success: false,
        logs,
        failReason: '화공 실패',
        data: { fireSuccessChance }
      };
    }

    // 화공 대미지 계산
    const baseDamage = target.maxHP * 0.15; // 최대 HP의 15%
    const intelBonus = 1 + (intel / 200);
    const weatherBonus = battleContext.weather === WeatherType.WIND ? 1.5 : 1.0;

    let damage = Math.round(baseDamage * intelBonus * weatherBonus * rng.range(0.8, 1.3));

    // 성벽/성문에 추가 피해
    if (battleContext.terrain === TerrainType.WALL || battleContext.terrain === TerrainType.GATE) {
      damage = Math.round(damage * 1.3);
    }

    const actualDamage = Math.min(damage, target.hp);

    // 대미지 적용
    target.hp -= actualDamage;
    target.deadCurrent += actualDamage;
    target.deadTotal += actualDamage;
    executor.killedCurrent += actualDamage;
    executor.killedTotal += actualDamage;

    // 화상 상태 (지속 피해)
    const burnTurns = rng.nextRangeInt(2, 4);
    target.statusEffects = target.statusEffects ?? [];
    target.statusEffects.push({
      type: 'burn',
      duration: burnTurns,
      value: Math.round(actualDamage * 0.1)
    });

    // 사기 타격
    const atmosLoss = Math.min(10, Math.round(actualDamage / target.maxHP * 20));
    target.atmos = Math.max(0, target.atmos - atmosLoss);

    const josa = JosaUtil.pick(executor.name, '이');
    logs.push(`<Y>${executor.name}</>${josa} <R>화공</> 성공! <Y>${target.name}</>에게 <C>${actualDamage}</> 피해!`);
    logs.push(`<Y>${target.name}</> ${burnTurns}턴간 화상 상태`);

    return {
      success: true,
      logs,
      data: {
        damage: actualDamage,
        burnTurns,
        atmosLoss,
        fireSuccessChance,
        weatherBonus
      }
    };
  }
}
