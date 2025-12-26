/**
 * 수비전 엔진 - 성을 방어하는 전투
 * 방어자 시점의 전투 처리
 */

import { BaseBattleEngine, BattleEngineConfig, WarUnitState } from './BaseBattleEngine';
import { BattleType, BattlePhaseType, BattleResult, TerrainType } from './BattleType';
import { BattleSimulationResult, BattleSummary } from '../types';

export class DefenseBattleEngine extends BaseBattleEngine {
  constructor(config: Omit<BattleEngineConfig, 'battleType'>) {
    super({
      ...config,
      battleType: BattleType.DEFENSE,
      terrain: config.terrain ?? TerrainType.WALL
    });
  }

  simulate(): BattleSimulationResult {
    // 유닛 초기화 (공격자/방어자 역할 반전)
    this.attackers = this.config.attackers.generals.map(g =>
      this.createWarUnit(g, this.config.attackers, true)
    );
    this.defenders = this.config.defenders.generals.map(g =>
      this.createWarUnit(g, this.config.defenders, false)
    );

    if (this.defenders.length === 0) {
      return this.emptyResult();
    }

    // 방어자 시점으로 전환
    const defender = this.defenders[0];
    const attackerQueue = [...this.attackers];

    let result = BattleResult.DRAW;
    let totalTurns = 0;
    let totalAttackerCasualties = 0;
    let totalDefenderCasualties = 0;

    // 수비 시작 로그
    const cityName = this.cityState?.name ?? '성';
    const josaYi = this.josa(defender.name, '이');
    this.pushGlobalLog(`<Y>${defender.name}</>${josaYi} <G><b>${cityName}</b></>을 <M>수비</>합니다.`);
    this.pushGeneralLog(defender.generalId, `<G><b>${cityName}</b></>을 <M>수비</>합니다.`);

    // 공격자들과 순차 전투
    let attackerIndex = 0;
    let currentAttacker = attackerQueue[attackerIndex] || null;

    while (defender.phase < this.getMaxPhase(defender) && defender.hp > 0) {
      if (!currentAttacker || currentAttacker.hp <= 0) {
        attackerIndex++;
        currentAttacker = attackerQueue[attackerIndex] || null;

        if (!currentAttacker) {
          // 모든 공격자 격퇴 - 방어 성공
          result = BattleResult.DEFENDER_WIN;
          break;
        }
      }

      // 대결 시작
      if (defender.oppose !== currentAttacker) {
        this.startDuel(defender, currentAttacker);
      }

      // 교전 페이즈
      this.context.currentPhase = BattlePhaseType.COMBAT;
      const phaseResult = this.executeCombatPhase(defender, currentAttacker);

      totalTurns++;
      totalDefenderCasualties += phaseResult.defenderDamage;
      totalAttackerCasualties += phaseResult.attackerDamage;

      // 전투 지속 가능 여부 확인
      const defenderStatus = this.canContinueWar(defender);
      const attackerStatus = this.canContinueWar(currentAttacker);

      if (!defenderStatus.canContinue) {
        if (defenderStatus.noRice) {
          this.pushGlobalLog(`<Y>${defender.name}</>의 군량이 부족하여 <R>패퇴</>합니다.`);
          result = BattleResult.DEFENDER_ROUT;
        } else if (defender.hp <= 0) {
          this.pushGlobalLog(`<Y>${defender.name}</>의 ${defender.unit.name}${this.josa(defender.unit.name, '이')} <R>전멸</>했습니다.`);
          result = BattleResult.ATTACKER_WIN;
        }
        break;
      }

      if (!attackerStatus.canContinue) {
        if (attackerStatus.noRice) {
          this.pushGlobalLog(`<Y>${currentAttacker.name}</>의 군량이 부족하여 <R>퇴각</>합니다.`);
        } else {
          this.pushGlobalLog(`<Y>${currentAttacker.name}</>의 ${currentAttacker.unit.name}${this.josa(currentAttacker.unit.name, '이')} <R>퇴각</>했습니다.`);
        }
        currentAttacker.isFinished = true;

        // 수비 성공 보너스
        defender.train = Math.min(130, defender.train + 1);
        defender.atmos = Math.min(130, defender.atmos + 2);

        // 다음 공격자
        defender.oppose = null;
        currentAttacker = null;
      }

      defender.phase++;
    }

    // 결과 페이즈
    this.context.currentPhase = BattlePhaseType.RESULT;

    // 부상 처리
    this.tryWound(defender);
    attackerQueue.forEach(a => this.tryWound(a));

    // 최종 결과 판정
    if (result === BattleResult.DRAW) {
      if (defender.hp > 0 && attackerQueue.every(a => a.hp <= 0)) {
        result = BattleResult.DEFENDER_WIN;
      } else if (defender.hp <= 0) {
        result = BattleResult.ATTACKER_WIN;
      }
    }

    // 수비 성공 시 추가 보상
    if (result === BattleResult.DEFENDER_WIN) {
      this.pushGlobalLog(`<Y>${defender.name}</>${this.josa(defender.name, '이')} <G><b>${cityName}</b></> 수비에 <S>성공</>했습니다.`);
      this.pushGeneralLog(defender.generalId, `<G><b>${cityName}</b></> 수비에 <S>성공</>했습니다.`);
    }

    const summary: BattleSummary = {
      winner: result === BattleResult.DEFENDER_WIN ? 'defenders' :
              result === BattleResult.ATTACKER_WIN ? 'attackers' : 'draw',
      turns: totalTurns,
      attackerCasualties: totalAttackerCasualties,
      defenderCasualties: totalDefenderCasualties,
      attackerRiceUsed: attackerQueue.reduce((sum, a) => sum + Math.round((a.stats.rice ?? 1000) - a.rice), 0),
      defenderRiceUsed: Math.round((defender.stats.rice ?? 1000) - defender.rice)
    };

    return {
      summary,
      turnLogs: [],
      unitStates: [defender, ...attackerQueue],
      battleLog: this.battleLog,
      battleDetailLog: this.battleDetailLog
    };
  }

  /** 대결 시작 */
  private startDuel(defender: WarUnitState, attacker: WarUnitState): void {
    defender.oppose = attacker;
    attacker.oppose = defender;
    defender.killedCurrent = 0;
    defender.deadCurrent = 0;
    attacker.killedCurrent = 0;
    attacker.deadCurrent = 0;

    const josaWa = this.josa(defender.unit.name, '와');
    const josaYi = this.josa(attacker.unit.name, '이');
    this.pushGlobalLog(`<Y>${defender.name}</>의 ${defender.unit.name}${josaWa} <Y>${attacker.name}</>의 ${attacker.unit.name}${josaYi} 대결합니다.`);

    this.pushGeneralLog(defender.generalId, `${defender.unit.name}${this.josa(defender.unit.name, '로')} <Y>${attacker.name}</>의 ${attacker.unit.name}${this.josa(attacker.unit.name, '을')} <M>수비</>합니다.`);
    this.pushGeneralLog(attacker.generalId, `${attacker.unit.name}${this.josa(attacker.unit.name, '로')} <Y>${defender.name}</>의 ${defender.unit.name}${this.josa(defender.unit.name, '을')} <M>공격</>합니다.`);
  }

  /** 교전 페이즈 */
  private executeCombatPhase(defender: WarUnitState, attacker: WarUnitState): { defenderDamage: number; attackerDamage: number } {
    // 전투력 계산 (방어자 유리 보정)
    this.computeWarPower(defender, attacker);
    this.computeWarPower(attacker, defender);

    // 성벽 방어 보너스
    defender.warPowerMultiply *= 1.2;

    // 대미지 계산
    let damageToAttacker = this.calcDamage(defender);
    let damageToDefender = this.calcDamage(attacker);

    // 동시 전멸 방지
    if (damageToDefender > defender.hp || damageToAttacker > attacker.hp) {
      const defenderRatio = damageToDefender / Math.max(1, defender.hp);
      const attackerRatio = damageToAttacker / Math.max(1, attacker.hp);

      if (attackerRatio > defenderRatio) {
        damageToDefender /= attackerRatio;
        damageToAttacker = attacker.hp;
      } else {
        damageToAttacker /= defenderRatio;
        damageToDefender = defender.hp;
      }
    }

    damageToDefender = Math.min(Math.ceil(damageToDefender), defender.hp);
    damageToAttacker = Math.min(Math.ceil(damageToAttacker), attacker.hp);

    // 대미지 적용
    defender.hp -= damageToDefender;
    attacker.hp -= damageToAttacker;

    defender.deadCurrent += damageToDefender;
    defender.deadTotal += damageToDefender;
    defender.killedCurrent += damageToAttacker;
    defender.killedTotal += damageToAttacker;

    attacker.deadCurrent += damageToAttacker;
    attacker.deadTotal += damageToAttacker;
    attacker.killedCurrent += damageToDefender;
    attacker.killedTotal += damageToDefender;

    // 군량 소모
    defender.rice -= damageToDefender / 100 * 0.8;
    attacker.rice -= damageToAttacker / 100 * 0.8;

    // 전투 로그
    const phaseNum = defender.phase + 1;
    this.pushDetailLog(`${phaseNum}: <Y1>【${defender.name}】</> <C>${defender.hp} (-${damageToDefender})</> VS <C>${attacker.hp} (-${damageToAttacker})</> <Y1>【${attacker.name}】</>`);

    return { defenderDamage: damageToDefender, attackerDamage: damageToAttacker };
  }
}
