/**
 * 기본 전투 엔진 추상 클래스
 * PHP sammo/WarUnit.php 참조
 */

import { SeedRandom } from '../random';
import { JosaUtil } from '../../func/josaUtil';
import {
  BattleType,
  BattlePhaseType,
  BattleResult,
  TerrainType,
  WeatherType,
  BattleContext
} from './BattleType';
import {
  BattleConfig,
  BattleSimulationResult,
  BattleSummary,
  BattleUnitState,
  BattleGeneralInput,
  BattleSideInput,
  BattleCityInfo
} from '../types';
import { GameUnitConst, ARM_TYPE, getAttackAdvantage, getDefenseAdvantage } from '../../const/GameUnitConst';

export interface BattleEngineConfig extends BattleConfig {
  battleType: BattleType;
  terrain?: TerrainType;
  weather?: WeatherType;
}

/** 상태 효과 */
export interface StatusEffect {
  type: 'burn' | 'immobilize' | 'poison' | 'confusion' | 'buff' | 'debuff';
  duration: number;
  value: number;
}

export interface WarUnitState extends BattleUnitState {
  /** 현재 페이즈 */
  phase: number;
  /** 이전 페이즈 (합류 시점) */
  prePhase: number;
  /** 보너스 페이즈 */
  bonusPhase: number;
  /** 현재 전투에서 처치한 적 수 */
  killedCurrent: number;
  /** 총 처치 수 */
  killedTotal: number;
  /** 현재 전투에서 잃은 병력 */
  deadCurrent: number;
  /** 총 잃은 병력 */
  deadTotal: number;
  /** 전투력 */
  warPower: number;
  /** 전투력 배율 */
  warPowerMultiply: number;
  /** 활성화된 스킬 */
  activatedSkills: Set<string>;
  /** 상대 유닛 */
  oppose: WarUnitState | null;
  /** 공격자 여부 */
  isAttacker: boolean;
  /** 전투 종료 여부 */
  isFinished: boolean;
  /** 군량 */
  rice: number;

  // 전투 명령 관련 상태
  /** 유닛 위치 */
  position?: { x: number; y: number };
  /** 매복 중 여부 */
  isAmbushing?: boolean;
  /** 매복 위치 */
  ambushPosition?: { x: number; y: number };
  /** 명령 쿨다운 */
  commandCooldowns?: Record<string, number>;
  /** 방어 중 여부 */
  isDefending?: boolean;
  /** 방어 보너스 */
  defenseBonus?: number;
  /** 방어 시작 턴 */
  defendTurn?: number;
  /** 퇴각 중 여부 */
  isRetreating?: boolean;
  /** 퇴각 시작 턴 */
  retreatTurn?: number;
  /** 상태 효과 */
  statusEffects?: StatusEffect[];
}

export abstract class BaseBattleEngine {
  protected readonly rng: SeedRandom;
  protected readonly scenarioId: string;
  protected readonly battleType: BattleType;
  protected readonly terrain: TerrainType;
  protected readonly weather: WeatherType;

  protected readonly battleLog: string[] = [];
  protected readonly battleDetailLog: string[] = [];
  protected readonly generalLogs: Map<number, string[]> = new Map();

  protected context: BattleContext;
  protected attackers: WarUnitState[] = [];
  protected defenders: WarUnitState[] = [];
  protected cityState: BattleCityInfo | null = null;

  protected readonly MAX_PHASE = 30;
  protected readonly ARM_PER_PHASE = 500;

  constructor(protected readonly config: BattleEngineConfig) {
    this.scenarioId = config.scenarioId ?? 'sangokushi';
    this.battleType = config.battleType;
    this.terrain = config.terrain ?? TerrainType.PLAIN;
    this.weather = config.weather ?? WeatherType.CLEAR;
    this.rng = new SeedRandom(config.seed ?? String(Date.now()));

    this.context = {
      battleType: this.battleType,
      currentPhase: BattlePhaseType.APPROACH,
      terrain: this.terrain,
      weather: this.weather,
      turn: 0,
      maxTurns: config.maxTurns ?? this.MAX_PHASE,
      isSupplyConnected: true
    };

    this.cityState = config.city ?? null;
  }

  /** 전투 시뮬레이션 실행 (추상 메서드) */
  abstract simulate(): BattleSimulationResult;

  /** 유닛 생성 */
  protected createWarUnit(general: BattleGeneralInput, side: BattleSideInput, isAttacker: boolean): WarUnitState {
    const unit = GameUnitConst.byID(general.crewTypeId, this.scenarioId);
    const moraleBonus = side.moraleBonus ?? 0;
    const trainBonus = side.trainBonus ?? 0;

    return {
      generalId: general.generalId,
      name: general.name,
      nationId: general.nationId,
      side: side.side,
      stats: general,
      unit,
      maxHP: Math.max(1, general.crew),
      hp: Math.max(0, general.crew),
      train: this.clamp(general.train + trainBonus, 40, 130),
      atmos: this.clamp(general.atmos + moraleBonus, 40, 130),
      moraleBonus,
      trainBonus,
      alive: general.crew > 0,
      // WarUnitState 확장 필드
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
      isAttacker,
      isFinished: false,
      rice: general.rice ?? 1000
    };
  }

  /** 전투력 계산 */
  protected computeWarPower(attacker: WarUnitState, defender: WarUnitState): [number, number] {
    const myAtt = this.computeAttackPower(attacker);
    const opDef = this.computeDefensePower(defender);

    let warPower = this.ARM_PER_PHASE + myAtt - opDef;
    let opposeWarPowerMultiply = 1.0;

    // 최소 전투력 보장
    if (warPower < 100) {
      warPower = Math.max(0, warPower);
      warPower = (warPower + 100) / 2;
      warPower = this.rng.nextRangeInt(Math.floor(warPower), 100);
    }

    // 사기 보정
    warPower *= this.getComputedAtmos(attacker);
    // 훈련도 보정
    warPower /= this.getComputedTrain(defender);

    // 숙련도 보정
    const genDexAtt = this.getDex(attacker, attacker.unit.armType, true);
    const oppDexDef = this.getDex(defender, attacker.unit.armType, false);
    warPower *= this.getDexLog(genDexAtt, oppDexDef);

    // 병종 상성 보정
    warPower *= this.getCrewTypeAttackCoef(attacker, defender);
    opposeWarPowerMultiply *= this.getCrewTypeDefenseCoef(attacker, defender);

    // 지형 보정
    warPower *= this.getTerrainModifier(attacker);
    opposeWarPowerMultiply *= this.getTerrainModifier(defender);

    // 날씨 보정
    warPower *= this.getWeatherModifier(attacker);

    attacker.warPower = warPower;
    defender.warPowerMultiply = opposeWarPowerMultiply;

    return [warPower, opposeWarPowerMultiply];
  }

  /** 공격력 계산 */
  protected computeAttackPower(unit: WarUnitState): number {
    const { stats } = unit;
    const leadership = stats.leadership ?? 50;
    const strength = stats.strength ?? 50;
    const intel = stats.intel ?? 50;
    const baseAttack = unit.unit.attack || 100;

    // 궁병/마법사는 지력 기반
    if (unit.unit.armType === ARM_TYPE.ARCHER || unit.unit.armType === ARM_TYPE.WIZARD) {
      return baseAttack + leadership / 10 + intel / 10;
    }
    return baseAttack + leadership / 10 + strength / 10;
  }

  /** 방어력 계산 */
  protected computeDefensePower(unit: WarUnitState): number {
    const baseDefence = unit.unit.defence || 100;
    const crewCoef = (unit.hp / 233.33) + 70;
    const clampedCoef = Math.min(100, Math.max(70, crewCoef));
    return baseDefence * clampedCoef / 100;
  }

  /** 사기 보정 */
  protected getComputedAtmos(unit: WarUnitState): number {
    return Math.max(40, Math.min(130, unit.atmos)) / 100;
  }

  /** 훈련도 보정 */
  protected getComputedTrain(unit: WarUnitState): number {
    return Math.max(50, unit.train) / 100;
  }

  /** 숙련도 계산 */
  protected getDex(unit: WarUnitState, armType: number, _isAttack: boolean): number {
    const dexMap: Record<number, number | undefined> = {
      [ARM_TYPE.FOOTMAN]: unit.stats.dex1,
      [ARM_TYPE.ARCHER]: unit.stats.dex2,
      [ARM_TYPE.CAVALRY]: unit.stats.dex3,
      [ARM_TYPE.WIZARD]: unit.stats.dex4,
      [ARM_TYPE.SIEGE]: unit.stats.dex5
    };
    const dexValue = dexMap[armType] ?? 0;
    return 1 + dexValue / 100000;
  }

  /** 숙련도 로그 계산 */
  protected getDexLog(attackerDex: number, defenderDex: number): number {
    if (attackerDex <= 1 && defenderDex <= 1) return 1;
    const ratio = Math.max(0.5, Math.min(2, attackerDex / Math.max(1, defenderDex)));
    return 0.8 + ratio * 0.2;
  }

  /** 병종 공격 상성 */
  protected getCrewTypeAttackCoef(attacker: WarUnitState, defender: WarUnitState): number {
    return getAttackAdvantage(attacker.unit.id, this.getArmTypeLabel(defender.unit.armType), this.scenarioId);
  }

  /** 병종 방어 상성 */
  protected getCrewTypeDefenseCoef(attacker: WarUnitState, defender: WarUnitState): number {
    return getDefenseAdvantage(defender.unit.id, this.getArmTypeLabel(attacker.unit.armType), this.scenarioId);
  }

  /** 지형 보정 */
  protected getTerrainModifier(unit: WarUnitState): number {
    const armType = unit.unit.armType;

    switch (this.terrain) {
      case TerrainType.MOUNTAIN:
        // 산악: 기병 약화, 보병 강화
        if (armType === ARM_TYPE.CAVALRY) return 0.7;
        if (armType === ARM_TYPE.FOOTMAN) return 1.1;
        break;
      case TerrainType.WATER:
        // 수상: 기병 불리
        if (armType === ARM_TYPE.CAVALRY) return 0.5;
        break;
      case TerrainType.WALL:
        // 성벽: 공성 병기 유리, 기병 불리
        if (armType === ARM_TYPE.SIEGE) return 1.3;
        if (armType === ARM_TYPE.CAVALRY) return 0.6;
        break;
      case TerrainType.GATE:
        // 성문: 보병 유리
        if (armType === ARM_TYPE.FOOTMAN) return 1.2;
        break;
    }
    return 1.0;
  }

  /** 날씨 보정 */
  protected getWeatherModifier(unit: WarUnitState): number {
    const armType = unit.unit.armType;

    switch (this.weather) {
      case WeatherType.RAIN:
        // 비: 화공/궁병 약화
        if (armType === ARM_TYPE.ARCHER) return 0.8;
        if (armType === ARM_TYPE.WIZARD) return 0.7;
        break;
      case WeatherType.SNOW:
        // 눈: 기병 약화
        if (armType === ARM_TYPE.CAVALRY) return 0.85;
        break;
      case WeatherType.FOG:
        // 안개: 궁병 약화, 기습 유리
        if (armType === ARM_TYPE.ARCHER) return 0.7;
        break;
      case WeatherType.WIND:
        // 강풍: 궁병 약화
        if (armType === ARM_TYPE.ARCHER) return 0.85;
        break;
    }
    return 1.0;
  }

  /** 대미지 계산 */
  protected calcDamage(attacker: WarUnitState): number {
    const warPower = attacker.warPower * attacker.warPowerMultiply;
    const randomFactor = this.rng.range(0.9, 1.1);

    // 부상 패널티
    const injuryPenalty = attacker.stats.injury
      ? 1 - Math.min(attacker.stats.injury, 80) / 120
      : 1;

    return Math.round(warPower * randomFactor * injuryPenalty);
  }

  /** 전투 지속 가능 여부 확인 */
  protected canContinueWar(unit: WarUnitState): { canContinue: boolean; noRice: boolean } {
    // HP 체크
    if (unit.hp <= 0) {
      return { canContinue: false, noRice: false };
    }

    // 군량 체크
    const ricePerPhase = unit.hp / 100;
    if (unit.rice < ricePerPhase) {
      return { canContinue: false, noRice: true };
    }

    // 페이즈 체크
    const maxPhase = this.getMaxPhase(unit);
    if (unit.phase >= maxPhase) {
      return { canContinue: false, noRice: false };
    }

    return { canContinue: true, noRice: false };
  }

  /** 최대 페이즈 계산 */
  protected getMaxPhase(unit: WarUnitState): number {
    return (unit.unit.speed || 10) + unit.bonusPhase;
  }

  /** 부상 시도 */
  protected tryWound(unit: WarUnitState): boolean {
    // 기본 부상 확률 (전투 손실에 따라)
    const lossRatio = unit.deadCurrent / Math.max(1, unit.maxHP);
    const woundChance = lossRatio * 0.3; // 최대 30% 부상 확률

    if (this.rng.nextBool(woundChance)) {
      const woundAmount = this.rng.nextRangeInt(5, 20);
      unit.stats.injury = (unit.stats.injury ?? 0) + woundAmount;
      return true;
    }
    return false;
  }

  /** ARM_TYPE을 레이블로 변환 */
  protected getArmTypeLabel(armType: number): string {
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

  /** 로그 유틸리티 */
  protected pushGlobalLog(message: string): void {
    this.battleLog.push(message);
  }

  protected pushDetailLog(message: string): void {
    this.battleDetailLog.push(message);
  }

  protected pushGeneralLog(generalId: number, message: string): void {
    if (!this.generalLogs.has(generalId)) {
      this.generalLogs.set(generalId, []);
    }
    this.generalLogs.get(generalId)!.push(message);
  }

  /** 유틸리티 */
  protected clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  /** JosaUtil 래퍼 */
  protected josa(word: string, josa: string): string {
    return JosaUtil.pick(word, josa);
  }

  /** 빈 결과 반환 */
  protected emptyResult(): BattleSimulationResult {
    return {
      summary: {
        winner: 'draw',
        turns: 0,
        attackerCasualties: 0,
        defenderCasualties: 0,
        attackerRiceUsed: 0,
        defenderRiceUsed: 0
      },
      turnLogs: [],
      unitStates: [],
      battleLog: [],
      battleDetailLog: []
    };
  }
}
