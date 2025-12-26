/**
 * 공성전 엔진 - 성벽을 공격하는 전투
 * PHP process_war.php의 WarUnitCity 전투 로직 참조
 */

import { BaseBattleEngine, BattleEngineConfig, WarUnitState } from './BaseBattleEngine';
import { BattleType, BattlePhaseType, BattleResult, TerrainType } from './BattleType';
import { BattleSimulationResult, BattleSummary, BattleCityInfo } from '../types';
import { ARM_TYPE } from '../../const/GameUnitConst';

/** 성벽 유닛 상태 */
interface CityUnitState extends WarUnitState {
  /** 성벽 내구도 */
  wall: number;
  /** 성벽 최대 내구도 */
  wallMax: number;
  /** 성문 내구도 */
  gate: number;
  /** 성문 최대 내구도 */
  gateMax: number;
  /** 공성전 여부 */
  isSiege: boolean;
}

export class SiegeBattleEngine extends BaseBattleEngine {
  private cityUnit: CityUnitState | null = null;

  constructor(config: Omit<BattleEngineConfig, 'battleType'>) {
    super({
      ...config,
      battleType: BattleType.SIEGE,
      terrain: TerrainType.WALL
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

    // 성벽 유닛 생성
    if (this.cityState) {
      this.cityUnit = this.createCityUnit(this.cityState);
    }

    if (this.attackers.length === 0) {
      return this.emptyResult();
    }

    const attacker = this.attackers[0];
    const defenderQueue = [...this.defenders];

    let result: BattleResult = BattleResult.DRAW;
    let totalTurns = 0;
    let totalAttackerCasualties = 0;
    let totalDefenderCasualties = 0;
    let conquerCity = false;

    // 진격 로그
    const cityName = this.cityState?.name ?? '성';
    const josaYi = this.josa(attacker.name, '이');
    const josaRo = this.josa(cityName, '로');
    this.pushGlobalLog(`<D><b>${this.config.attackers.nation.name}</b></>의 <Y>${attacker.name}</>${josaYi} <G><b>${cityName}</b></>${josaRo} 진격합니다.`);
    this.pushGeneralLog(attacker.generalId, `<G><b>${cityName}</b></>${josaRo} <M>진격</>합니다.`);

    // 수비자들과 전투
    let defenderIndex = 0;
    let currentDefender: WarUnitState | CityUnitState | null = defenderQueue[defenderIndex] || null;

    while (attacker.phase < this.getMaxPhase(attacker) && attacker.hp > 0) {
      // 수비자가 없으면 성벽 공격
      if (!currentDefender) {
        if (this.cityUnit && !this.cityUnit.isSiege) {
          // 성벽 공격 시작
          this.cityUnit.isSiege = true;
          currentDefender = this.cityUnit;

          // 군량 패퇴 체크
          if (this.config.defenders.nation.level === 0 || this.checkNationRiceRout()) {
            this.pushGlobalLog(`병량 부족으로 <G><b>${cityName}</b></>의 수비병들이 <R>패퇴</>합니다.`);
            conquerCity = true;
            result = BattleResult.CITY_CONQUERED;
            break;
          }

          const josaYiCity = this.josa(attacker.name, '이');
          this.pushGlobalLog(`<Y>${attacker.name}</>${josaYiCity} ${attacker.unit.name}${this.josa(attacker.unit.name, '로')} 성벽을 공격합니다.`);
        } else {
          // 성벽 없음 - 도시 점령
          conquerCity = true;
          result = BattleResult.CITY_CONQUERED;
          break;
        }
      }

      // 대결 시작
      if (attacker.oppose !== currentDefender) {
        this.startDuel(attacker, currentDefender);
      }

      // 교전
      this.context.currentPhase = BattlePhaseType.COMBAT;
      const phaseResult = this.executeCombatPhase(attacker, currentDefender);

      totalTurns++;
      totalAttackerCasualties += phaseResult.attackerDamage;
      totalDefenderCasualties += phaseResult.defenderDamage;

      // 전투 지속 가능 여부 확인
      const attackerStatus = this.canContinueWar(attacker);

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

      // 수비자/성벽 패배 체크
      if (currentDefender.hp <= 0) {
        if (this.isCityUnit(currentDefender)) {
          // 성벽 함락
          this.pushGlobalLog(`<G><b>${cityName}</b></>의 성벽이 <R>함락</>되었습니다.`);
          conquerCity = true;
          result = BattleResult.CITY_CONQUERED;
          break;
        } else {
          // 수비 장수 패배
          this.pushGlobalLog(`<Y>${currentDefender.name}</>의 ${currentDefender.unit.name}${this.josa(currentDefender.unit.name, '이')} <R>전멸</>했습니다.`);
          currentDefender.isFinished = true;

          // 승리 보너스
          attacker.train = Math.min(130, attacker.train + 1);

          // 다음 수비자
          defenderIndex++;
          currentDefender = defenderQueue[defenderIndex] || null;
          attacker.oppose = null;
        }
      }

      attacker.phase++;
    }

    // 결과 페이즈
    this.context.currentPhase = BattlePhaseType.RESULT;

    // 부상 처리
    this.tryWound(attacker);
    defenderQueue.forEach(d => this.tryWound(d));

    // 도시 점령 시 추가 처리
    if (conquerCity) {
      attacker.atmos = Math.min(130, attacker.atmos + 10);
      this.pushGlobalLog(`<Y>${attacker.name}</>${this.josa(attacker.name, '이')} <G><b>${cityName}</b></> 공략에 <S>성공</>했습니다.`);
      this.pushGeneralLog(attacker.generalId, `<G><b>${cityName}</b></> 공략에 <S>성공</>했습니다.`);
    }

    const summary: BattleSummary = {
      winner: result === BattleResult.CITY_CONQUERED ? 'attackers' :
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

  /** 성벽 유닛 생성 */
  private createCityUnit(city: BattleCityInfo): CityUnitState {
    const wall = city.wall ?? 1000;
    const wallMax = city.wallMax ?? 1000;
    const gate = city.gate ?? 500;
    const gateMax = city.gateMax ?? 500;

    // 성벽은 특수 병종으로 처리
    const unit = {
      id: 0,
      name: '성벽',
      armType: ARM_TYPE.CASTLE,
      attack: 50 + (city.defence ?? 100),
      defence: 100 + (city.defence ?? 100),
      speed: 99, // 성벽은 페이즈 제한 없음
      cost: 0,
      rice: 0,
      critical: 0,
      avoid: 0
    };

    return {
      generalId: 0,
      name: city.name,
      nationId: city.nationId ?? 0,
      side: 'defenders',
      stats: {
        generalId: 0,
        name: city.name,
        nationId: city.nationId ?? 0,
        crewTypeId: 0,
        crew: wall,
        train: 100,
        atmos: 100,
        leadership: 50,
        strength: 50,
        intel: 50
      },
      unit: unit as any,
      maxHP: wallMax,
      hp: wall,
      train: 100,
      atmos: 100,
      moraleBonus: 0,
      trainBonus: 0,
      alive: wall > 0,
      phase: 0,
      prePhase: 0,
      bonusPhase: 0,
      killedCurrent: 0,
      killedTotal: 0,
      deadCurrent: 0,
      deadTotal: 0,
      warPower: 0,
      warPowerMultiply: 1.0,
      activatedSkills: new Set(),
      oppose: null,
      isAttacker: false,
      isFinished: false,
      rice: 99999,
      wall,
      wallMax,
      gate,
      gateMax,
      isSiege: false
    };
  }

  /** 대결 시작 */
  private startDuel(attacker: WarUnitState, defender: WarUnitState | CityUnitState): void {
    attacker.oppose = defender;
    defender.oppose = attacker;
    attacker.killedCurrent = 0;
    attacker.deadCurrent = 0;
    defender.killedCurrent = 0;
    defender.deadCurrent = 0;
  }

  /** 교전 페이즈 */
  private executeCombatPhase(attacker: WarUnitState, defender: WarUnitState | CityUnitState): { attackerDamage: number; defenderDamage: number } {
    // 전투력 계산
    this.computeWarPower(attacker, defender);
    if (!this.isCityUnit(defender)) {
      this.computeWarPower(defender, attacker);
    }

    // 대미지 계산
    let damageToDefender = this.calcDamage(attacker);
    let damageToAttacker = this.isCityUnit(defender)
      ? this.calcCityDamage(defender as CityUnitState, attacker)
      : this.calcDamage(defender);

    // 공성 병기 보너스
    if (this.isCityUnit(defender) && attacker.unit.armType === ARM_TYPE.SIEGE) {
      damageToDefender *= 1.5;
    }

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
    attacker.rice -= damageToAttacker / 100 * 0.8;

    // 전투 로그
    const phaseNum = attacker.phase + 1;
    this.pushDetailLog(`${phaseNum}: <Y1>【${attacker.name}】</> <C>${attacker.hp} (-${damageToAttacker})</> VS <C>${defender.hp} (-${damageToDefender})</> <Y1>【${defender.name}】</>`);

    return { attackerDamage: damageToAttacker, defenderDamage: damageToDefender };
  }

  /** 성벽 대미지 계산 */
  private calcCityDamage(city: CityUnitState, target: WarUnitState): number {
    // 성벽 방어력 기반 반격
    const baseDamage = city.stats.leadership ?? 50;
    const randomFactor = this.rng.range(0.5, 1.0);
    return Math.round(baseDamage * randomFactor * 0.5);
  }

  /** 국가 군량 패퇴 체크 */
  private checkNationRiceRout(): boolean {
    // 국가 군량이 0 이하면 패퇴
    // 실제로는 DB에서 확인해야 하지만, 여기서는 설정값으로 체크
    return false;
  }

  /** CityUnit 타입 가드 */
  private isCityUnit(unit: WarUnitState): unit is CityUnitState {
    return 'wall' in unit && 'isSiege' in unit;
  }
}
