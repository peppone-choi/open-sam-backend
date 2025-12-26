/**
 * 접근 페이즈 - 전투 전 준비 단계
 * 선제 스킬 발동, 진형 배치 등
 */

import { BattlePhase, PhaseResult, BattlePhaseContext } from './BattlePhase';
import { BattlePhaseType } from '../engines/BattleType';
import { JosaUtil } from '../../func/josaUtil';

export class ApproachPhase extends BattlePhase {
  readonly type = BattlePhaseType.APPROACH;
  readonly name = '접근 페이즈';

  execute(ctx: BattlePhaseContext): PhaseResult {
    const logs: string[] = [];
    const { attacker, defender, rng } = ctx;

    // 훈련도 보너스 적용
    attacker.train = Math.min(130, attacker.train + 1);
    if (defender) {
      defender.train = Math.min(130, defender.train + 1);
    }

    // 선제 스킬 발동 체크 (향후 확장)
    const attackerSkillLog = this.checkPreemptiveSkills(ctx, attacker, true);
    if (attackerSkillLog) logs.push(attackerSkillLog);

    if (defender) {
      const defenderSkillLog = this.checkPreemptiveSkills(ctx, defender, false);
      if (defenderSkillLog) logs.push(defenderSkillLog);
    }

    // 병종 상성 정보 로그
    if (defender) {
      const advantageLog = this.checkCrewTypeAdvantage(attacker, defender);
      if (advantageLog) logs.push(advantageLog);
    }

    // 진형 배치 (선제 사격 등)
    if (defender && this.canPreemptiveStrike(attacker, defender)) {
      const preemptiveResult = this.executePreemptiveStrike(ctx, attacker, defender);
      logs.push(...preemptiveResult.logs);
    }

    return {
      completed: true,
      canContinue: true,
      logs,
      data: {
        prePhaseBonus: {
          attacker: { train: 1 },
          defender: defender ? { train: 1 } : null
        }
      }
    };
  }

  /** 선제 스킬 체크 */
  private checkPreemptiveSkills(ctx: BattlePhaseContext, unit: any, isAttacker: boolean): string | null {
    const { rng } = ctx;
    const skills = unit.stats.specialSkills ?? [];

    // 선제사격 (궁병)
    if (skills.includes('선제사격') && rng.nextBool(0.3)) {
      unit.activatedSkills.add('선제사격');
      const josaYi = JosaUtil.pick(unit.name, '이');
      return `<Y>${unit.name}</>${josaYi} <C>선제사격</> 스킬을 발동합니다!`;
    }

    // 위압 (지휘관)
    if (skills.includes('위압') && rng.nextBool(0.2)) {
      unit.activatedSkills.add('위압');
      const josaYi = JosaUtil.pick(unit.name, '이');
      return `<Y>${unit.name}</>${josaYi} <C>위압</> 스킬을 발동합니다!`;
    }

    return null;
  }

  /** 병종 상성 체크 */
  private checkCrewTypeAdvantage(attacker: any, defender: any): string | null {
    // 간단한 상성 정보 (향후 GameUnitConst에서 가져오도록 확장)
    const attackerType = attacker.unit.armType;
    const defenderType = defender.unit.armType;

    // 기병 vs 궁병 상성
    if (attackerType === 3 && defenderType === 2) { // CAVALRY vs ARCHER
      return `기병이 궁병에게 <S>유리</>합니다!`;
    }
    if (attackerType === 2 && defenderType === 1) { // ARCHER vs FOOTMAN
      return `궁병이 보병에게 <S>유리</>합니다!`;
    }
    if (attackerType === 1 && defenderType === 3) { // FOOTMAN vs CAVALRY
      return `보병이 기병에게 <S>유리</>합니다!`;
    }

    return null;
  }

  /** 선제 공격 가능 여부 */
  private canPreemptiveStrike(attacker: any, defender: any): boolean {
    // 궁병의 선제 사격
    if (attacker.unit.armType === 2 && attacker.activatedSkills.has('선제사격')) {
      return true;
    }
    return false;
  }

  /** 선제 공격 실행 */
  private executePreemptiveStrike(ctx: BattlePhaseContext, attacker: any, defender: any): { logs: string[]; damage: number } {
    const { rng } = ctx;
    const logs: string[] = [];

    // 선제 사격 대미지 계산 (정규 대미지의 50%)
    const baseDamage = Math.round(attacker.stats.strength * 0.5 * rng.range(0.8, 1.2));
    const actualDamage = Math.min(baseDamage, defender.hp);

    defender.hp -= actualDamage;
    attacker.killedCurrent += actualDamage;
    attacker.killedTotal += actualDamage;
    defender.deadCurrent += actualDamage;
    defender.deadTotal += actualDamage;

    const josaYi = JosaUtil.pick(attacker.name, '이');
    logs.push(`<Y>${attacker.name}</>${josaYi} 선제 사격으로 <C>${actualDamage}</> 피해를 입혔습니다!`);

    return { logs, damage: actualDamage };
  }
}
