/**
 * GridService
 * 
 * Manages grid-based fleet tracking, encounter detection, and unit limits
 * for MMO-Battle integration.
 */

import { EventEmitter } from 'events';
import { 
  GalaxyGrid, 
  IGalaxyGrid, 
  IGridFleetInfo, 
  IGridBattleState,
  GRID_CONSTANTS 
} from '../../models/gin7/GalaxyGrid';
import { Fleet, IFleet } from '../../models/gin7/Fleet';
import { Gin7Character } from '../../models/gin7/Character';

/**
 * Encounter result when hostile fleets meet
 */
export interface IEncounterResult {
  hasEncounter: boolean;
  gridId: string;
  x: number;
  y: number;
  factions: string[];
  fleets: IGridFleetInfo[];
  totalUnits: Map<string, number>;
}

/**
 * Movement result
 */
export interface IMoveResult {
  success: boolean;
  fleet: IFleet | null;
  fromGrid: IGalaxyGrid | null;
  toGrid: IGalaxyGrid | null;
  encounterResult?: IEncounterResult;
  reason?: string;
}

/**
 * Grid state summary
 */
export interface IGridSummary {
  gridId: string;
  x: number;
  y: number;
  type: string;
  terrain: string;
  factions: string[];
  fleetCount: number;
  totalUnits: number;
  unitsByFaction: Record<string, number>;
  battlePending: boolean;
  activeBattle?: {
    battleId: string;
    status: string;
    startedAt: Date;
  };
}

class GridService extends EventEmitter {
  private static instance: GridService;

  private constructor() {
    super();
  }

  static getInstance(): GridService {
    if (!GridService.instance) {
      GridService.instance = new GridService();
    }
    return GridService.instance;
  }

  /**
   * Get grid state
   */
  async getGridState(sessionId: string, x: number, y: number): Promise<IGalaxyGrid | null> {
    return GalaxyGrid.findOne({ sessionId, x, y });
  }

  /**
   * Get grid by gridId
   */
  async getGridById(sessionId: string, gridId: string): Promise<IGalaxyGrid | null> {
    return GalaxyGrid.findOne({ sessionId, gridId });
  }

  /**
   * Get grid summary (for UI display)
   */
  async getGridSummary(sessionId: string, x: number, y: number): Promise<IGridSummary | null> {
    const grid = await this.getGridState(sessionId, x, y);
    if (!grid) return null;

    const unitsByFaction: Record<string, number> = {};
    let totalUnits = 0;

    for (const fleet of grid.fleets || []) {
      unitsByFaction[fleet.factionId] = (unitsByFaction[fleet.factionId] || 0) + fleet.unitCount;
      totalUnits += fleet.unitCount;
    }

    return {
      gridId: grid.gridId || `grid_${x}_${y}`,
      x: grid.x,
      y: grid.y,
      type: grid.type || 'SPACE',
      terrain: grid.terrain,
      factions: grid.ownerFactions || [],
      fleetCount: grid.fleets?.length || 0,
      totalUnits,
      unitsByFaction,
      battlePending: grid.battlePending || false,
      activeBattle: grid.battleState ? {
        battleId: grid.battleState.battleId,
        status: grid.battleState.status,
        startedAt: grid.battleState.startedAt
      } : undefined
    };
  }

  /**
   * Get all fleets in a grid
   */
  async getFleetsInGrid(sessionId: string, x: number, y: number): Promise<IFleet[]> {
    const grid = await this.getGridState(sessionId, x, y);
    if (!grid || !grid.fleets?.length) return [];

    const fleetIds = grid.fleets.map(f => f.fleetId);
    return Fleet.find({ sessionId, fleetId: { $in: fleetIds } });
  }

  /**
   * Get fleets by faction in a grid
   */
  async getFleetsByFaction(
    sessionId: string, 
    x: number, 
    y: number, 
    factionId: string
  ): Promise<IFleet[]> {
    const grid = await this.getGridState(sessionId, x, y);
    if (!grid) return [];

    const fleetIds = grid.fleets
      ?.filter(f => f.factionId === factionId)
      .map(f => f.fleetId) || [];

    if (fleetIds.length === 0) return [];
    return Fleet.find({ sessionId, fleetId: { $in: fleetIds } });
  }

  /**
   * Get hostile factions in a grid
   */
  async getHostileFactions(
    sessionId: string, 
    x: number, 
    y: number, 
    factionId: string
  ): Promise<string[]> {
    const grid = await this.getGridState(sessionId, x, y);
    if (!grid) return [];

    // All other factions are considered hostile (simplified)
    // In production, check diplomacy state
    return (grid.ownerFactions || []).filter(f => f !== factionId);
  }

  /**
   * Check if a fleet can enter a grid (unit limit check)
   */
  async canEnterGrid(
    sessionId: string, 
    x: number, 
    y: number, 
    fleet: IFleet
  ): Promise<{ allowed: boolean; reason?: string }> {
    const grid = await this.getGridState(sessionId, x, y);
    
    // Check terrain
    if (grid?.terrain === 'black_hole') {
      return { allowed: false, reason: 'Cannot enter black hole' };
    }
    
    if (grid?.type === 'BLOCKED') {
      return { allowed: false, reason: 'Grid is blocked' };
    }

    // Calculate unit count
    const unitCount = fleet.units.reduce((sum, u) => sum + Math.ceil(u.count / 300), 0) || 1;
    
    // Check unit limit for this faction
    const currentUnits = grid?.unitCountByFaction?.get(fleet.factionId) || 0;
    if (currentUnits + unitCount > GRID_CONSTANTS.MAX_UNITS_PER_GRID) {
      return { 
        allowed: false, 
        reason: `Unit limit exceeded: ${currentUnits + unitCount}/${GRID_CONSTANTS.MAX_UNITS_PER_GRID}` 
      };
    }

    // Check faction limit
    const existingFactions = new Set(grid?.ownerFactions || []);
    if (!existingFactions.has(fleet.factionId) && existingFactions.size >= GRID_CONSTANTS.MAX_FACTIONS_PER_GRID) {
      return { 
        allowed: false, 
        reason: 'Grid already has maximum factions' 
      };
    }

    // Check if there's an active battle that this fleet cannot join
    if (grid?.battleState?.status === 'ACTIVE') {
      // Can only join if same faction is already fighting
      if (!grid.battleState.factions.includes(fleet.factionId)) {
        return { 
          allowed: false, 
          reason: 'Cannot enter grid with active battle between other factions' 
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Move fleet to a new grid
   */
  async moveFleetToGrid(
    sessionId: string, 
    fleetId: string, 
    targetX: number, 
    targetY: number
  ): Promise<IMoveResult> {
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) {
      return { success: false, fleet: null, fromGrid: null, toGrid: null, reason: 'Fleet not found' };
    }

    // Check if fleet can move
    if (fleet.status === 'IN_BATTLE' || fleet.status === 'COMBAT') {
      return { 
        success: false, 
        fleet, 
        fromGrid: null, 
        toGrid: null, 
        reason: 'Fleet is in battle and cannot move' 
      };
    }

    // Check destination
    const canEnter = await this.canEnterGrid(sessionId, targetX, targetY, fleet);
    if (!canEnter.allowed) {
      return { 
        success: false, 
        fleet, 
        fromGrid: null, 
        toGrid: null, 
        reason: canEnter.reason 
      };
    }

    // Get current grid coordinates from fleet
    let fromGrid: IGalaxyGrid | null = null;
    if (fleet.gridId) {
      const [, x, y] = fleet.gridId.split('_').map(Number);
      if (!isNaN(x) && !isNaN(y)) {
        fromGrid = await this.getGridState(sessionId, x, y);
        // Remove from current grid
        if (fromGrid) {
          await GalaxyGrid.removeFleetFromGrid(sessionId, x, y, fleetId);
        }
      }
    }

    // Calculate unit count
    const unitCount = fleet.units.reduce((sum, u) => sum + Math.ceil(u.count / 300), 0) || 1;

    // Add to new grid
    const fleetInfo: IGridFleetInfo = {
      fleetId: fleet.fleetId,
      factionId: fleet.factionId,
      unitCount,
      commanderId: fleet.commanderId,
      name: fleet.name
    };

    const addResult = await GalaxyGrid.addFleetToGrid(sessionId, targetX, targetY, fleetInfo);
    if (!addResult.success) {
      // Rollback: re-add to original grid
      if (fromGrid) {
        await GalaxyGrid.addFleetToGrid(sessionId, fromGrid.x, fromGrid.y, fleetInfo);
      }
      return { 
        success: false, 
        fleet, 
        fromGrid, 
        toGrid: null, 
        reason: addResult.reason 
      };
    }

    // Update fleet location
    fleet.previousGridId = fleet.gridId;
    fleet.gridId = `grid_${targetX}_${targetY}`;
    fleet.location.coordinates = { x: targetX, y: targetY };
    await fleet.save();

    // Check for encounter
    const encounterResult = await this.detectEncounter(sessionId, targetX, targetY);

    // Emit events
    this.emit('fleet:moved', {
      sessionId,
      fleetId,
      from: fromGrid ? { x: fromGrid.x, y: fromGrid.y } : null,
      to: { x: targetX, y: targetY }
    });

    if (encounterResult.hasEncounter) {
      this.emit('encounter:detected', encounterResult);
    }

    return {
      success: true,
      fleet,
      fromGrid,
      toGrid: addResult.grid || null,
      encounterResult
    };
  }

  /**
   * Detect hostile encounter in a grid
   */
  async detectEncounter(sessionId: string, x: number, y: number): Promise<IEncounterResult> {
    const grid = await this.getGridState(sessionId, x, y);
    
    const result: IEncounterResult = {
      hasEncounter: false,
      gridId: `grid_${x}_${y}`,
      x,
      y,
      factions: [],
      fleets: [],
      totalUnits: new Map()
    };

    if (!grid) return result;

    result.fleets = grid.fleets || [];
    result.factions = grid.ownerFactions || [];

    // Calculate units by faction
    for (const fleet of result.fleets) {
      const current = result.totalUnits.get(fleet.factionId) || 0;
      result.totalUnits.set(fleet.factionId, current + fleet.unitCount);
    }

    // Encounter if 2+ factions present
    if (result.factions.length >= 2) {
      result.hasEncounter = true;

      // Update grid state
      grid.battlePending = true;
      grid.hostileFactions = result.factions;
      await grid.save();

      // Notify all players in the grid
      this.emit('battle:pending', {
        sessionId,
        gridId: result.gridId,
        x,
        y,
        factions: result.factions,
        fleetCount: result.fleets.length
      });
    }

    return result;
  }

  /**
   * Mark battle as pending in grid
   */
  async markBattlePending(
    sessionId: string, 
    x: number, 
    y: number, 
    factions: string[]
  ): Promise<void> {
    await GalaxyGrid.findOneAndUpdate(
      { sessionId, x, y },
      { battlePending: true, hostileFactions: factions }
    );
  }

  /**
   * Set active battle state in grid
   */
  async setGridBattleState(
    sessionId: string, 
    x: number, 
    y: number, 
    battleState: IGridBattleState
  ): Promise<IGalaxyGrid | null> {
    return GalaxyGrid.setBattleState(sessionId, x, y, battleState);
  }

  /**
   * Clear battle state from grid
   */
  async clearGridBattleState(
    sessionId: string, 
    x: number, 
    y: number
  ): Promise<IGalaxyGrid | null> {
    return GalaxyGrid.setBattleState(sessionId, x, y, null);
  }

  /**
   * Get all grids with pending battles
   */
  async getGridsWithPendingBattles(sessionId: string): Promise<IGalaxyGrid[]> {
    return GalaxyGrid.getGridsWithPendingBattles(sessionId);
  }

  /**
   * Get all grids with active battles
   */
  async getGridsWithActiveBattles(sessionId: string): Promise<IGalaxyGrid[]> {
    return GalaxyGrid.getGridsWithActiveBattles(sessionId);
  }

  /**
   * Get adjacent grids (for reinforcement checks)
   */
  async getAdjacentGrids(
    sessionId: string, 
    x: number, 
    y: number
  ): Promise<IGalaxyGrid[]> {
    const adjacentCoords = [
      { x: x - 1, y: y - 1 }, { x, y: y - 1 }, { x: x + 1, y: y - 1 },
      { x: x - 1, y },                          { x: x + 1, y },
      { x: x - 1, y: y + 1 }, { x, y: y + 1 }, { x: x + 1, y: y + 1 }
    ].filter(c => c.x >= 0 && c.x < 100 && c.y >= 0 && c.y < 100);

    return GalaxyGrid.find({
      sessionId,
      $or: adjacentCoords.map(c => ({ x: c.x, y: c.y }))
    });
  }

  /**
   * Get friendly fleets in adjacent grids (for reinforcement)
   */
  async getFriendlyFleetsNearby(
    sessionId: string, 
    x: number, 
    y: number, 
    factionId: string
  ): Promise<IFleet[]> {
    const adjacentGrids = await this.getAdjacentGrids(sessionId, x, y);
    const fleetIds: string[] = [];

    for (const grid of adjacentGrids) {
      const factionFleets = grid.fleets?.filter(f => f.factionId === factionId) || [];
      fleetIds.push(...factionFleets.map(f => f.fleetId));
    }

    if (fleetIds.length === 0) return [];
    return Fleet.find({ sessionId, fleetId: { $in: fleetIds }, status: 'IDLE' });
  }

  /**
   * Get all online player characters in a grid
   */
  async getOnlinePlayersInGrid(
    sessionId: string, 
    x: number, 
    y: number
  ): Promise<string[]> {
    const fleets = await this.getFleetsInGrid(sessionId, x, y);
    const commanderIds = fleets.map(f => f.commanderId);

    const onlineCharacters = await Gin7Character.find({
      sessionId,
      characterId: { $in: commanderIds },
      isOnline: true
    });

    return onlineCharacters.map(c => c.characterId);
  }

  /**
   * Calculate movement distance between grids
   */
  calculateDistance(fromX: number, fromY: number, toX: number, toY: number): number {
    return Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2));
  }

  /**
   * Check if two grids are adjacent
   */
  isAdjacent(x1: number, y1: number, x2: number, y2: number): boolean {
    return Math.abs(x1 - x2) <= 1 && Math.abs(y1 - y2) <= 1 && !(x1 === x2 && y1 === y2);
  }
}

export const gridService = GridService.getInstance();
export default GridService;
