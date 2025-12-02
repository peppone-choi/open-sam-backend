/**
 * 창병 (槍兵) - 병종 특기
 * 
 * 효과:
 * - 창병 전투력 +15%
 * - 창병 대기병 데미지 +30%
 * - 창병 방어 시 반격 확률 +20%
 */

import {
  UnitSpecialityBase,
  IStatCalcContext,
  IWarPowerMultiplier,
  IBattleContext,
  ITriggerResult,
  TriggerTiming,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';
import { BattleUnit } from '../../../battle/interfaces/Unit';

export class Changbyeong extends UnitSpecialityBase {
  readonly id = 73;
  readonly name = '창병';
  readonly info = '[병종] 창병 전투력 +15%, 대기병 데미지 +30%, 반격 확률 +20%';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [StatRequirement.STAT_STRENGTH];

  /**
   * 창병 유닛인지 확인
   */
  override matchesUnitType(unitType: string): boolean {
    const spearTypes = ['spear', '창병', 'pike', '극병', '장창'];
    return spearTypes.some((t) =>
      unitType.toLowerCase().includes(t.toLowerCase())
    );
  }

  /**
   * 스탯 계산
   */
  override onCalcStat(ctx: IStatCalcContext): number {
    if (!this.matchesUnitType((ctx.unit as any).unitType ?? '')) {
      return ctx.baseValue;
    }

    switch (ctx.statName) {
      case 'counterAttackRate':
        return ctx.baseValue + 0.2;
      case 'antiCavalryDamage':
        return ctx.baseValue * 1.3;
      default:
        return ctx.baseValue;
    }
  }

  /**
   * 병종 전투력 보정
   */
  override getUnitPowerBonus(): IWarPowerMultiplier {
    return {
      attackMultiplier: 1.15,
      defenseMultiplier: 1.1,
    };
  }

  /**
   * 전투력 배수 (창병일 때, 상대가 기병이면 추가 보너스)
   */
  getWarPowerMultiplier(
    unit: BattleUnit,
    opponent?: BattleUnit
  ): IWarPowerMultiplier {
    const unitType = (unit as any).unitType ?? '';

    if (!this.matchesUnitType(unitType)) {
      return {
        attackMultiplier: 1,
        defenseMultiplier: 1,
      };
    }

    // 기본 보너스
    let bonus = this.getUnitPowerBonus();

    // 상대가 기병이면 추가 공격력 보너스
    if (opponent) {
      const oppType = (opponent as any).unitType ?? '';
      const cavalryTypes = ['cavalry', '기병', 'horse', '마병'];
      const isCavalry = cavalryTypes.some((t) =>
        oppType.toLowerCase().includes(t.toLowerCase())
      );

      if (isCavalry) {
        bonus = {
          attackMultiplier: bonus.attackMultiplier * 1.3,
          defenseMultiplier: bonus.defenseMultiplier,
        };
      }
    }

    return bonus;
  }

  /**
   * 트리거 지원
   */
  supportsTrigger(timing: TriggerTiming): boolean {
    return timing === TriggerTiming.AFTER_DEFEND;
  }

  getSupportedTriggers(): TriggerTiming[] {
    return [TriggerTiming.AFTER_DEFEND];
  }

  /**
   * 방어 후 반격 트리거
   */
  onTrigger(timing: TriggerTiming, _ctx: IBattleContext): ITriggerResult {
    if (timing === TriggerTiming.AFTER_DEFEND) {
      if (Math.random() < 0.2) {
        return {
          activated: true,
          message: '창병 반격!',
          effects: { counterAttack: 1 },
        };
      }
    }
    return { activated: false };
  }
}


