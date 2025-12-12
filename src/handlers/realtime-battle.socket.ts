/**
 * RealtimeBattleSocketHandler
 * 
 * WebSocket handler for realtime fleet battles (gin7)
 * Uses Socket.IO for bidirectional communication
 */

import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from '../middleware/auth';
import { RealtimeBattle, IRealtimeBattle, BATTLE_AREA_SIZES, TICK_RATES } from '../models/gin7/RealtimeBattle';
import { Fleet, IVector3 } from '../models/gin7/Fleet';
import { RealtimeBattleEngine, CommandType, BattleStateSnapshot, BattleEvent } from '../services/gin7/battle/RealtimeBattleEngine';
import { Vector3 } from '../services/gin7/physics/FleetPhysicsEngine';
import { v4 as uuidv4 } from 'uuid';

/**
 * Client command data
 */
interface ClientCommand {
  type: CommandType;
  targetPosition?: IVector3;
  targetFleetId?: string;
  formationType?: string;
  direction?: IVector3;
  heading?: number;
}

/**
 * Battle join data
 */
interface JoinData {
  battleId: string;
  fleetId: string;
}

/**
 * Create battle data
 */
interface CreateBattleData {
  sessionId: string;
  name?: string;
  fleetIds: string[];
  battleAreaSize?: 'SMALL' | 'MEDIUM' | 'LARGE' | 'EPIC';
  tickRate?: number;
  maxTicks?: number;
  rules?: {
    allowRetreat?: boolean;
    retreatDelay?: number;
    friendlyFire?: boolean;
  };
}

/**
 * Connected user info
 */
interface ConnectedUser {
  socketId: string;
  userId: string;
  battleId?: string;
  fleetId?: string;
  joinedAt: Date;
}

/**
 * RealtimeBattleSocketHandler class
 */
export class RealtimeBattleSocketHandler {
  private io: Server;
  private namespace: string = '/rtbattle';
  
  // Active battle engines
  private battleEngines: Map<string, RealtimeBattleEngine> = new Map();
  
  // Connected users
  private connectedUsers: Map<string, ConnectedUser> = new Map();  // socketId -> user
  
  // User to socket mapping (for reconnection)
  private userSockets: Map<string, string> = new Map();  // oddelId -> socketId
  
  // Disconnect grace period
  private disconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private readonly DISCONNECT_GRACE_PERIOD = 30000;  // 30 seconds
  
  // Delta compression state
  private lastBroadcastState: Map<string, BattleStateSnapshot> = new Map();

  constructor(io: Server) {
    this.io = io;
    this.setupNamespace();
  }

  /**
   * Setup Socket.IO namespace
   */
  private setupNamespace(): void {
    const rtBattleNs = this.io.of(this.namespace);
    
    rtBattleNs.use((socket, next) => {
      this.authenticateSocket(socket, next);
    });
    
    rtBattleNs.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * Authenticate socket connection
   */
  private authenticateSocket(socket: Socket, next: (err?: Error) => void): void {
    const authToken = 
      socket.handshake.auth?.token || 
      socket.handshake.headers['x-auth-token'];
    
    if (!authToken) {
      return next(new Error('Authentication token required'));
    }
    
    if (!process.env.JWT_SECRET) {
      return next(new Error('Server configuration error'));
    }
    
    try {
      const decoded = jwt.verify(authToken, process.env.JWT_SECRET) as JwtPayload;
      
      if (!decoded.userId) {
        return next(new Error('Invalid token'));
      }
      
      socket.data.userId = decoded.userId;
      socket.data.sessionId = decoded.sessionId;
      
      next();
    } catch (error) {
      next(new Error('Token verification failed'));
    }
  }

  /**
   * Handle new socket connection
   */
  private handleConnection(socket: Socket): void {
    const userId = socket.data.userId as string;
    
    console.log(`[RTBattle] User connected: ${userId}, socket: ${socket.id}`);
    
    // Cancel any pending disconnect timeout
    this.cancelDisconnectTimeout(userId);
    
    // Track connection
    this.connectedUsers.set(socket.id, {
      socketId: socket.id,
      userId,
      joinedAt: new Date()
    });
    this.userSockets.set(userId, socket.id);
    
    // Register event handlers
    socket.on('rtbattle:create', (data) => this.handleCreate(socket, data));
    socket.on('rtbattle:join', (data) => this.handleJoin(socket, data));
    socket.on('rtbattle:leave', (data) => this.handleLeave(socket, data));
    socket.on('rtbattle:ready', (data) => this.handleReady(socket, data));
    socket.on('rtbattle:command', (data) => this.handleCommand(socket, data));
    socket.on('rtbattle:start', (data) => this.handleStart(socket, data));
    socket.on('rtbattle:pause', (data) => this.handlePause(socket, data));
    socket.on('rtbattle:resume', (data) => this.handleResume(socket, data));
    socket.on('rtbattle:get_state', (data) => this.handleGetState(socket, data));
    socket.on('rtbattle:list', (data) => this.handleList(socket, data));
    socket.on('disconnect', () => this.handleDisconnect(socket));
  }

  /**
   * Handle create battle request
   */
  private async handleCreate(socket: Socket, data: CreateBattleData): Promise<void> {
    try {
      const userId = socket.data.userId as string;
      const { sessionId, name, fleetIds, battleAreaSize = 'MEDIUM', tickRate = 10, maxTicks, rules } = data;
      
      if (!sessionId || !fleetIds || fleetIds.length < 2) {
        socket.emit('rtbattle:error', { message: 'Invalid battle data. Need at least 2 fleets.' });
        return;
      }
      
      // Load fleets and verify ownership/faction
      const fleets = await Fleet.find({ 
        fleetId: { $in: fleetIds },
        sessionId 
      });
      
      if (fleets.length < 2) {
        socket.emit('rtbattle:error', { message: 'Not enough valid fleets found' });
        return;
      }
      
      // Group fleets by faction
      const factionFleets = new Map<string, typeof fleets>();
      for (const fleet of fleets) {
        const existing = factionFleets.get(fleet.factionId) || [];
        existing.push(fleet);
        factionFleets.set(fleet.factionId, existing);
      }
      
      if (factionFleets.size < 2) {
        socket.emit('rtbattle:error', { message: 'Need fleets from at least 2 different factions' });
        return;
      }
      
      // Create battle ID
      const battleId = `rtb_${uuidv4()}`;
      
      // Get battle area
      const battleArea = BATTLE_AREA_SIZES[battleAreaSize];
      
      // Calculate initial positions for each faction
      const factionPositions = this.calculateFactionStartPositions(
        Array.from(factionFleets.keys()),
        battleArea
      );
      
      // Create participants
      const participants = fleets.map(fleet => {
        const factionIndex = Array.from(factionFleets.keys()).indexOf(fleet.factionId);
        const basePosition = factionPositions[factionIndex];
        const offset = this.calculateFleetOffset(factionFleets.get(fleet.factionId)!.indexOf(fleet));
        
        return {
          fleetId: fleet.fleetId,
          faction: fleet.factionId,
          factionId: fleet.factionId,
          isNPC: false,  // TODO: Check if NPC
          joinedAt: new Date(),
          isReady: false,
          isDefeated: false,
          initialPosition: Vector3.add(basePosition, offset),
          shipsLost: 0,
          damageDealt: 0,
          damageTaken: 0
        };
      });
      
      // Create battle document
      const battle = new RealtimeBattle({
        battleId,
        sessionId,
        name: name || `Battle ${battleId.slice(-6)}`,
        status: 'PREPARING',
        tickCount: 0,
        tickRate,
        maxTicks,
        participants,
        maxParticipants: 10,
        battleArea,
        rules: {
          allowRetreat: rules?.allowRetreat ?? true,
          retreatDelay: rules?.retreatDelay ?? 50,
          respawnEnabled: false,
          friendlyFire: rules?.friendlyFire ?? false,
          minParticipants: 2
        }
      });
      
      await battle.save();
      
      // Create and initialize battle engine
      const engine = new RealtimeBattleEngine(battleId, {
        tickRate,
        retreatDelay: rules?.retreatDelay ?? 50
      });
      
      // Setup engine event handlers
      this.setupEngineEventHandlers(engine, battleId);
      
      // Store engine
      this.battleEngines.set(battleId, engine);
      
      // Send response
      socket.emit('rtbattle:created', {
        battleId,
        battle: {
          battleId: battle.battleId,
          sessionId: battle.sessionId,
          name: battle.name,
          status: battle.status,
          participants: battle.participants,
          battleArea: battle.battleArea,
          rules: battle.rules,
          tickRate: battle.tickRate
        }
      });
      
      console.log(`[RTBattle] Battle created: ${battleId} by user ${userId}`);
      
    } catch (error) {
      console.error('[RTBattle] Create error:', error);
      socket.emit('rtbattle:error', { message: 'Failed to create battle' });
    }
  }

  /**
   * Handle join battle request
   */
  private async handleJoin(socket: Socket, data: JoinData): Promise<void> {
    try {
      const userId = socket.data.userId as string;
      const { battleId, fleetId } = data;
      
      // Find battle
      const battle = await RealtimeBattle.findOne({ battleId });
      if (!battle) {
        socket.emit('rtbattle:error', { message: 'Battle not found' });
        return;
      }
      
      // Check if fleet is participant
      const participant = battle.participants.find(p => p.fleetId === fleetId);
      if (!participant) {
        socket.emit('rtbattle:error', { message: 'Fleet is not a participant in this battle' });
        return;
      }
      
      // TODO: Verify fleet ownership
      
      // Update connected user info
      const userInfo = this.connectedUsers.get(socket.id);
      if (userInfo) {
        userInfo.battleId = battleId;
        userInfo.fleetId = fleetId;
      }
      
      // Join socket room
      socket.join(`battle:${battleId}`);
      
      // Get or create engine
      let engine = this.battleEngines.get(battleId);
      if (!engine) {
        engine = new RealtimeBattleEngine(battleId, { tickRate: battle.tickRate });
        this.setupEngineEventHandlers(engine, battleId);
        this.battleEngines.set(battleId, engine);
        await engine.initialize();
      }
      
      // Send current state
      const state = engine.getState();
      socket.emit('rtbattle:joined', {
        battleId,
        fleetId,
        battle: {
          status: battle.status,
          tickCount: battle.tickCount,
          participants: battle.participants,
          battleArea: battle.battleArea,
          rules: battle.rules
        },
        currentState: state
      });
      
      // Notify others
      socket.to(`battle:${battleId}`).emit('rtbattle:player_joined', {
        fleetId,
        userId,
        timestamp: new Date()
      });
      
      console.log(`[RTBattle] User ${userId} joined battle ${battleId} with fleet ${fleetId}`);
      
    } catch (error) {
      console.error('[RTBattle] Join error:', error);
      socket.emit('rtbattle:error', { message: 'Failed to join battle' });
    }
  }

  /**
   * Handle leave battle request
   */
  private async handleLeave(socket: Socket, data: { battleId: string }): Promise<void> {
    try {
      const userId = socket.data.userId as string;
      const { battleId } = data;
      
      const userInfo = this.connectedUsers.get(socket.id);
      const fleetId = userInfo?.fleetId;
      
      // Leave socket room
      socket.leave(`battle:${battleId}`);
      
      // Update user info
      if (userInfo) {
        userInfo.battleId = undefined;
        userInfo.fleetId = undefined;
      }
      
      // Notify others
      this.io.of(this.namespace).to(`battle:${battleId}`).emit('rtbattle:player_left', {
        fleetId,
        userId,
        timestamp: new Date()
      });
      
      console.log(`[RTBattle] User ${userId} left battle ${battleId}`);
      
    } catch (error) {
      console.error('[RTBattle] Leave error:', error);
    }
  }

  /**
   * Handle ready request
   */
  private async handleReady(socket: Socket, data: { battleId: string; fleetId: string; ready: boolean }): Promise<void> {
    try {
      const { battleId, fleetId, ready } = data;
      
      const battle = await RealtimeBattle.findOne({ battleId });
      if (!battle) {
        socket.emit('rtbattle:error', { message: 'Battle not found' });
        return;
      }
      
      // Update participant ready status
      const participant = battle.participants.find(p => p.fleetId === fleetId);
      if (participant) {
        participant.isReady = ready;
        await battle.save();
      }
      
      // Check if all ready
      const allReady = battle.participants.every(p => p.isReady || p.isNPC);
      
      // Broadcast ready status
      this.io.of(this.namespace).to(`battle:${battleId}`).emit('rtbattle:ready_status', {
        fleetId,
        ready,
        allReady,
        readyCount: battle.participants.filter(p => p.isReady).length,
        totalCount: battle.participants.length,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('[RTBattle] Ready error:', error);
      socket.emit('rtbattle:error', { message: 'Failed to set ready status' });
    }
  }

  /**
   * Handle command request
   */
  private async handleCommand(
    socket: Socket, 
    data: { battleId: string; fleetId: string; command: ClientCommand }
  ): Promise<void> {
    try {
      const { battleId, fleetId, command } = data;
      
      const engine = this.battleEngines.get(battleId);
      if (!engine) {
        socket.emit('rtbattle:error', { message: 'Battle engine not found' });
        return;
      }
      
      if (!engine.getIsRunning()) {
        socket.emit('rtbattle:error', { message: 'Battle is not active' });
        return;
      }
      
      // Queue command
      const commandId = engine.queueCommand(fleetId, command.type, {
        targetPosition: command.targetPosition,
        targetFleetId: command.targetFleetId,
        formationType: command.formationType,
        direction: command.direction,
        heading: command.heading
      });
      
      // Acknowledge command
      socket.emit('rtbattle:command_ack', {
        commandId,
        fleetId,
        type: command.type,
        tick: engine.getCurrentTick(),
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('[RTBattle] Command error:', error);
      socket.emit('rtbattle:error', { message: 'Failed to process command' });
    }
  }

  /**
   * Handle start battle request
   */
  private async handleStart(socket: Socket, data: { battleId: string }): Promise<void> {
    try {
      const { battleId } = data;
      
      const engine = this.battleEngines.get(battleId);
      if (!engine) {
        socket.emit('rtbattle:error', { message: 'Battle engine not found' });
        return;
      }
      
      // Initialize if needed
      const battle = await RealtimeBattle.findOne({ battleId });
      if (!battle) {
        socket.emit('rtbattle:error', { message: 'Battle not found' });
        return;
      }
      
      // Check if all ready
      const allReady = battle.participants.every(p => p.isReady || p.isNPC);
      if (!allReady) {
        socket.emit('rtbattle:error', { message: 'Not all participants are ready' });
        return;
      }
      
      // Initialize and start
      await engine.initialize();
      const started = await engine.start();
      
      if (!started) {
        socket.emit('rtbattle:error', { message: 'Failed to start battle' });
        return;
      }
      
      // Broadcast start
      this.io.of(this.namespace).to(`battle:${battleId}`).emit('rtbattle:started', {
        battleId,
        tick: engine.getCurrentTick(),
        timestamp: new Date()
      });
      
      console.log(`[RTBattle] Battle started: ${battleId}`);
      
    } catch (error) {
      console.error('[RTBattle] Start error:', error);
      socket.emit('rtbattle:error', { message: 'Failed to start battle' });
    }
  }

  /**
   * Handle pause request
   */
  private async handlePause(socket: Socket, data: { battleId: string }): Promise<void> {
    try {
      const { battleId } = data;
      
      const engine = this.battleEngines.get(battleId);
      if (!engine) {
        socket.emit('rtbattle:error', { message: 'Battle engine not found' });
        return;
      }
      
      await engine.pause();
      
      this.io.of(this.namespace).to(`battle:${battleId}`).emit('rtbattle:paused', {
        battleId,
        tick: engine.getCurrentTick(),
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('[RTBattle] Pause error:', error);
      socket.emit('rtbattle:error', { message: 'Failed to pause battle' });
    }
  }

  /**
   * Handle resume request
   */
  private async handleResume(socket: Socket, data: { battleId: string }): Promise<void> {
    try {
      const { battleId } = data;
      
      const engine = this.battleEngines.get(battleId);
      if (!engine) {
        socket.emit('rtbattle:error', { message: 'Battle engine not found' });
        return;
      }
      
      const resumed = await engine.resume();
      
      if (resumed) {
        this.io.of(this.namespace).to(`battle:${battleId}`).emit('rtbattle:resumed', {
          battleId,
          tick: engine.getCurrentTick(),
          timestamp: new Date()
        });
      }
      
    } catch (error) {
      console.error('[RTBattle] Resume error:', error);
      socket.emit('rtbattle:error', { message: 'Failed to resume battle' });
    }
  }

  /**
   * Handle get state request
   */
  private async handleGetState(socket: Socket, data: { battleId: string }): Promise<void> {
    try {
      const { battleId } = data;
      
      const engine = this.battleEngines.get(battleId);
      if (!engine) {
        // Try to load from database
        const battle = await RealtimeBattle.findOne({ battleId });
        if (!battle) {
          socket.emit('rtbattle:error', { message: 'Battle not found' });
          return;
        }
        
        socket.emit('rtbattle:state', {
          battleId,
          status: battle.status,
          tickCount: battle.tickCount,
          participants: battle.participants,
          result: battle.result
        });
        return;
      }
      
      const state = engine.getState();
      socket.emit('rtbattle:state', state);
      
    } catch (error) {
      console.error('[RTBattle] Get state error:', error);
      socket.emit('rtbattle:error', { message: 'Failed to get state' });
    }
  }

  /**
   * Handle list battles request
   */
  private async handleList(socket: Socket, data: { sessionId: string; status?: string }): Promise<void> {
    try {
      const { sessionId, status } = data;
      
      const query: any = { sessionId };
      if (status) {
        query.status = status;
      }
      
      const battles = await RealtimeBattle.find(query)
        .select('battleId name status tickCount participants createdAt')
        .sort({ createdAt: -1 })
        .limit(50);
      
      socket.emit('rtbattle:list', {
        battles: battles.map(b => ({
          battleId: b.battleId,
          name: b.name,
          status: b.status,
          tickCount: b.tickCount,
          participantCount: b.participants.length,
          createdAt: b.createdAt
        }))
      });
      
    } catch (error) {
      console.error('[RTBattle] List error:', error);
      socket.emit('rtbattle:error', { message: 'Failed to list battles' });
    }
  }

  /**
   * Handle socket disconnect
   */
  private handleDisconnect(socket: Socket): void {
    const userId = socket.data.userId as string;
    const userInfo = this.connectedUsers.get(socket.id);
    
    console.log(`[RTBattle] User disconnected: ${userId}, socket: ${socket.id}`);
    
    // Set disconnect timeout (allow reconnection)
    if (userInfo?.battleId) {
      const timeout = setTimeout(() => {
        this.handleDisconnectTimeout(userId, userInfo.battleId!, userInfo.fleetId);
      }, this.DISCONNECT_GRACE_PERIOD);
      
      this.disconnectTimeouts.set(userId, timeout);
      
      // Notify others of temporary disconnect
      this.io.of(this.namespace).to(`battle:${userInfo.battleId}`).emit('rtbattle:player_disconnected', {
        fleetId: userInfo.fleetId,
        userId,
        temporary: true,
        gracePeriod: this.DISCONNECT_GRACE_PERIOD,
        timestamp: new Date()
      });
    }
    
    // Clean up
    this.connectedUsers.delete(socket.id);
    if (userId) {
      this.userSockets.delete(userId);
    }
  }

  /**
   * Handle disconnect timeout (player didn't reconnect)
   */
  private handleDisconnectTimeout(userId: string, battleId: string, fleetId?: string): void {
    console.log(`[RTBattle] Disconnect timeout for user ${userId} in battle ${battleId}`);
    
    this.disconnectTimeouts.delete(userId);
    
    // Notify others
    this.io.of(this.namespace).to(`battle:${battleId}`).emit('rtbattle:player_left', {
      fleetId,
      userId,
      reason: 'disconnect_timeout',
      timestamp: new Date()
    });
    
    // TODO: Handle fleet AI takeover or forfeit
  }

  /**
   * Cancel disconnect timeout
   */
  private cancelDisconnectTimeout(userId: string): void {
    const timeout = this.disconnectTimeouts.get(userId);
    if (timeout) {
      clearTimeout(timeout);
      this.disconnectTimeouts.delete(userId);
    }
  }

  /**
   * Setup engine event handlers
   */
  private setupEngineEventHandlers(engine: RealtimeBattleEngine, battleId: string): void {
    // Tick event - broadcast state
    engine.on('tick', (snapshot: BattleStateSnapshot) => {
      this.broadcastState(battleId, snapshot);
    });
    
    // Battle ended
    engine.on('ended', (data: { battleId: string; tick: number; reason: string; winner?: string }) => {
      this.io.of(this.namespace).to(`battle:${battleId}`).emit('rtbattle:ended', {
        ...data,
        timestamp: new Date()
      });
      
      // Clean up engine after delay
      setTimeout(() => {
        this.battleEngines.delete(battleId);
        this.lastBroadcastState.delete(battleId);
      }, 60000);  // Keep for 1 minute for late joiners to see result
    });
    
    // Battle paused
    engine.on('paused', (data: { battleId: string; tick: number }) => {
      this.io.of(this.namespace).to(`battle:${battleId}`).emit('rtbattle:paused', {
        ...data,
        timestamp: new Date()
      });
    });
  }

  /**
   * Broadcast state with delta compression
   */
  private broadcastState(battleId: string, snapshot: BattleStateSnapshot): void {
    const lastState = this.lastBroadcastState.get(battleId);
    
    // Send full state every 10 ticks or on events
    const sendFull = !lastState || 
      snapshot.tick % 10 === 0 || 
      snapshot.events.length > 0;
    
    if (sendFull) {
      this.io.of(this.namespace).to(`battle:${battleId}`).emit('rtbattle:state', snapshot);
      this.lastBroadcastState.set(battleId, snapshot);
      return;
    }
    
    // Calculate delta
    const delta = this.calculateStateDelta(lastState, snapshot);
    
    if (delta) {
      this.io.of(this.namespace).to(`battle:${battleId}`).emit('rtbattle:state_delta', {
        battleId,
        tick: snapshot.tick,
        timestamp: snapshot.timestamp,
        delta
      });
    }
    
    this.lastBroadcastState.set(battleId, snapshot);
  }

  /**
   * Calculate state delta (changed fleets only)
   */
  private calculateStateDelta(
    oldState: BattleStateSnapshot, 
    newState: BattleStateSnapshot
  ): any | null {
    const changedFleets: any[] = [];
    
    for (const newFleet of newState.fleets) {
      const oldFleet = oldState.fleets.find(f => f.fleetId === newFleet.fleetId);
      
      if (!oldFleet || this.hasFleetChanged(oldFleet, newFleet)) {
        changedFleets.push(newFleet);
      }
    }
    
    if (changedFleets.length === 0) {
      return null;
    }
    
    return { fleets: changedFleets };
  }

  /**
   * Check if fleet state has changed
   */
  private hasFleetChanged(oldFleet: any, newFleet: any): boolean {
    // Position change threshold
    const posThreshold = 0.5;
    const posChanged = 
      Math.abs(oldFleet.position.x - newFleet.position.x) > posThreshold ||
      Math.abs(oldFleet.position.y - newFleet.position.y) > posThreshold ||
      Math.abs(oldFleet.position.z - newFleet.position.z) > posThreshold;
    
    // Other changes
    return posChanged ||
      oldFleet.hp !== newFleet.hp ||
      oldFleet.ships !== newFleet.ships ||
      oldFleet.heading !== newFleet.heading ||
      oldFleet.isDefeated !== newFleet.isDefeated ||
      oldFleet.isRetreating !== newFleet.isRetreating;
  }

  /**
   * Calculate starting positions for each faction
   */
  private calculateFactionStartPositions(
    factions: string[], 
    battleArea: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number; center: IVector3 }
  ): IVector3[] {
    const positions: IVector3[] = [];
    const count = factions.length;
    const radius = (battleArea.maxX - battleArea.minX) * 0.35;  // 35% of arena width
    
    for (let i = 0; i < count; i++) {
      const angle = (2 * Math.PI * i) / count - Math.PI / 2;  // Start from top
      positions.push({
        x: Math.round(Math.cos(angle) * radius),
        y: Math.round(Math.sin(angle) * radius),
        z: 0
      });
    }
    
    return positions;
  }

  /**
   * Calculate offset for fleet within faction group
   */
  private calculateFleetOffset(index: number): IVector3 {
    const offset = 80;  // Distance between fleets in same faction
    const row = Math.floor(index / 3);
    const col = index % 3;
    
    return {
      x: (col - 1) * offset,
      y: row * offset,
      z: 0
    };
  }

  /**
   * Get active battle count
   */
  getActiveBattleCount(): number {
    return this.battleEngines.size;
  }

  /**
   * Get connected user count
   */
  getConnectedUserCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    // Stop all engines
    for (const [_, engine] of this.battleEngines) {
      engine.destroy();
    }
    this.battleEngines.clear();
    
    // Clear timeouts
    for (const [_, timeout] of this.disconnectTimeouts) {
      clearTimeout(timeout);
    }
    this.disconnectTimeouts.clear();
    
    // Clear state
    this.connectedUsers.clear();
    this.userSockets.clear();
    this.lastBroadcastState.clear();
  }
}

export default RealtimeBattleSocketHandler;
