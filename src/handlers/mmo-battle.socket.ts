/**
 * MMO-Battle Socket Handler
 * 
 * Extends RealtimeBattleSocketHandler with MMO-specific events:
 * - mmo:battle_available - Notify when battle can be initiated
 * - mmo:battle_started - Notify when battle starts
 * - mmo:fleet_updated - Fleet state changed
 * - mmo:battle_ended - Battle result notification
 * - mmo:encounter_detected - Hostile fleet encounter
 */

import { Server, Socket } from 'socket.io';
import { EventEmitter } from 'events';
import { gridService } from '../services/gin7/GridService';
import { battleInitiationService } from '../services/gin7/battle/BattleInitiationService';
import { battleResultService } from '../services/gin7/battle/BattleResultService';
import { Gin7Character } from '../models/gin7/Character';
import { Fleet } from '../models/gin7/Fleet';
import { GalaxyGrid } from '../models/gin7/GalaxyGrid';

/**
 * MMO-Battle namespace events
 */
interface MMOBattleEvents {
  'mmo:battle_available': {
    sessionId: string;
    gridId: string;
    x: number;
    y: number;
    factions: string[];
    fleetCount: number;
  };
  'mmo:battle_started': {
    sessionId: string;
    battleId: string;
    gridX: number;
    gridY: number;
    factions: string[];
    participants: Array<{ fleetId: string; factionId: string }>;
  };
  'mmo:fleet_updated': {
    sessionId: string;
    fleetId: string;
    update: {
      gridId?: string;
      status?: string;
      totalShips?: number;
    };
  };
  'mmo:battle_ended': {
    sessionId: string;
    battleId: string;
    gridX: number;
    gridY: number;
    winner?: string;
    endReason: string;
    participantResults: Array<{
      fleetId: string;
      survived: boolean;
      shipsLost: number;
    }>;
  };
  'mmo:encounter_detected': {
    sessionId: string;
    gridId: string;
    x: number;
    y: number;
    factions: string[];
    fleets: Array<{ fleetId: string; factionId: string; unitCount: number }>;
  };
}

/**
 * Player presence tracking
 */
interface PlayerPresence {
  socketId: string;
  sessionId: string;
  characterId: string;
  factionId?: string;
  lastActiveAt: Date;
}

/**
 * MMO-Battle Socket Handler
 */
export class MMOBattleSocketHandler {
  private io: Server;
  private namespace: string = '/mmo';
  
  // Player presence tracking
  private playerPresence: Map<string, PlayerPresence> = new Map();  // socketId -> presence
  private characterSockets: Map<string, string> = new Map();  // characterId -> socketId
  
  // Session rooms
  private sessionPlayers: Map<string, Set<string>> = new Map();  // sessionId -> socketIds

  constructor(io: Server) {
    this.io = io;
    this.setupNamespace();
    this.setupServiceEventHandlers();
  }

  /**
   * Setup Socket.IO namespace
   */
  private setupNamespace(): void {
    const mmoNs = this.io.of(this.namespace);
    
    mmoNs.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * Handle new socket connection
   */
  private handleConnection(socket: Socket): void {
    console.log(`[MMO] Socket connected: ${socket.id}`);
    
    // Register event handlers
    socket.on('mmo:join_session', (data) => this.handleJoinSession(socket, data));
    socket.on('mmo:leave_session', (data) => this.handleLeaveSession(socket, data));
    socket.on('mmo:set_character', (data) => this.handleSetCharacter(socket, data));
    socket.on('mmo:subscribe_grid', (data) => this.handleSubscribeGrid(socket, data));
    socket.on('mmo:unsubscribe_grid', (data) => this.handleUnsubscribeGrid(socket, data));
    socket.on('mmo:get_grid_state', (data) => this.handleGetGridState(socket, data));
    socket.on('mmo:heartbeat', () => this.handleHeartbeat(socket));
    socket.on('disconnect', () => this.handleDisconnect(socket));
  }

  /**
   * Handle join session request
   */
  private async handleJoinSession(
    socket: Socket, 
    data: { sessionId: string; characterId?: string }
  ): Promise<void> {
    try {
      const { sessionId, characterId } = data;
      
      if (!sessionId) {
        socket.emit('mmo:error', { message: 'sessionId required' });
        return;
      }
      
      // Join session room
      socket.join(`session:${sessionId}`);
      
      // Track presence
      const presence: PlayerPresence = {
        socketId: socket.id,
        sessionId,
        characterId: characterId || '',
        lastActiveAt: new Date()
      };
      this.playerPresence.set(socket.id, presence);
      
      // Track session players
      if (!this.sessionPlayers.has(sessionId)) {
        this.sessionPlayers.set(sessionId, new Set());
      }
      this.sessionPlayers.get(sessionId)!.add(socket.id);
      
      // Update character online status
      if (characterId) {
        await this.setCharacterOnline(sessionId, characterId, socket.id, true);
        this.characterSockets.set(characterId, socket.id);
      }
      
      socket.emit('mmo:session_joined', {
        sessionId,
        characterId,
        playerCount: this.sessionPlayers.get(sessionId)?.size || 0
      });
      
      console.log(`[MMO] Socket ${socket.id} joined session ${sessionId}`);
      
    } catch (error: any) {
      console.error('[MMO] Join session error:', error);
      socket.emit('mmo:error', { message: error.message });
    }
  }

  /**
   * Handle leave session request
   */
  private async handleLeaveSession(socket: Socket, data: { sessionId: string }): Promise<void> {
    try {
      const { sessionId } = data;
      const presence = this.playerPresence.get(socket.id);
      
      // Leave session room
      socket.leave(`session:${sessionId}`);
      
      // Update tracking
      this.sessionPlayers.get(sessionId)?.delete(socket.id);
      
      // Update character online status
      if (presence?.characterId) {
        await this.setCharacterOnline(sessionId, presence.characterId, socket.id, false);
        this.characterSockets.delete(presence.characterId);
      }
      
      this.playerPresence.delete(socket.id);
      
      console.log(`[MMO] Socket ${socket.id} left session ${sessionId}`);
      
    } catch (error: any) {
      console.error('[MMO] Leave session error:', error);
    }
  }

  /**
   * Handle set character request (for multi-character accounts)
   */
  private async handleSetCharacter(
    socket: Socket, 
    data: { sessionId: string; characterId: string }
  ): Promise<void> {
    try {
      const { sessionId, characterId } = data;
      const presence = this.playerPresence.get(socket.id);
      
      if (!presence) {
        socket.emit('mmo:error', { message: 'Not in session' });
        return;
      }
      
      // Update old character if different
      if (presence.characterId && presence.characterId !== characterId) {
        await this.setCharacterOnline(sessionId, presence.characterId, socket.id, false);
        this.characterSockets.delete(presence.characterId);
      }
      
      // Update new character
      presence.characterId = characterId;
      await this.setCharacterOnline(sessionId, characterId, socket.id, true);
      this.characterSockets.set(characterId, socket.id);
      
      // Get character info
      const character = await Gin7Character.findOne({ sessionId, characterId });
      presence.factionId = character?.factionId;
      
      socket.emit('mmo:character_set', {
        characterId,
        factionId: presence.factionId
      });
      
    } catch (error: any) {
      console.error('[MMO] Set character error:', error);
      socket.emit('mmo:error', { message: error.message });
    }
  }

  /**
   * Handle subscribe to grid updates
   */
  private async handleSubscribeGrid(
    socket: Socket, 
    data: { sessionId: string; gridId: string }
  ): Promise<void> {
    try {
      const { sessionId, gridId } = data;
      
      // Join grid room
      socket.join(`grid:${sessionId}:${gridId}`);
      
      // Send current state
      const [, x, y] = gridId.split('_').map(Number);
      if (!isNaN(x) && !isNaN(y)) {
        const summary = await gridService.getGridSummary(sessionId, x, y);
        if (summary) {
          socket.emit('mmo:grid_state', {
            sessionId,
            gridId,
            state: summary
          });
        }
      }
      
    } catch (error: any) {
      console.error('[MMO] Subscribe grid error:', error);
      socket.emit('mmo:error', { message: error.message });
    }
  }

  /**
   * Handle unsubscribe from grid updates
   */
  private handleUnsubscribeGrid(
    socket: Socket, 
    data: { sessionId: string; gridId: string }
  ): void {
    const { sessionId, gridId } = data;
    socket.leave(`grid:${sessionId}:${gridId}`);
  }

  /**
   * Handle get grid state request
   */
  private async handleGetGridState(
    socket: Socket, 
    data: { sessionId: string; x: number; y: number }
  ): Promise<void> {
    try {
      const { sessionId, x, y } = data;
      
      const summary = await gridService.getGridSummary(sessionId, x, y);
      
      socket.emit('mmo:grid_state', {
        sessionId,
        gridId: `grid_${x}_${y}`,
        state: summary
      });
      
    } catch (error: any) {
      console.error('[MMO] Get grid state error:', error);
      socket.emit('mmo:error', { message: error.message });
    }
  }

  /**
   * Handle heartbeat
   */
  private handleHeartbeat(socket: Socket): void {
    const presence = this.playerPresence.get(socket.id);
    if (presence) {
      presence.lastActiveAt = new Date();
    }
    socket.emit('mmo:heartbeat_ack', { timestamp: Date.now() });
  }

  /**
   * Handle socket disconnect
   */
  private async handleDisconnect(socket: Socket): Promise<void> {
    try {
      const presence = this.playerPresence.get(socket.id);
      
      if (presence) {
        // Update character online status
        if (presence.characterId) {
          await this.setCharacterOnline(
            presence.sessionId, 
            presence.characterId, 
            socket.id, 
            false
          );
          this.characterSockets.delete(presence.characterId);
        }
        
        // Remove from session tracking
        this.sessionPlayers.get(presence.sessionId)?.delete(socket.id);
        this.playerPresence.delete(socket.id);
      }
      
      console.log(`[MMO] Socket disconnected: ${socket.id}`);
      
    } catch (error) {
      console.error('[MMO] Disconnect error:', error);
    }
  }

  /**
   * Setup service event handlers
   */
  private setupServiceEventHandlers(): void {
    // GridService events
    gridService.on('encounter:detected', (data) => {
      this.broadcastEncounterDetected(data);
    });
    
    gridService.on('battle:pending', (data) => {
      this.broadcastBattleAvailable(data);
    });
    
    gridService.on('fleet:moved', (data) => {
      this.broadcastFleetMoved(data);
    });
    
    // BattleInitiationService events
    battleInitiationService.on('battle:created', (data) => {
      this.broadcastBattleStarted(data);
    });
    
    battleInitiationService.on('battle:reinforcement', (data) => {
      this.broadcastReinforcement(data);
    });
    
    // BattleResultService events
    battleResultService.on('battle:ended', (data) => {
      this.broadcastBattleEnded(data);
    });
    
    battleResultService.on('fleet:updated', (data) => {
      this.broadcastFleetUpdated(data);
    });
    
    battleResultService.on('fleet:destroyed', (data) => {
      this.broadcastFleetDestroyed(data);
    });
  }

  /**
   * Broadcast encounter detected
   */
  private broadcastEncounterDetected(data: {
    sessionId: string;
    gridId: string;
    x: number;
    y: number;
    factions: string[];
    fleets: any[];
  }): void {
    const room = `session:${data.sessionId}`;
    
    this.io.of(this.namespace).to(room).emit('mmo:encounter_detected', {
      sessionId: data.sessionId,
      gridId: data.gridId,
      x: data.x,
      y: data.y,
      factions: data.factions,
      fleets: data.fleets.map(f => ({
        fleetId: f.fleetId,
        factionId: f.factionId,
        unitCount: f.unitCount
      }))
    });
    
    // Also send to specific grid subscribers
    const gridRoom = `grid:${data.sessionId}:${data.gridId}`;
    this.io.of(this.namespace).to(gridRoom).emit('mmo:grid_encounter', data);
  }

  /**
   * Broadcast battle available
   */
  private broadcastBattleAvailable(data: {
    sessionId: string;
    gridId: string;
    x: number;
    y: number;
    factions: string[];
    fleetCount: number;
  }): void {
    const room = `session:${data.sessionId}`;
    
    this.io.of(this.namespace).to(room).emit('mmo:battle_available', {
      sessionId: data.sessionId,
      gridId: data.gridId,
      x: data.x,
      y: data.y,
      factions: data.factions,
      fleetCount: data.fleetCount
    });
  }

  /**
   * Broadcast battle started
   */
  private broadcastBattleStarted(data: {
    battleId: string;
    sessionId: string;
    gridX: number;
    gridY: number;
    factions: string[];
    participants: Array<{ fleetId: string; factionId: string }>;
  }): void {
    const room = `session:${data.sessionId}`;
    
    this.io.of(this.namespace).to(room).emit('mmo:battle_started', {
      sessionId: data.sessionId,
      battleId: data.battleId,
      gridX: data.gridX,
      gridY: data.gridY,
      factions: data.factions,
      participants: data.participants
    });
    
    // Also send to specific grid subscribers
    const gridRoom = `grid:${data.sessionId}:grid_${data.gridX}_${data.gridY}`;
    this.io.of(this.namespace).to(gridRoom).emit('mmo:grid_battle_started', data);
  }

  /**
   * Broadcast reinforcement joined
   */
  private broadcastReinforcement(data: {
    battleId: string;
    sessionId: string;
    fleetId: string;
    factionId: string;
  }): void {
    const room = `session:${data.sessionId}`;
    
    this.io.of(this.namespace).to(room).emit('mmo:reinforcement_joined', data);
  }

  /**
   * Broadcast battle ended
   */
  private broadcastBattleEnded(data: any): void {
    const room = `session:${data.sessionId}`;
    
    this.io.of(this.namespace).to(room).emit('mmo:battle_ended', {
      sessionId: data.sessionId,
      battleId: data.battleId,
      gridX: data.gridX,
      gridY: data.gridY,
      winner: data.winner,
      endReason: data.endReason,
      participantResults: data.participantResults.map((p: any) => ({
        fleetId: p.fleetId,
        survived: p.survived,
        shipsLost: p.shipsLost
      }))
    });
  }

  /**
   * Broadcast fleet moved
   */
  private broadcastFleetMoved(data: {
    sessionId: string;
    fleetId: string;
    from: { x: number; y: number } | null;
    to: { x: number; y: number };
  }): void {
    const room = `session:${data.sessionId}`;
    
    this.io.of(this.namespace).to(room).emit('mmo:fleet_moved', data);
    
    // Send to both grid rooms
    if (data.from) {
      const fromRoom = `grid:${data.sessionId}:grid_${data.from.x}_${data.from.y}`;
      this.io.of(this.namespace).to(fromRoom).emit('mmo:grid_fleet_left', {
        fleetId: data.fleetId,
        destination: data.to
      });
    }
    
    const toRoom = `grid:${data.sessionId}:grid_${data.to.x}_${data.to.y}`;
    this.io.of(this.namespace).to(toRoom).emit('mmo:grid_fleet_arrived', {
      fleetId: data.fleetId,
      from: data.from
    });
  }

  /**
   * Broadcast fleet updated
   */
  private broadcastFleetUpdated(data: {
    sessionId: string;
    fleetId: string;
    update: any;
  }): void {
    const room = `session:${data.sessionId}`;
    
    this.io.of(this.namespace).to(room).emit('mmo:fleet_updated', {
      sessionId: data.sessionId,
      fleetId: data.fleetId,
      update: data.update
    });
  }

  /**
   * Broadcast fleet destroyed
   */
  private broadcastFleetDestroyed(data: {
    sessionId: string;
    fleetId: string;
    commanderId: string;
  }): void {
    const room = `session:${data.sessionId}`;
    
    this.io.of(this.namespace).to(room).emit('mmo:fleet_destroyed', data);
  }

  /**
   * Set character online status
   */
  private async setCharacterOnline(
    sessionId: string, 
    characterId: string, 
    socketId: string,
    online: boolean
  ): Promise<void> {
    try {
      await Gin7Character.findOneAndUpdate(
        { sessionId, characterId },
        { 
          isOnline: online,
          lastActiveAt: new Date(),
          socketId: online ? socketId : undefined
        }
      );
    } catch (error) {
      console.error('[MMO] Set character online error:', error);
    }
  }

  /**
   * Get online player count for session
   */
  getOnlinePlayerCount(sessionId: string): number {
    return this.sessionPlayers.get(sessionId)?.size || 0;
  }

  /**
   * Check if character is online
   */
  isCharacterOnline(characterId: string): boolean {
    return this.characterSockets.has(characterId);
  }

  /**
   * Send direct message to character
   */
  sendToCharacter(characterId: string, event: string, data: any): boolean {
    const socketId = this.characterSockets.get(characterId);
    if (socketId) {
      this.io.of(this.namespace).to(socketId).emit(event, data);
      return true;
    }
    return false;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.playerPresence.clear();
    this.characterSockets.clear();
    this.sessionPlayers.clear();
  }
}

export default MMOBattleSocketHandler;
