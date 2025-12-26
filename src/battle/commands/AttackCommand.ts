/**
 * 공격 명령
 * 기본 전투 공격 명령
 */

import { BattleCommand, BattleCommandType, CommandContext, CommandResult, CommandRequirement } from './BattleCommand';
import { JosaUtil } from '../../func/josaUtil';
import { getCrewAdvantage } from '../crews/CrewTypeCombat';

export class AttackCommand extends BattleCommand {
  readonly type = BattleCommandType.ATTACK;
  readonly name = '공격';
  readonly description = '대상을 공격합니다.';
  readonly requirements: CommandRequirement = {
    minHpRatio: 0,
    minAtmos: 30
  };

  execute(ctx: CommandContext): CommandResult {
    const { executor, target, rng, battleContext } = ctx;
    const logs: string[] = [];

    // 대상 검증
    if (!target) {
      return {
        success: false,
        logs: [],
        failReason: '공격 대상이 없습니다'
      };
    }

    // 기본 공격력 계산
    const baseAttack = executor.unit.attack + (executor.stats.strength ?? 50) / 10;
    const baseDefense = target.unit.defence;

    // 상성 보정
    const advantageMultiplier = getCrewAdvantage(executor.unit.armType, target.unit.armType);

    // 사기 보정
    const atmosMultiplier = Math.max(0.5, Math.min(1.5, executor.atmos / 100));

    // 훈련도 보정
    const trainMultiplier = Math.max(0.7, Math.min(1.3, executor.train / 100));

    // 랜덤 요소
    const randomFactor = rng.range(0.9, 1.1);

    // 최종 대미지 계산
    let damage = Math.round(
      (baseAttack - baseDefense * 0.5) *
      advantageMultiplier *
      atmosMultiplier *
      trainMultiplier *
      randomFactor
    );

    // 최소 대미지 보장
    damage = Math.max(10, damage);

    // 크리티컬 체크
    const critChance = (executor.unit.critical ?? 0) / 100;
    const isCritical = rng.nextBool(critChance);
    if (isCritical) {
      const critMultiplier = rng.range(1.5, 2.0);
      damage = Math.round(damage * critMultiplier);
      logs.push(`<Y>${executor.name}</>의 <R>필살 공격</>!`);
    }

    // 회피 체크
    const avoidChance = (target.unit.avoid ?? 0) / 100;
    const isAvoided = rng.nextBool(avoidChance);
    if (isAvoided) {
      damage = Math.round(damage * 0.3);
      logs.push(`<Y>${target.name}</>${JosaUtil.pick(target.name, '이')} 공격을 <C>회피</>했습니다!`);
    }

    // 대미지 적용
    const actualDamage = Math.min(damage, target.hp);
    target.hp -= actualDamage;
    target.deadCurrent += actualDamage;
    target.deadTotal += actualDamage;
    executor.killedCurrent += actualDamage;
    executor.killedTotal += actualDamage;

    // 로그 생성
    const josa = JosaUtil.pick(executor.name, '이');
    logs.push(`<Y>${executor.name}</>${josa} <Y>${target.name}</>을(를) 공격하여 <C>${actualDamage}</> 피해!`);

    // 사기 변화
    if (actualDamage > 0) {
      const atmosLoss = Math.min(5, Math.round(actualDamage / target.maxHP * 10));
      target.atmos = Math.max(0, target.atmos - atmosLoss);
    }

    return {
      success: true,
      logs,
      data: {
        damage: actualDamage,
        isCritical,
        isAvoided,
        advantageMultiplier
      }
    };
  }
}
