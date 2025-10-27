import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../cache/redis.service';

/**
 * 웹소켓 서버 (Socket.IO 기반)
 * 
 * 기능:
 * - 클라이언트 연결/해제 관리
 * - Room 관리 (sessionId, battleId 기반)
 * - Redis Pub/Sub 구독 및 자동 브로드캐스트
 */
export class WebSocketServer {
  private io: Server;
  private redis: RedisService;
  private channels = {
    gameState: 'channel:game-state',
    battle: 'channel:battle',
    general: 'channel:general',
    city: 'channel:city',
    entity: 'channel:entity',
  };

  constructor(httpServer: HTTPServer) {
    // Socket.IO 서버 초기화
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
    });

    this.redis = new RedisService();

    this.setupConnectionHandlers();
    this.setupRedisSubscriptions();
  }

  /**
   * 클라이언트 연결/해제 핸들러 설정
   */
  private setupConnectionHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`클라이언트 연결: ${socket.id}`);

      // 세션 Room 참가
      socket.on('join:session', (sessionId: string) => {
        socket.join(`session:${sessionId}`);
        console.log(`세션 참가: ${socket.id} -> session:${sessionId}`);
      });

      // 세션 Room 퇴장
      socket.on('leave:session', (sessionId: string) => {
        socket.leave(`session:${sessionId}`);
        console.log(`세션 퇴장: ${socket.id} -> session:${sessionId}`);
      });

      // 전투 Room 참가
      socket.on('join:battle', (battleId: string) => {
        socket.join(`battle:${battleId}`);
        console.log(`전투 참가: ${socket.id} -> battle:${battleId}`);
      });

      // 전투 Room 퇴장
      socket.on('leave:battle', (battleId: string) => {
        socket.leave(`battle:${battleId}`);
        console.log(`전투 퇴장: ${socket.id} -> battle:${battleId}`);
      });

      // 장수 구독
      socket.on('subscribe:general', (generalId: string) => {
        socket.join(`general:${generalId}`);
        console.log(`장수 구독: ${socket.id} -> general:${generalId}`);
      });

      // 장수 구독 해제
      socket.on('unsubscribe:general', (generalId: string) => {
        socket.leave(`general:${generalId}`);
        console.log(`장수 구독 해제: ${socket.id} -> general:${generalId}`);
      });

      // 도시 구독
      socket.on('subscribe:city', (cityId: string) => {
        socket.join(`city:${cityId}`);
        console.log(`도시 구독: ${socket.id} -> city:${cityId}`);
      });

      // 도시 구독 해제
      socket.on('unsubscribe:city', (cityId: string) => {
        socket.leave(`city:${cityId}`);
        console.log(`도시 구독 해제: ${socket.id} -> city:${cityId}`);
      });

      // 연결 해제
      socket.on('disconnect', () => {
        console.log(`클라이언트 연결 해제: ${socket.id}`);
      });
    });
  }

  /**
   * Redis Pub/Sub 구독 설정
   */
  private setupRedisSubscriptions(): void {
    // 게임 상태 변경 구독
    this.redis.subscribe(this.channels.gameState, (message) => {
      const { sessionId, data } = message;
      if (sessionId && data) {
        this.emitGameState(sessionId, data);
      }
    });

    // 전투 이벤트 구독
    this.redis.subscribe(this.channels.battle, (message) => {
      const { battleId, event } = message;
      if (battleId && event) {
        this.emitBattleEvent(battleId, event);
      }
    });

    // 장수 업데이트 구독
    this.redis.subscribe(this.channels.general, (message) => {
      const { generalId, patch } = message;
      if (generalId && patch) {
        this.emitGeneralUpdate(generalId, patch);
      }
    });

    // 도시 업데이트 구독
    this.redis.subscribe(this.channels.city, (message) => {
      const { cityId, patch } = message;
      if (cityId && patch) {
        this.emitCityUpdate(cityId, patch);
      }
    });

    // 엔티티 업데이트 구독 (Entity 시스템)
    this.redis.subscribe(this.channels.entity, (message) => {
      const { scenario, role, id, patch, version } = message;
      if (scenario && role && id && patch) {
        this.emitEntityUpdate(scenario, role, id, patch, version);
      }
    });

    console.log('Redis Pub/Sub 구독 완료');
  }

  /**
   * 게임 상태 전송 (세션별)
   */
  emitGameState(sessionId: string, data: any): void {
    this.io.to(`session:${sessionId}`).emit('game:state', data);
  }

  /**
   * 전투 이벤트 전송 (전투별)
   */
  emitBattleEvent(battleId: string, event: any): void {
    this.io.to(`battle:${battleId}`).emit('battle:event', event);
  }

  /**
   * 장수 업데이트 전송 (장수별)
   */
  emitGeneralUpdate(generalId: string, patch: any): void {
    this.io.to(`general:${generalId}`).emit('general:update', {
      generalId,
      patch,
    });
  }

  /**
   * 도시 업데이트 전송 (도시별)
   */
  emitCityUpdate(cityId: string, patch: any): void {
    this.io.to(`city:${cityId}`).emit('city:update', {
      cityId,
      patch,
    });
  }

  /**
   * 엔티티 업데이트 전송 (Entity 시스템)
   */
  emitEntityUpdate(
    scenario: string,
    role: string,
    id: string,
    patch: any,
    version?: number
  ): void {
    // 시나리오 Room으로 전송
    this.io.to(`session:${scenario}`).emit('entity:updated', {
      scenario,
      role,
      id,
      patch,
      version,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 특정 세션에 커스텀 이벤트 전송
   */
  emitToSession(sessionId: string, event: string, data: any): void {
    this.io.to(`session:${sessionId}`).emit(event, data);
  }

  /**
   * 전체 브로드캐스트
   */
  broadcast(event: string, data: any): void {
    this.io.emit(event, data);
  }

  /**
   * 연결된 클라이언트 수 조회 (세션별)
   */
  async getSessionClientCount(sessionId: string): Promise<number> {
    const sockets = await this.io.in(`session:${sessionId}`).fetchSockets();
    return sockets.length;
  }

  /**
   * 서버 종료
   */
  async close(): Promise<void> {
    await this.redis.disconnect();
    this.io.close();
  }
}
