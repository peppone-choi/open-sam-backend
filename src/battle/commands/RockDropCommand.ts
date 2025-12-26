/**
 * 낙석 명령
 * 산지에서 바위를 굴려 적을 공격
 */

import { BattleCommand, BattleCommandType, CommandContext, CommandResult, CommandRequirement } from './BattleCommand';
import { BattleType, TerrainType } from '../engines/BattleType';
import { JosaUtil } from '../../func/josaUtil';

export class RockDropCommand extends BattleCommand {
  readonly type = BattleCommandType.ROCK_DROP;
  readonly name = '낙석';
  readonly description = '산지에서 바위를 굴려 적을 공격합니다.';
  readonly requirements: CommandRequirement = {
    minHpRatio: 0.1,
    minAtmos: 30,
    allowedTerrains: [TerrainType.MOUNTAIN],
    requiresSkill: '낙석'
  };

  execute(ctx: CommandContext): CommandResult {
    const { executor, target, rng, battleContext } = ctx;
    const logs: string[] = [];

    if (!target) {
      return {
        success: false,
        logs: [],
        failReason: '낙석 대상이 없습니다'
      };
    }

    // 산지 지형 확인
    if (battleContext.terrain !== TerrainType.MOUNTAIN) {
      return {
        success: false,
        logs: [],
        failReason: '낙석은 산지에서만 사용할 수 있습니다'
      };
    }

    // 낙석 성공 확률
    let rockSuccessChance = 0.6;

    // 지력에 따른 보정
    const intel = executor.stats.intel ?? 50;
    rockSuccessChance += (intel - 50) / 150;

    // 공성전에서 수비측 유리
    if (battleContext.battleType === BattleType.DEFENSE) {
      rockSuccessChance += 0.15;
    }

    // 높은 곳에서 아래로 공격 시 유리 (고도 차이가 있다면)
    if (executor.position && target.position) {
      const heightDiff = (executor.position.y ?? 0) - (target.position.y ?? 0);
      if (heightDiff > 0) {
        rockSuccessChance += Math.min(0.2, heightDiff * 0.05);
      }
    }

    // 성공 여부 결정
    const isSuccessful = rng.nextBool(rockSuccessChance);

    if (!isSuccessful) {
      const josa = JosaUtil.pick(executor.name, '이');
      logs.push(`<Y>${executor.name}</>${josa} 낙석을 시도했으나 <R>빗나갔습니다</>.`);

      return {
        success: false,
        logs,
        failReason: '낙석 실패',
        data: { rockSuccessChance }
      };
    }

    // 낙석 대미지 계산 (고정 대미지 + 비율 대미지)
    const fixedDamage = 200;
    const ratioDamage = target.maxHP * 0.12;
    const intelBonus = 1 + (intel / 300);

    let damage = Math.round((fixedDamage + ratioDamage) * intelBonus * rng.range(0.8, 1.3));

    // 기병에게 추가 피해 (말이 놀라 혼란)
    if (target.unit.armType === 3) { // CAVALRY
      damage = Math.round(damage * 1.4);
      logs.push(`기병이 낙석에 크게 당황합니다!`);
    }

    // 공성병기에게 추가 피해
    if (target.unit.armType === 5) { // SIEGE
      damage = Math.round(damage * 1.5);
      logs.push(`공성병기가 낙석에 파손됩니다!`);
    }

    const actualDamage = Math.min(damage, target.hp);

    // 대미지 적용
    target.hp -= actualDamage;
    target.deadCurrent += actualDamage;
    target.deadTotal += actualDamage;
    executor.killedCurrent += actualDamage;
    executor.killedTotal += actualDamage;

    // 이동 불능 상태 (일정 확률)
    const immobilizeChance = 0.3;
    let isImmobilized = false;
    if (rng.nextBool(immobilizeChance)) {
      target.statusEffects = target.statusEffects ?? [];
      target.statusEffects.push({
        type: 'immobilize',
        duration: 1,
        value: 0
      });
      isImmobilized = true;
    }

    // 사기 타격
    const atmosLoss = Math.min(8, Math.round(actualDamage / target.maxHP * 15));
    target.atmos = Math.max(0, target.atmos - atmosLoss);

    const josa = JosaUtil.pick(executor.name, '이');
    logs.push(`<Y>${executor.name}</>${josa} <R>낙석</> 성공! <Y>${target.name}</>에게 <C>${actualDamage}</> 피해!`);

    if (isImmobilized) {
      logs.push(`<Y>${target.name}</> 1턴간 이동 불능!`);
    }

    return {
      success: true,
      logs,
      data: {
        damage: actualDamage,
        isImmobilized,
        atmosLoss,
        rockSuccessChance
      }
    };
  }
}
