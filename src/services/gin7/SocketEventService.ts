/**
 * SocketEventService - 실시간 이벤트 처리
 * 클라이언트 연동용
 *
 * 기능:
 * - 이벤트 브로드캐스트
 * - 룸 관리 (세션별, 진영별, 개인별)
 * - 이벤트 필터링
 */

import { EventEmitter } from 'events';
import { logger } from '../../common/logger';

// ============================================================
// Types
// ============================================================

export enum SocketEventType {
  // 세션 이벤트
  SESSION_CREATED = 'session:created',
  SESSION_STARTED = 'session:started',
  SESSION_PAUSED = 'session:paused',
  SESSION_ENDED = 'session:ended',

  // 시간 이벤트
  TIME_TICK = 'time:tick',
  TIME_DAY_START = 'time:dayStart',
  TIME_MONTH_START = 'time:monthStart',

  // 전술 이벤트
  TACTICAL_STARTED = 'tactical:started',
  TACTICAL_ENDED = 'tactical:ended',
  TACTICAL_PHASE = 'tactical:phase',
  TACTICAL_MOVE = 'tactical:move',
  TACTICAL_ATTACK = 'tactical:attack',
  TACTICAL_DAMAGE = 'tactical:damage',
  TACTICAL_UNIT_DESTROYED = 'tactical:unitDestroyed',

  // 캐릭터 이벤트
  CHARACTER_CREATED = 'character:created',
  CHARACTER_UPDATED = 'character:updated',
  CHARACTER_DIED = 'character:died',
  CHARACTER_PROMOTED = 'character:promoted',
  CHARACTER_APPOINTED = 'character:appointed',

  // 함대 이벤트
  FLEET_CREATED = 'fleet:created',
  FLEET_MOVED = 'fleet:moved',
  FLEET_DOCKED = 'fleet:docked',
  FLEET_ENGAGED = 'fleet:engaged',
  FLEET_DESTROYED = 'fleet:destroyed',

  // 행성 이벤트
  PLANET_CAPTURED = 'planet:captured',
  PLANET_DEVELOPED = 'planet:developed',
  PLANET_ATTACKED = 'planet:attacked',

  // 정치 이벤트
  COUP_STARTED = 'coup:started',
  COUP_ENDED = 'coup:ended',
  CIVIL_WAR_STARTED = 'civilWar:started',
  CIVIL_WAR_ENDED = 'civilWar:ended',
  REBELLION_STARTED = 'rebellion:started',

  // 외교 이벤트
  DIPLOMACY_MESSAGE = 'diplomacy:message',
  ALLIANCE_FORMED = 'alliance:formed',
  WAR_DECLARED = 'war:declared',

  // 채팅/메신저
  CHAT_MESSAGE = 'chat:message',
  MESSENGER_CALL = 'messenger:call',
  MESSENGER_MESSAGE = 'messenger:message',

  // 생산/경제
  PRODUCTION_COMPLETED = 'production:completed',
  TRADE_EXECUTED = 'trade:executed',
  TAX_COLLECTED = 'tax:collected',

  // 기타
  NOTIFICATION = 'notification',
  ALERT = 'alert',
  SYSTEM_MESSAGE = 'system:message',
}

export interface SocketEvent {
  type: SocketEventType;
  sessionId: string;
  timestamp: Date;
  data: any;
  visibility: {
    global?: boolean;            // 전체 공개
    factionIds?: string[];       // 특정 진영에만
    characterIds?: string[];     // 특정 캐릭터에만
    systemOnly?: boolean;        // 성계 범위 내만
    systemId?: string;
  };
}

export interface RoomInfo {
  roomId: string;
  type: 'session' | 'faction' | 'character' | 'system' | 'tactical';
  sessionId: string;
  members: Set<string>;          // Socket IDs
}

export interface SocketConnection {
  socketId: string;
  playerId: string;
  characterId?: string;
  sessionId?: string;
  factionId?: string;
  connectedAt: Date;
}

// ============================================================
// SocketEventService Class
// ============================================================

export class SocketEventService extends EventEmitter {
  private static instance: SocketEventService;
  
  // 연결 관리
  private connections: Map<string, SocketConnection> = new Map();
  
  // 룸 관리
  private rooms: Map<string, RoomInfo> = new Map();
  
  // 이벤트 히스토리 (최근 100개)
  private eventHistory: Map<string, SocketEvent[]> = new Map();

  // Socket.IO 서버 참조 (외부에서 주입)
  private io: any = null;

  private constructor() {
    super();
    logger.info('[SocketEventService] Initialized');
  }

  public static getInstance(): SocketEventService {
    if (!SocketEventService.instance) {
      SocketEventService.instance = new SocketEventService();
    }
    return SocketEventService.instance;
  }

  // ============================================================
  // Socket.IO 연동
  // ============================================================

  /**
   * Socket.IO 서버 설정
   */
  public setSocketIO(io: any): void {
    this.io = io;
    this.setupSocketHandlers();
    logger.info('[SocketEventService] Socket.IO configured');
  }

  /**
   * Socket 핸들러 설정
   */
  private setupSocketHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: any) => {
      logger.info(`[SocketEventService] New connection: ${socket.id}`);

      socket.on('authenticate', (data: { playerId: string; token: string }) => {
        this.handleAuthenticate(socket, data);
      });

      socket.on('join_session', (data: { sessionId: string }) => {
        this.handleJoinSession(socket, data);
      });

      socket.on('leave_session', (data: { sessionId: string }) => {
        this.handleLeaveSession(socket, data);
      });

      socket.on('select_character', (data: { characterId: string; factionId: string }) => {
        this.handleSelectCharacter(socket, data);
      });

      socket.on('join_tactical', (data: { tacticalId: string }) => {
        this.handleJoinTactical(socket, data);
      });

      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  // ============================================================
  // 연결 핸들러
  // ============================================================

  private handleAuthenticate(socket: any, data: { playerId: string; token: string }): void {
    // TODO: 토큰 검증
    const connection: SocketConnection = {
      socketId: socket.id,
      playerId: data.playerId,
      connectedAt: new Date(),
    };
    this.connections.set(socket.id, connection);
    
    socket.emit('authenticated', { success: true });
    logger.info(`[SocketEventService] Player ${data.playerId} authenticated`);
  }

  private handleJoinSession(socket: any, data: { sessionId: string }): void {
    const connection = this.connections.get(socket.id);
    if (!connection) return;

    connection.sessionId = data.sessionId;
    
    // 세션 룸 참가
    const roomId = `session:${data.sessionId}`;
    socket.join(roomId);
    
    // 룸 정보 업데이트
    let room = this.rooms.get(roomId);
    if (!room) {
      room = {
        roomId,
        type: 'session',
        sessionId: data.sessionId,
        members: new Set(),
      };
      this.rooms.set(roomId, room);
    }
    room.members.add(socket.id);

    socket.emit('session_joined', { sessionId: data.sessionId });
    logger.info(`[SocketEventService] Socket ${socket.id} joined session ${data.sessionId}`);
  }

  private handleLeaveSession(socket: any, data: { sessionId: string }): void {
    const roomId = `session:${data.sessionId}`;
    socket.leave(roomId);
    
    const room = this.rooms.get(roomId);
    if (room) {
      room.members.delete(socket.id);
    }

    const connection = this.connections.get(socket.id);
    if (connection) {
      connection.sessionId = undefined;
    }
  }

  private handleSelectCharacter(socket: any, data: { characterId: string; factionId: string }): void {
    const connection = this.connections.get(socket.id);
    if (!connection || !connection.sessionId) return;

    connection.characterId = data.characterId;
    connection.factionId = data.factionId;

    // 진영 룸 참가
    const factionRoomId = `faction:${connection.sessionId}:${data.factionId}`;
    socket.join(factionRoomId);

    // 캐릭터 룸 참가
    const characterRoomId = `character:${connection.sessionId}:${data.characterId}`;
    socket.join(characterRoomId);

    socket.emit('character_selected', { characterId: data.characterId });
  }

  private handleJoinTactical(socket: any, data: { tacticalId: string }): void {
    const connection = this.connections.get(socket.id);
    if (!connection) return;

    const roomId = `tactical:${data.tacticalId}`;
    socket.join(roomId);

    socket.emit('tactical_joined', { tacticalId: data.tacticalId });
  }

  private handleDisconnect(socket: any): void {
    const connection = this.connections.get(socket.id);
    if (connection) {
      logger.info(`[SocketEventService] Player ${connection.playerId} disconnected`);
    }
    this.connections.delete(socket.id);

    // 모든 룸에서 제거
    for (const room of this.rooms.values()) {
      room.members.delete(socket.id);
    }
  }

  // ============================================================
  // 이벤트 브로드캐스트
  // ============================================================

  /**
   * 이벤트 발송
   */
  public broadcast(event: SocketEvent): void {
    if (!this.io) {
      // Socket.IO 없이도 이벤트 기록
      this.recordEvent(event);
      return;
    }

    const { type, sessionId, data, visibility } = event;

    // 전체 공개
    if (visibility.global) {
      this.io.to(`session:${sessionId}`).emit(type, data);
    }
    // 특정 진영에만
    else if (visibility.factionIds && visibility.factionIds.length > 0) {
      for (const factionId of visibility.factionIds) {
        this.io.to(`faction:${sessionId}:${factionId}`).emit(type, data);
      }
    }
    // 특정 캐릭터에만
    else if (visibility.characterIds && visibility.characterIds.length > 0) {
      for (const characterId of visibility.characterIds) {
        this.io.to(`character:${sessionId}:${characterId}`).emit(type, data);
      }
    }
    // 성계 범위
    else if (visibility.systemOnly && visibility.systemId) {
      this.io.to(`system:${sessionId}:${visibility.systemId}`).emit(type, data);
    }

    // 이벤트 기록
    this.recordEvent(event);
  }

  /**
   * 세션 전체 브로드캐스트
   */
  public broadcastToSession(
    sessionId: string,
    type: SocketEventType,
    data: any,
  ): void {
    this.broadcast({
      type,
      sessionId,
      timestamp: new Date(),
      data,
      visibility: { global: true },
    });
  }

  /**
   * 진영 브로드캐스트
   */
  public broadcastToFaction(
    sessionId: string,
    factionId: string,
    type: SocketEventType,
    data: any,
  ): void {
    this.broadcast({
      type,
      sessionId,
      timestamp: new Date(),
      data,
      visibility: { factionIds: [factionId] },
    });
  }

  /**
   * 캐릭터 개인 전송
   */
  public sendToCharacter(
    sessionId: string,
    characterId: string,
    type: SocketEventType,
    data: any,
  ): void {
    this.broadcast({
      type,
      sessionId,
      timestamp: new Date(),
      data,
      visibility: { characterIds: [characterId] },
    });
  }

  /**
   * 전술전 브로드캐스트
   */
  public broadcastToTactical(
    tacticalId: string,
    type: SocketEventType,
    data: any,
  ): void {
    if (!this.io) return;
    this.io.to(`tactical:${tacticalId}`).emit(type, data);
  }

  // ============================================================
  // 이벤트 기록
  // ============================================================

  private recordEvent(event: SocketEvent): void {
    const history = this.eventHistory.get(event.sessionId) || [];
    history.push(event);
    
    // 최근 100개만 유지
    if (history.length > 100) {
      history.shift();
    }
    
    this.eventHistory.set(event.sessionId, history);

    // 내부 이벤트 발생
    this.emit(event.type, event);
  }

  // ============================================================
  // 조회
  // ============================================================

  /**
   * 연결 정보 조회
   */
  public getConnection(socketId: string): SocketConnection | undefined {
    return this.connections.get(socketId);
  }

  /**
   * 세션 내 연결된 플레이어 수
   */
  public getSessionPlayerCount(sessionId: string): number {
    const roomId = `session:${sessionId}`;
    const room = this.rooms.get(roomId);
    return room?.members.size || 0;
  }

  /**
   * 이벤트 히스토리 조회
   */
  public getEventHistory(
    sessionId: string,
    type?: SocketEventType,
    limit: number = 50,
  ): SocketEvent[] {
    const history = this.eventHistory.get(sessionId) || [];
    
    let filtered = history;
    if (type) {
      filtered = history.filter(e => e.type === type);
    }
    
    return filtered.slice(-limit);
  }

  /**
   * 온라인 플레이어 목록
   */
  public getOnlinePlayers(sessionId: string): Array<{
    playerId: string;
    characterId?: string;
    factionId?: string;
  }> {
    const players: Array<{
      playerId: string;
      characterId?: string;
      factionId?: string;
    }> = [];

    for (const connection of this.connections.values()) {
      if (connection.sessionId === sessionId) {
        players.push({
          playerId: connection.playerId,
          characterId: connection.characterId,
          factionId: connection.factionId,
        });
      }
    }

    return players;
  }

  // ============================================================
  // 유틸리티
  // ============================================================

  /**
   * 알림 전송
   */
  public sendNotification(
    sessionId: string,
    targetIds: string[],
    message: string,
    level: 'info' | 'warning' | 'error' | 'success' = 'info',
  ): void {
    this.broadcast({
      type: SocketEventType.NOTIFICATION,
      sessionId,
      timestamp: new Date(),
      data: { message, level },
      visibility: { characterIds: targetIds },
    });
  }

  /**
   * 시스템 메시지 브로드캐스트
   */
  public sendSystemMessage(
    sessionId: string,
    message: string,
  ): void {
    this.broadcastToSession(sessionId, SocketEventType.SYSTEM_MESSAGE, {
      message,
      timestamp: new Date(),
    });
  }
}

export const socketEventService = SocketEventService.getInstance();
export default SocketEventService;







