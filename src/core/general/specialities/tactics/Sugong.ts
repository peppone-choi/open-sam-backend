/**
 * 수공 (水攻) - 계략 특기
 * 
 * 효과:
 * - 수공 계략 효과 +40%
 * - 수공 성공률 +25%
 * - 물 지형에서 추가 보너스
 */

import {
  TacticsSpecialityBase,
  IStatCalcContext,
  IWarPowerMultiplier,
  IBattleContext,
  ITriggerResult,
  TriggerTiming,
  StatRequirement,
  SelectWeightType,
} from '../SpecialityBase';
import { BattleUnit } from '../../../battle/interfaces/Unit';

export class Sugong extends TacticsSpecialityBase {
  readonly id = 43;
  readonly name = '수공';
  readonly info =
    '[계략] 수공 계략 효과 +40%, 성공률 +25%, 수상 전투 시 보너스';

  static override selectWeightType = SelectWeightType.NORM;
  static override selectWeight = 1;
  static override requirements = [StatRequirement.STAT_INTEL];

  /**
   * 수공 관련 스킬 목록
   */
  private waterSkills = ['수공', '수계', 'water', '홍수', '범람'];

  /**
   * 스탯 계산
   */
  override onCalcStat(ctx: IStatCalcContext): number {
    if (ctx.skillId && this.isWaterSkill(ctx.skillId)) {
      switch (ctx.statName) {
        case 'warMagicSuccessProb':
        case 'tacticsSuccessRate':
          return ctx.baseValue + 0.25;
        case 'warMagicSuccessDamage':
        case 'tacticsDamage':
          return ctx.baseValue * 1.4;
        default:
          return ctx.baseValue;
      }
    }

    // 수상 전투 보너스
    if (ctx.statName === 'waterBattleBonus') {
      return ctx.baseValue + 0.2;
    }

    return ctx.baseValue;
  }

  /**
   * 전투력 배수 (수상 전투 시)
   */
  getWarPowerMultiplier(
    unit: BattleUnit,
    _opponent?: BattleUnit
  ): IWarPowerMultiplier {
    // 수상 전투인 경우 보너스
    const isWaterBattle = this.isWaterTerrain(unit);

    if (isWaterBattle) {
      return {
        attackMultiplier: 1.15,
        defenseMultiplier: 0.9,
      };
    }

    return {
      attackMultiplier: 1,
      defenseMultiplier: 1,
    };
  }

  /**
   * 계략 성공 확률 보정
   */
  override getTacticsSuccessBonus(baseRate: number): number {
    return baseRate + 0.15;
  }

  /**
   * 계략 데미지 배수
   */
  override getTacticsDamageMultiplier(): number {
    return 1.4;
  }

  /**
   * 트리거 지원
   */
  override supportsTrigger(timing: TriggerTiming): boolean {
    return timing === TriggerTiming.ON_SKILL;
  }

  override getSupportedTriggers(): TriggerTiming[] {
    return [TriggerTiming.ON_SKILL];
  }

  /**
   * 스킬 사용 시 트리거
   */
  override onTrigger(
    timing: TriggerTiming,
    _ctx: IBattleContext
  ): ITriggerResult {
    if (timing === TriggerTiming.ON_SKILL) {
      return {
        activated: true,
        message: '수공 특기 발동! 수공 효과가 강화됩니다!',
        effects: {
          waterDamageBonus: 0.4,
        },
      };
    }
    return { activated: false };
  }

  /**
   * 수공 스킬인지 확인
   */
  private isWaterSkill(skillId: string): boolean {
    return this.waterSkills.some((s) =>
      skillId.toLowerCase().includes(s.toLowerCase())
    );
  }

  /**
   * 수상 지형인지 확인
   */
  private isWaterTerrain(unit: BattleUnit): boolean {
    const terrain = (unit as any).terrain ?? '';
    const waterTerrains = ['water', 'river', 'sea', 'lake', '수'];
    return waterTerrains.some((t) =>
      terrain.toLowerCase().includes(t.toLowerCase())
    );
  }
}


