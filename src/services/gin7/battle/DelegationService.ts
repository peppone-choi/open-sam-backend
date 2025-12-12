/**
 * DelegationService
 * 
 * Handles command delegation for fleets when players are offline.
 * Determines who should control a fleet:
 * 1. Player (if online)
 * 2. Online subordinate admiral
 * 3. AI based on commander profile
 * 
 * Also handles delegation requests and command reclaim.
 */

import { EventEmitter } from 'events';
import { Fleet, IFleet } from '../../../models/gin7/Fleet';
import { Gin7Character, IGin7Character } from '../../../models/gin7/Character';
import { playerPresenceService } from '../PlayerPresenceService';
import { aiProfileService, IAIBattleProfile } from './AIProfileService';
import { AIStrategy, AIDifficulty } from './BattleAIService';

/**
 * Delegation types
 */
export type DelegationType = 
  | 'PLAYER'        // Player is controlling
  | 'SUBORDINATE'   // Delegated to online subordinate
  | 'AI'            // AI controlled
  | 'PENDING';      // Waiting for delegation decision

/**
 * Delegation state for a fleet
 */
export interface IDelegationState {
  fleetId: string;
  sessionId: string;
  battleId: string;
  
  // Original commander
  ownerId: string;
  ownerCharacterId: string;
  ownerIsOnline: boolean;
  
  // Current delegation
  delegationType: DelegationType;
  delegatedTo?: string;           // characterId if subordinate
  delegatedToSocketId?: string;   // For direct commands
  
  // AI profile (if AI controlled)
  aiProfile?: IAIBattleProfile;
  aiStrategy?: AIStrategy;
  aiDifficulty?: AIDifficulty;
  
  // Timestamps
  delegatedAt: Date;
  lastCommandAt?: Date;
  
  // Settings
  autoRevertOnOwnerOnline: boolean;  // Return control when owner comes online
  allowSubordinateDelegation: boolean;
}

/**
 * Delegation request
 */
export interface IDelegationRequest {
  fleetId: string;
  sessionId: string;
  battleId: string;
  requesterId: string;  // characterId of requester
  reason: 'OFFLINE' | 'MANUAL' | 'INCAPACITATED' | 'BATTLE_START';
}

/**
 * Delegation result
 */
export interface IDelegationResult {
  success: boolean;
  delegationType: DelegationType;
  controllerId?: string;        // characterId of controller
  controllerSocketId?: string;  // socketId for direct commands
  aiProfile?: IAIBattleProfile;
  error?: string;
}

/**
 * DelegationService class
 */
class DelegationService extends EventEmitter {
  private static instance: DelegationService;
  
  // Track delegation states per fleet in battle
  private delegationStates: Map<string, IDelegationState> = new Map();  // fleetId -> state
  
  // Track which fleets each character is controlling
  private characterFleets: Map<string, Set<string>> = new Map();  // characterId -> fleetIds

  private constructor() {
    super();
    this.setupPresenceListeners();
  }

  static getInstance(): DelegationService {
    if (!DelegationService.instance) {
      DelegationService.instance = new DelegationService();
    }
    return DelegationService.instance;
  }

  /**
   * Setup listeners for player presence changes
   */
  private setupPresenceListeners(): void {
    // When player comes online, check if they can reclaim command
    playerPresenceService.on('presence:online', async (update) => {
      await this.handlePlayerOnline(update.sessionId, update.characterId);
    });

    // When player goes offline, delegate their fleets
    playerPresenceService.on('presence:offline', async (update) => {
      await this.handlePlayerOffline(update.sessionId, update.characterId);
    });
  }

  /**
   * Resolve who should command a fleet in battle
   * Main entry point for delegation decisions
   */
  async resolveBattleCommander(
    sessionId: string,
    battleId: string,
    fleetId: string
  ): Promise<IDelegationResult> {
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) {
      return { success: false, delegationType: 'PENDING', error: 'Fleet not found' };
    }

    // 1. Check if owner is online
    const ownerOnline = await playerPresenceService.isPlayerOnline(sessionId, fleet.commanderId);
    
    if (ownerOnline) {
      // Owner is online - they control
      const character = await Gin7Character.findOne({ sessionId, characterId: fleet.commanderId });
      return this.setPlayerControl(
        sessionId, 
        battleId, 
        fleetId, 
        fleet.commanderId,
        character?.socketId
      );
    }

    // 2. Check for online subordinates in the fleet's faction
    const subordinate = await this.findOnlineSubordinate(sessionId, fleet);
    if (subordinate) {
      return this.delegateToSubordinate(sessionId, battleId, fleetId, subordinate);
    }

    // 3. Delegate to AI
    return this.delegateToAI(sessionId, battleId, fleetId, fleet.commanderId);
  }

  /**
   * Set player control for a fleet
   */
  private async setPlayerControl(
    sessionId: string,
    battleId: string,
    fleetId: string,
    characterId: string,
    socketId?: string
  ): Promise<IDelegationResult> {
    const state: IDelegationState = {
      fleetId,
      sessionId,
      battleId,
      ownerId: characterId,
      ownerCharacterId: characterId,
      ownerIsOnline: true,
      delegationType: 'PLAYER',
      delegatedAt: new Date(),
      autoRevertOnOwnerOnline: true,
      allowSubordinateDelegation: true
    };

    if (socketId) {
      state.delegatedToSocketId = socketId;
    }

    this.delegationStates.set(fleetId, state);
    this.addFleetToCharacter(characterId, fleetId);

    this.emit('delegation:player_control', {
      sessionId,
      battleId,
      fleetId,
      characterId
    });

    return {
      success: true,
      delegationType: 'PLAYER',
      controllerId: characterId,
      controllerSocketId: socketId
    };
  }

  /**
   * Find an online subordinate who can take command
   */
  private async findOnlineSubordinate(
    sessionId: string,
    fleet: IFleet
  ): Promise<IGin7Character | null> {
    // Get online players in the same faction
    const onlinePlayers = await playerPresenceService.getOnlinePlayersByFaction(
      sessionId,
      fleet.factionId
    );

    if (onlinePlayers.length === 0) {
      return null;
    }

    // Filter to find subordinates (same faction, not the commander)
    const subordinateIds = onlinePlayers
      .filter(p => p.characterId !== fleet.commanderId)
      .map(p => p.characterId);

    if (subordinateIds.length === 0) {
      return null;
    }

    // Get character details to find best subordinate
    const subordinates = await Gin7Character.find({
      sessionId,
      characterId: { $in: subordinateIds },
      isOnline: true
    }).sort({ 'stats.command': -1 });  // Highest command skill first

    // Return the best qualified subordinate
    return subordinates[0] || null;
  }

  /**
   * Delegate fleet command to a subordinate
   */
  async delegateToSubordinate(
    sessionId: string,
    battleId: string,
    fleetId: string,
    subordinate: IGin7Character
  ): Promise<IDelegationResult> {
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) {
      return { success: false, delegationType: 'PENDING', error: 'Fleet not found' };
    }

    const state: IDelegationState = {
      fleetId,
      sessionId,
      battleId,
      ownerId: fleet.commanderId,
      ownerCharacterId: fleet.commanderId,
      ownerIsOnline: false,
      delegationType: 'SUBORDINATE',
      delegatedTo: subordinate.characterId,
      delegatedToSocketId: subordinate.socketId,
      delegatedAt: new Date(),
      autoRevertOnOwnerOnline: true,
      allowSubordinateDelegation: true
    };

    this.delegationStates.set(fleetId, state);
    this.addFleetToCharacter(subordinate.characterId, fleetId);

    this.emit('delegation:subordinate', {
      sessionId,
      battleId,
      fleetId,
      ownerId: fleet.commanderId,
      subordinateId: subordinate.characterId
    });

    return {
      success: true,
      delegationType: 'SUBORDINATE',
      controllerId: subordinate.characterId,
      controllerSocketId: subordinate.socketId
    };
  }

  /**
   * Delegate fleet command to AI
   */
  async delegateToAI(
    sessionId: string,
    battleId: string,
    fleetId: string,
    commanderId: string
  ): Promise<IDelegationResult> {
    // Generate AI profile from commander stats
    const aiProfile = await aiProfileService.createProfile(sessionId, commanderId);

    const fleet = await Fleet.findOne({ sessionId, fleetId });
    
    const state: IDelegationState = {
      fleetId,
      sessionId,
      battleId,
      ownerId: commanderId,
      ownerCharacterId: commanderId,
      ownerIsOnline: false,
      delegationType: 'AI',
      aiProfile,
      aiStrategy: aiProfile.preferredStrategy,
      aiDifficulty: aiProfile.effectiveDifficulty,
      delegatedAt: new Date(),
      autoRevertOnOwnerOnline: true,
      allowSubordinateDelegation: true
    };

    this.delegationStates.set(fleetId, state);

    this.emit('delegation:ai', {
      sessionId,
      battleId,
      fleetId,
      commanderId,
      aiProfile
    });

    return {
      success: true,
      delegationType: 'AI',
      aiProfile
    };
  }

  /**
   * Reclaim command of a fleet (owner returning online)
   */
  async reclaimCommand(
    sessionId: string,
    battleId: string,
    fleetId: string,
    commanderId: string
  ): Promise<IDelegationResult> {
    const state = this.delegationStates.get(fleetId);
    
    if (!state) {
      return { success: false, delegationType: 'PENDING', error: 'No delegation state' };
    }

    // Verify this is the owner
    if (state.ownerCharacterId !== commanderId) {
      return { success: false, delegationType: state.delegationType, error: 'Not the owner' };
    }

    // Check if owner is online
    const isOnline = await playerPresenceService.isPlayerOnline(sessionId, commanderId);
    if (!isOnline) {
      return { success: false, delegationType: state.delegationType, error: 'Owner not online' };
    }

    // Get socket ID
    const character = await Gin7Character.findOne({ sessionId, characterId: commanderId });
    const socketId = character?.socketId;

    // Remove from previous controller
    if (state.delegatedTo) {
      this.removeFleetFromCharacter(state.delegatedTo, fleetId);
    }

    // Update state
    const previousType = state.delegationType;
    state.delegationType = 'PLAYER';
    state.ownerIsOnline = true;
    state.delegatedTo = undefined;
    state.delegatedToSocketId = socketId;
    state.aiProfile = undefined;
    state.aiStrategy = undefined;

    this.addFleetToCharacter(commanderId, fleetId);

    this.emit('delegation:reclaimed', {
      sessionId,
      battleId,
      fleetId,
      commanderId,
      previousDelegationType: previousType
    });

    return {
      success: true,
      delegationType: 'PLAYER',
      controllerId: commanderId,
      controllerSocketId: socketId
    };
  }

  /**
   * Handle player coming online
   */
  private async handlePlayerOnline(sessionId: string, characterId: string): Promise<void> {
    // Find all fleets this player owns that are in battle
    const fleets = await Fleet.find({
      sessionId,
      commanderId: characterId,
      'battleState.battleId': { $exists: true }
    });

    for (const fleet of fleets) {
      const state = this.delegationStates.get(fleet.fleetId);
      
      if (state && state.autoRevertOnOwnerOnline && state.delegationType !== 'PLAYER') {
        // Reclaim command
        await this.reclaimCommand(
          sessionId,
          state.battleId,
          fleet.fleetId,
          characterId
        );
      }
    }
  }

  /**
   * Handle player going offline
   */
  private async handlePlayerOffline(sessionId: string, characterId: string): Promise<void> {
    // Find all fleets this player is controlling
    const controlledFleets = this.characterFleets.get(characterId);
    
    if (!controlledFleets || controlledFleets.size === 0) {
      return;
    }

    for (const fleetId of controlledFleets) {
      const state = this.delegationStates.get(fleetId);
      
      if (state && state.delegationType === 'PLAYER') {
        // Need to delegate
        await this.resolveBattleCommander(sessionId, state.battleId, fleetId);
      }
    }
  }

  /**
   * Get delegation state for a fleet
   */
  getDelegationState(fleetId: string): IDelegationState | undefined {
    return this.delegationStates.get(fleetId);
  }

  /**
   * Check if fleet is AI controlled
   */
  isAIControlled(fleetId: string): boolean {
    const state = this.delegationStates.get(fleetId);
    return state?.delegationType === 'AI';
  }

  /**
   * Check if fleet is player controlled
   */
  isPlayerControlled(fleetId: string): boolean {
    const state = this.delegationStates.get(fleetId);
    return state?.delegationType === 'PLAYER';
  }

  /**
   * Get AI profile for a fleet
   */
  getAIProfile(fleetId: string): IAIBattleProfile | undefined {
    const state = this.delegationStates.get(fleetId);
    return state?.aiProfile;
  }

  /**
   * Get all AI controlled fleets in a battle
   */
  getAIControlledFleets(battleId: string): string[] {
    const result: string[] = [];
    
    for (const [fleetId, state] of this.delegationStates) {
      if (state.battleId === battleId && state.delegationType === 'AI') {
        result.push(fleetId);
      }
    }
    
    return result;
  }

  /**
   * Get all player controlled fleets in a battle
   */
  getPlayerControlledFleets(battleId: string): string[] {
    const result: string[] = [];
    
    for (const [fleetId, state] of this.delegationStates) {
      if (state.battleId === battleId && 
          (state.delegationType === 'PLAYER' || state.delegationType === 'SUBORDINATE')) {
        result.push(fleetId);
      }
    }
    
    return result;
  }

  /**
   * Get controller socket ID for a fleet
   */
  getControllerSocket(fleetId: string): string | undefined {
    const state = this.delegationStates.get(fleetId);
    return state?.delegatedToSocketId;
  }

  /**
   * Update last command time for a fleet
   */
  updateLastCommand(fleetId: string): void {
    const state = this.delegationStates.get(fleetId);
    if (state) {
      state.lastCommandAt = new Date();
    }
  }

  /**
   * Check if a character can control a fleet
   */
  canControl(fleetId: string, characterId: string): boolean {
    const state = this.delegationStates.get(fleetId);
    if (!state) return false;

    // Owner can always control
    if (state.ownerCharacterId === characterId) return true;

    // Current delegate can control
    if (state.delegatedTo === characterId) return true;

    return false;
  }

  /**
   * Manual delegation request (player delegating to another)
   */
  async requestDelegation(
    sessionId: string,
    battleId: string,
    fleetId: string,
    fromCharacterId: string,
    toCharacterId: string
  ): Promise<IDelegationResult> {
    const state = this.delegationStates.get(fleetId);
    
    if (!state) {
      return { success: false, delegationType: 'PENDING', error: 'No delegation state' };
    }

    // Verify requester can delegate
    if (!this.canControl(fleetId, fromCharacterId)) {
      return { success: false, delegationType: state.delegationType, error: 'Cannot delegate' };
    }

    // Check if target is online
    const targetOnline = await playerPresenceService.isPlayerOnline(sessionId, toCharacterId);
    if (!targetOnline) {
      return { success: false, delegationType: state.delegationType, error: 'Target not online' };
    }

    // Get target character
    const targetChar = await Gin7Character.findOne({ sessionId, characterId: toCharacterId });
    if (!targetChar) {
      return { success: false, delegationType: state.delegationType, error: 'Target not found' };
    }

    // Remove from previous controller
    if (state.delegatedTo) {
      this.removeFleetFromCharacter(state.delegatedTo, fleetId);
    }

    // Update state
    state.delegationType = 'SUBORDINATE';
    state.delegatedTo = toCharacterId;
    state.delegatedToSocketId = targetChar.socketId;
    state.aiProfile = undefined;
    state.aiStrategy = undefined;

    this.addFleetToCharacter(toCharacterId, fleetId);

    this.emit('delegation:manual', {
      sessionId,
      battleId,
      fleetId,
      fromCharacterId,
      toCharacterId
    });

    return {
      success: true,
      delegationType: 'SUBORDINATE',
      controllerId: toCharacterId,
      controllerSocketId: targetChar.socketId
    };
  }

  /**
   * Remove delegation state when battle ends
   */
  removeBattleDelegations(battleId: string): void {
    const toRemove: string[] = [];

    for (const [fleetId, state] of this.delegationStates) {
      if (state.battleId === battleId) {
        toRemove.push(fleetId);
        
        // Clean up character fleet tracking
        if (state.delegatedTo) {
          this.removeFleetFromCharacter(state.delegatedTo, fleetId);
        }
        if (state.delegationType === 'PLAYER' && state.ownerCharacterId) {
          this.removeFleetFromCharacter(state.ownerCharacterId, fleetId);
        }
      }
    }

    for (const fleetId of toRemove) {
      this.delegationStates.delete(fleetId);
    }

    this.emit('delegation:battle_ended', { battleId, removedCount: toRemove.length });
  }

  /**
   * Helper: Add fleet to character's controlled list
   */
  private addFleetToCharacter(characterId: string, fleetId: string): void {
    if (!this.characterFleets.has(characterId)) {
      this.characterFleets.set(characterId, new Set());
    }
    this.characterFleets.get(characterId)!.add(fleetId);
  }

  /**
   * Helper: Remove fleet from character's controlled list
   */
  private removeFleetFromCharacter(characterId: string, fleetId: string): void {
    this.characterFleets.get(characterId)?.delete(fleetId);
  }

  /**
   * Get statistics for delegation service
   */
  getStats(): {
    totalDelegations: number;
    byType: Record<DelegationType, number>;
    byBattle: Map<string, number>;
  } {
    const byType: Record<DelegationType, number> = {
      'PLAYER': 0,
      'SUBORDINATE': 0,
      'AI': 0,
      'PENDING': 0
    };
    const byBattle = new Map<string, number>();

    for (const [_, state] of this.delegationStates) {
      byType[state.delegationType]++;
      
      const battleCount = byBattle.get(state.battleId) || 0;
      byBattle.set(state.battleId, battleCount + 1);
    }

    return {
      totalDelegations: this.delegationStates.size,
      byType,
      byBattle
    };
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.delegationStates.clear();
    this.characterFleets.clear();
    this.removeAllListeners();
  }
}

export const delegationService = DelegationService.getInstance();
export default DelegationService;
