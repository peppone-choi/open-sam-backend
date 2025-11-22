// @ts-nocheck - Type issues need investigation
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../middleware/auth';
import { tokenBlacklist } from '../utils/tokenBlacklist';
import { BattleSocketHandler } from '../handlers/battle.socket';
import { GameSocketHandler } from './game.socket';
import { GeneralSocketHandler } from './general.socket';
import { NationSocketHandler } from './nation.socket';
import { WebSocketHandler } from '../services/logh/WebSocketHandler.service';

/**
 * Socket.IO 서버 관리자
 * 게임의 모든 실시간 통신을 관리합니다.
 */
export class SocketManager {
  private io: SocketIOServer;
  private battleHandler: BattleSocketHandler;
  private gameHandler: GameSocketHandler;
  private generalHandler: GeneralSocketHandler;
  private nationHandler: NationSocketHandler;
  private loghHandler: WebSocketHandler | null = null;

  constructor(httpServer: HTTPServer) {
    // Socket.IO 서버 초기화
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://127.0.0.1:3000',
          process.env.FRONTEND_URL || 'http://localhost:3000'
        ],
        credentials: true,
        methods: ['GET', 'POST']
      },
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      pingTimeout: 60000, // 60초
      pingInterval: 25000, // 25초
      allowEIO3: true, // Engine.IO v3 호환성
      upgradeTimeout: 30000, // 30초
      maxHttpBufferSize: 1e6 // 1MB
    });

    // 핸들러 초기화
    this.battleHandler = new BattleSocketHandler(this.io);
    this.gameHandler = new GameSocketHandler(this.io);
    this.generalHandler = new GeneralSocketHandler(this.io);
    this.nationHandler = new NationSocketHandler(this.io);

    // LOGH 핸들러 초기화 (환경 변수로 제어)
    if (process.env.ENABLE_LOGH_WEBSOCKET !== 'false') {
      this.loghHandler = new WebSocketHandler(this.io);
      console.log('✅ LOGH WebSocket 핸들러 초기화 완료');
    }

    // 연결 처리
    this.io.use(this.authenticateSocket.bind(this));
    this.io.on('connection', this.handleConnection.bind(this));

    console.log('✅ Socket.IO 서버 초기화 완료');
  }

  /**
   * Socket.IO 인증 미들웨어
   */
  private async authenticateSocket(socket: Socket, next: Function) {
    try {
      // LOGH 세션 기반 인증 (sessionId만으로 접속 가능)
      const sessionId = socket.handshake.query?.sessionId as string;
      if (sessionId && sessionId.startsWith('logh_')) {
        // LOGH 게임은 sessionId만으로 인증 허용 (오픈 액세스)
        socket.user = { sessionId } as any;
        return next();
      }

      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('인증 토큰이 필요합니다'));
      }

      // 토큰 블랙리스트 체크
      if (tokenBlacklist.has(token)) {
        return next(new Error('로그아웃된 토큰입니다'));
      }

      // JWT 검증
      const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
      const decoded = jwt.verify(token, secret) as unknown as JwtPayload;

      // 소켓에 사용자 정보 저장
      socket.user = decoded;
      next();
    } catch (error: any) {
      if (error instanceof jwt.JsonWebTokenError) {
        return next(new Error('유효하지 않은 토큰입니다'));
      }
      if (error instanceof jwt.TokenExpiredError) {
        return next(new Error('토큰이 만료되었습니다'));
      }
      next(new Error('인증 오류가 발생했습니다'));
    }
  }

  /**
   * 소켓 연결 처리
   */
  private handleConnection(socket: Socket) {
    const user = socket.user as JwtPayload;
    const userId = user?.userId;
    const sessionId = socket.handshake.query?.sessionId as string;

    console.log(`📡 소켓 연결: ${socket.id} (사용자: ${userId || 'unknown'}, 세션: ${sessionId || 'N/A'})`);

    // 사용자별 룸에 조인
    if (userId) {
      socket.join(`user:${userId}`);
    }

    // 세션 룸에 자동 조인 (실시간 로그 수신을 위해 필수)
    if (sessionId) {
      socket.join(`session:${sessionId}`);
      console.log(`📡 소켓 ${socket.id}가 세션 룸 session:${sessionId}에 조인했습니다`);
    }

    // LOGH 세션인 경우 LOGH 핸들러로 처리
    if (sessionId && sessionId.startsWith('logh_') && this.loghHandler) {
      this.loghHandler.handleConnection(socket);
      return; // LOGH는 별도 처리
    }

    // 핸들러에 연결 전달 (Sangokushi 전용)
    this.battleHandler.handleConnection(socket);
    this.gameHandler.handleConnection(socket);
    this.generalHandler.handleConnection(socket);
    this.nationHandler.handleConnection(socket);

    // 연결 해제 처리
    socket.on('disconnect', (reason: string) => {
      // HMR이나 클라이언트 disconnect는 로그만 (정상 동작)
      if (reason === 'io client disconnect' || reason === 'transport close') {
        console.log(`📡 소켓 연결 해제 (정상): ${socket.id} (이유: ${reason})`);
      } else {
        console.log(`📡 소켓 연결 해제: ${socket.id} (이유: ${reason})`);
      }
      if (userId) {
        socket.leave(`user:${userId}`);
      }
    });

    // 에러 처리
    socket.on('error', (error) => {
      console.error(`📡 소켓 에러: ${socket.id}`, error);
    });

    // 연결 성공 메시지
    socket.emit('connected', {
      socketId: socket.id,
      userId,
      timestamp: new Date()
    });
  }

  /**
   * 게임 이벤트 브로드캐스트
   */
  broadcastGameEvent(sessionId: string, event: string, data: any) {
    this.io.to(`session:${sessionId}`).emit(`game:${event}`, {
      sessionId,
      ...data,
      timestamp: new Date()
    });
  }

  /**
   * 특정 사용자에게 이벤트 전송
   */
  sendToUser(userId: string, event: string, data: any) {
    this.io.to(`user:${userId}`).emit(event, {
      ...data,
      timestamp: new Date()
    });
  }

  /**
   * 턴 완료 브로드캐스트
   */
  broadcastTurnComplete(sessionId: string, turnNumber: number, nextTurnAt: Date) {
    this.broadcastGameEvent(sessionId, 'turn:complete', {
      turnNumber,
      nextTurnAt
    });
  }

  /**
   * 장수 정보 업데이트 브로드캐스트
   */
  broadcastGeneralUpdate(sessionId: string, generalId: number, updates: any) {
    this.io.to(`session:${sessionId}`).emit('general:updated', {
      sessionId,
      generalId,
      updates,
      timestamp: new Date()
    });
  }

  /**
   * 국가 정보 업데이트 브로드캐스트
   */
  broadcastNationUpdate(sessionId: string, nationId: number, updates: any) {
    this.io.to(`session:${sessionId}`).emit('nation:updated', {
      sessionId,
      nationId,
      updates,
      timestamp: new Date()
    });
  }

  /**
   * 도시 정보 업데이트 브로드캐스트
   */
  broadcastCityUpdate(sessionId: string, cityId: number, updates: any) {
    this.io.to(`session:${sessionId}`).emit('city:updated', {
      sessionId,
      cityId,
      updates,
      timestamp: new Date()
    });
  }

  /**
   * 메시지 알림 브로드캐스트
   */
  broadcastMessage(sessionId: string, message: any) {
    this.io.to(`session:${sessionId}`).emit('message:new', {
      sessionId,
      message,
      timestamp: new Date()
    });
  }

  /**
   * 전투 시작 알림
   */
  broadcastBattleStart(sessionId: string, battleId: string, participants: number[]) {
    this.io.to(`session:${sessionId}`).emit('battle:started', {
      sessionId,
      battleId,
      participants,
      timestamp: new Date()
    });
  }

  /**
   * 로그 업데이트 브로드캐스트
   * @param sessionId 세션 ID
   * @param generalId 장수 ID (장수동향/개인기록용, 중원정세는 0)
   * @param logType 'action' | 'history'
   * @param logId 로그 ID
   * @param logText 로그 텍스트
   */
  broadcastLogUpdate(sessionId: string, generalId: number, logType: 'action' | 'history', logId: number, logText: string) {
    this.io.to(`session:${sessionId}`).emit('log:updated', {
      sessionId,
      generalId,
      logType,
      logId,
      logText,
      timestamp: new Date()
    });
  }

  /**
   * Socket.IO 서버 인스턴스 반환
   */
  getIO(): SocketIOServer {
    return this.io;
  }

  /**
   * 접속 중인 사용자 수 조회
   */
  getOnlineUserCount(sessionId?: string): number {
    if (sessionId) {
      const room = this.io.sockets.adapter.rooms.get(`session:${sessionId}`);
      return room ? room.size : 0;
    }
    // 전체 접속자 수
    return this.io.sockets.sockets.size;
  }

  /**
   * 접속 중인 국가 목록 조회
   */
  async getOnlineNations(sessionId: string): Promise<number[]> {
    const sessionRoom = this.io.sockets.adapter.rooms.get(`session:${sessionId}`);
    if (!sessionRoom) {
      return [];
    }

    const { General } = await import('../models/general.model');
    const nationIds = new Set<number>();

    // 세션 룸에 있는 모든 소켓 확인
    for (const socketId of sessionRoom) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        const user = socket.user as JwtPayload;
        const userId = user?.userId;
        if (userId) {
          // 해당 사용자의 장수 찾기
          const general = await General.findOne({
            session_id: sessionId,
            owner: String(userId),
            $or: [
              { 'data.npc': { $lt: 2 } },
              { npc: { $lt: 2 } }
            ]
          }).lean();
          
          if (general) {
            const nationId = general.data?.nation ?? general.nation ?? 0;
            if (nationId > 0) {
              nationIds.add(nationId);
            }
          }
        }
      }
    }

    return Array.from(nationIds);
  }

  async getOnlineGenerals(sessionId: string): Promise<Array<{ nationId: number; generalId: number; name: string }>> {
    const sessionRoom = this.io.sockets.adapter.rooms.get(`session:${sessionId}`);
    if (!sessionRoom) {
      return [];
    }

    const { General } = await import('../models/general.model');
    const results: Array<{ nationId: number; generalId: number; name: string }> = [];
    const processedOwners = new Set<string>();

    for (const socketId of sessionRoom) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (!socket) {
        continue;
      }
      const user = socket.user as JwtPayload;
      const userId = user?.userId;
      if (!userId || processedOwners.has(userId)) {
        continue;
      }
      processedOwners.add(userId);

      const general = await General.findOne({
        session_id: sessionId,
        owner: String(userId),
        $or: [
          { 'data.npc': { $lt: 2 } },
          { npc: { $lt: 2 } },
          { npc: { $exists: false } }
        ]
      }).lean();

      if (!general) {
        continue;
      }

      const nationId = general.data?.nation ?? general.nation ?? 0;
      if (nationId <= 0) {
        continue;
      }

      const name = general.name || general.data?.name || '무명';
      const generalId = general.no ?? general.data?.no ?? 0;
      results.push({ nationId, generalId, name });
    }

    return results;
  }
}


// 싱글톤 인스턴스
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


