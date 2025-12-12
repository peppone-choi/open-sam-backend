/**
 * BattleResultService
 * 
 * Applies battle results back to the MMO world.
 * Handles fleet losses, commander stats, grid state updates, and history recording.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { GalaxyGrid, IGalaxyGrid, IGridFleetInfo } from '../../../models/gin7/GalaxyGrid';
import { Fleet, IFleet } from '../../../models/gin7/Fleet';
import { Gin7Character, IGin7Character, ICharacterBattleStats } from '../../../models/gin7/Character';
import { RealtimeBattle, IRealtimeBattle, IBattleResult } from '../../../models/gin7/RealtimeBattle';
import { gridService } from '../GridService';

/**
 * Battle participant result
 */
export interface IParticipantResult {
  fleetId: string;
  factionId: string;
  commanderId: string;
  survived: boolean;
  retreated: boolean;
  initialShips: number;
  finalShips: number;
  shipsLost: number;
  damageDealt: number;
  damageTaken: number;
}

/**
 * Complete battle result
 */
export interface IBattleOutcome {
  battleId: string;
  sessionId: string;
  gridX: number;
  gridY: number;
  winner?: string;           // Winning faction ID
  winnerFaction?: string;
  endReason: 'VICTORY' | 'RETREAT' | 'TIMEOUT' | 'DRAW' | 'CANCELLED';
  duration: number;          // In ticks
  realDuration: number;      // In milliseconds
  participantResults: IParticipantResult[];
  totalShipsDestroyed: number;
}

/**
 * Fleet update after battle
 */
export interface IFleetPostBattleUpdate {
  fleetId: string;
  destroyed: boolean;
  shipsRemaining: number;
  unitsRemaining: Array<{
    unitId: string;
    remainingCount: number;
    remainingHp: number;
    remainingMorale: number;
  }>;
  morale: number;
  retreatDestination?: { x: number; y: number };
}

class BattleResultService extends EventEmitter {
  private static instance: BattleResultService;

  private constructor() {
    super();
  }

  static getInstance(): BattleResultService {
    if (!BattleResultService.instance) {
      BattleResultService.instance = new BattleResultService();
    }
    return BattleResultService.instance;
  }

  /**
   * Apply complete battle result to MMO world
   */
  async applyBattleResult(battleId: string, result: IBattleResult): Promise<IBattleOutcome> {
    // Get battle document
    const battle = await RealtimeBattle.findOne({ battleId });
    if (!battle) {
      throw new Error(`Battle ${battleId} not found`);
    }

    const sessionId = battle.sessionId;
    const gridX = battle.gridLocation?.x || 0;
    const gridY = battle.gridLocation?.y || 0;

    // Build outcome
    const outcome: IBattleOutcome = {
      battleId,
      sessionId,
      gridX,
      gridY,
      winner: result.winner,
      winnerFaction: result.winnerFaction,
      endReason: result.endReason,
      duration: result.duration,
      realDuration: result.duration * 100,  // 10 ticks/sec
      participantResults: result.participantResults.map(pr => ({
        fleetId: pr.fleetId,
        factionId: pr.faction,
        commanderId: battle.participants.find(p => p.fleetId === pr.fleetId)?.commanderId || '',
        survived: pr.survived,
        retreated: !pr.survived && pr.shipsLost < (battle.participants.find(p => p.fleetId === pr.fleetId)?.shipCount || 0),
        initialShips: battle.participants.find(p => p.fleetId === pr.fleetId)?.shipCount || 0,
        finalShips: (battle.participants.find(p => p.fleetId === pr.fleetId)?.shipCount || 0) - pr.shipsLost,
        shipsLost: pr.shipsLost,
        damageDealt: pr.damageDealt,
        damageTaken: pr.damageTaken
      })),
      totalShipsDestroyed: result.totalShipsDestroyed
    };

    // Apply updates to each participant
    for (const pr of outcome.participantResults) {
      await this.updateFleetAfterBattle(sessionId, pr);
      await this.updateCommanderAfterBattle(sessionId, pr, outcome);
    }

    // Update grid state
    await this.updateGridAfterBattle(sessionId, gridX, gridY, outcome);

    // Save battle history
    await this.saveBattleHistory(battle, outcome);

    // Update battle document
    battle.status = 'ENDED';
    battle.endedAt = new Date();
    battle.result = result;
    await battle.save();

    // Emit events
    this.emit('battle:ended', outcome);
    this.emit(`battle:${battleId}:ended`, outcome);

    return outcome;
  }

  /**
   * Update fleet state after battle
   */
  async updateFleetAfterBattle(
    sessionId: string, 
    result: IParticipantResult
  ): Promise<IFleetPostBattleUpdate> {
    const fleet = await Fleet.findOne({ sessionId, fleetId: result.fleetId });
    if (!fleet) {
      throw new Error(`Fleet ${result.fleetId} not found`);
    }

    const update: IFleetPostBattleUpdate = {
      fleetId: result.fleetId,
      destroyed: !result.survived && !result.retreated,
      shipsRemaining: result.finalShips,
      unitsRemaining: [],
      morale: 50  // Default post-battle morale
    };

    // Calculate losses per unit (distribute proportionally)
    const totalInitialShips = fleet.units.reduce((sum, u) => sum + u.count, 0);
    const lossRatio = result.shipsLost / Math.max(1, totalInitialShips);

    for (const unit of fleet.units) {
      const unitLoss = Math.floor(unit.count * lossRatio);
      const remainingCount = Math.max(0, unit.count - unitLoss);
      
      // HP and morale loss based on damage taken
      const hpLoss = Math.min(50, result.damageTaken / 1000);  // Max 50% HP loss
      const moraleLoss = Math.min(30, result.shipsLost / 10);  // Morale loss from losses
      
      update.unitsRemaining.push({
        unitId: unit.unitId,
        remainingCount,
        remainingHp: Math.max(10, unit.hp - hpLoss),
        remainingMorale: Math.max(10, unit.morale - moraleLoss)
      });

      // Update unit in fleet
      unit.count = remainingCount;
      unit.destroyed += unitLoss;
      unit.hp = Math.max(10, unit.hp - hpLoss);
      unit.morale = Math.max(10, unit.morale - moraleLoss);
    }

    // Calculate fleet morale (average of unit morales)
    update.morale = fleet.units.length > 0
      ? fleet.units.reduce((sum, u) => sum + u.morale, 0) / fleet.units.length
      : 30;

    // Update fleet document
    fleet.totalShips = fleet.units.reduce((sum, u) => sum + u.count, 0);
    
    // Combat stats
    fleet.combatStats.damageDealt += result.damageDealt;
    fleet.combatStats.damageTaken += result.damageTaken;
    fleet.combatStats.shipsLost += result.shipsLost;
    
    if (result.survived) {
      // Stayed in battle until the end
      if (result.factionId === result.factionId) {  // Winner check would need outcome
        fleet.combatStats.battlesWon += 1;
      } else {
        fleet.combatStats.battlesLost += 1;
      }
    } else {
      fleet.combatStats.battlesLost += 1;
    }

    // Clear battle state
    fleet.battleState = undefined;
    fleet.status = 'IDLE';
    fleet.statusData = {};

    // Handle retreat destination
    if (result.retreated && fleet.previousGridId) {
      const [, px, py] = fleet.previousGridId.split('_').map(Number);
      if (!isNaN(px) && !isNaN(py)) {
        update.retreatDestination = { x: px, y: py };
        fleet.gridId = fleet.previousGridId;
        fleet.location.coordinates = { x: px, y: py };
      }
    }

    // Check if fleet destroyed
    if (update.destroyed || fleet.totalShips === 0) {
      update.destroyed = true;
      fleet.status = 'REORG';  // Needs reorganization
      fleet.statusData = { reason: 'DESTROYED_IN_BATTLE' };
    }

    await fleet.save();

    // Update grid fleet info
    const [, gx, gy] = (fleet.gridId || '').split('_').map(Number);
    if (!isNaN(gx) && !isNaN(gy)) {
      await this.updateFleetInGrid(sessionId, gx, gy, fleet);
    }

    this.emit('fleet:updated', {
      sessionId,
      fleetId: result.fleetId,
      update
    });

    return update;
  }

  /**
   * Update fleet info in grid
   */
  private async updateFleetInGrid(
    sessionId: string, 
    x: number, 
    y: number, 
    fleet: IFleet
  ): Promise<void> {
    const grid = await gridService.getGridState(sessionId, x, y);
    if (!grid) return;

    // Find and update fleet info
    const fleetIndex = grid.fleets?.findIndex(f => f.fleetId === fleet.fleetId) ?? -1;
    if (fleetIndex >= 0 && grid.fleets) {
      const unitCount = Math.ceil(fleet.totalShips / 300) || 0;
      
      if (unitCount === 0) {
        // Remove fleet from grid
        await GalaxyGrid.removeFleetFromGrid(sessionId, x, y, fleet.fleetId);
      } else {
        // Update unit count
        grid.fleets[fleetIndex].unitCount = unitCount;
        await grid.save();
      }
    }
  }

  /**
   * Update commander stats after battle
   */
  async updateCommanderAfterBattle(
    sessionId: string,
    result: IParticipantResult,
    outcome: IBattleOutcome
  ): Promise<void> {
    const commander = await Gin7Character.findOne({ 
      sessionId, 
      characterId: result.commanderId 
    });
    if (!commander) return;

    // Initialize battle stats if not present
    if (!commander.battleStats) {
      commander.battleStats = {
        battlesWon: 0,
        battlesLost: 0,
        battlesDrawn: 0,
        shipsDestroyed: 0,
        shipsLost: 0,
        damageDealt: 0,
        damageTaken: 0,
        killCount: 0,
        captureCount: 0
      };
    }

    const stats = commander.battleStats as ICharacterBattleStats;

    // Update stats
    stats.damageDealt += result.damageDealt;
    stats.damageTaken += result.damageTaken;
    stats.shipsLost += result.shipsLost;
    
    // Estimate ships destroyed (based on damage dealt)
    stats.shipsDestroyed += Math.floor(result.damageDealt / 500);

    // Win/loss/draw
    if (outcome.endReason === 'DRAW') {
      stats.battlesDrawn += 1;
    } else if (outcome.winner === result.factionId) {
      stats.battlesWon += 1;
    } else {
      stats.battlesLost += 1;
    }

    // Merit points for combat (could be expanded)
    const meritGained = Math.floor(result.damageDealt / 100);
    commander.merit = (commander.merit || 0) + meritGained;

    await commander.save();

    this.emit('commander:updated', {
      sessionId,
      characterId: result.commanderId,
      battleStats: stats
    });
  }

  /**
   * Update grid state after battle ends
   */
  async updateGridAfterBattle(
    sessionId: string,
    x: number,
    y: number,
    outcome: IBattleOutcome
  ): Promise<void> {
    // Clear battle state
    await gridService.clearGridBattleState(sessionId, x, y);

    // Update fleet counts in grid
    const grid = await gridService.getGridState(sessionId, x, y);
    if (!grid) return;

    // Recalculate ownerFactions
    const factionsWithFleets = new Set<string>();
    for (const fleet of grid.fleets || []) {
      if (fleet.unitCount > 0) {
        factionsWithFleets.add(fleet.factionId);
      }
    }

    grid.ownerFactions = Array.from(factionsWithFleets);
    grid.battlePending = false;
    grid.hostileFactions = [];

    await grid.save();

    this.emit('grid:updated', {
      sessionId,
      x,
      y,
      ownerFactions: grid.ownerFactions
    });
  }

  /**
   * Save battle to history
   */
  async saveBattleHistory(
    battle: IRealtimeBattle,
    outcome: IBattleOutcome
  ): Promise<void> {
    // Could create a separate BattleHistory collection
    // For now, the battle document itself serves as history
    // with result populated
    
    this.emit('battle:history:saved', {
      battleId: battle.battleId,
      sessionId: battle.sessionId,
      outcome
    });
  }

  /**
   * Calculate morale change based on battle result
   */
  calculateMoraleChange(
    initialMorale: number,
    won: boolean,
    lossRatio: number
  ): number {
    let change = 0;

    if (won) {
      // Victory bonus
      change = 10 + Math.random() * 10;
    } else {
      // Defeat penalty
      change = -20 - lossRatio * 30;
    }

    // High losses always hurt morale
    change -= lossRatio * 20;

    return Math.max(10, Math.min(100, initialMorale + change));
  }

  /**
   * Calculate experience/veterancy gain
   */
  calculateVeterancyGain(
    currentVeterancy: number,
    damageDealt: number,
    survived: boolean
  ): number {
    let gain = 0;

    // Base gain from combat participation
    gain += Math.min(5, damageDealt / 1000);

    // Survival bonus
    if (survived) {
      gain += 2;
    }

    // Diminishing returns at high veterancy
    const diminishingFactor = 1 - (currentVeterancy / 100) * 0.5;
    gain *= diminishingFactor;

    return Math.min(100, currentVeterancy + gain);
  }

  /**
   * Handle fleet destruction
   */
  async handleFleetDestruction(
    sessionId: string,
    fleetId: string
  ): Promise<void> {
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) return;

    // Remove from grid
    const [, x, y] = (fleet.gridId || '').split('_').map(Number);
    if (!isNaN(x) && !isNaN(y)) {
      await GalaxyGrid.removeFleetFromGrid(sessionId, x, y, fleetId);
    }

    // Mark fleet as destroyed
    fleet.status = 'REORG';
    fleet.units = [];
    fleet.totalShips = 0;
    fleet.statusData = { 
      reason: 'DESTROYED',
      destroyedAt: new Date()
    };
    await fleet.save();

    this.emit('fleet:destroyed', {
      sessionId,
      fleetId,
      commanderId: fleet.commanderId
    });
  }

  /**
   * Process retreat for a fleet
   */
  async processRetreat(
    sessionId: string,
    fleetId: string,
    battleId: string
  ): Promise<{ success: boolean; destination?: { x: number; y: number } }> {
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) {
      return { success: false };
    }

    // Determine retreat destination (previous grid or nearest friendly)
    let destination: { x: number; y: number } | undefined;

    if (fleet.previousGridId) {
      const [, px, py] = fleet.previousGridId.split('_').map(Number);
      if (!isNaN(px) && !isNaN(py)) {
        destination = { x: px, y: py };
      }
    }

    if (!destination) {
      // Find nearest grid with friendly units
      // For now, default to a safe location
      destination = { x: 50, y: 50 };  // Center of map
    }

    // Apply retreat losses (10% additional losses)
    const retreatLosses = Math.floor(fleet.totalShips * 0.1);
    for (const unit of fleet.units) {
      const unitLoss = Math.floor(unit.count * 0.1);
      unit.count = Math.max(0, unit.count - unitLoss);
      unit.destroyed += unitLoss;
    }

    fleet.totalShips = fleet.units.reduce((sum, u) => sum + u.count, 0);
    fleet.status = 'RETREATING';
    fleet.battleState = undefined;
    fleet.statusData = {
      retreatFrom: battleId,
      retreatDestination: destination,
      retreatStartedAt: new Date()
    };

    await fleet.save();

    this.emit('fleet:retreated', {
      sessionId,
      fleetId,
      battleId,
      destination
    });

    return { success: true, destination };
  }
}

export const battleResultService = BattleResultService.getInstance();
export default BattleResultService;
