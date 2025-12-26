/**
 * 야전 엔진 - 평지에서의 장수 vs 장수 전투
 * PHP process_war.php의 장수 대 장수 전투 로직 참조
 */

import { BaseBattleEngine, BattleEngineConfig, WarUnitState } from './BaseBattleEngine';
import { BattleType, BattlePhaseType, BattleResult, TerrainType } from './BattleType';
import { BattleSimulationResult, BattleSummary } from '../types';

export class FieldBattleEngine extends BaseBattleEngine {
  constructor(config: Omit<BattleEngineConfig, 'battleType'>) {
    super({
      ...config,
      battleType: BattleType.FIELD,
      terrain: config.terrain ?? TerrainType.PLAIN
    });
  }

  simulate(): BattleSimulationResult {
    // 유닛 초기화
    this.attackers = this.config.attackers.generals.map(g =>
      this.createWarUnit(g, this.config.attackers, true)
    );
    this.defenders = this.config.defenders.generals.map(g =>
      this.createWarUnit(g, this.config.defenders, false)
    );

    if (this.attackers.length === 0) {
      return this.emptyResult();
    }

    // 메인 공격자 선택 (첫 번째 장수)
    const attacker = this.attackers[0];
    const defenderQueue = [...this.defenders];

    let result = BattleResult.DRAW;
    let totalTurns = 0;
    let totalAttackerCasualties = 0;
    let totalDefenderCasualties = 0;

    // 진격 로그
    const josaYi = this.josa(attacker.name, '이');
    this.pushGlobalLog(`<D><b>${this.config.attackers.nation.name}</b></>의 <Y>${attacker.name}</>${josaYi} 야전을 펼칩니다.`);
    this.pushGeneralLog(attacker.generalId, '야전을 <M>시작</>합니다.');

    // 접근 페이즈
    this.context.currentPhase = BattlePhaseType.APPROACH;
    this.onApproachPhase(attacker, defenderQueue);

    // 수비자들과 순차 전투
    let defenderIndex = 0;
    let currentDefender = defenderQueue[defenderIndex] || null;

    while (attacker.phase < this.getMaxPhase(attacker) && attacker.hp > 0) {
      if (!currentDefender || currentDefender.hp <= 0) {
        // 다음 수비자
        defenderIndex++;
        currentDefender = defenderQueue[defenderIndex] || null;

        if (!currentDefender) {
          // 모든 수비자 처치 - 공격자 승리
          result = BattleResult.ATTACKER_WIN;
          break;
        }
      }

      // 대결 시작
      if (attacker.oppose !== currentDefender) {
        this.startDuel(attacker, currentDefender);
      }

      // 교전 페이즈
      this.context.currentPhase = BattlePhaseType.COMBAT;
      const phaseResult = this.executeCombatPhase(attacker, currentDefender);

      totalTurns++;
      totalAttackerCasualties += phaseResult.attackerDamage;
      totalDefenderCasualties += phaseResult.defenderDamage;

      // 전투 지속 가능 여부 확인
      const attackerStatus = this.canContinueWar(attacker);
      const defenderStatus = this.canContinueWar(currentDefender);

      if (!attackerStatus.canContinue) {
        if (attackerStatus.noRice) {
          this.pushGlobalLog(`<Y>${attacker.name}</>의 군량이 부족하여 <R>퇴각</>합니다.`);
          result = BattleResult.ATTACKER_RETREAT;
        } else if (attacker.hp <= 0) {
          this.pushGlobalLog(`<Y>${attacker.name}</>의 ${attacker.unit.name}${this.josa(attacker.unit.name, '이')} <R>퇴각</>했습니다.`);
          result = BattleResult.DEFENDER_WIN;
        }
        break;
      }

      if (!defenderStatus.canContinue) {
        if (defenderStatus.noRice) {
          this.pushGlobalLog(`<Y>${currentDefender.name}</>의 군량이 부족하여 <R>패퇴</>합니다.`);
        } else {
          this.pushGlobalLog(`<Y>${currentDefender.name}</>의 ${currentDefender.unit.name}${this.josa(currentDefender.unit.name, '이')} <R>전멸</>했습니다.`);
        }
        currentDefender.isFinished = true;

        // 승리 보너스
        attacker.train = Math.min(130, attacker.train + 1);

        // 다음 수비자로
        attacker.oppose = null;
        currentDefender = null;
      }

      attacker.phase++;
    }

    // 결과 페이즈
    this.context.currentPhase = BattlePhaseType.RESULT;
    this.onResultPhase(attacker, defenderQueue, result);

    // 부상 처리
    this.tryWound(attacker);
    defenderQueue.forEach(d => this.tryWound(d));

    // 최종 결과 판정
    if (result === BattleResult.DRAW) {
      if (attacker.hp > 0 && defenderQueue.every(d => d.hp <= 0)) {
        result = BattleResult.ATTACKER_WIN;
      } else if (attacker.hp <= 0) {
        result = BattleResult.DEFENDER_WIN;
      }
    }

    const summary: BattleSummary = {
      winner: result === BattleResult.ATTACKER_WIN ? 'attackers' :
              result === BattleResult.DEFENDER_WIN ? 'defenders' : 'draw',
      turns: totalTurns,
      attackerCasualties: totalAttackerCasualties,
      defenderCasualties: totalDefenderCasualties,
      attackerRiceUsed: Math.round((attacker.stats.rice ?? 1000) - attacker.rice),
      defenderRiceUsed: defenderQueue.reduce((sum, d) => sum + Math.round((d.stats.rice ?? 1000) - d.rice), 0)
    };

    return {
      summary,
      turnLogs: [],
      unitStates: [attacker, ...defenderQueue],
      battleLog: this.battleLog,
      battleDetailLog: this.battleDetailLog
    };
  }

  /** 접근 페이즈 */
  private onApproachPhase(attacker: WarUnitState, defenders: WarUnitState[]): void {
    // 선제 스킬 발동 등 (향후 확장)
    attacker.train = Math.min(130, attacker.train + 1);
    defenders.forEach(d => {
      d.train = Math.min(130, d.train + 1);
    });
  }

  /** 대결 시작 */
  private startDuel(attacker: WarUnitState, defender: WarUnitState): void {
    attacker.oppose = defender;
    defender.oppose = attacker;
    attacker.killedCurrent = 0;
    attacker.deadCurrent = 0;
    defender.killedCurrent = 0;
    defender.deadCurrent = 0;

    const josaWa = this.josa(attacker.unit.name, '와');
    const josaYi = this.josa(defender.unit.name, '이');
    this.pushGlobalLog(`<Y>${attacker.name}</>의 ${attacker.unit.name}${josaWa} <Y>${defender.name}</>의 ${defender.unit.name}${josaYi} 대결합니다.`);

    const josaRo = this.josa(attacker.unit.name, '로');
    const josaUl = this.josa(defender.unit.name, '을');
    this.pushGeneralLog(attacker.generalId, `${attacker.unit.name}${josaRo} <Y>${defender.name}</>의 ${defender.unit.name}${josaUl} <M>공격</>합니다.`);
    this.pushGeneralLog(defender.generalId, `${defender.unit.name}${this.josa(defender.unit.name, '로')} <Y>${attacker.name}</>의 ${attacker.unit.name}${this.josa(attacker.unit.name, '을')} <M>수비</>합니다.`);
  }

  /** 교전 페이즈 */
  private executeCombatPhase(attacker: WarUnitState, defender: WarUnitState): { attackerDamage: number; defenderDamage: number } {
    // 전투력 계산
    this.computeWarPower(attacker, defender);
    this.computeWarPower(defender, attacker);

    // 대미지 계산
    let damageToDefender = this.calcDamage(attacker);
    let damageToAttacker = this.calcDamage(defender);

    // 동시 전멸 방지
    if (damageToAttacker > attacker.hp || damageToDefender > defender.hp) {
      const attackerRatio = damageToAttacker / Math.max(1, attacker.hp);
      const defenderRatio = damageToDefender / Math.max(1, defender.hp);

      if (defenderRatio > attackerRatio) {
        damageToAttacker /= defenderRatio;
        damageToDefender = defender.hp;
      } else {
        damageToDefender /= attackerRatio;
        damageToAttacker = attacker.hp;
      }
    }

    damageToAttacker = Math.min(Math.ceil(damageToAttacker), attacker.hp);
    damageToDefender = Math.min(Math.ceil(damageToDefender), defender.hp);

    // 대미지 적용
    attacker.hp -= damageToAttacker;
    defender.hp -= damageToDefender;

    attacker.deadCurrent += damageToAttacker;
    attacker.deadTotal += damageToAttacker;
    attacker.killedCurrent += damageToDefender;
    attacker.killedTotal += damageToDefender;

    defender.deadCurrent += damageToDefender;
    defender.deadTotal += damageToDefender;
    defender.killedCurrent += damageToAttacker;
    defender.killedTotal += damageToAttacker;

    // 군량 소모
    const attackerRiceUsed = damageToAttacker / 100 * 0.8;
    const defenderRiceUsed = damageToDefender / 100 * 0.8;
    attacker.rice -= attackerRiceUsed;
    defender.rice -= defenderRiceUsed;

    // 전투 로그
    const phaseNum = attacker.phase + 1;
    this.pushDetailLog(`${phaseNum}: <Y1>【${attacker.name}】</> <C>${attacker.hp} (-${damageToAttacker})</> VS <C>${defender.hp} (-${damageToDefender})</> <Y1>【${defender.name}】</>`);

    return { attackerDamage: damageToAttacker, defenderDamage: damageToDefender };
  }

  /** 결과 페이즈 */
  private onResultPhase(attacker: WarUnitState, defenders: WarUnitState[], result: BattleResult): void {
    // 결과 로그
    const resultText = result === BattleResult.ATTACKER_WIN ? '<S>승리</>' :
                       result === BattleResult.DEFENDER_WIN ? '<R>패배</>' : '무승부';

    this.pushGeneralLog(attacker.generalId, `야전 결과: ${resultText}`);

    // 승리 보상
    if (result === BattleResult.ATTACKER_WIN) {
      attacker.atmos = Math.min(130, attacker.atmos + 5);
    }
  }
}
