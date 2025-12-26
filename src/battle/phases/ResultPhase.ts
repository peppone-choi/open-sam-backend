/**
 * 결과 처리 페이즈
 * 승패 판정, 보상/패널티, 부상 처리 등
 */

import { BattlePhase, PhaseResult, BattlePhaseContext } from './BattlePhase';
import { BattlePhaseType, BattleResult, BattleType, BattleContext } from '../engines/BattleType';
import { WarUnitState } from '../engines/BaseBattleEngine';
import { JosaUtil } from '../../func/josaUtil';

export interface BattleResultData {
  result: BattleResult;
  winner: 'attacker' | 'defender' | 'draw';
  attackerStats: UnitResultStats;
  defenderStats: UnitResultStats | null;
  rewards: BattleRewards;
}

export interface UnitResultStats {
  generalId: number;
  name: string;
  initialHP: number;
  finalHP: number;
  killed: number;
  dead: number;
  wounded: boolean;
  woundAmount: number;
  experienceGained: number;
  trainChange: number;
  atmosChange: number;
}

export interface BattleRewards {
  attackerGold: number;
  attackerRice: number;
  defenderGold: number;
  defenderRice: number;
  techGain: number;
}

export class ResultPhase extends BattlePhase {
  readonly type = BattlePhaseType.RESULT;
  readonly name = '결과 처리 페이즈';

  execute(ctx: BattlePhaseContext): PhaseResult {
    const logs: string[] = [];
    const { attacker, defender, rng, context } = ctx;

    // 승패 판정
    const result = this.determineResult(attacker, defender, context);
    logs.push(this.getResultLog(result, attacker, defender));

    // 부상 처리
    const attackerWound = this.processWound(attacker, rng, result);
    if (attackerWound.wounded) {
      logs.push(attackerWound.log);
    }

    let defenderWound = { wounded: false, woundAmount: 0, log: '' };
    if (defender) {
      defenderWound = this.processWound(defender, rng, result);
      if (defenderWound.wounded) {
        logs.push(defenderWound.log);
      }
    }

    // 경험치/훈련도/사기 변화
    const attackerStatChanges = this.calculateStatChanges(attacker, result, true);
    const defenderStatChanges = defender ? this.calculateStatChanges(defender, result, false) : null;

    // 스탯 적용
    this.applyStatChanges(attacker, attackerStatChanges);
    if (defender && defenderStatChanges) {
      this.applyStatChanges(defender, defenderStatChanges);
    }

    // 보상 계산
    const rewards = this.calculateRewards(attacker, defender, result, context);

    // 결과 데이터 생성
    const resultData: BattleResultData = {
      result,
      winner: result === BattleResult.ATTACKER_WIN || result === BattleResult.CITY_CONQUERED ? 'attacker' :
              result === BattleResult.DEFENDER_WIN ? 'defender' : 'draw',
      attackerStats: {
        generalId: attacker.generalId,
        name: attacker.name,
        initialHP: attacker.maxHP,
        finalHP: attacker.hp,
        killed: attacker.killedTotal,
        dead: attacker.deadTotal,
        wounded: attackerWound.wounded,
        woundAmount: attackerWound.woundAmount,
        experienceGained: attackerStatChanges.experience,
        trainChange: attackerStatChanges.train,
        atmosChange: attackerStatChanges.atmos
      },
      defenderStats: defender ? {
        generalId: defender.generalId,
        name: defender.name,
        initialHP: defender.maxHP,
        finalHP: defender.hp,
        killed: defender.killedTotal,
        dead: defender.deadTotal,
        wounded: defenderWound.wounded,
        woundAmount: defenderWound.woundAmount,
        experienceGained: defenderStatChanges?.experience ?? 0,
        trainChange: defenderStatChanges?.train ?? 0,
        atmosChange: defenderStatChanges?.atmos ?? 0
      } : null,
      rewards
    };

    // 스탯 변화 로그
    if (attackerStatChanges.experience > 0) {
      logs.push(`<Y>${attacker.name}</> 경험치 +${attackerStatChanges.experience}`);
    }
    if (defenderStatChanges && defenderStatChanges.experience > 0) {
      logs.push(`<Y>${defender!.name}</> 경험치 +${defenderStatChanges.experience}`);
    }

    return {
      completed: true,
      canContinue: false,
      logs,
      data: resultData
    };
  }

  /** 승패 판정 */
  private determineResult(attacker: WarUnitState, defender: WarUnitState | null, context: BattleContext): BattleResult {
    if (!defender) {
      return BattleResult.ATTACKER_WIN;
    }

    const attackerAlive = attacker.hp > 0;
    const defenderAlive = defender.hp > 0;

    if (attackerAlive && !defenderAlive) {
      // 공성전에서 성 함락
      if (context.battleType === BattleType.SIEGE) {
        return BattleResult.CITY_CONQUERED;
      }
      return BattleResult.ATTACKER_WIN;
    }

    if (!attackerAlive && defenderAlive) {
      return BattleResult.DEFENDER_WIN;
    }

    if (!attackerAlive && !defenderAlive) {
      return BattleResult.DRAW;
    }

    // 둘 다 살아있으면 피해량으로 판정
    const attackerDamageRatio = attacker.deadTotal / attacker.maxHP;
    const defenderDamageRatio = defender.deadTotal / defender.maxHP;

    if (attackerDamageRatio < defenderDamageRatio - 0.1) {
      return BattleResult.ATTACKER_WIN;
    }
    if (defenderDamageRatio < attackerDamageRatio - 0.1) {
      return BattleResult.DEFENDER_WIN;
    }

    return BattleResult.DRAW;
  }

  /** 결과 로그 생성 */
  private getResultLog(result: BattleResult, attacker: WarUnitState, defender: WarUnitState | null): string {
    switch (result) {
      case BattleResult.ATTACKER_WIN:
        return `<Y>${attacker.name}</>${JosaUtil.pick(attacker.name, '이')} <S>승리</>했습니다!`;
      case BattleResult.DEFENDER_WIN:
        return `<Y>${defender?.name ?? '수비군'}</>${JosaUtil.pick(defender?.name ?? '수비군', '이')} <S>승리</>했습니다!`;
      case BattleResult.CITY_CONQUERED:
        return `<Y>${attacker.name}</>${JosaUtil.pick(attacker.name, '이')} 성을 <S>점령</>했습니다!`;
      case BattleResult.ATTACKER_RETREAT:
        return `<Y>${attacker.name}</>${JosaUtil.pick(attacker.name, '이')} <R>퇴각</>했습니다.`;
      case BattleResult.DEFENDER_ROUT:
        return `<Y>${defender?.name ?? '수비군'}</>${JosaUtil.pick(defender?.name ?? '수비군', '이')} <R>패퇴</>했습니다.`;
      case BattleResult.DRAW:
      default:
        return '전투가 <Y>무승부</>로 끝났습니다.';
    }
  }

  /** 부상 처리 */
  private processWound(unit: WarUnitState, rng: any, result: BattleResult): { wounded: boolean; woundAmount: number; log: string } {
    // 부상 확률 계산
    const lossRatio = unit.deadTotal / Math.max(1, unit.maxHP);
    let woundChance = lossRatio * 0.3;

    // 패배/퇴각 시 부상 확률 증가
    const isLoser = (result === BattleResult.DEFENDER_WIN && unit.isAttacker) ||
                    (result === BattleResult.ATTACKER_WIN && !unit.isAttacker);
    if (isLoser) {
      woundChance += 0.1;
    }

    // 전멸 시 부상 확률 높음
    if (unit.hp <= 0) {
      woundChance = 0.5;
    }

    if (rng.nextBool(woundChance)) {
      const woundAmount = rng.nextRangeInt(5, 30);
      unit.stats.injury = (unit.stats.injury ?? 0) + woundAmount;

      const josaYi = JosaUtil.pick(unit.name, '이');
      return {
        wounded: true,
        woundAmount,
        log: `<Y>${unit.name}</>${josaYi} 전투 중 <R>부상</>(${woundAmount})을 입었습니다.`
      };
    }

    return { wounded: false, woundAmount: 0, log: '' };
  }

  /** 스탯 변화 계산 */
  private calculateStatChanges(unit: WarUnitState, result: BattleResult, isAttacker: boolean): { experience: number; train: number; atmos: number } {
    let experience = 0;
    let train = 0;
    let atmos = 0;

    // 기본 경험치 (처치 수 기반)
    experience = Math.round(unit.killedTotal * 0.1);

    // 승리 보너스
    const isWinner = (result === BattleResult.ATTACKER_WIN || result === BattleResult.CITY_CONQUERED) && isAttacker ||
                     result === BattleResult.DEFENDER_WIN && !isAttacker;

    if (isWinner) {
      experience += 100;
      train = 2;
      atmos = 5;
    } else if (result === BattleResult.DRAW) {
      train = 1;
    } else {
      // 패배
      atmos = -3;
    }

    // 도시 점령 보너스
    if (result === BattleResult.CITY_CONQUERED && isAttacker) {
      experience += 500;
      atmos = 10;
    }

    return { experience, train, atmos };
  }

  /** 스탯 변화 적용 */
  private applyStatChanges(unit: WarUnitState, changes: { experience: number; train: number; atmos: number }): void {
    // 경험치는 별도 필드로 관리 (여기서는 로그만)
    unit.train = Math.min(130, Math.max(40, unit.train + changes.train));
    unit.atmos = Math.min(130, Math.max(40, unit.atmos + changes.atmos));
  }

  /** 보상 계산 */
  private calculateRewards(attacker: WarUnitState, defender: WarUnitState | null, result: BattleResult, context: BattleContext): BattleRewards {
    const rewards: BattleRewards = {
      attackerGold: 0,
      attackerRice: 0,
      defenderGold: 0,
      defenderRice: 0,
      techGain: 0
    };

    // 도시 점령 시 보상
    if (result === BattleResult.CITY_CONQUERED) {
      rewards.attackerGold = 500;
      rewards.attackerRice = 300;
      rewards.techGain = attacker.killedTotal * 0.012;
    }

    // 전투 승리 시 약탈
    if (result === BattleResult.ATTACKER_WIN && defender) {
      rewards.attackerGold = Math.round(defender.deadTotal * 0.5);
      rewards.attackerRice = Math.round(defender.deadTotal * 0.3);
    }

    return rewards;
  }
}
