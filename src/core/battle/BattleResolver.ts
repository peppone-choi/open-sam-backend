/**
 * BattleResolver - Resolution Phase 처리
 * 
 * 모든 플레이어의 액션을 동시 처리하고 전투 결과 계산
 */

import {
  BattleUnit3D,
  BattleTile3D,
  Position3D,
  Action,
  ResolutionResult,
  HeightBonus,
  UnitType,
  BattleState
} from './types';
import { BattleValidator } from './BattleValidator';

export class BattleResolver {
  private validator: BattleValidator;

  constructor() {
    this.validator = new BattleValidator();
  }

  resolve(state: BattleState): ResolutionResult {
    const result: ResolutionResult = {
      casualties: new Map(),
      moraleLosses: new Map(),
      buildingDamage: new Map(),
      positions: new Map(),
      effects: []
    };

    this.processBuffsAndDebuffs(state, result);
    this.processRangedAttacks(state, result);
    this.resolveMovement(state, result);
    this.resolveCombat(state, result);
    this.resolveSkills(state, result);
    this.checkMoraleCollapse(state, result);
    this.processBuildingCapture(state, result);

    return result;
  }

  private processBuffsAndDebuffs(state: BattleState, result: ResolutionResult): void {
    for (const [unitId, unit] of state.units) {
      if (unit.buffs) {
        unit.buffs = unit.buffs.map(buff => ({
          ...buff,
          duration: buff.duration - 1
        })).filter(buff => buff.duration > 0);
      }

      if (unit.debuffs) {
        unit.debuffs = unit.debuffs.map(debuff => ({
          ...debuff,
          duration: debuff.duration - 1
        })).filter(debuff => debuff.duration > 0);
      }
    }
  }

  private processRangedAttacks(state: BattleState, result: ResolutionResult): void {
    const rangedActions = Array.from(state.actions.values()).filter(
      action => action.type === 'attack'
    );

    for (const action of rangedActions) {
      if (action.type !== 'attack') continue;

      const attacker = state.units.get(action.unitId);
      const target = state.units.get(action.targetId);

      if (!attacker || !target) continue;

      if (attacker.unitType !== UnitType.ARCHER && attacker.unitType !== UnitType.SIEGE) {
        continue;
      }

      const validation = this.validator.canAttack(attacker, target, state.map);
      if (!validation.valid) continue;

      const damage = this.calculateDamage(attacker, target);
      
      target.hp -= damage;
      const casualties = Math.floor((damage / target.maxHp) * target.maxTroops);
      target.troops = Math.max(0, target.troops - casualties);

      result.casualties.set(target.id, (result.casualties.get(target.id) || 0) + casualties);
      result.effects.push(
        `${attacker.name} shot ${target.name} for ${damage} damage (${casualties} casualties)`
      );

      attacker.hasActed = true;
    }
  }

  resolveMovement(state: BattleState, result: ResolutionResult): void {
    const moveActions = Array.from(state.actions.values()).filter(
      action => action.type === 'move'
    ) as Extract<Action, { type: 'move' }>[];

    moveActions.sort((a, b) => {
      const unitA = state.units.get(a.unitId)!;
      const unitB = state.units.get(b.unitId)!;
      return unitB.speed - unitA.speed;
    });

    for (const action of moveActions) {
      const unit = state.units.get(action.unitId);
      if (!unit) continue;

      const targetPos = action.path[action.path.length - 1];
      const validation = this.validator.canMove(unit, targetPos, state.map, state.units);

      if (validation.valid) {
        unit.position = { ...targetPos };
        result.positions.set(unit.id, targetPos);
        result.effects.push(`${unit.name} moved to (${targetPos.x}, ${targetPos.y}, ${targetPos.z})`);
      } else {
        result.effects.push(`${unit.name} failed to move: ${validation.reason}`);
      }

      unit.hasActed = true;
    }
  }

  resolveCombat(state: BattleState, result: ResolutionResult): void {
    const combatPairs = this.findCombatPairs(state);

    for (const [attacker, defender] of combatPairs) {
      const attackerDamage = this.calculateDamage(attacker, defender);
      const defenderDamage = this.calculateDamage(defender, attacker);

      defender.hp -= attackerDamage;
      attacker.hp -= defenderDamage;

      const attackerCasualties = Math.floor((defenderDamage / attacker.maxHp) * attacker.maxTroops);
      const defenderCasualties = Math.floor((attackerDamage / defender.maxHp) * defender.maxTroops);

      attacker.troops = Math.max(0, attacker.troops - attackerCasualties);
      defender.troops = Math.max(0, defender.troops - defenderCasualties);

      result.casualties.set(attacker.id, (result.casualties.get(attacker.id) || 0) + attackerCasualties);
      result.casualties.set(defender.id, (result.casualties.get(defender.id) || 0) + defenderCasualties);

      result.effects.push(
        `${attacker.name} vs ${defender.name}: ${defenderCasualties} vs ${attackerCasualties} casualties`
      );

      const attackerMoraleLoss = Math.floor(defenderCasualties / 10);
      const defenderMoraleLoss = Math.floor(attackerCasualties / 10);

      attacker.morale = Math.max(0, attacker.morale - attackerMoraleLoss);
      defender.morale = Math.max(0, defender.morale - defenderMoraleLoss);

      result.moraleLosses.set(attacker.id, attackerMoraleLoss);
      result.moraleLosses.set(defender.id, defenderMoraleLoss);
    }
  }

  resolveSkills(state: BattleState, result: ResolutionResult): void {
    const skillActions = Array.from(state.actions.values()).filter(
      action => action.type === 'skill'
    ) as Extract<Action, { type: 'skill' }>[];

    for (const action of skillActions) {
      const unit = state.units.get(action.unitId);
      if (!unit) continue;

      const validation = this.validator.canUseSkill(unit, action.skillId, action.target, state.map);
      if (!validation.valid) {
        result.effects.push(`${unit.name} failed to use ${action.skillId}: ${validation.reason}`);
        continue;
      }

      this.applySkill(unit, action.skillId, action.target, state, result);
      unit.hasActed = true;
    }
  }

  checkMoraleCollapse(state: BattleState, result: ResolutionResult): void {
    for (const [unitId, unit] of state.units) {
      if (unit.morale <= 20) {
        const moraleCheck = Math.random() * 100;
        if (moraleCheck > unit.morale) {
          unit.morale = 0;
          result.effects.push(`${unit.name} suffered morale collapse and is retreating!`);
          
          state.actions.set(unitId, { type: 'retreat', unitId });
        }
      }
    }
  }

  private processBuildingCapture(state: BattleState, result: ResolutionResult): void {
    for (const building of state.buildings) {
      if (building.type === 'throne') {
        const occupants = Array.from(state.units.values()).filter(
          u => u.position.x === building.z && u.side === 'attacker'
        );

        if (occupants.length > 0) {
          result.effects.push(`Throne tile occupied by attackers!`);
        }
      }
    }
  }

  private findCombatPairs(state: BattleState): [BattleUnit3D, BattleUnit3D][] {
    const pairs: [BattleUnit3D, BattleUnit3D][] = [];
    const processed = new Set<string>();

    for (const [attackerId, attacker] of state.units) {
      if (processed.has(attackerId) || attacker.hp <= 0) continue;

      for (const [defenderId, defender] of state.units) {
        if (processed.has(defenderId) || defender.hp <= 0) continue;
        if (attacker.side === defender.side) continue;

        const distance = this.validator.getDistance3D(attacker.position, defender.position);
        
        if (distance <= 1.5) {
          pairs.push([attacker, defender]);
          processed.add(attackerId);
          processed.add(defenderId);
          break;
        }
      }
    }

    return pairs;
  }

  private calculateDamage(attacker: BattleUnit3D, defender: BattleUnit3D): number {
    const baseDamage = attacker.strength * (attacker.troops / attacker.maxTroops);
    
    const heightBonus = this.getHeightAdvantage(
      attacker.position.z,
      defender.position.z
    );

    const typeAdvantage = this.getTypeAdvantage(attacker.unitType, defender.unitType);
    
    const moraleMultiplier = 0.5 + (attacker.morale / 100) * 0.5;
    const defenseMultiplier = 1 - (defender.training / 200);

    const totalDamage = baseDamage * 
                       (1 + heightBonus.attackBonus / 100) *
                       typeAdvantage *
                       moraleMultiplier *
                       defenseMultiplier;

    return Math.max(1, Math.floor(totalDamage));
  }

  getHeightAdvantage(attackerZ: number, defenderZ: number): HeightBonus {
    const heightDiff = attackerZ - defenderZ;

    if (heightDiff > 0) {
      return {
        attackBonus: Math.min(heightDiff * 10, 50),
        defenseBonus: heightDiff * 5,
        rangeBonus: Math.floor(heightDiff / 2),
        visionBonus: heightDiff * 2
      };
    } else if (heightDiff < 0) {
      return {
        attackBonus: Math.max(heightDiff * 10, -30),
        defenseBonus: 0,
        rangeBonus: 0,
        visionBonus: 0
      };
    }

    return { attackBonus: 0, defenseBonus: 0, rangeBonus: 0, visionBonus: 0 };
  }

  private getTypeAdvantage(attacker: UnitType, defender: UnitType): number {
    const advantages: Record<UnitType, Record<UnitType, number>> = {
      [UnitType.FOOTMAN]: {
        [UnitType.FOOTMAN]: 1.0,
        [UnitType.CAVALRY]: 0.7,
        [UnitType.ARCHER]: 1.3,
        [UnitType.WIZARD]: 1.0,
        [UnitType.SIEGE]: 1.2
      },
      [UnitType.CAVALRY]: {
        [UnitType.FOOTMAN]: 1.4,
        [UnitType.CAVALRY]: 1.0,
        [UnitType.ARCHER]: 1.5,
        [UnitType.WIZARD]: 0.8,
        [UnitType.SIEGE]: 1.6
      },
      [UnitType.ARCHER]: {
        [UnitType.FOOTMAN]: 0.8,
        [UnitType.CAVALRY]: 0.6,
        [UnitType.ARCHER]: 1.0,
        [UnitType.WIZARD]: 1.2,
        [UnitType.SIEGE]: 1.1
      },
      [UnitType.WIZARD]: {
        [UnitType.FOOTMAN]: 1.0,
        [UnitType.CAVALRY]: 1.3,
        [UnitType.ARCHER]: 0.9,
        [UnitType.WIZARD]: 1.0,
        [UnitType.SIEGE]: 0.9
      },
      [UnitType.SIEGE]: {
        [UnitType.FOOTMAN]: 0.9,
        [UnitType.CAVALRY]: 0.5,
        [UnitType.ARCHER]: 0.8,
        [UnitType.WIZARD]: 1.1,
        [UnitType.SIEGE]: 1.0
      }
    };

    return advantages[attacker][defender];
  }

  private applySkill(
    unit: BattleUnit3D,
    skillId: string,
    target: Position3D,
    state: BattleState,
    result: ResolutionResult
  ): void {
    switch (skillId) {
      case 'fireball':
        this.applyAreaDamage(target, 2, 50, state, result);
        result.effects.push(`${unit.name} cast Fireball at (${target.x}, ${target.y}, ${target.z})`);
        break;
      
      case 'heal':
        this.applyAreaHeal(target, 2, 30, state, result);
        result.effects.push(`${unit.name} cast Heal at (${target.x}, ${target.y}, ${target.z})`);
        break;
      
      case 'buff':
        this.applyAreaBuff(target, 3, unit.side, state, result);
        result.effects.push(`${unit.name} cast Buff on allies`);
        break;
    }
  }

  private applyAreaDamage(
    center: Position3D,
    radius: number,
    damage: number,
    state: BattleState,
    result: ResolutionResult
  ): void {
    for (const [unitId, unit] of state.units) {
      const distance = this.validator.getDistance3D(unit.position, center);
      if (distance <= radius) {
        unit.hp -= damage;
        const casualties = Math.floor((damage / unit.maxHp) * unit.maxTroops);
        unit.troops = Math.max(0, unit.troops - casualties);
        result.casualties.set(unitId, (result.casualties.get(unitId) || 0) + casualties);
      }
    }
  }

  private applyAreaHeal(
    center: Position3D,
    radius: number,
    healing: number,
    state: BattleState,
    result: ResolutionResult
  ): void {
    for (const unit of state.units.values()) {
      const distance = this.validator.getDistance3D(unit.position, center);
      if (distance <= radius) {
        unit.hp = Math.min(unit.maxHp, unit.hp + healing);
      }
    }
  }

  private applyAreaBuff(
    center: Position3D,
    radius: number,
    side: 'attacker' | 'defender',
    state: BattleState,
    result: ResolutionResult
  ): void {
    for (const unit of state.units.values()) {
      if (unit.side !== side) continue;
      
      const distance = this.validator.getDistance3D(unit.position, center);
      if (distance <= radius) {
        unit.buffs = unit.buffs || [];
        unit.buffs.push({ type: 'attack', value: 20, duration: 3 });
      }
    }
  }
}
