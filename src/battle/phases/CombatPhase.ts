/**
 * 교전 페이즈 - 실제 전투 단계
 * 대미지 교환, 스킬 발동 등
 */

import { BattlePhase, PhaseResult, BattlePhaseContext } from './BattlePhase';
import { BattlePhaseType } from '../engines/BattleType';
import { WarUnitState } from '../engines/BaseBattleEngine';
import { JosaUtil } from '../../func/josaUtil';
import { ARM_TYPE, getAttackAdvantage, getDefenseAdvantage } from '../../const/GameUnitConst';

const ARM_PER_PHASE = 500;

export class CombatPhase extends BattlePhase {
  readonly type = BattlePhaseType.COMBAT;
  readonly name = '교전 페이즈';

  execute(ctx: BattlePhaseContext): PhaseResult {
    const logs: string[] = [];
    const { attacker, defender, rng, context } = ctx;

    if (!defender) {
      return {
        completed: true,
        canContinue: false,
        logs: ['수비자가 없습니다.']
      };
    }

    // 전투력 계산
    const attackerPower = this.computeWarPower(attacker, defender, ctx);
    const defenderPower = this.computeWarPower(defender, attacker, ctx);

    // 스킬 발동 체크
    const skillLogs = this.checkCombatSkills(ctx, attacker, defender);
    logs.push(...skillLogs);

    // 대미지 계산
    let damageToDefender = this.calcDamage(attackerPower, attacker, defender, rng);
    let damageToAttacker = this.calcDamage(defenderPower, defender, attacker, rng);

    // 필살 체크
    if (this.checkCritical(attacker, rng)) {
      const critMultiplier = rng.range(1.3, 2.0);
      damageToDefender = Math.round(damageToDefender * critMultiplier);
      logs.push(`<Y>${attacker.name}</>의 <R>필살 공격</>! (x${critMultiplier.toFixed(1)})`);
    }

    if (this.checkCritical(defender, rng)) {
      const critMultiplier = rng.range(1.3, 2.0);
      damageToAttacker = Math.round(damageToAttacker * critMultiplier);
      logs.push(`<Y>${defender.name}</>의 <R>필살 반격</>! (x${critMultiplier.toFixed(1)})`);
    }

    // 회피 체크
    if (this.checkAvoid(defender, rng)) {
      damageToDefender = Math.round(damageToDefender * 0.3);
      logs.push(`<Y>${defender.name}</>${JosaUtil.pick(defender.name, '이')} 공격을 <C>회피</>했습니다!`);
    }

    if (this.checkAvoid(attacker, rng)) {
      damageToAttacker = Math.round(damageToAttacker * 0.3);
      logs.push(`<Y>${attacker.name}</>${JosaUtil.pick(attacker.name, '이')} 공격을 <C>회피</>했습니다!`);
    }

    // 동시 전멸 방지
    const { finalAttackerDamage, finalDefenderDamage } = this.preventSimultaneousDeath(
      damageToAttacker, damageToDefender, attacker.hp, defender.hp
    );

    // 대미지 적용
    this.applyDamage(attacker, finalAttackerDamage, finalDefenderDamage);
    this.applyDamage(defender, finalDefenderDamage, finalAttackerDamage);

    // 군량 소모
    const attackerRiceUsed = finalAttackerDamage / 100 * 0.8;
    const defenderRiceUsed = finalDefenderDamage / 100 * 0.8;
    attacker.rice -= attackerRiceUsed;
    defender.rice -= defenderRiceUsed;

    // 턴 로그
    const turn = context.turn + 1;
    logs.push(`${turn}: <Y1>【${attacker.name}】</> <C>${attacker.hp} (-${finalAttackerDamage})</> VS <C>${defender.hp} (-${finalDefenderDamage})</> <Y1>【${defender.name}】</>`);

    // 전투 지속 가능 여부
    const canContinue = attacker.hp > 0 && defender.hp > 0;

    return {
      completed: true,
      canContinue,
      logs,
      data: {
        damageDealt: {
          toAttacker: finalAttackerDamage,
          toDefender: finalDefenderDamage
        },
        riceUsed: {
          attacker: attackerRiceUsed,
          defender: defenderRiceUsed
        }
      }
    };
  }

  /** 전투력 계산 */
  private computeWarPower(attacker: WarUnitState, defender: WarUnitState, ctx: BattlePhaseContext): number {
    const myAtt = this.computeAttackPower(attacker);
    const opDef = this.computeDefensePower(defender);

    let warPower = ARM_PER_PHASE + myAtt - opDef;

    // 최소 전투력 보장
    if (warPower < 100) {
      warPower = Math.max(0, warPower);
      warPower = (warPower + 100) / 2;
      warPower = ctx.rng.nextRangeInt(Math.floor(warPower), 100);
    }

    // 사기 보정
    warPower *= Math.max(40, Math.min(130, attacker.atmos)) / 100;

    // 훈련도 보정
    warPower /= Math.max(50, defender.train) / 100;

    // 숙련도 보정
    const dexBonus = this.getDexBonus(attacker, attacker.unit.armType);
    const dexPenalty = this.getDexBonus(defender, attacker.unit.armType);
    warPower *= this.getDexLog(dexBonus, dexPenalty);

    // 병종 상성
    const attackAdvantage = getAttackAdvantage(attacker.unit.id, this.getArmTypeLabel(defender.unit.armType), ctx.context.battleType);
    const defenseAdvantage = getDefenseAdvantage(defender.unit.id, this.getArmTypeLabel(attacker.unit.armType), ctx.context.battleType);
    warPower *= attackAdvantage * defenseAdvantage;

    return warPower;
  }

  /** 공격력 계산 */
  private computeAttackPower(unit: WarUnitState): number {
    const { stats } = unit;
    const leadership = stats.leadership ?? 50;
    const strength = stats.strength ?? 50;
    const intel = stats.intel ?? 50;
    const baseAttack = unit.unit.attack || 100;

    if (unit.unit.armType === ARM_TYPE.ARCHER || unit.unit.armType === ARM_TYPE.WIZARD) {
      return baseAttack + leadership / 10 + intel / 10;
    }
    return baseAttack + leadership / 10 + strength / 10;
  }

  /** 방어력 계산 */
  private computeDefensePower(unit: WarUnitState): number {
    const baseDefence = unit.unit.defence || 100;
    const crewCoef = (unit.hp / 233.33) + 70;
    const clampedCoef = Math.min(100, Math.max(70, crewCoef));
    return baseDefence * clampedCoef / 100;
  }

  /** 숙련도 보너스 */
  private getDexBonus(unit: WarUnitState, armType: number): number {
    const dexMap: Record<number, number | undefined> = {
      [ARM_TYPE.FOOTMAN]: unit.stats.dex1,
      [ARM_TYPE.ARCHER]: unit.stats.dex2,
      [ARM_TYPE.CAVALRY]: unit.stats.dex3,
      [ARM_TYPE.WIZARD]: unit.stats.dex4,
      [ARM_TYPE.SIEGE]: unit.stats.dex5
    };
    return 1 + (dexMap[armType] ?? 0) / 100000;
  }

  /** 숙련도 로그 계산 */
  private getDexLog(attackerDex: number, defenderDex: number): number {
    if (attackerDex <= 1 && defenderDex <= 1) return 1;
    const ratio = Math.max(0.5, Math.min(2, attackerDex / Math.max(1, defenderDex)));
    return 0.8 + ratio * 0.2;
  }

  /** ARM_TYPE 레이블 변환 */
  private getArmTypeLabel(armType: number): string {
    const labels: Record<number, string> = {
      [ARM_TYPE.CASTLE]: 'CASTLE',
      [ARM_TYPE.FOOTMAN]: 'FOOTMAN',
      [ARM_TYPE.ARCHER]: 'ARCHER',
      [ARM_TYPE.CAVALRY]: 'CAVALRY',
      [ARM_TYPE.WIZARD]: 'WIZARD',
      [ARM_TYPE.SIEGE]: 'SIEGE',
      [ARM_TYPE.MISC]: 'MISC'
    };
    return labels[armType] ?? 'FOOTMAN';
  }

  /** 대미지 계산 */
  private calcDamage(warPower: number, attacker: WarUnitState, defender: WarUnitState, rng: any): number {
    const randomFactor = rng.range(0.9, 1.1);
    const injuryPenalty = attacker.stats.injury ? 1 - Math.min(attacker.stats.injury, 80) / 120 : 1;
    return Math.round(warPower * randomFactor * injuryPenalty);
  }

  /** 필살 체크 */
  private checkCritical(unit: WarUnitState, rng: any): boolean {
    const critRatio = unit.unit.critical ?? 0;
    const inheritBuff = unit.stats.inheritBuff?.warCriticalRatio ?? 0;
    const totalCritRatio = (critRatio + inheritBuff) / 100;
    return rng.nextBool(totalCritRatio);
  }

  /** 회피 체크 */
  private checkAvoid(unit: WarUnitState, rng: any): boolean {
    const avoidRatio = unit.unit.avoid ?? 0;
    const inheritBuff = unit.stats.inheritBuff?.warAvoidRatio ?? 0;
    const totalAvoidRatio = (avoidRatio + inheritBuff) / 100;
    return rng.nextBool(totalAvoidRatio);
  }

  /** 동시 전멸 방지 */
  private preventSimultaneousDeath(
    damageToAttacker: number,
    damageToDefender: number,
    attackerHP: number,
    defenderHP: number
  ): { finalAttackerDamage: number; finalDefenderDamage: number } {
    if (damageToAttacker > attackerHP || damageToDefender > defenderHP) {
      const attackerRatio = damageToAttacker / Math.max(1, attackerHP);
      const defenderRatio = damageToDefender / Math.max(1, defenderHP);

      if (defenderRatio > attackerRatio) {
        return {
          finalAttackerDamage: Math.round(damageToAttacker / defenderRatio),
          finalDefenderDamage: defenderHP
        };
      } else {
        return {
          finalAttackerDamage: attackerHP,
          finalDefenderDamage: Math.round(damageToDefender / attackerRatio)
        };
      }
    }

    return {
      finalAttackerDamage: Math.min(Math.ceil(damageToAttacker), attackerHP),
      finalDefenderDamage: Math.min(Math.ceil(damageToDefender), defenderHP)
    };
  }

  /** 대미지 적용 */
  private applyDamage(unit: WarUnitState, damageTaken: number, damageDealt: number): void {
    unit.hp -= damageTaken;
    unit.deadCurrent += damageTaken;
    unit.deadTotal += damageTaken;
    unit.killedCurrent += damageDealt;
    unit.killedTotal += damageDealt;
  }

  /** 전투 스킬 체크 */
  private checkCombatSkills(ctx: BattlePhaseContext, attacker: WarUnitState, defender: WarUnitState): string[] {
    const logs: string[] = [];
    const { rng } = ctx;
    const attackerSkills = attacker.stats.specialSkills ?? [];
    const defenderSkills = defender.stats.specialSkills ?? [];

    // 돌격 (기병)
    if (attackerSkills.includes('돌격') && attacker.unit.armType === ARM_TYPE.CAVALRY && rng.nextBool(0.25)) {
      attacker.activatedSkills.add('돌격');
      attacker.warPowerMultiply *= 1.3;
      logs.push(`<Y>${attacker.name}</>${JosaUtil.pick(attacker.name, '이')} <C>돌격</> 스킬 발동!`);
    }

    // 반계
    if (defenderSkills.includes('반계') && rng.nextBool(0.15)) {
      defender.activatedSkills.add('반계');
      logs.push(`<Y>${defender.name}</>${JosaUtil.pick(defender.name, '이')} <C>반계</> 스킬 발동!`);
    }

    // 집중
    if (attackerSkills.includes('집중') && rng.nextBool(0.2)) {
      attacker.activatedSkills.add('집중');
      attacker.warPowerMultiply *= 1.2;
      logs.push(`<Y>${attacker.name}</>${JosaUtil.pick(attacker.name, '이')} <C>집중</> 스킬 발동!`);
    }

    return logs;
  }
}
