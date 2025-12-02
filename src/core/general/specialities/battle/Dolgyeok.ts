/**
 * 돌격 (突擊) - 전투 특기
 * PHP che_돌격.php 기반
 * 
 * 효과:
 * - 공격 시 대등/유리한 병종에게는 퇴각 전까지 전투
 * - 공격 시 페이즈 +2
 * - 공격 시 대미지 +5%
 */

import {
  BattleSpecialityBase,
  IStatCalcContext,
  IWarPowerMultiplier,
  IBattleContext,
  ITriggerResult,
  TriggerTiming,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';
import { BattleUnit } from '../../../battle/interfaces/Unit';

export class Dolgyeok extends BattleSpecialityBase {
  readonly id = 60;
  readonly name = '돌격';
  readonly info =
    '[전투] 공격 시 대등/유리한 병종에게는 퇴각 전까지 전투, ' +
    '공격 시 페이즈 +2, 공격 시 대미지 +5%';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [StatRequirement.STAT_STRENGTH];

  /**
   * 스탯 계산 - 초기 페이즈 +2
   */
  override onCalcStat(ctx: IStatCalcContext): number {
    if (ctx.statName === 'initWarPhase') {
      return ctx.baseValue + 2;
    }
    return ctx.baseValue;
  }

  /**
   * 전투력 배수 계산 (공격자일 때만)
   */
  override getWarPowerMultiplier(
    unit: BattleUnit,
    _opponent?: BattleUnit
  ): IWarPowerMultiplier {
    // 공격자일 때만 데미지 보너스
    const isAttacker = (unit as any).isAttacker ?? false;

    if (isAttacker) {
      return {
        attackMultiplier: 1.05,
        defenseMultiplier: 1,
      };
    }

    return {
      attackMultiplier: 1,
      defenseMultiplier: 1,
    };
  }

  /**
   * 추가 페이즈 수
   */
  override getExtraPhases(): number {
    return 2;
  }

  /**
   * 선제 공격 확률 보정
   */
  override getInitiativeBonus(baseValue: number): number {
    return baseValue + 0.1; // +10%
  }

  /**
   * 트리거 지원
   */
  override supportsTrigger(timing: TriggerTiming): boolean {
    return timing === TriggerTiming.BEFORE_ATTACK;
  }

  override getSupportedTriggers(): TriggerTiming[] {
    return [TriggerTiming.BEFORE_ATTACK];
  }

  /**
   * 공격 전 트리거 - 돌격 지속 효과
   */
  override onTrigger(
    timing: TriggerTiming,
    ctx: IBattleContext
  ): ITriggerResult {
    if (timing === TriggerTiming.BEFORE_ATTACK) {
      // 유리한 병종 상대로는 퇴각 전까지 전투
      const isFavorableMatchup = this.checkFavorableMatchup(
        ctx.attacker,
        ctx.defender
      );

      if (isFavorableMatchup) {
        return {
          activated: true,
          message: '돌격! 퇴각 전까지 전투를 계속합니다!',
          effects: { continuousBattle: 1 },
        };
      }
    }
    return { activated: false };
  }

  /**
   * 유리한 상성인지 확인
   */
  private checkFavorableMatchup(
    attacker: BattleUnit,
    defender: BattleUnit
  ): boolean {
    const attackerType = (attacker as any).unitType ?? 'footman';
    const defenderType = (defender as any).unitType ?? 'footman';

    // 병종 상성 체크 (기병 > 궁병 > 보병 > 창병 > 기병)
    const advantages: Record<string, string[]> = {
      cavalry: ['archer', 'wizard'],
      archer: ['footman', 'siege'],
      footman: ['spearman'],
      spearman: ['cavalry'],
    };

    const attackerAdvantages = advantages[attackerType.toLowerCase()] ?? [];
    return (
      attackerAdvantages.includes(defenderType.toLowerCase()) ||
      attackerType === defenderType
    );
  }
}


