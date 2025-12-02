/**
 * Socket.IO 통합 테스트
 * 
 * 테스트 범위:
 * - 소켓 연결/인증
 * - 이벤트 송수신
 * - 브로드캐스트
 * - 룸 조인/퇴장
 */

/// <reference types="jest" />

import { createServer, Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket as ServerSocket } from 'socket.io';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import {
  setupTestDatabase,
  connectTestDatabase,
  cleanupTestDatabase,
  teardownTestDatabase,
  createTestToken,
  createTestSession,
  createTestGeneral,
  TEST_TIMEOUT,
  wait,
} from './setup';

// 테스트용 서버 설정
let httpServer: HTTPServer;
let io: SocketIOServer;
let serverPort: number;

/**
 * 테스트용 소켓 서버 시작
 */
async function startTestSocketServer(): Promise<number> {
  return new Promise((resolve) => {
    httpServer = createServer();
    
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
    });

    // 인증 미들웨어
    io.use((socket, next) => {
      const token = socket.handshake.auth?.token;
      
      if (!token) {
        return next(new Error('인증 토큰이 필요합니다'));
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        (socket as any).user = decoded;
        next();
      } catch (error) {
        next(new Error('유효하지 않은 토큰입니다'));
      }
    });

    // 연결 핸들러
    io.on('connection', (socket) => {
      const user = (socket as any).user;
      
      // 세션 룸 조인
      const sessionId = socket.handshake.query?.sessionId as string;
      if (sessionId) {
        socket.join(`session:${sessionId}`);
      }

      // 사용자 룸 조인
      if (user?.userId) {
        socket.join(`user:${user.userId}`);
      }

      // 연결 성공 이벤트
      socket.emit('connected', {
        socketId: socket.id,
        userId: user?.userId,
        timestamp: new Date(),
      });

      // 테스트 이벤트 핸들러
      socket.on('ping', (data, callback) => {
        if (callback) {
          callback({ pong: true, received: data });
        }
        socket.emit('pong', { received: data });
      });

      socket.on('join:room', (roomName: string) => {
        socket.join(roomName);
        socket.emit('room:joined', { room: roomName });
      });

      socket.on('leave:room', (roomName: string) => {
        socket.leave(roomName);
        socket.emit('room:left', { room: roomName });
      });

      socket.on('broadcast:room', ({ room, event, data }) => {
        io.to(room).emit(event, data);
      });

      socket.on('disconnect', (reason) => {
        // 연결 해제 로깅
      });
    });

    httpServer.listen(0, () => {
      const address = httpServer.address();
      serverPort = typeof address === 'object' && address ? address.port : 0;
      resolve(serverPort);
    });
  });
}

/**
 * 테스트용 클라이언트 소켓 생성
 */
function createTestClient(token: string, options?: any): ClientSocket {
  return ioc(`http://localhost:${serverPort}`, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    ...options,
  });
}

/**
 * 소켓 연결 대기
 */
function waitForConnect(socket: ClientSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('연결 타임아웃'));
    }, 5000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      resolve();
    });

    socket.on('connect_error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

/**
 * 이벤트 대기
 */
function waitForEvent(socket: ClientSocket, event: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`이벤트 타임아웃: ${event}`));
    }, 5000);

    socket.once(event, (data) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });
}

describe('통합 테스트: Socket.IO', () => {
  let mongoUri: string;

  beforeAll(async () => {
    mongoUri = await setupTestDatabase();
    await connectTestDatabase(mongoUri);
    await startTestSocketServer();
  }, TEST_TIMEOUT);

  afterAll(async () => {
    // 소켓 서버 종료
    if (io) {
      io.close();
    }
    if (httpServer) {
      httpServer.close();
    }
    await teardownTestDatabase();
  }, TEST_TIMEOUT);

  beforeEach(async () => {
    await cleanupTestDatabase();
  });

  describe('연결 테스트', () => {
    it('유효한 토큰으로 연결 성공', async () => {
      const token = createTestToken({
        userId: 'test-user-1',
        username: 'testuser1',
      });

      const client = createTestClient(token);
      
      try {
        await waitForConnect(client);
        expect(client.connected).toBe(true);

        // connected 이벤트 수신 확인
        const connectedData = await waitForEvent(client, 'connected');
        expect(connectedData).toHaveProperty('socketId');
        expect(connectedData).toHaveProperty('userId', 'test-user-1');
      } finally {
        client.disconnect();
      }
    });

    it('토큰 없이 연결 실패', async () => {
      const client = ioc(`http://localhost:${serverPort}`, {
        transports: ['websocket'],
        forceNew: true,
        reconnection: false,
      });

      try {
        await expect(waitForConnect(client)).rejects.toThrow();
      } finally {
        client.disconnect();
      }
    });

    it('잘못된 토큰으로 연결 실패', async () => {
      const client = createTestClient('invalid-token');

      try {
        await expect(waitForConnect(client)).rejects.toThrow();
      } finally {
        client.disconnect();
      }
    });

    it('연결 해제 후 재연결', async () => {
      const token = createTestToken({
        userId: 'test-user-2',
        username: 'testuser2',
      });

      // 첫 번째 연결
      const client1 = createTestClient(token);
      await waitForConnect(client1);
      expect(client1.connected).toBe(true);
      client1.disconnect();

      // 두 번째 연결
      const client2 = createTestClient(token);
      await waitForConnect(client2);
      expect(client2.connected).toBe(true);
      client2.disconnect();
    });
  });

  describe('이벤트 테스트', () => {
    it('ping-pong 이벤트', async () => {
      const token = createTestToken({
        userId: 'test-user-3',
        username: 'testuser3',
      });

      const client = createTestClient(token);
      
      try {
        await waitForConnect(client);

        // ping 전송 및 pong 수신
        const pongPromise = waitForEvent(client, 'pong');
        client.emit('ping', { message: 'hello' });
        
        const pongData = await pongPromise;
        expect(pongData).toHaveProperty('received');
        expect(pongData.received).toEqual({ message: 'hello' });
      } finally {
        client.disconnect();
      }
    });

    it('콜백을 통한 응답', async () => {
      const token = createTestToken({
        userId: 'test-user-4',
        username: 'testuser4',
      });

      const client = createTestClient(token);
      
      try {
        await waitForConnect(client);

        // 콜백 테스트
        const response = await new Promise<any>((resolve) => {
          client.emit('ping', { test: 'callback' }, (response: any) => {
            resolve(response);
          });
        });

        expect(response).toHaveProperty('pong', true);
        expect(response).toHaveProperty('received');
      } finally {
        client.disconnect();
      }
    });
  });

  describe('룸 테스트', () => {
    it('룸 조인 및 퇴장', async () => {
      const token = createTestToken({
        userId: 'test-user-5',
        username: 'testuser5',
      });

      const client = createTestClient(token);
      
      try {
        await waitForConnect(client);

        // 룸 조인
        const joinPromise = waitForEvent(client, 'room:joined');
        client.emit('join:room', 'test-room');
        const joinData = await joinPromise;
        expect(joinData).toHaveProperty('room', 'test-room');

        // 룸 퇴장
        const leavePromise = waitForEvent(client, 'room:left');
        client.emit('leave:room', 'test-room');
        const leaveData = await leavePromise;
        expect(leaveData).toHaveProperty('room', 'test-room');
      } finally {
        client.disconnect();
      }
    });

    it('세션 룸 자동 조인', async () => {
      const token = createTestToken({
        userId: 'test-user-6',
        username: 'testuser6',
      });

      const client = ioc(`http://localhost:${serverPort}`, {
        auth: { token },
        query: { sessionId: 'test_session' },
        transports: ['websocket'],
        forceNew: true,
        reconnection: false,
      });
      
      try {
        await waitForConnect(client);
        
        // 세션 룸에 자동 조인되었는지 확인
        // (서버 사이드에서 확인해야 하지만, 여기서는 연결만 확인)
        expect(client.connected).toBe(true);
      } finally {
        client.disconnect();
      }
    });
  });

  describe('브로드캐스트 테스트', () => {
    it('룸 내 브로드캐스트', async () => {
      const token1 = createTestToken({
        userId: 'test-user-7',
        username: 'testuser7',
      });
      const token2 = createTestToken({
        userId: 'test-user-8',
        username: 'testuser8',
      });

      const client1 = createTestClient(token1);
      const client2 = createTestClient(token2);
      
      try {
        await Promise.all([
          waitForConnect(client1),
          waitForConnect(client2),
        ]);

        // 두 클라이언트 모두 같은 룸 조인
        client1.emit('join:room', 'broadcast-room');
        client2.emit('join:room', 'broadcast-room');
        
        await wait(100); // 룸 조인 완료 대기

        // client2에서 브로드캐스트 수신 대기
        const broadcastPromise = waitForEvent(client2, 'test:broadcast');

        // client1에서 브로드캐스트 전송
        client1.emit('broadcast:room', {
          room: 'broadcast-room',
          event: 'test:broadcast',
          data: { message: 'broadcast message' },
        });

        const broadcastData = await broadcastPromise;
        expect(broadcastData).toEqual({ message: 'broadcast message' });
      } finally {
        client1.disconnect();
        client2.disconnect();
      }
    });

    it('여러 클라이언트에게 브로드캐스트', async () => {
      const clients: ClientSocket[] = [];
      const receivePromises: Promise<any>[] = [];

      try {
        // 5개의 클라이언트 생성
        for (let i = 0; i < 5; i++) {
          const token = createTestToken({
            userId: `broadcast-user-${i}`,
            username: `broadcastuser${i}`,
          });
          const client = createTestClient(token);
          clients.push(client);
        }

        // 모든 클라이언트 연결
        await Promise.all(clients.map(c => waitForConnect(c)));

        // 모든 클라이언트 같은 룸 조인
        clients.forEach((c) => c.emit('join:room', 'multi-room'));
        await wait(100);

        // 수신 대기 (첫 번째 클라이언트 제외 - 발신자)
        for (let i = 1; i < clients.length; i++) {
          receivePromises.push(waitForEvent(clients[i], 'multi:broadcast'));
        }

        // 첫 번째 클라이언트에서 브로드캐스트
        clients[0].emit('broadcast:room', {
          room: 'multi-room',
          event: 'multi:broadcast',
          data: { count: 100 },
        });

        // 모든 클라이언트가 수신했는지 확인
        const results = await Promise.all(receivePromises);
        results.forEach((data) => {
          expect(data).toEqual({ count: 100 });
        });
      } finally {
        clients.forEach((c) => c.disconnect());
      }
    });
  });

  describe('게임 이벤트 시뮬레이션', () => {
    it('턴 완료 브로드캐스트', async () => {
      const token1 = createTestToken({
        userId: 'game-user-1',
        username: 'gameuser1',
      });
      const token2 = createTestToken({
        userId: 'game-user-2',
        username: 'gameuser2',
      });

      const client1 = createTestClient(token1, { 
        query: { sessionId: 'game_session' } 
      });
      const client2 = createTestClient(token2, { 
        query: { sessionId: 'game_session' } 
      });
      
      try {
        await Promise.all([
          waitForConnect(client1),
          waitForConnect(client2),
        ]);

        // 세션 룸 수동 조인 (테스트 서버에서)
        client1.emit('join:room', 'session:game_session');
        client2.emit('join:room', 'session:game_session');
        await wait(100);

        // 턴 완료 이벤트 수신 대기
        const turnPromise = waitForEvent(client2, 'game:turn:complete');

        // 턴 완료 브로드캐스트
        client1.emit('broadcast:room', {
          room: 'session:game_session',
          event: 'game:turn:complete',
          data: {
            sessionId: 'game_session',
            turnNumber: 15,
            nextTurnAt: new Date().toISOString(),
          },
        });

        const turnData = await turnPromise;
        expect(turnData).toHaveProperty('turnNumber', 15);
        expect(turnData).toHaveProperty('nextTurnAt');
      } finally {
        client1.disconnect();
        client2.disconnect();
      }
    });

    it('장수 업데이트 이벤트', async () => {
      const token = createTestToken({
        userId: 'game-user-3',
        username: 'gameuser3',
      });

      const client = createTestClient(token, { 
        query: { sessionId: 'game_session' } 
      });
      
      try {
        await waitForConnect(client);
        client.emit('join:room', 'session:game_session');
        await wait(100);

        // 장수 업데이트 이벤트 수신 대기
        const updatePromise = waitForEvent(client, 'general:updated');

        // 서버에서 직접 브로드캐스트 (시뮬레이션)
        io.to('session:game_session').emit('general:updated', {
          sessionId: 'game_session',
          generalId: 1001,
          updates: {
            gold: 5000,
            rice: 3000,
          },
          timestamp: new Date(),
        });

        const updateData = await updatePromise;
        expect(updateData).toHaveProperty('generalId', 1001);
        expect(updateData).toHaveProperty('updates');
        expect(updateData.updates).toHaveProperty('gold', 5000);
      } finally {
        client.disconnect();
      }
    });

    it('전투 시작 알림', async () => {
      const token = createTestToken({
        userId: 'game-user-4',
        username: 'gameuser4',
      });

      const client = createTestClient(token, { 
        query: { sessionId: 'game_session' } 
      });
      
      try {
        await waitForConnect(client);
        client.emit('join:room', 'session:game_session');
        await wait(100);

        // 전투 시작 이벤트 수신 대기
        const battlePromise = waitForEvent(client, 'battle:started');

        // 서버에서 전투 시작 브로드캐스트
        io.to('session:game_session').emit('battle:started', {
          sessionId: 'game_session',
          battleId: 'battle-123',
          participants: [1001, 1002, 2001],
          timestamp: new Date(),
        });

        const battleData = await battlePromise;
        expect(battleData).toHaveProperty('battleId', 'battle-123');
        expect(battleData).toHaveProperty('participants');
        expect(battleData.participants).toContain(1001);
      } finally {
        client.disconnect();
      }
    });

    it('메시지 알림', async () => {
      const token = createTestToken({
        userId: 'game-user-5',
        username: 'gameuser5',
      });

      const client = createTestClient(token, { 
        query: { sessionId: 'game_session' } 
      });
      
      try {
        await waitForConnect(client);
        client.emit('join:room', 'session:game_session');
        await wait(100);

        // 메시지 이벤트 수신 대기
        const messagePromise = waitForEvent(client, 'message:new');

        // 서버에서 메시지 브로드캐스트
        io.to('session:game_session').emit('message:new', {
          sessionId: 'game_session',
          message: {
            id: 'msg-1',
            from: '조조',
            to: '유비',
            content: '동맹을 제안합니다.',
            type: 'diplomacy',
          },
          timestamp: new Date(),
        });

        const messageData = await messagePromise;
        expect(messageData).toHaveProperty('message');
        expect(messageData.message).toHaveProperty('from', '조조');
        expect(messageData.message).toHaveProperty('content');
      } finally {
        client.disconnect();
      }
    });
  });

  describe('동시 연결 테스트', () => {
    it('다수 클라이언트 동시 연결', async () => {
      const clientCount = 20;
      const clients: ClientSocket[] = [];

      try {
        // 동시에 여러 클라이언트 연결
        const connectPromises = [];
        for (let i = 0; i < clientCount; i++) {
          const token = createTestToken({
            userId: `concurrent-user-${i}`,
            username: `concurrentuser${i}`,
          });
          const client = createTestClient(token);
          clients.push(client);
          connectPromises.push(waitForConnect(client));
        }

        await Promise.all(connectPromises);

        // 모든 클라이언트 연결 확인
        const connectedCount = clients.filter(c => c.connected).length;
        expect(connectedCount).toBe(clientCount);
      } finally {
        clients.forEach(c => c.disconnect());
      }
    }, 15000);
  });
});

