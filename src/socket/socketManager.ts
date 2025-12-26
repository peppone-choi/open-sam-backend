// @ts-nocheck - Type issues need investigation
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { redisClient } from '../config/redis';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../middleware/auth';
import { tokenBlacklist } from '../utils/tokenBlacklist';
import { BattleSocketHandler } from '../handlers/battle.socket';
import { RealtimeBattleSocketHandler } from '../handlers/realtime-battle.socket';
import { GameSocketHandler } from './game.socket';
import { GeneralSocketHandler } from './general.socket';
import { NationSocketHandler } from './nation.socket';
import { WebSocketHandler } from '../services/logh/WebSocketHandler.service';
import { TacticalSocketHandler, initTacticalSocket } from './tactical.socket';
import { MessengerSocketHandler } from './messenger.socket';
import { logger } from '../common/logger';
import { configManager } from '../config/ConfigManager';

/**
 * Socket.IO 서버 관리자
 * 게임의 모든 실시간 통신을 관리합니다.
 */
export class SocketManager {
  private static instance: SocketManager;
  private io: SocketIOServer;
  private isInitialized = false;
  private battleHandler: BattleSocketHandler;
  private gameHandler: GameSocketHandler;
  private generalHandler: GeneralSocketHandler;
  private nationHandler: NationSocketHandler;
  private loghHandler?: WebSocketHandler;
  private tacticalHandler?: TacticalSocketHandler;
  private messengerHandler?: MessengerSocketHandler;
  private realtimeBattleHandler?: RealtimeBattleSocketHandler;

  private constructor(server: any) {
    const { jwtSecret } = configManager.get().system;
    
    this.io = new SocketIOServer(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      upgradeTimeout: 30000,
      maxHttpBufferSize: 1e6
    });

    if (process.env.REDIS_URL || process.env.ENABLE_REDIS_ADAPTER === 'true') {
      const pubClient = redisClient.duplicate();
      const subClient = redisClient.duplicate();
      
      Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
        this.io.adapter(createAdapter(pubClient, subClient));
        logger.info('Socket.IO Redis 어댑터 적용 완료');
      }).catch(err => {
        logger.error('Socket.IO Redis 어댑터 적용 실패:', err);
      });
    }

    this.initializeHandlers(jwtSecret);
  }

  private initializeHandlers(jwtSecret: string | null) {
    this.io.use(async (socket, next) => {
      const token = (socket.handshake.auth?.token as string) || (socket.handshake.headers['x-auth-token'] as string);
      
      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      try {
        if (!jwtSecret) {
          return next(new Error('Authentication error: Server configuration error'));
        }
        const decoded = jwt.verify(token, jwtSecret) as unknown as JwtPayload;
        (socket as any).user = decoded;
        next();
      } catch (err) {
        next(new Error('Authentication error: Invalid token'));
      }
    });

    this.battleHandler = new BattleSocketHandler(this.io);
    this.gameHandler = new GameSocketHandler(this.io);
    this.generalHandler = new GeneralSocketHandler(this.io);
    this.nationHandler = new NationSocketHandler(this.io);

    if (process.env.ENABLE_LOGH_WEBSOCKET !== 'false') {
      this.loghHandler = new WebSocketHandler(this.io);
    }

    if (process.env.ENABLE_GIN7_TACTICAL !== 'false') {
      this.tacticalHandler = initTacticalSocket(this.io);
    }

    if (process.env.ENABLE_GIN7_MESSENGER !== 'false') {
      this.messengerHandler = new MessengerSocketHandler(this.io);
    }

    if (process.env.ENABLE_GIN7_RTBATTLE !== 'false') {
      this.realtimeBattleHandler = new RealtimeBattleSocketHandler(this.io);
    }

    this.io.on('connection', this.handleConnection.bind(this));
    logger.info('Socket.IO 서버 초기화 완료');
  }

  private handleConnection(socket: Socket) {
    const user = (socket as any).user as JwtPayload;
    const userId = user?.userId;
    const sessionId = socket.handshake.query?.sessionId as string;

    logger.info('Socket connected', { 
      socketId: socket.id, 
      userId: userId || 'unknown', 
      sessionId: sessionId || 'N/A' 
    });

    if (userId) {
      socket.join(`user:${userId}`);
    }

    if (sessionId) {
      socket.join(`session:${sessionId}`);
    }

    if (sessionId && sessionId.startsWith('logh_') && this.loghHandler) {
      this.loghHandler.handleConnection(socket);
      if (this.messengerHandler) {
        this.messengerHandler.handleConnection(socket);
      }
      return;
    }

    this.battleHandler.handleConnection(socket);
    this.gameHandler.handleConnection(socket);
    this.generalHandler.handleConnection(socket);
    this.nationHandler.handleConnection(socket);
    
    if (this.messengerHandler) {
      this.messengerHandler.handleConnection(socket);
    }

    socket.on('disconnect', (reason: string) => {
      if (userId) {
        socket.leave(`user:${userId}`);
      }
    });

    socket.on('error', (error: any) => {
      logger.error('Socket error', { 
        socketId: socket.id, 
        error: error.message
      });
    });

    socket.emit('connected', {
      socketId: socket.id,
      userId,
      timestamp: new Date()
    });
  }

  broadcastGameEvent(sessionId: string, event: string, data: any) {
    this.io.to(`session:${sessionId}`).emit(`game:${event}`, {
      sessionId,
      ...data,
      timestamp: new Date()
    });
  }

  sendToUser(userId: string, event: string, data: any) {
    this.io.to(`user:${userId}`).emit(event, {
      ...data,
      timestamp: new Date()
    });
  }

  broadcastTurnComplete(sessionId: string, turnNumber: number, nextTurnAt: Date) {
    this.broadcastGameEvent(sessionId, 'turn:complete', {
      turnNumber,
      nextTurnAt
    });
  }

  broadcastGeneralUpdate(sessionId: string, generalId: number, updates: any) {
    this.io.to(`session:${sessionId}`).emit('general:updated', {
      sessionId,
      generalId,
      updates,
      timestamp: new Date()
    });
  }

  broadcastNationUpdate(sessionId: string, nationId: number, updates: any) {
    this.io.to(`session:${sessionId}`).emit('nation:updated', {
      sessionId,
      nationId,
      updates,
      timestamp: new Date()
    });
  }

  broadcastCityUpdate(sessionId: string, cityId: number, updates: any) {
    this.io.to(`session:${sessionId}`).emit('city:updated', {
      sessionId,
      cityId,
      updates,
      timestamp: new Date()
    });
  }

  broadcastMessage(sessionId: string, message: any) {
    this.io.to(`session:${sessionId}`).emit('message:new', {
      sessionId,
      message,
      timestamp: new Date()
    });
  }

  broadcastBattleStart(sessionId: string, battleId: string, participants: number[]) {
    this.io.to(`session:${sessionId}`).emit('battle:started', {
      sessionId,
      battleId,
      participants,
      timestamp: new Date()
    });
  }

  broadcastLogUpdate(sessionId: string, generalId: number, logType: 'action' | 'history', logId: string | number, logText: string) {
    this.io.to(`session:${sessionId}`).emit('log:updated', {
      sessionId,
      generalId,
      logType,
      logId,
      logText,
      timestamp: new Date()
    });
  }

  getIO(): SocketIOServer {
    return this.io;
  }

  getTacticalHandler(): TacticalSocketHandler | undefined {
    return this.tacticalHandler;
  }

  getMessengerHandler(): MessengerSocketHandler | undefined {
    return this.messengerHandler;
  }

  getRealtimeBattleHandler(): RealtimeBattleSocketHandler | undefined {
    return this.realtimeBattleHandler;
  }

  getOnlineUserCount(sessionId?: string): number {
    if (sessionId) {
      const room = this.io.sockets.adapter.rooms.get(`session:${sessionId}`);
      return room ? room.size : 0;
    }
    return this.io.sockets.sockets.size;
  }

  async getOnlineNations(sessionId: string): Promise<number[]> {
    const sessionRoom = this.io.sockets.adapter.rooms.get(`session:${sessionId}`);
    if (!sessionRoom) return [];

    const { General } = await import('../models/general.model');
    const nationIds = new Set<number>();

    for (const socketId of sessionRoom) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        const user = (socket as any).user as JwtPayload;
        const userId = user?.userId;
        if (userId) {
          const general = await General.findOne({
            session_id: sessionId,
            owner: String(userId),
            $or: [{ 'data.npc': { $lt: 2 } }, { npc: { $lt: 2 } }]
          }).lean();
          
          if (general) {
            const nationId = general.data?.nation ?? general.nation ?? 0;
            if (nationId > 0) nationIds.add(nationId);
          }
        }
      }
    }
    return Array.from(nationIds);
  }

  async getOnlineGenerals(sessionId: string): Promise<Array<{ nationId: number; generalId: number; name: string }>> {
    const sessionRoom = this.io.sockets.adapter.rooms.get(`session:${sessionId}`);
    if (!sessionRoom) return [];

    const { General } = await import('../models/general.model');
    const results: Array<{ nationId: number; generalId: number; name: string }> = [];
    const processedOwners = new Set<string>();

    for (const socketId of sessionRoom) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (!socket) continue;
      
      const user = (socket as any).user as JwtPayload;
      const userId = user?.userId;
      if (!userId || processedOwners.has(userId)) continue;
      processedOwners.add(userId);

      const general = await General.findOne({
        session_id: sessionId,
        owner: String(userId),
        $or: [{ 'data.npc': { $lt: 2 } }, { npc: { $lt: 2 } }, { npc: { $exists: false } }]
      }).lean();

      if (!general) continue;

      const nationId = general.data?.nation ?? general.nation ?? 0;
      if (nationId <= 0) continue;

      const name = general.name || general.data?.name || '무명';
      const generalId = general.no ?? general.data?.no ?? 0;
      results.push({ nationId, generalId, name });
    }
    return results;
  }
}

let socketManagerInstance: SocketManager | null = null;

export function initializeSocket(httpServer: HTTPServer): SocketManager {
  if (!socketManagerInstance) {
    socketManagerInstance = new SocketManager(httpServer);
  }
  return socketManagerInstance;
}

export function getSocketManager(): SocketManager | null {
  return socketManagerInstance;
}

export function setSocketManager(manager: SocketManager): void {
  socketManagerInstance = manager;
}
