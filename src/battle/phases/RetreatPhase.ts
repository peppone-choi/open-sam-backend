/**
 * 추격/퇴각 페이즈
 * 패배한 측의 퇴각 및 승리한 측의 추격 처리
 */

import { BattlePhase, PhaseResult, BattlePhaseContext } from './BattlePhase';
import { BattlePhaseType } from '../engines/BattleType';
import { WarUnitState } from '../engines/BaseBattleEngine';
import { JosaUtil } from '../../func/josaUtil';
import { ARM_TYPE } from '../../const/GameUnitConst';

export class RetreatPhase extends BattlePhase {
  readonly type = BattlePhaseType.PURSUIT_RETREAT;
  readonly name = '추격/퇴각 페이즈';

  execute(ctx: BattlePhaseContext): PhaseResult {
    const logs: string[] = [];
    const { attacker, defender, rng } = ctx;

    if (!defender) {
      return { completed: true, canContinue: false, logs: [] };
    }

    // 패배자 결정
    const attackerLost = attacker.hp <= 0;
    const defenderLost = defender.hp <= 0;

    if (attackerLost) {
      // 공격자 퇴각
      const retreatResult = this.processRetreat(ctx, attacker, defender);
      logs.push(...retreatResult.logs);

      // 방어자 추격
      if (this.canPursue(defender, attacker)) {
        const pursuitResult = this.processPursuit(ctx, defender, attacker);
        logs.push(...pursuitResult.logs);
      }
    } else if (defenderLost) {
      // 방어자 퇴각/전멸
      const retreatResult = this.processRetreat(ctx, defender, attacker);
      logs.push(...retreatResult.logs);

      // 공격자 추격
      if (this.canPursue(attacker, defender)) {
        const pursuitResult = this.processPursuit(ctx, attacker, defender);
        logs.push(...pursuitResult.logs);
      }
    }

    return {
      completed: true,
      canContinue: false,
      logs,
      data: {
        attackerRetreated: attackerLost,
        defenderRetreated: defenderLost
      }
    };
  }

  /** 퇴각 처리 */
  private processRetreat(ctx: BattlePhaseContext, retreater: WarUnitState, pursuer: WarUnitState): { logs: string[]; woundChance: number } {
    const logs: string[] = [];
    const { rng } = ctx;

    // 퇴각 로그
    const josaYi = JosaUtil.pick(retreater.unit.name, '이');
    if (retreater.hp <= 0) {
      logs.push(`<Y>${retreater.name}</>의 ${retreater.unit.name}${josaYi} <R>전멸</>했습니다.`);
    } else {
      logs.push(`<Y>${retreater.name}</>의 ${retreater.unit.name}${josaYi} <R>퇴각</>합니다.`);
    }

    // 퇴각 시 추가 피해 (10-30%)
    const retreatPenalty = rng.range(0.1, 0.3);
    const additionalDamage = Math.round(retreater.deadTotal * retreatPenalty);

    if (additionalDamage > 0 && retreater.hp > 0) {
      retreater.hp = Math.max(0, retreater.hp - additionalDamage);
      retreater.deadTotal += additionalDamage;
      logs.push(`퇴각 중 <C>${additionalDamage}</> 추가 손실이 발생했습니다.`);
    }

    // 부상 확률 증가
    const woundChance = retreater.hp <= 0 ? 0.4 : 0.2;

    return { logs, woundChance };
  }

  /** 추격 가능 여부 */
  private canPursue(pursuer: WarUnitState, retreater: WarUnitState): boolean {
    // 기병은 추격 유리
    if (pursuer.unit.armType === ARM_TYPE.CAVALRY) {
      return pursuer.hp > 0 && pursuer.atmos > 50;
    }

    // 궁병은 원거리 추격 가능
    if (pursuer.unit.armType === ARM_TYPE.ARCHER) {
      return pursuer.hp > 0 && pursuer.atmos > 60;
    }

    // 일반 병종은 사기가 높아야 추격 가능
    return pursuer.hp > 0 && pursuer.atmos > 80;
  }

  /** 추격 처리 */
  private processPursuit(ctx: BattlePhaseContext, pursuer: WarUnitState, retreater: WarUnitState): { logs: string[]; additionalDamage: number } {
    const logs: string[] = [];
    const { rng } = ctx;

    // 추격 성공 확률
    let pursuitChance = 0.3;
    if (pursuer.unit.armType === ARM_TYPE.CAVALRY) {
      pursuitChance = 0.6; // 기병은 추격 확률 높음
    } else if (pursuer.unit.armType === ARM_TYPE.ARCHER) {
      pursuitChance = 0.5; // 궁병은 원거리 추격
    }

    if (!rng.nextBool(pursuitChance)) {
      return { logs, additionalDamage: 0 };
    }

    // 추격 대미지 (잔여 전투력의 20-50%)
    const pursuitDamage = Math.round(pursuer.warPower * rng.range(0.2, 0.5));
    const actualDamage = Math.min(pursuitDamage, Math.max(0, retreater.hp));

    if (actualDamage > 0) {
      retreater.hp -= actualDamage;
      retreater.deadTotal += actualDamage;
      pursuer.killedTotal += actualDamage;

      const josaYi = JosaUtil.pick(pursuer.name, '이');
      logs.push(`<Y>${pursuer.name}</>${josaYi} 추격하여 <C>${actualDamage}</> 추가 피해를 입혔습니다!`);
    }

    return { logs, additionalDamage: actualDamage };
  }

  /** 진입 조건 - 전투 종료 시에만 실행 */
  canEnter(ctx: BattlePhaseContext): boolean {
    const { attacker, defender } = ctx;
    if (!defender) return false;
    return attacker.hp <= 0 || defender.hp <= 0;
  }
}
