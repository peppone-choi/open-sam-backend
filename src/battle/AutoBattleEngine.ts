import { ARM_TYPE, GameUnitConst, getAttackAdvantage, getDefenseAdvantage } from '../const/GameUnitConst';
import { SeedRandom } from './random';
import type {
  BattleActionLog,
  BattleConfig,
  BattleSimulationResult,
  BattleSummary,
  BattleTurnLog,
  BattleUnitState,
  BattleGeneralInput,
  BattleSideInput
} from './types';

const ARM_TYPE_LABEL: Record<number, string> = {
  [ARM_TYPE.CASTLE]: 'CASTLE',
  [ARM_TYPE.FOOTMAN]: 'FOOTMAN',
  [ARM_TYPE.ARCHER]: 'ARCHER',
  [ARM_TYPE.CAVALRY]: 'CAVALRY',
  [ARM_TYPE.WIZARD]: 'WIZARD',
  [ARM_TYPE.SIEGE]: 'SIEGE',
  [ARM_TYPE.MISC]: 'MISC'
};

const DEFAULT_MAX_TURNS = 24;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export class AutoBattleEngine {
  private readonly rng: SeedRandom;
  private readonly maxTurns: number;
  private readonly scenarioId: string;
  private readonly unitStates: BattleUnitState[];

  private attackerCasualties = 0;
  private defenderCasualties = 0;
  private attackerRiceUsed = 0;
  private defenderRiceUsed = 0;

  constructor(private readonly config: BattleConfig) {
    this.scenarioId = config.scenarioId ?? 'sangokushi';
    this.rng = new SeedRandom(config.seed ?? Date.now());
    this.maxTurns = config.maxTurns ?? DEFAULT_MAX_TURNS;
    this.unitStates = [
      ...this.createUnits(config.attackers),
      ...this.createUnits(config.defenders)
    ];
  }

  simulate(): BattleSimulationResult {
    const turnLogs: BattleTurnLog[] = [];

    for (let turn = 1; turn <= this.maxTurns; turn += 1) {
      const actions: BattleActionLog[] = [];
      const aliveAttackers = this.getAliveUnits('attackers');
      const aliveDefenders = this.getAliveUnits('defenders');

      if (aliveAttackers.length === 0 || aliveDefenders.length === 0) {
        break;
      }

      this.resolveTurn(turn, aliveAttackers, aliveDefenders, actions);
      turnLogs.push({ turn, actions });

      if (this.getAliveUnits('attackers').length === 0 || this.getAliveUnits('defenders').length === 0) {
        break;
      }
    }

    const summary = this.buildSummary(turnLogs.length);

    return {
      summary,
      turnLogs,
      unitStates: this.unitStates
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
        train: clamp(general.train + trainBonus, 0, 130),
        atmos: clamp(general.atmos + moraleBonus, 0, 130),
        moraleBonus,
        trainBonus,
        alive: general.crew > 0
      } satisfies BattleUnitState;
    });
  }

  private getAliveUnits(side: 'attackers' | 'defenders'): BattleUnitState[] {
    return this.unitStates.filter((unit) => unit.side === side && unit.alive && unit.hp > 0);
  }

  private resolveTurn(
    turn: number,
    attackers: BattleUnitState[],
    defenders: BattleUnitState[],
    actions: BattleActionLog[]
  ): void {
    const order = [...attackers, ...defenders].sort(() => this.rng.next() - 0.5);
    for (const unit of order) {
      if (!unit.alive || unit.hp <= 0) continue;
      const targets = this.getAliveUnits(unit.side === 'attackers' ? 'defenders' : 'attackers');
      if (targets.length === 0) break;
      const target = this.rng.pick(targets);
      const damage = this.calculateDamage(unit, target);
      if (damage <= 0) continue;
      target.hp = Math.max(0, target.hp - damage);
      if (target.hp === 0) {
        target.alive = false;
      }

      this.updateCasualties(unit, damage);
      this.updateRiceUsage(unit, damage);

      actions.push({
        attackerId: unit.generalId,
        defenderId: target.generalId,
        damage,
        remainingHP: target.hp,
        turn
      });
    }
  }

  /**
   * PHP 방식 데미지 계산 (WarUnit.php:computeWarPower 참고)
   * 
   * PHP 공식:
   * $warPower = GameConst::$armperphase + $myAtt - $opDef;  // $armperphase = 500
   * $warPower *= $this->getComputedAtmos();  // 사기
   * $warPower /= $oppose->getComputedTrain();  // 훈련
   * $warPower *= getDexLog($genDexAtt, $oppDexDef);  // 숙련도
   * $warPower *= $this->getCrewType()->getAttackCoef($oppose->getCrewType());  // 병종 상성
   */
  private calculateDamage(attacker: BattleUnitState, defender: BattleUnitState): number {
    if (attacker.hp <= 0) return 0;

    const attackerStats = attacker.stats;
    const attackerUnit = attacker.unit;
    const defenderUnit = defender.unit;

    // PHP: GameConst::$armperphase = 500 (페이즈당 표준 감소 병사 수)
    const ARM_PER_PHASE = 500;

    // PHP: getComputedAttack() - 장수의 공격력 계산
    // 통솔과 무력 기반으로 공격력 계산
    const myAttack = this.computeAttackPower(attackerStats, attackerUnit);
    
    // PHP: getComputedDefence() - 상대의 방어력 계산
    const opDefense = this.computeDefensePower(defender.stats, defenderUnit, defender.hp);

    // PHP: $warPower = GameConst::$armperphase + $myAtt - $opDef;
    let warPower = ARM_PER_PHASE + myAttack - opDefense;

    // PHP: 최소 전투력 50 보장
    if (warPower < 100) {
      warPower = Math.max(0, warPower);
      warPower = (warPower + 100) / 2;
      warPower = this.rng.nextRangeInt(Math.floor(warPower), 100);
    }

    // PHP: $warPower *= $this->getComputedAtmos() / $oppose->getComputedTrain();
    // 사기/훈련 - PHP에서는 100이 기준값 (maxAtmosByCommand, maxTrainByCommand)
    const atmosMultiplier = (attacker.atmos || 70) / 100;
    const trainDivisor = Math.max(50, defender.train || 70) / 100;
    warPower *= atmosMultiplier;
    warPower /= trainDivisor;

    // PHP: getDexLog 숙련도 보너스
    const dexBonus = this.getDexterityBonus(attackerStats, attackerUnit.armType);
    const opDexDefense = this.getDexterityBonus(defender.stats, attackerUnit.armType);
    const dexLog = this.getDexLog(dexBonus, opDexDefense);
    warPower *= dexLog;

    // PHP: 병종 상성 계수 - getAttackCoef, getDefenceCoef
    const attackerArmType = ARM_TYPE_LABEL[attackerUnit.armType] ?? 'FOOTMAN';
    const defenderArmType = ARM_TYPE_LABEL[defenderUnit.armType] ?? 'FOOTMAN';
    const attackAdvantage = getAttackAdvantage(attackerUnit.id, defenderArmType, this.scenarioId);
    const defenceAdvantage = getDefenseAdvantage(defenderUnit.id, attackerArmType, this.scenarioId);
    warPower *= attackAdvantage;
    warPower *= defenceAdvantage; // PHP: oppose->setWarPowerMultiply 대신 직접 적용

    // PHP: 랜덤 범위 0.9 ~ 1.1
    const randomFactor = this.rng.range(0.9, 1.1);
    warPower *= randomFactor;

    // 부상 패널티
    const injuryPenalty = attackerStats.injury ? 1 - Math.min(attackerStats.injury, 80) / 120 : 1;
    warPower *= injuryPenalty;

    // 최종 데미지
    const damage = Math.max(1, Math.round(warPower));
    return Math.min(damage, defender.hp);
  }

  /**
   * PHP: getComputedAttack() 포팅
   * 통솔, 무력, 지력을 기반으로 공격력 계산
   */
  private computeAttackPower(stats: BattleGeneralInput, unit: any): number {
    const leadership = stats.leadership ?? 50;
    const strength = stats.strength ?? 50;
    const intel = stats.intel ?? 50;
    
    // PHP: GameUnitDetail.php의 getComputedAttack 공식
    // attack + leadership/10 + strength/10 (보병/기병)
    // attack + leadership/10 + intel/10 (궁병/술사)
    const baseAttack = unit.attack || 100;
    
    if (unit.armType === ARM_TYPE.ARCHER || unit.armType === ARM_TYPE.WIZARD) {
      return baseAttack + leadership / 10 + intel / 10;
    }
    return baseAttack + leadership / 10 + strength / 10;
  }

  /**
   * PHP: getComputedDefence() 포팅
   * 병사 수에 따른 방어력 계수 적용
   */
  private computeDefensePower(stats: BattleGeneralInput, unit: any, crew: number): number {
    const baseDefence = unit.defence || 100;
    
    // PHP: 병사 수에 따른 계수 (7000명 = 100%, 0명 = 70%)
    // $crewCoef = (crew / (7000 / 30)) + 70;
    const crewCoef = (crew / 233.33) + 70;
    const clampedCoef = Math.min(100, Math.max(70, crewCoef));
    
    return baseDefence * clampedCoef / 100;
  }

  /**
   * PHP: getDexLog 함수 포팅
   * 숙련도 로그 계산
   */
  private getDexLog(attackerDex: number, defenderDex: number): number {
    if (attackerDex <= 1 && defenderDex <= 1) return 1;
    
    // PHP getDexLog 공식
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
    if (!dexValue) return 1;
    return 1 + dexValue / 100000;
  }

  private updateCasualties(attacker: BattleUnitState, damage: number): void {
    if (attacker.side === 'attackers') {
      this.defenderCasualties += damage;
    } else {
      this.attackerCasualties += damage;
    }
  }

  private updateRiceUsage(attacker: BattleUnitState, damage: number): void {
    const ricePerSoldier = attacker.unit.rice ?? 100;
    const consumption = (damage / 100) * ricePerSoldier;
    if (attacker.side === 'attackers') {
      this.attackerRiceUsed += consumption;
    } else {
      this.defenderRiceUsed += consumption;
    }
  }

  private buildSummary(turns: number): BattleSummary {
    const attackerAlive = this.getAliveUnits('attackers').length > 0;
    const defenderAlive = this.getAliveUnits('defenders').length > 0;

    let winner: BattleSummary['winner'] = 'draw';
    if (attackerAlive && !defenderAlive) winner = 'attackers';
    else if (!attackerAlive && defenderAlive) winner = 'defenders';
    else {
      const attackerHP = this.sumHP('attackers');
      const defenderHP = this.sumHP('defenders');
      if (attackerHP > defenderHP) winner = 'attackers';
      else if (defenderHP > attackerHP) winner = 'defenders';
    }

    return {
      winner,
      turns,
      attackerCasualties: Math.round(this.attackerCasualties),
      defenderCasualties: Math.round(this.defenderCasualties),
      attackerRiceUsed: Math.round(this.attackerRiceUsed),
      defenderRiceUsed: Math.round(this.defenderRiceUsed)
    };
  }

  private sumHP(side: 'attackers' | 'defenders'): number {
    return this.unitStates
      .filter((unit) => unit.side === side)
      .reduce((sum, unit) => sum + unit.hp, 0);
  }
}
