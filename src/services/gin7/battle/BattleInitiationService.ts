/**
 * BattleInitiationService
 * 
 * Handles the creation of realtime battles from MMO world state.
 * Bridges the gap between strategic MMO layer and tactical battle layer.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { GalaxyGrid, IGalaxyGrid, IGridFleetInfo, IGridBattleState } from '../../../models/gin7/GalaxyGrid';
import { Fleet, IFleet, IFleetBattleState } from '../../../models/gin7/Fleet';
import { Gin7Character, IGin7Character } from '../../../models/gin7/Character';
import { RealtimeBattle, IRealtimeBattle, IBattleParticipant } from '../../../models/gin7/RealtimeBattle';
import { gridService } from '../GridService';

/**
 * Battle initiation request
 */
export interface IBattleInitiationRequest {
  sessionId: string;
  gridX: number;
  gridY: number;
  initiatorFleetId: string;
  targetFactionId?: string;    // Optional: specific faction to attack
  reason?: string;             // Reason for battle (for logging)
}

/**
 * Battle initiation result
 */
export interface IBattleInitiationResult {
  success: boolean;
  battleId?: string;
  battle?: IRealtimeBattle;
  participants?: IBattleParticipant[];
  reason?: string;
}

/**
 * Fleet eligibility check result
 */
export interface IFleetEligibility {
  fleetId: string;
  eligible: boolean;
  reason?: string;
  fleet?: IFleet;
  commander?: IGin7Character;
  isOnline: boolean;
}

class BattleInitiationService extends EventEmitter {
  private static instance: BattleInitiationService;

  // Battle area constants
  private readonly BATTLE_AREA_SIZE = 1000;  // 1000 x 1000 battle area
  private readonly SPAWN_OFFSET = 400;       // Distance from center for spawning

  private constructor() {
    super();
  }

  static getInstance(): BattleInitiationService {
    if (!BattleInitiationService.instance) {
      BattleInitiationService.instance = new BattleInitiationService();
    }
    return BattleInitiationService.instance;
  }

  /**
   * Check if battle can be initiated in a grid
   */
  async canInitiateBattle(
    sessionId: string, 
    gridX: number, 
    gridY: number, 
    initiatorFleetId: string
  ): Promise<{ canInitiate: boolean; reason?: string }> {
    // Get grid state
    const grid = await gridService.getGridState(sessionId, gridX, gridY);
    if (!grid) {
      return { canInitiate: false, reason: 'Grid not found' };
    }

    // Check if battle already active
    if (grid.battleState?.status === 'ACTIVE') {
      return { canInitiate: false, reason: 'Battle already active in this grid' };
    }

    // Check if there are hostile factions
    if (!grid.battlePending && (grid.ownerFactions?.length || 0) < 2) {
      return { canInitiate: false, reason: 'No hostile factions present' };
    }

    // Check initiator fleet
    const fleet = await Fleet.findOne({ sessionId, fleetId: initiatorFleetId });
    if (!fleet) {
      return { canInitiate: false, reason: 'Initiator fleet not found' };
    }

    // Check fleet is in this grid
    if (fleet.gridId !== `grid_${gridX}_${gridY}`) {
      return { canInitiate: false, reason: 'Initiator fleet not in this grid' };
    }

    // Check fleet status
    if (fleet.status === 'IN_BATTLE' || fleet.status === 'COMBAT') {
      return { canInitiate: false, reason: 'Initiator fleet already in battle' };
    }

    // Check fleet has units
    const totalUnits = fleet.units.reduce((sum, u) => sum + u.count, 0);
    if (totalUnits === 0) {
      return { canInitiate: false, reason: 'Initiator fleet has no units' };
    }

    return { canInitiate: true };
  }

  /**
   * Get all eligible fleets for battle in a grid
   */
  async getEligibleFleets(
    sessionId: string, 
    gridX: number, 
    gridY: number, 
    factionId?: string
  ): Promise<IFleetEligibility[]> {
    const fleets = await gridService.getFleetsInGrid(sessionId, gridX, gridY);
    const results: IFleetEligibility[] = [];

    for (const fleet of fleets) {
      // Skip if filtering by faction
      if (factionId && fleet.factionId !== factionId) continue;

      const eligibility: IFleetEligibility = {
        fleetId: fleet.fleetId,
        eligible: true,
        fleet,
        isOnline: false
      };

      // Check fleet status
      if (fleet.status === 'IN_BATTLE' || fleet.status === 'COMBAT') {
        eligibility.eligible = false;
        eligibility.reason = 'Already in battle';
      }

      // Check units
      const totalUnits = fleet.units.reduce((sum, u) => sum + u.count, 0);
      if (totalUnits === 0) {
        eligibility.eligible = false;
        eligibility.reason = 'No units';
      }

      // Get commander and online status
      const commander = await Gin7Character.findOne({ 
        sessionId, 
        characterId: fleet.commanderId 
      });
      if (commander) {
        eligibility.commander = commander;
        eligibility.isOnline = commander.isOnline || false;
      }

      results.push(eligibility);
    }

    return results;
  }

  /**
   * Initiate a battle from MMO world
   */
  async initiateBattle(request: IBattleInitiationRequest): Promise<IBattleInitiationResult> {
    const { sessionId, gridX, gridY, initiatorFleetId, targetFactionId, reason } = request;

    // Validate
    const canInitiate = await this.canInitiateBattle(sessionId, gridX, gridY, initiatorFleetId);
    if (!canInitiate.canInitiate) {
      return { success: false, reason: canInitiate.reason };
    }

    // Get initiator fleet
    const initiatorFleet = await Fleet.findOne({ sessionId, fleetId: initiatorFleetId });
    if (!initiatorFleet) {
      return { success: false, reason: 'Initiator fleet not found' };
    }

    // Get all fleets in grid
    const grid = await gridService.getGridState(sessionId, gridX, gridY);
    if (!grid) {
      return { success: false, reason: 'Grid not found' };
    }

    // Determine participating factions
    let participatingFactions = grid.ownerFactions || [];
    if (targetFactionId) {
      // Filter to just initiator and target
      participatingFactions = [initiatorFleet.factionId, targetFactionId];
    }

    // Get all eligible fleets for each faction
    const eligibleFleets = await this.getEligibleFleets(sessionId, gridX, gridY);
    const battleFleets = eligibleFleets.filter(
      e => e.eligible && e.fleet && participatingFactions.includes(e.fleet.factionId)
    );

    if (battleFleets.length < 2) {
      return { success: false, reason: 'Not enough eligible fleets for battle' };
    }

    // Create battle
    const battleId = `battle_${uuidv4()}`;
    const participants = await this.createParticipants(battleFleets, participatingFactions);

    // Create battle document
    const battle = new RealtimeBattle({
      battleId,
      sessionId,
      gridLocation: { x: gridX, y: gridY, gridId: `grid_${gridX}_${gridY}` },
      battleArea: {
        width: this.BATTLE_AREA_SIZE,
        height: this.BATTLE_AREA_SIZE,
        minX: -this.BATTLE_AREA_SIZE / 2,
        maxX: this.BATTLE_AREA_SIZE / 2,
        minY: -this.BATTLE_AREA_SIZE / 2,
        maxY: this.BATTLE_AREA_SIZE / 2,
        minZ: -100,
        maxZ: 100
      },
      participants,
      factions: participatingFactions,
      status: 'PREPARING',
      tickCount: 0,
      maxTicks: 36000,  // 1 hour at 10 ticks/sec
      createdAt: new Date(),
      initiatedBy: initiatorFleetId,
      initiationReason: reason
    });

    await battle.save();

    // Update grid state
    const gridBattleState: IGridBattleState = {
      battleId,
      startedAt: new Date(),
      participants: participants.map(p => p.fleetId),
      factions: participatingFactions,
      status: 'PENDING'
    };
    await gridService.setGridBattleState(sessionId, gridX, gridY, gridBattleState);

    // Update fleet states
    for (const p of participants) {
      const fleet = battleFleets.find(b => b.fleetId === p.fleetId)?.fleet;
      if (fleet) {
        const battleState: IFleetBattleState = {
          battleId,
          gridId: `grid_${gridX}_${gridY}`,
          joinedAt: new Date(),
          role: p.fleetId === initiatorFleetId ? 'INITIATOR' : 'DEFENDER',
          initialUnits: fleet.units.reduce((sum, u) => sum + u.count, 0),
          currentUnits: fleet.units.reduce((sum, u) => sum + u.count, 0)
        };
        
        await Fleet.findOneAndUpdate(
          { sessionId, fleetId: p.fleetId },
          { 
            status: 'IN_BATTLE',
            battleState,
            statusData: { battleId, joinedAt: new Date() }
          }
        );
      }
    }

    // Emit events
    this.emit('battle:created', {
      battleId,
      sessionId,
      gridX,
      gridY,
      factions: participatingFactions,
      participants: participants.map(p => ({
        fleetId: p.fleetId,
        factionId: p.faction
      }))
    });

    return {
      success: true,
      battleId,
      battle,
      participants
    };
  }

  /**
   * Create battle participants from eligible fleets
   */
  private async createParticipants(
    eligibleFleets: IFleetEligibility[],
    factions: string[]
  ): Promise<IBattleParticipant[]> {
    const participants: IBattleParticipant[] = [];
    const factionPositions = this.calculateFactionSpawnPositions(factions.length);

    for (let i = 0; i < factions.length; i++) {
      const faction = factions[i];
      const factionFleets = eligibleFleets.filter(
        e => e.fleet?.factionId === faction
      );

      // Calculate spawn positions for this faction's fleets
      const basePos = factionPositions[i];
      const fleetPositions = this.calculateFleetSpawnPositions(
        factionFleets.length,
        basePos.x,
        basePos.y
      );

      for (let j = 0; j < factionFleets.length; j++) {
        const ef = factionFleets[j];
        if (!ef.fleet) continue;

        const participant: IBattleParticipant = {
          fleetId: ef.fleet.fleetId,
          faction,
          commanderId: ef.fleet.commanderId,
          isPlayerControlled: ef.isOnline,
          initialPosition: {
            x: fleetPositions[j].x,
            y: fleetPositions[j].y,
            z: 0
          },
          shipCount: ef.fleet.units.reduce((sum, u) => sum + u.count, 0),
          isDefeated: false,
          joinedAt: new Date(),
          damageDealt: 0,
          damageTaken: 0,
          shipsLost: 0
        };

        participants.push(participant);
      }
    }

    return participants;
  }

  /**
   * Calculate spawn positions for factions (evenly distributed around center)
   */
  private calculateFactionSpawnPositions(factionCount: number): { x: number; y: number }[] {
    const positions: { x: number; y: number }[] = [];
    const angleStep = (2 * Math.PI) / factionCount;

    for (let i = 0; i < factionCount; i++) {
      const angle = i * angleStep - Math.PI / 2;  // Start from top
      positions.push({
        x: Math.cos(angle) * this.SPAWN_OFFSET,
        y: Math.sin(angle) * this.SPAWN_OFFSET
      });
    }

    return positions;
  }

  /**
   * Calculate spawn positions for fleets within a faction's area
   */
  private calculateFleetSpawnPositions(
    fleetCount: number,
    baseX: number,
    baseY: number
  ): { x: number; y: number }[] {
    const positions: { x: number; y: number }[] = [];
    const spacing = 80;  // Space between fleets

    // Arrange in a line perpendicular to center direction
    const perpAngle = Math.atan2(baseY, baseX) + Math.PI / 2;
    const startOffset = -(fleetCount - 1) * spacing / 2;

    for (let i = 0; i < fleetCount; i++) {
      const offset = startOffset + i * spacing;
      positions.push({
        x: baseX + Math.cos(perpAngle) * offset,
        y: baseY + Math.sin(perpAngle) * offset
      });
    }

    return positions;
  }

  /**
   * Add reinforcement fleet to existing battle
   */
  async addReinforcement(
    sessionId: string,
    battleId: string,
    fleetId: string
  ): Promise<{ success: boolean; reason?: string }> {
    // Get battle
    const battle = await RealtimeBattle.findOne({ sessionId, battleId });
    if (!battle) {
      return { success: false, reason: 'Battle not found' };
    }

    if (battle.status !== 'ACTIVE' && battle.status !== 'PREPARING') {
      return { success: false, reason: 'Battle not accepting reinforcements' };
    }

    // Get fleet
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) {
      return { success: false, reason: 'Fleet not found' };
    }

    // Check fleet can reinforce
    if (fleet.status === 'IN_BATTLE' || fleet.status === 'COMBAT') {
      return { success: false, reason: 'Fleet already in battle' };
    }

    // Check faction is part of battle
    if (!battle.factions.includes(fleet.factionId)) {
      return { success: false, reason: 'Fleet faction not part of this battle' };
    }

    // Check fleet is adjacent to battle
    const gridLocation = battle.gridLocation;
    if (!gridLocation) {
      return { success: false, reason: 'Battle has no grid location' };
    }

    const [, fx, fy] = (fleet.gridId || '').split('_').map(Number);
    if (!gridService.isAdjacent(fx, fy, gridLocation.x, gridLocation.y)) {
      return { success: false, reason: 'Fleet must be in adjacent grid to reinforce' };
    }

    // Get commander online status
    const commander = await Gin7Character.findOne({ 
      sessionId, 
      characterId: fleet.commanderId 
    });
    const isOnline = commander?.isOnline || false;

    // Calculate reinforcement spawn position
    const existingFactionFleets = battle.participants.filter(
      p => p.faction === fleet.factionId
    );
    const baseAngle = this.getFactionSpawnAngle(
      battle.factions.indexOf(fleet.factionId),
      battle.factions.length
    );
    const spawnPos = {
      x: Math.cos(baseAngle) * (this.SPAWN_OFFSET + 50 * existingFactionFleets.length),
      y: Math.sin(baseAngle) * (this.SPAWN_OFFSET + 50 * existingFactionFleets.length),
      z: 0
    };

    // Create participant
    const participant: IBattleParticipant = {
      fleetId: fleet.fleetId,
      faction: fleet.factionId,
      commanderId: fleet.commanderId,
      isPlayerControlled: isOnline,
      initialPosition: spawnPos,
      shipCount: fleet.units.reduce((sum, u) => sum + u.count, 0),
      isDefeated: false,
      joinedAt: new Date(),
      damageDealt: 0,
      damageTaken: 0,
      shipsLost: 0
    };

    // Update battle
    battle.participants.push(participant);
    await battle.save();

    // Update fleet
    const battleState: IFleetBattleState = {
      battleId,
      gridId: `grid_${gridLocation.x}_${gridLocation.y}`,
      joinedAt: new Date(),
      role: 'REINFORCEMENT',
      initialUnits: fleet.units.reduce((sum, u) => sum + u.count, 0),
      currentUnits: fleet.units.reduce((sum, u) => sum + u.count, 0)
    };

    await Fleet.findOneAndUpdate(
      { sessionId, fleetId },
      { 
        status: 'IN_BATTLE',
        battleState,
        gridId: `grid_${gridLocation.x}_${gridLocation.y}`,
        statusData: { battleId, joinedAt: new Date(), role: 'REINFORCEMENT' }
      }
    );

    // Emit event
    this.emit('battle:reinforcement', {
      battleId,
      sessionId,
      fleetId,
      factionId: fleet.factionId
    });

    return { success: true };
  }

  /**
   * Get faction spawn angle
   */
  private getFactionSpawnAngle(factionIndex: number, totalFactions: number): number {
    const angleStep = (2 * Math.PI) / totalFactions;
    return factionIndex * angleStep - Math.PI / 2;
  }

  /**
   * Check if auto-battle should trigger for a grid
   */
  async checkAutoInitiation(sessionId: string, gridX: number, gridY: number): Promise<void> {
    const eligibleFleets = await this.getEligibleFleets(sessionId, gridX, gridY);
    
    // Find fleets with autoEngage enabled
    for (const ef of eligibleFleets) {
      if (!ef.fleet || !ef.eligible) continue;
      
      if (ef.fleet.battleConfig?.autoEngage) {
        // Check if there are hostile fleets
        const hostiles = eligibleFleets.filter(
          other => other.fleet && 
                   other.fleet.factionId !== ef.fleet!.factionId &&
                   other.eligible
        );

        if (hostiles.length > 0) {
          // Initiate battle
          await this.initiateBattle({
            sessionId,
            gridX,
            gridY,
            initiatorFleetId: ef.fleetId,
            reason: 'AUTO_ENGAGE'
          });
          return;  // Only one battle per grid
        }
      }
    }
  }
}

export const battleInitiationService = BattleInitiationService.getInstance();
export default BattleInitiationService;
