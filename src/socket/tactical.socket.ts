/**
 * TacticalSocketHandler - Socket.io /tactical 네임스페이스 핸들러
 * 
 * RTS 전투의 실시간 통신을 담당합니다.
 */

import { Server as SocketIOServer, Socket, Namespace } from 'socket.io';
import { logger } from '../common/logger';
import { 
  TacticalSession, 
  tacticalSessionManager 
} from '../services/gin7/TacticalSession';
import { 
  TacticalCommand,
  BattleStartEvent,
  BattleUpdateEvent,
  BattleEndEvent,
  UnitDestroyedEvent,
  DamageEvent,
} from '../types/gin7/tactical.types';
import { Fleet } from '../models/gin7/Fleet';

// ============================================================
// Socket Event Types
// ============================================================

// Client -> Server
interface ClientToServerEvents {
  // Lobby events
  'tactical:join': (data: { battleId: string }) => void;
  'tactical:leave': (data: { battleId: string }) => void;
  'tactical:ready': (data: { battleId: string; ready: boolean }) => void;
  
  // Game events
  'tactical:command': (data: { battleId: string; command: TacticalCommand }) => void;
  'tactical:ping': (data: { battleId: string; timestamp: number }) => void;
  
  // Request snapshot
  'tactical:request_snapshot': (data: { battleId: string }) => void;
}

// Server -> Client
interface ServerToClientEvents {
  // Connection events
  'tactical:connected': (data: { socketId: string }) => void;
  'tactical:joined': (data: { battleId: string; snapshot: BattleUpdateEvent | null }) => void;
  'tactical:left': (data: { battleId: string }) => void;
  
  // GIN7 API Contract Events
  'GIN7:BATTLE_START': (data: BattleStartEvent) => void;
  'GIN7:BATTLE_UPDATE': (data: BattleUpdateEvent) => void;
  'GIN7:BATTLE_END': (data: BattleEndEvent) => void;
  
  // Additional events
  'tactical:unit_destroyed': (data: UnitDestroyedEvent) => void;
  'tactical:damage': (data: DamageEvent) => void;
  'tactical:pong': (data: { battleId: string; timestamp: number; serverTime: number }) => void;
  'tactical:error': (data: { code: string; message: string }) => void;
  
  // Snapshot response
  'tactical:snapshot': (data: { battleId: string; snapshot: BattleUpdateEvent }) => void;
}

// Socket Data
interface SocketData {
  userId?: string;
  factionId?: string;
  commanderId?: string;
  sessionId?: string;
  activeBattles: Set<string>;
}

// ============================================================
// TacticalSocketHandler
// ============================================================

export class TacticalSocketHandler {
  private io: SocketIOServer;
  private tacticalNs: Namespace<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;
  
  constructor(io: SocketIOServer) {
    this.io = io;
    
    // Create /tactical namespace
    this.tacticalNs = io.of('/tactical') as Namespace<
      ClientToServerEvents, 
      ServerToClientEvents, 
      {}, 
      SocketData
    >;
    
    // Setup namespace
    this.setupNamespace();
    
    logger.info('[TacticalSocket] /tactical namespace initialized');
  }
  
  // ============================================================
  // Namespace Setup
  // ============================================================
  
  private setupNamespace(): void {
    // Authentication middleware
    this.tacticalNs.use(async (socket, next) => {
      try {
        // Get user info from handshake
        const sessionId = socket.handshake.query?.sessionId as string;
        const factionId = socket.handshake.query?.factionId as string;
        const commanderId = socket.handshake.query?.commanderId as string;
        const userId = socket.handshake.auth?.userId as string;
        
        if (!sessionId) {
          return next(new Error('sessionId is required'));
        }
        
        // Store in socket data
        socket.data.sessionId = sessionId;
        socket.data.factionId = factionId;
        socket.data.commanderId = commanderId;
        socket.data.userId = userId;
        socket.data.activeBattles = new Set();
        
        next();
      } catch (error) {
        logger.error('[TacticalSocket] Auth error', { error });
        next(new Error('Authentication failed'));
      }
    });
    
    // Connection handler
    this.tacticalNs.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }
  
  // ============================================================
  // Connection Handler
  // ============================================================
  
  private handleConnection(socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>): void {
    logger.info('[TacticalSocket] Client connected', {
      socketId: socket.id,
      sessionId: socket.data.sessionId,
      factionId: socket.data.factionId,
    });
    
    // Send connected acknowledgment
    socket.emit('tactical:connected', { socketId: socket.id });
    
    // Register event handlers
    socket.on('tactical:join', (data) => this.handleJoin(socket, data));
    socket.on('tactical:leave', (data) => this.handleLeave(socket, data));
    socket.on('tactical:ready', (data) => this.handleReady(socket, data));
    socket.on('tactical:command', (data) => this.handleCommand(socket, data));
    socket.on('tactical:ping', (data) => this.handlePing(socket, data));
    socket.on('tactical:request_snapshot', (data) => this.handleRequestSnapshot(socket, data));
    
    // Disconnect handler
    socket.on('disconnect', (reason) => {
      this.handleDisconnect(socket, reason);
    });
  }
  
  // ============================================================
  // Event Handlers
  // ============================================================
  
  private handleJoin(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
    data: { battleId: string }
  ): void {
    const { battleId } = data;
    const session = tacticalSessionManager.getSession(battleId);
    
    if (!session) {
      socket.emit('tactical:error', {
        code: 'GIN7_E005',
        message: 'Battle not found',
      });
      return;
    }
    
    // Join battle room
    socket.join(`battle:${battleId}`);
    socket.data.activeBattles.add(battleId);
    
    // Subscribe to session events if not already
    this.subscribeToSession(session);
    
    // Send current snapshot
    const snapshot = session.getStatus() !== 'WAITING' ? session.getSnapshot() : null;
    socket.emit('tactical:joined', { battleId, snapshot });
    
    logger.debug('[TacticalSocket] Client joined battle', {
      socketId: socket.id,
      battleId,
      status: session.getStatus(),
    });
  }
  
  private handleLeave(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
    data: { battleId: string }
  ): void {
    const { battleId } = data;
    
    socket.leave(`battle:${battleId}`);
    socket.data.activeBattles.delete(battleId);
    socket.emit('tactical:left', { battleId });
    
    logger.debug('[TacticalSocket] Client left battle', {
      socketId: socket.id,
      battleId,
    });
  }
  
  private handleReady(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
    data: { battleId: string; ready: boolean }
  ): void {
    const { battleId, ready } = data;
    const session = tacticalSessionManager.getSession(battleId);
    
    if (!session) {
      socket.emit('tactical:error', {
        code: 'GIN7_E005',
        message: 'Battle not found',
      });
      return;
    }
    
    const factionId = socket.data.factionId;
    if (!factionId) {
      socket.emit('tactical:error', {
        code: 'GIN7_E002',
        message: 'Faction ID required',
      });
      return;
    }
    
    try {
      session.setParticipantReady(factionId, ready);
    } catch (error: any) {
      socket.emit('tactical:error', {
        code: 'GIN7_E005',
        message: error.message,
      });
    }
  }
  
  private handleCommand(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
    data: { battleId: string; command: TacticalCommand }
  ): void {
    const { battleId, command } = data;
    const session = tacticalSessionManager.getSession(battleId);
    
    if (!session) {
      socket.emit('tactical:error', {
        code: 'GIN7_E005',
        message: 'Battle not found',
      });
      return;
    }
    
    const factionId = socket.data.factionId;
    const commanderId = socket.data.commanderId;
    
    if (!factionId || !commanderId) {
      socket.emit('tactical:error', {
        code: 'GIN7_E002',
        message: 'Faction and Commander ID required',
      });
      return;
    }
    
    // Queue command (server is authoritative)
    const success = session.queueCommand(factionId, commanderId, command);
    
    if (!success) {
      socket.emit('tactical:error', {
        code: 'GIN7_E002',
        message: 'Invalid command - no valid units',
      });
    }
  }
  
  private handlePing(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
    data: { battleId: string; timestamp: number }
  ): void {
    socket.emit('tactical:pong', {
      battleId: data.battleId,
      timestamp: data.timestamp,
      serverTime: Date.now(),
    });
  }
  
  private handleRequestSnapshot(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
    data: { battleId: string }
  ): void {
    const { battleId } = data;
    const session = tacticalSessionManager.getSession(battleId);
    
    if (!session) {
      socket.emit('tactical:error', {
        code: 'GIN7_E005',
        message: 'Battle not found',
      });
      return;
    }
    
    const snapshot = session.getSnapshot();
    socket.emit('tactical:snapshot', { battleId, snapshot });
  }
  
  private handleDisconnect(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
    reason: string
  ): void {
    // Leave all active battles
    for (const battleId of socket.data.activeBattles) {
      socket.leave(`battle:${battleId}`);
    }
    
    logger.info('[TacticalSocket] Client disconnected', {
      socketId: socket.id,
      reason,
      activeBattles: Array.from(socket.data.activeBattles),
    });
  }
  
  // ============================================================
  // Session Event Subscription
  // ============================================================
  
  private subscribedSessions: Set<string> = new Set();
  
  private subscribeToSession(session: TacticalSession): void {
    const battleId = session.getBattleId();
    
    if (this.subscribedSessions.has(battleId)) {
      return;
    }
    
    this.subscribedSessions.add(battleId);
    
    // Subscribe to session events
    session.on('BATTLE_START', (data: BattleStartEvent) => {
      this.tacticalNs.to(`battle:${battleId}`).emit('GIN7:BATTLE_START', data);
    });
    
    session.on('BATTLE_UPDATE', (data: BattleUpdateEvent) => {
      this.tacticalNs.to(`battle:${battleId}`).emit('GIN7:BATTLE_UPDATE', data);
    });
    
    session.on('BATTLE_END', (data: BattleEndEvent) => {
      this.tacticalNs.to(`battle:${battleId}`).emit('GIN7:BATTLE_END', data);
      
      // Cleanup subscription
      this.subscribedSessions.delete(battleId);
      
      // Schedule session removal
      setTimeout(() => {
        tacticalSessionManager.removeSession(battleId);
      }, 60000); // Keep for 1 minute after end
    });
    
    session.on('UNIT_DESTROYED', (data: UnitDestroyedEvent) => {
      this.tacticalNs.to(`battle:${battleId}`).emit('tactical:unit_destroyed', data);
    });
    
    session.on('DAMAGE', (data: DamageEvent) => {
      this.tacticalNs.to(`battle:${battleId}`).emit('tactical:damage', data);
    });
    
    logger.debug('[TacticalSocket] Subscribed to session', { battleId });
  }
  
  // ============================================================
  // Public API
  // ============================================================
  
  /**
   * Create a new battle session
   */
  async createBattle(
    sessionId: string,
    gridId: string,
    participants: Array<{ factionId: string; fleetIds: string[]; commanderIds: string[] }>
  ): Promise<TacticalSession> {
    const session = tacticalSessionManager.createSession(sessionId, gridId);
    
    // Add participants
    for (const p of participants) {
      session.addParticipant(p.factionId, p.fleetIds, p.commanderIds);
      
      // Load and add fleet units
      for (const fleetId of p.fleetIds) {
        const fleet = await Fleet.findOne({ sessionId, fleetId });
        if (fleet) {
          // Calculate spawn position based on faction (simplified)
          const spawnX = participants.indexOf(p) * 2000 + 500;
          session.addFleetUnits(fleet, { x: spawnX, y: 0, z: 1000 });
        }
      }
    }
    
    // Subscribe to events
    this.subscribeToSession(session);
    
    logger.info('[TacticalSocket] Battle created', {
      battleId: session.getBattleId(),
      sessionId,
      gridId,
      participantCount: participants.length,
    });
    
    return session;
  }
  
  /**
   * Get active battle count
   */
  getActiveBattleCount(): number {
    return tacticalSessionManager.getActiveSessionCount();
  }
  
  /**
   * Get namespace for external use
   */
  getNamespace(): Namespace {
    return this.tacticalNs;
  }
}

// Export singleton getter
let tacticalSocketHandler: TacticalSocketHandler | null = null;

export function initTacticalSocket(io: SocketIOServer): TacticalSocketHandler {
  if (!tacticalSocketHandler) {
    tacticalSocketHandler = new TacticalSocketHandler(io);
  }
  return tacticalSocketHandler;
}

export function getTacticalSocketHandler(): TacticalSocketHandler | null {
  return tacticalSocketHandler;
}

