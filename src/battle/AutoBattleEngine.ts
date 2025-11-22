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

  private calculateDamage(attacker: BattleUnitState, defender: BattleUnitState): number {
    if (attacker.hp <= 0) return 0;

    const attackerStats = attacker.stats;
    const defenderStats = defender.stats;
    const attackerUnit = attacker.unit;
    const defenderUnit = defender.unit;

    const leadershipFactor = 1 + (attackerStats.leadership ?? 0) / 200;
    const strengthFactor = 1 + (attackerStats.strength ?? 0) / 200;
    const trainFactor = 0.5 + attacker.train / 200;
    const atmosFactor = 0.5 + attacker.atmos / 200;

    const attackerArmType = ARM_TYPE_LABEL[attackerUnit.armType] ?? 'FOOTMAN';
    const defenderArmType = ARM_TYPE_LABEL[defenderUnit.armType] ?? 'FOOTMAN';

    const attackAdvantage = getAttackAdvantage(attackerUnit.id, defenderArmType, this.scenarioId);
    const defenceAdvantage = getDefenseAdvantage(defenderUnit.id, attackerArmType, this.scenarioId);

    const advantage = attackAdvantage / Math.max(0.5, defenceAdvantage);

    const dexBonus = this.getDexterityBonus(attackerStats, attackerUnit.armType);
    const injuryPenalty = attackerStats.injury ? 1 - Math.min(attackerStats.injury, 80) / 120 : 1;

    const baseAttackPower = attackerUnit.attack || 100;
    const crewFactor = Math.sqrt(Math.max(1, attacker.hp));
    const randomFactor = this.rng.range(0.9, 1.15);

    let damage = crewFactor * (baseAttackPower / 100) * leadershipFactor * strengthFactor;
    damage *= trainFactor * atmosFactor * advantage * dexBonus * injuryPenalty * randomFactor;

    // defence mitigation
    const defenceFactor = (defenderUnit.defence || 100) / 120;
    damage /= defenceFactor;

    // morale difference
    const moraleDiff = (attacker.atmos - defender.atmos) / 200;
    damage *= 1 + moraleDiff * 0.25;

    damage = Math.max(1, Math.floor(damage));
    damage = Math.min(damage, defender.hp);
    return damage;
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
