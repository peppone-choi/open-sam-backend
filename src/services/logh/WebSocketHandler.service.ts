/**
 * LOGH WebSocket Handler
 * 실시간 게임 상태를 클라이언트에 전송
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { Fleet } from '../../models/logh/Fleet.model';
import { TacticalMap } from '../../models/logh/TacticalMap.model';
import { GameLoopManager } from './GameLoop.service';

export class WebSocketHandler {
  private io: SocketIOServer;
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  /**
   * 소켓 연결 처리
   */
  handleConnection(socket: Socket): void {
    console.log(`[LOGH WebSocket] Client connected: ${socket.id}`);

    const sessionId = socket.handshake.query.sessionId as string;
    if (!sessionId) {
      socket.disconnect();
      return;
    }

    // 세션 룸에 참가
    socket.join(`session:${sessionId}`);

    // 이벤트 핸들러 등록
    this.registerEventHandlers(socket, sessionId);

    // 실시간 업데이트 시작
    this.startRealtimeUpdates(sessionId);

    // 연결 해제 처리
    socket.on('disconnect', () => {
      console.log(`[LOGH WebSocket] Client disconnected: ${socket.id}`);
    });
  }

  /**
   * 이벤트 핸들러 등록
   */
  private registerEventHandlers(socket: Socket, sessionId: string): void {
    // 함대 이동 명령 (전략 맵)
    socket.on('fleet:move', async (data: { fleetId: string; x: number; y: number }) => {
      try {
        const { RealtimeMovementService } = await import('./RealtimeMovement.service');
        const result = await RealtimeMovementService.setFleetDestination(
          sessionId,
          data.fleetId,
          { x: data.x, y: data.y }
        );

        socket.emit('fleet:move-result', result);
      } catch (error: any) {
        socket.emit('error', { message: error.message });
      }
    });

    // 함대 이동 명령 (전술 맵)
    socket.on('fleet:tactical-move', async (data: { fleetId: string; x: number; y: number }) => {
      try {
        const { RealtimeCombatService } = await import('./RealtimeCombat.service');
        const result = await RealtimeCombatService.moveFleetTactical(
          sessionId,
          data.fleetId,
          data.x,
          data.y
        );

        socket.emit('fleet:tactical-move-result', result);
      } catch (error: any) {
        socket.emit('error', { message: error.message });
      }
    });

    // 진형 변경
    socket.on('fleet:formation', async (data: { fleetId: string; formation: string }) => {
      try {
        const fleet = await Fleet.findOne({
          session_id: sessionId,
          fleetId: data.fleetId,
        });

        if (fleet) {
          fleet.formation = data.formation as any;
          await fleet.save();

          this.io.to(`session:${sessionId}`).emit('fleet:formation-changed', {
            fleetId: data.fleetId,
            formation: data.formation,
          });
        }
      } catch (error: any) {
        socket.emit('error', { message: error.message });
      }
    });

    // 게임 상태 요청
    socket.on('game:request-state', async () => {
      try {
        await this.sendGameState(sessionId);
      } catch (error: any) {
        socket.emit('error', { message: error.message });
      }
    });
  }

  /**
   * 실시간 업데이트 시작 (30 FPS)
   */
  private startRealtimeUpdates(sessionId: string): void {
    // 이미 실행 중이면 리턴
    if (this.updateIntervals.has(sessionId)) {
      return;
    }

    const intervalMs = 1000 / 30; // 30 FPS

    const interval = setInterval(async () => {
      try {
        await this.sendGameState(sessionId);
      } catch (error) {
        console.error(`[LOGH WebSocket] Update error for session ${sessionId}:`, error);
      }
    }, intervalMs);

    this.updateIntervals.set(sessionId, interval);

    console.log(`[LOGH WebSocket] Started realtime updates for session: ${sessionId}`);
  }

  /**
   * 실시간 업데이트 정지
   */
  stopRealtimeUpdates(sessionId: string): void {
    const interval = this.updateIntervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.updateIntervals.delete(sessionId);
      console.log(`[LOGH WebSocket] Stopped realtime updates for session: ${sessionId}`);
    }
  }

  /**
   * 게임 상태 전송
   */
  private async sendGameState(sessionId: string): Promise<void> {
    // 모든 함대 위치
    const fleets = await Fleet.find({
      session_id: sessionId,
    });

    const fleetPositions = fleets.map((fleet) => ({
      fleetId: fleet.fleetId,
      name: fleet.name,
      faction: fleet.faction,
      strategicPosition: fleet.strategicPosition,
      tacticalPosition: fleet.tacticalPosition,
      status: fleet.status,
      isInCombat: fleet.isInCombat,
      totalShips: fleet.totalShips,
      formation: fleet.formation,
    }));

    // 활성 전투
    const activeCombats = await TacticalMap.find({
      session_id: sessionId,
      status: 'active',
    });

    const combatStates = await Promise.all(
      activeCombats.map(async (combat) => {
        const combatFleets = await Fleet.find({
          session_id: sessionId,
          tacticalMapId: combat.tacticalMapId,
        });

        return {
          tacticalMapId: combat.tacticalMapId,
          strategicGridPosition: combat.strategicGridPosition,
          fleets: combatFleets.map((f) => ({
            fleetId: f.fleetId,
            tacticalPosition: f.tacticalPosition,
            totalShips: f.totalShips,
            formation: f.formation,
          })),
        };
      })
    );

    // 모든 클라이언트에 전송
    this.io.to(`session:${sessionId}`).emit('game:state-update', {
      timestamp: Date.now(),
      fleets: fleetPositions,
      combats: combatStates,
    });
  }

  /**
   * 전투 시작 알림
   */
  async notifyCombatStarted(
    sessionId: string,
    tacticalMapId: string,
    fleetIds: string[]
  ): Promise<void> {
    this.io.to(`session:${sessionId}`).emit('combat:started', {
      tacticalMapId,
      fleetIds,
      timestamp: Date.now(),
    });
  }

  /**
   * 전투 종료 알림
   */
  async notifyCombatEnded(
    sessionId: string,
    tacticalMapId: string,
    result: any
  ): Promise<void> {
    this.io.to(`session:${sessionId}`).emit('combat:ended', {
      tacticalMapId,
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * 함대 파괴 알림
   */
  async notifyFleetDestroyed(
    sessionId: string,
    fleetId: string
  ): Promise<void> {
    this.io.to(`session:${sessionId}`).emit('fleet:destroyed', {
      fleetId,
      timestamp: Date.now(),
    });
  }

  /**
   * 모든 업데이트 정지
   */
  stopAllUpdates(): void {
    for (const [sessionId, interval] of this.updateIntervals) {
      clearInterval(interval);
      console.log(`[LOGH WebSocket] Stopped updates for session: ${sessionId}`);
    }
    this.updateIntervals.clear();
  }
}

/**
 * WebSocket 핸들러 인스턴스 (싱글톤)
 */
let webSocketHandler: WebSocketHandler | null = null;

export function initializeWebSocketHandler(io: SocketIOServer): WebSocketHandler {
  if (!webSocketHandler) {
    webSocketHandler = new WebSocketHandler(io);
  }
  return webSocketHandler;
}

export function getWebSocketHandler(): WebSocketHandler | null {
  return webSocketHandler;
}
