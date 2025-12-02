/**
 * LOGH WebSocket Combat Handler
 * 실시간 전투 WebSocket 통신 핸들러
 * 
 * 이벤트 흐름:
 * - 클라이언트 → 서버: command:* (이동, 공격, 진형, 후퇴)
 * - 서버 → 클라이언트: battle:* (상태, 이벤트)
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { Fleet } from '../../models/logh/Fleet.model';
import { TacticalMap } from '../../models/logh/TacticalMap.model';
import {
  RealtimeCombatEngine,
  CombatEngineManager,
  RealtimeCombatEngineService,
} from './RealtimeCombatEngine.service';
import {
  Formation,
  BattleState,
  Position2D,
  ServerEvents,
  ClientEvents,
  BattleStatePayload,
  COMBAT_CONSTANTS,
} from './types/Combat.types';

// ============================================================================
// WebSocket Event Types
// ============================================================================

/**
 * 서버 → 클라이언트 이벤트
 */
export const SERVER_EVENTS = {
  // 전투 상태
  BATTLE_STATE: 'battle:state',
  BATTLE_STARTED: 'battle:started',
  BATTLE_ENDED: 'battle:ended',
  
  // 함대 이벤트
  FLEET_DESTROYED: 'fleet:destroyed',
  FLEET_RETREATED: 'fleet:retreated',
  FLEET_FORMATION_CHANGED: 'fleet:formation-changed',
  FLEET_POSITION_UPDATE: 'fleet:position-update',
  
  // 전투 이벤트
  COMBAT_HIT: 'combat:hit',
  COMBAT_MISS: 'combat:miss',
  COMBAT_DAMAGE: 'combat:damage',
  
  // 보급 이벤트
  SUPPLY_WARNING: 'supply:warning',
  SUPPLY_DEPLETED: 'supply:depleted',
  
  // 사기 이벤트
  MORALE_LOW: 'morale:low',
  MORALE_ROUT: 'morale:rout',
  
  // 에러
  ERROR: 'error',
} as const;

/**
 * 클라이언트 → 서버 이벤트
 */
export const CLIENT_EVENTS = {
  // 명령
  COMMAND_MOVE: 'command:move',
  COMMAND_ATTACK: 'command:attack',
  COMMAND_FORMATION: 'command:formation',
  COMMAND_RETREAT: 'command:retreat',
  COMMAND_HOLD: 'command:hold',
  
  // 요청
  REQUEST_STATE: 'request:state',
  REQUEST_JOIN_BATTLE: 'request:join-battle',
  REQUEST_LEAVE_BATTLE: 'request:leave-battle',
} as const;

// ============================================================================
// WebSocket Combat Handler Class
// ============================================================================

export class WebSocketCombatHandler {
  private io: SocketIOServer;
  private battleRooms: Map<string, Set<string>> = new Map(); // tacticalMapId → socket IDs

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  // ==========================================================================
  // Connection Handling
  // ==========================================================================

  /**
   * 소켓 연결 처리
   */
  handleConnection(socket: Socket): void {
    const sessionId = socket.handshake.query.sessionId as string;
    if (!sessionId) {
      socket.disconnect();
      return;
    }

    console.log(`[CombatWS] Client connected: ${socket.id}, session: ${sessionId}`);

    // 세션 데이터 저장
    socket.data.sessionId = sessionId;

    // 이벤트 핸들러 등록
    this.registerEventHandlers(socket);

    // 연결 해제 처리
    socket.on('disconnect', () => {
      this.handleDisconnect(socket);
    });
  }

  /**
   * 연결 해제 처리
   */
  private handleDisconnect(socket: Socket): void {
    console.log(`[CombatWS] Client disconnected: ${socket.id}`);

    // 모든 전투 룸에서 제거
    for (const [roomId, sockets] of this.battleRooms) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        this.battleRooms.delete(roomId);
      }
    }
  }

  // ==========================================================================
  // Event Handler Registration
  // ==========================================================================

  /**
   * 이벤트 핸들러 등록
   */
  private registerEventHandlers(socket: Socket): void {
    const sessionId = socket.data.sessionId;

    // 전투 참가 요청
    socket.on(CLIENT_EVENTS.REQUEST_JOIN_BATTLE, async (data: { tacticalMapId: string }) => {
      await this.handleJoinBattle(socket, sessionId, data.tacticalMapId);
    });

    // 전투 퇴장 요청
    socket.on(CLIENT_EVENTS.REQUEST_LEAVE_BATTLE, async (data: { tacticalMapId: string }) => {
      await this.handleLeaveBattle(socket, data.tacticalMapId);
    });

    // 이동 명령
    socket.on(CLIENT_EVENTS.COMMAND_MOVE, async (data: { fleetId: string; destination: Position2D }) => {
      await this.handleMoveCommand(socket, sessionId, data);
    });

    // 진형 변경 명령
    socket.on(CLIENT_EVENTS.COMMAND_FORMATION, async (data: { fleetId: string; formation: Formation }) => {
      await this.handleFormationCommand(socket, sessionId, data);
    });

    // 후퇴 명령
    socket.on(CLIENT_EVENTS.COMMAND_RETREAT, async (data: { fleetId: string }) => {
      await this.handleRetreatCommand(socket, sessionId, data);
    });

    // 정지 명령
    socket.on(CLIENT_EVENTS.COMMAND_HOLD, async (data: { fleetId: string }) => {
      await this.handleHoldCommand(socket, sessionId, data);
    });

    // 상태 요청
    socket.on(CLIENT_EVENTS.REQUEST_STATE, async (data: { tacticalMapId: string }) => {
      await this.handleStateRequest(socket, sessionId, data.tacticalMapId);
    });
  }

  // ==========================================================================
  // Command Handlers
  // ==========================================================================

  /**
   * 전투 참가 처리
   */
  private async handleJoinBattle(
    socket: Socket,
    sessionId: string,
    tacticalMapId: string
  ): Promise<void> {
    try {
      // 전술 맵 확인
      const tacticalMap = await TacticalMap.findOne({
        session_id: sessionId,
        tacticalMapId,
        status: 'active',
      });

      if (!tacticalMap) {
        socket.emit(SERVER_EVENTS.ERROR, { message: '활성 전투가 없습니다.' });
        return;
      }

      // 룸 참가
      const roomId = `battle:${tacticalMapId}`;
      socket.join(roomId);

      // 룸 트래킹
      if (!this.battleRooms.has(tacticalMapId)) {
        this.battleRooms.set(tacticalMapId, new Set());
      }
      this.battleRooms.get(tacticalMapId)!.add(socket.id);

      // 엔진이 없으면 시작 (첫 클라이언트 연결 시)
      const engine = CombatEngineManager.getEngine(sessionId, tacticalMapId);
      if (!engine.getStatus().isRunning) {
        engine.start((state) => {
          this.broadcastBattleState(tacticalMapId, state);
        });
      }

      console.log(`[CombatWS] Socket ${socket.id} joined battle ${tacticalMapId}`);
    } catch (error: any) {
      socket.emit(SERVER_EVENTS.ERROR, { message: error.message });
    }
  }

  /**
   * 전투 퇴장 처리
   */
  private async handleLeaveBattle(
    socket: Socket,
    tacticalMapId: string
  ): Promise<void> {
    const roomId = `battle:${tacticalMapId}`;
    socket.leave(roomId);

    // 룸 트래킹에서 제거
    const sockets = this.battleRooms.get(tacticalMapId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        this.battleRooms.delete(tacticalMapId);
      }
    }

    console.log(`[CombatWS] Socket ${socket.id} left battle ${tacticalMapId}`);
  }

  /**
   * 이동 명령 처리
   */
  private async handleMoveCommand(
    socket: Socket,
    sessionId: string,
    data: { fleetId: string; destination: Position2D }
  ): Promise<void> {
    try {
      const result = await RealtimeCombatEngineService.moveFleetTactical(
        sessionId,
        data.fleetId,
        data.destination.x,
        data.destination.y
      );

      socket.emit('command:move-result', result);
    } catch (error: any) {
      socket.emit(SERVER_EVENTS.ERROR, { message: error.message });
    }
  }

  /**
   * 진형 변경 명령 처리
   */
  private async handleFormationCommand(
    socket: Socket,
    sessionId: string,
    data: { fleetId: string; formation: Formation }
  ): Promise<void> {
    try {
      const result = await RealtimeCombatEngineService.changeFormation(
        sessionId,
        data.fleetId,
        data.formation
      );

      socket.emit('command:formation-result', result);

      if (result.success) {
        // 모든 클라이언트에 알림
        const fleet = await Fleet.findOne({
          session_id: sessionId,
          fleetId: data.fleetId,
        });

        if (fleet?.tacticalMapId) {
          this.io.to(`battle:${fleet.tacticalMapId}`).emit(
            SERVER_EVENTS.FLEET_FORMATION_CHANGED,
            {
              fleetId: data.fleetId,
              formation: data.formation,
              timestamp: Date.now(),
            }
          );
        }
      }
    } catch (error: any) {
      socket.emit(SERVER_EVENTS.ERROR, { message: error.message });
    }
  }

  /**
   * 후퇴 명령 처리
   */
  private async handleRetreatCommand(
    socket: Socket,
    sessionId: string,
    data: { fleetId: string }
  ): Promise<void> {
    try {
      const result = await RealtimeCombatEngineService.retreatFleet(
        sessionId,
        data.fleetId
      );

      socket.emit('command:retreat-result', result);
    } catch (error: any) {
      socket.emit(SERVER_EVENTS.ERROR, { message: error.message });
    }
  }

  /**
   * 정지 명령 처리
   */
  private async handleHoldCommand(
    socket: Socket,
    sessionId: string,
    data: { fleetId: string }
  ): Promise<void> {
    try {
      const fleet = await Fleet.findOne({
        session_id: sessionId,
        fleetId: data.fleetId,
        isInCombat: true,
      });

      if (!fleet || !fleet.tacticalMapId) {
        socket.emit(SERVER_EVENTS.ERROR, { message: '전투 중인 함대가 아닙니다.' });
        return;
      }

      const engine = CombatEngineManager.getEngine(sessionId, fleet.tacticalMapId);
      const success = await engine.holdPosition(data.fleetId);

      socket.emit('command:hold-result', {
        success,
        message: success ? '정지 명령이 설정되었습니다.' : '정지 명령 실패',
      });
    } catch (error: any) {
      socket.emit(SERVER_EVENTS.ERROR, { message: error.message });
    }
  }

  /**
   * 상태 요청 처리
   */
  private async handleStateRequest(
    socket: Socket,
    sessionId: string,
    tacticalMapId: string
  ): Promise<void> {
    try {
      const fleets = await Fleet.find({
        session_id: sessionId,
        tacticalMapId,
        isInCombat: true,
      });

      const fleetStates = fleets.map((f) => ({
        fleetId: f.fleetId,
        name: f.name,
        faction: f.faction,
        position: {
          x: f.tacticalPosition?.x || 0,
          y: f.tacticalPosition?.y || 0,
        },
        velocity: f.tacticalPosition?.velocity || { x: 0, y: 0 },
        heading: f.tacticalPosition?.heading || 0,
        formation: f.formation,
        totalShips: f.totalShips,
        totalStrength: f.totalStrength,
        morale: f.morale,
        supply: f.supplies,
        isMoving: f.isMoving,
        isInCombat: f.isInCombat,
        isRetreating: f.status === 'retreating',
      }));

      socket.emit(SERVER_EVENTS.BATTLE_STATE, {
        timestamp: Date.now(),
        tick: 0,
        fleets: fleetStates,
        events: [],
      });
    } catch (error: any) {
      socket.emit(SERVER_EVENTS.ERROR, { message: error.message });
    }
  }

  // ==========================================================================
  // Broadcasting
  // ==========================================================================

  /**
   * 전투 상태 브로드캐스트
   */
  private broadcastBattleState(tacticalMapId: string, state: BattleState): void {
    const roomId = `battle:${tacticalMapId}`;
    
    const payload: BattleStatePayload = {
      timestamp: state.timestamp,
      tick: state.tick,
      fleets: state.fleets,
      events: state.events,
    };

    this.io.to(roomId).emit(SERVER_EVENTS.BATTLE_STATE, payload);

    // 개별 이벤트도 전송
    for (const event of state.events) {
      switch (event.type) {
        case 'destroy':
          this.io.to(roomId).emit(SERVER_EVENTS.FLEET_DESTROYED, {
            fleetId: event.targetFleetId,
            destroyedBy: event.sourceFleetId,
            timestamp: event.timestamp,
          });
          break;

        case 'retreat':
          this.io.to(roomId).emit(SERVER_EVENTS.FLEET_RETREATED, {
            fleetId: event.sourceFleetId,
            timestamp: event.timestamp,
          });
          break;

        case 'supply_depleted':
          this.io.to(roomId).emit(SERVER_EVENTS.SUPPLY_WARNING, {
            fleetId: event.sourceFleetId,
            supplyLevel: event.details?.supplyPercent || 0,
            timestamp: event.timestamp,
          });
          break;

        case 'rout':
          this.io.to(roomId).emit(SERVER_EVENTS.MORALE_ROUT, {
            fleetId: event.sourceFleetId,
            timestamp: event.timestamp,
          });
          break;
      }
    }
  }

  /**
   * 전투 시작 알림
   */
  async notifyBattleStarted(
    sessionId: string,
    tacticalMapId: string,
    fleetIds: string[]
  ): Promise<void> {
    this.io.to(`session:${sessionId}`).emit(SERVER_EVENTS.BATTLE_STARTED, {
      tacticalMapId,
      fleetIds,
      timestamp: Date.now(),
    });
  }

  /**
   * 전투 종료 알림
   */
  async notifyBattleEnded(
    sessionId: string,
    tacticalMapId: string,
    result: any
  ): Promise<void> {
    const roomId = `battle:${tacticalMapId}`;

    this.io.to(roomId).emit(SERVER_EVENTS.BATTLE_ENDED, {
      tacticalMapId,
      result,
      timestamp: Date.now(),
    });

    // 세션 전체에도 알림
    this.io.to(`session:${sessionId}`).emit(SERVER_EVENTS.BATTLE_ENDED, {
      tacticalMapId,
      result,
      timestamp: Date.now(),
    });

    // 엔진 정리
    CombatEngineManager.removeEngine(sessionId, tacticalMapId);
    this.battleRooms.delete(tacticalMapId);
  }

  // ==========================================================================
  // Utility
  // ==========================================================================

  /**
   * 활성 전투 수
   */
  getActiveBattleCount(): number {
    return this.battleRooms.size;
  }

  /**
   * 전투 참가자 수
   */
  getBattleParticipantCount(tacticalMapId: string): number {
    return this.battleRooms.get(tacticalMapId)?.size || 0;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let webSocketCombatHandler: WebSocketCombatHandler | null = null;

export function initializeWebSocketCombatHandler(
  io: SocketIOServer
): WebSocketCombatHandler {
  if (!webSocketCombatHandler) {
    webSocketCombatHandler = new WebSocketCombatHandler(io);
  }
  return webSocketCombatHandler;
}

export function getWebSocketCombatHandler(): WebSocketCombatHandler | null {
  return webSocketCombatHandler;
}




