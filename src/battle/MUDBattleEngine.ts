import { JosaUtil } from '../func/josaUtil';
import { SeedRandom } from './random';
import {
  BattleConfig,
  BattleSimulationResult,
  BattleSummary,
  BattleUnitState,
  BattleTurnLog,
  BattleActionLog,
  BattleGeneralInput,
  BattleSideInput
} from './types';
import { ARM_TYPE, GameUnitConst, getAttackAdvantage, getDefenseAdvantage } from '../const/GameUnitConst';

const ARM_TYPE_LABEL: Record<number, string> = {
  [ARM_TYPE.CASTLE]: 'CASTLE',
  [ARM_TYPE.FOOTMAN]: 'FOOTMAN',
  [ARM_TYPE.ARCHER]: 'ARCHER',
  [ARM_TYPE.CAVALRY]: 'CAVALRY',
  [ARM_TYPE.WIZARD]: 'WIZARD',
  [ARM_TYPE.SIEGE]: 'SIEGE',
  [ARM_TYPE.MISC]: 'MISC'
};

const MAX_PHASE = 30;

export class MUDBattleEngine {
  private readonly rng: SeedRandom;
  private readonly scenarioId: string;
  private readonly battleLog: string[] = [];
  private readonly battleDetailLog: string[] = [];

  private attackerCasualties = 0;
  private defenderCasualties = 0;
  private attackerRiceUsed = 0;
  private defenderRiceUsed = 0;

  constructor(private readonly config: BattleConfig) {
    this.scenarioId = config.scenarioId ?? 'sangokushi';
    this.rng = new SeedRandom(config.seed ?? Date.now());
  }

  simulate(): BattleSimulationResult {
    const attackers = this.createUnits(this.config.attackers);
    const defenders = this.createUnits(this.config.defenders);
    const city = this.config.city;

    if (attackers.length === 0) {
      return this.emptyResult();
    }

    const attacker = attackers[0]; // MUD Battle usually has 1 main attacker vs N defenders
    const currentDefenders = [...defenders];
    
    let currentPhase = 0;
    let conquerCity = false;

    const josaYi = JosaUtil.pick(attacker.name, '이');
    const cityName = city?.name ?? '성벽';
    const josaRo = JosaUtil.pick(cityName, '로');

    this.pushGlobalLog(`<D><b>${this.config.attackers.nation.name}</b></>의 <Y>${attacker.name}</>${josaYi} <G><b>${cityName}</b></>${josaRo} 진격합니다.`);
    
    let defenderIndex = 0;
    let currentDefender: BattleUnitState | null = currentDefenders[defenderIndex] || null;

    while (currentPhase < MAX_PHASE) {
      if (!currentDefender) {
        // 공성전 시작 (수비자가 없거나 모두 패배한 경우 성벽 공격)
        this.pushGlobalLog(`병량 부족으로 <G><b>${cityName}</b></>의 수비병들이 <R>패퇴</>합니다.`);
        conquerCity = true;
        break;
      }

      // 대결 시작 로그
      if (currentPhase === 0 || attacker.hp > 0) {
        const josaWa = JosaUtil.pick(attacker.unit.name, '와');
        const josaYiDef = JosaUtil.pick(currentDefender.unit.name, '이');
        this.pushGlobalLog(`<Y>${attacker.name}</>의 ${attacker.unit.name}${josaWa} <Y>${currentDefender.name}</>의 ${currentDefender.unit.name}${josaYiDef} 대결합니다.`);
      }

      // 전투 루프
      while (currentPhase < MAX_PHASE && attacker.hp > 0 && currentDefender.hp > 0) {
        currentPhase += 1;
        
        const damageToDefender = this.calculateDamage(attacker, currentDefender);
        const damageToAttacker = this.calculateDamage(currentDefender, attacker);

        attacker.hp = Math.max(0, attacker.hp - damageToAttacker);
        currentDefender.hp = Math.max(0, currentDefender.hp - damageToDefender);

        this.attackerCasualties += damageToAttacker;
        this.defenderCasualties += damageToDefender;

        this.pushDetailLog(`${currentPhase}: <Y1>【${attacker.name}】</> <C>${attacker.hp} (-${damageToAttacker})</> VS <C>${currentDefender.hp} (-${damageToDefender})</> <Y1>【${currentDefender.name}】</>`);

        if (attacker.hp <= 0) {
          this.pushGlobalLog(`<Y>${attacker.name}</>의 ${attacker.unit.name}${JosaUtil.pick(attacker.unit.name, '이')} 퇴각했습니다.`);
          break;
        }

        if (currentDefender.hp <= 0) {
          this.pushGlobalLog(`<Y>${currentDefender.name}</>의 ${currentDefender.unit.name}${JosaUtil.pick(currentDefender.unit.name, '이')} 전멸했습니다.`);
          defenderIndex += 1;
          currentDefender = currentDefenders[defenderIndex] || null;
          break;
        }
      }

      if (attacker.hp <= 0) break;
    }

    return {
      summary: {
        winner: conquerCity ? 'attackers' : (attacker.hp > 0 ? 'attackers' : 'defenders'),
        turns: currentPhase,
        attackerCasualties: Math.round(this.attackerCasualties),
        defenderCasualties: Math.round(this.defenderCasualties),
        attackerRiceUsed: Math.round(this.attackerRiceUsed),
        defenderRiceUsed: Math.round(this.defenderRiceUsed)
      },
      turnLogs: [], // MUD battle uses battleLog instead of structured turnLogs
      unitStates: [attacker, ...currentDefenders],
      battleLog: this.battleLog,
      battleDetailLog: this.battleDetailLog
    };
  }

  private createUnits(sideInput: BattleSideInput): BattleUnitState[] {
    const moraleBonus = sideInput.moraleBonus ?? 0;
    const trainBonus = sideInput.trainBonus ?? 0;

    return sideInput.generals.map((general) => {
      const unit = GameUnitConst.byID(general.crewTypeId, this.scenarioId);
      return {
        generalId: general.generalId,
        name: general.name,
        nationId: general.nationId,
        side: sideInput.side,
        stats: general,
        unit,
        maxHP: Math.max(1, general.crew),
        hp: Math.max(0, general.crew),
        train: this.clamp(general.train + trainBonus, 40, 130),
        atmos: this.clamp(general.atmos + moraleBonus, 40, 130),
        moraleBonus,
        trainBonus,
        alive: general.crew > 0
      } satisfies BattleUnitState;
    });
  }

  private calculateDamage(attacker: BattleUnitState, defender: BattleUnitState): number {
    if (attacker.hp <= 0) return 0;

    const ARM_PER_PHASE = 500;
    const myAttack = this.computeAttackPower(attacker.stats, attacker.unit);
    const opDefense = this.computeDefensePower(defender.stats, defender.unit, defender.hp);

    let warPower = ARM_PER_PHASE + myAttack - opDefense;

    if (warPower < 100) {
      warPower = Math.max(0, warPower);
      warPower = (warPower + 100) / 2;
      warPower = this.rng.nextRangeInt(Math.floor(warPower), 100);
    }

    const atmosMultiplier = (attacker.atmos || 70) / 100;
    const trainDivisor = Math.max(50, defender.train || 70) / 100;
    warPower *= atmosMultiplier;
    warPower /= trainDivisor;

    const dexBonus = this.getDexterityBonus(attacker.stats, attacker.unit.armType);
    const opDexDefense = this.getDexterityBonus(defender.stats, attacker.unit.armType);
    const dexLog = this.getDexLog(dexBonus, opDexDefense);
    warPower *= dexLog;

    const attackerArmType = ARM_TYPE_LABEL[attacker.unit.armType] ?? 'FOOTMAN';
    const defenderArmType = ARM_TYPE_LABEL[defender.unit.armType] ?? 'FOOTMAN';
    const attackAdvantage = getAttackAdvantage(attacker.unit.id, defenderArmType, this.scenarioId);
    const defenceAdvantage = getDefenseAdvantage(defender.unit.id, attackerArmType, this.scenarioId);
    warPower *= attackAdvantage;
    warPower *= defenceAdvantage;

    const randomFactor = this.rng.range(0.9, 1.1);
    warPower *= randomFactor;

    const injuryPenalty = attacker.stats.injury ? 1 - Math.min(attacker.stats.injury, 80) / 120 : 1;
    warPower *= injuryPenalty;

    return Math.min(Math.max(1, Math.round(warPower)), defender.hp);
  }

  private computeAttackPower(stats: BattleGeneralInput, unit: any): number {
    const leadership = stats.leadership ?? 50;
    const strength = stats.strength ?? 50;
    const intel = stats.intel ?? 50;
    const baseAttack = unit.attack || 100;
    
    if (unit.armType === ARM_TYPE.ARCHER || unit.armType === ARM_TYPE.WIZARD) {
      return baseAttack + leadership / 10 + intel / 10;
    }
    return baseAttack + leadership / 10 + strength / 10;
  }

  private computeDefensePower(stats: BattleGeneralInput, unit: any, crew: number): number {
    const baseDefence = unit.defence || 100;
    const crewCoef = (crew / 233.33) + 70;
    const clampedCoef = Math.min(100, Math.max(70, crewCoef));
    return baseDefence * clampedCoef / 100;
  }

  private getDexLog(attackerDex: number, defenderDex: number): number {
    if (attackerDex <= 1 && defenderDex <= 1) return 1;
    const ratio = Math.max(0.5, Math.min(2, attackerDex / Math.max(1, defenderDex)));
    return 0.8 + ratio * 0.2;
  }

  private getDexterityBonus(stats: BattleGeneralInput, armType: number): number {
    const dexMap: Record<number, number | undefined> = {
      [ARM_TYPE.FOOTMAN]: stats.dex1,
      [ARM_TYPE.ARCHER]: stats.dex2,
      [ARM_TYPE.CAVALRY]: stats.dex3,
      [ARM_TYPE.WIZARD]: stats.dex4,
      [ARM_TYPE.SIEGE]: stats.dex5
    };
    const dexValue = dexMap[armType] ?? 0;
    return 1 + dexValue / 100000;
  }

  private pushGlobalLog(message: string): void {
    this.battleLog.push(message);
  }

  private pushDetailLog(message: string): void {
    this.battleDetailLog.push(message);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private emptyResult(): BattleSimulationResult {
    return {
      summary: { winner: 'draw', turns: 0, attackerCasualties: 0, defenderCasualties: 0, attackerRiceUsed: 0, defenderRiceUsed: 0 },
      turnLogs: [],
      unitStates: [],
      battleLog: [],
      battleDetailLog: []
    };
  }
}
