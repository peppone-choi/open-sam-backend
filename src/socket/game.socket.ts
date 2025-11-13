// @ts-nocheck - Type issues need investigation
import { Server, Socket } from 'socket.io';
import { General } from '../models/general.model';
import { Session } from '../models/session.model';

/**
 * 게임 이벤트 Socket 핸들러
 * 턴 완료, 게임 상태 변경 등을 처리합니다.
 */
export class GameSocketHandler {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  handleConnection(socket: Socket) {
    const user = socket.user;

    // 세션 구독
    socket.on('game:subscribe', async (data: { sessionId: string }) => {
      try {
        const { sessionId } = data;
        
        // 세션 존재 확인
        const session = await Session.findOne({ session_id: sessionId });
        if (!session) {
          socket.emit('game:error', { message: '세션을 찾을 수 없습니다' });
          return;
        }

        // 세션 룸에 조인
        socket.join(`session:${sessionId}`);
        console.log(`사용자 ${user?.userId}가 세션 ${sessionId}를 구독했습니다`);

        // 현재 게임 상태 전송
        socket.emit('game:subscribed', {
          sessionId,
          status: session.status || 'running',
          year: session.data?.year || 184,
          month: session.data?.month || 1,
          timestamp: new Date()
        });
      } catch (error: any) {
        socket.emit('game:error', { message: error.message });
      }
    });

    // 세션 구독 해제
    socket.on('game:unsubscribe', (data: { sessionId: string }) => {
      const { sessionId } = data;
      socket.leave(`session:${sessionId}`);
      console.log(`사용자 ${user?.userId}가 세션 ${sessionId} 구독을 해제했습니다`);
    });

    // 게임 상태 조회
    socket.on('game:status', async (data: { sessionId: string }) => {
      try {
        const { sessionId } = data;
        const session = await Session.findOne({ session_id: sessionId });

        if (!session) {
          socket.emit('game:error', { message: '세션을 찾을 수 없습니다' });
          return;
        }

        socket.emit('game:status', {
          sessionId,
          status: session.status || 'running',
          year: session.data?.year || 184,
          month: session.data?.month || 1,
          turnterm: session.data?.turnterm || 1440,
          lastExecuted: session.data?.lastExecuted || null,
          timestamp: new Date()
        });
      } catch (error: any) {
        socket.emit('game:error', { message: error.message });
      }
    });

    // 턴 완료 알림 구독
    socket.on('turn:subscribe', (data: { sessionId: string }) => {
      const { sessionId } = data;
      socket.join(`turn:${sessionId}`);
    });

    // 턴 완료 알림 구독 해제
    socket.on('turn:unsubscribe', (data: { sessionId: string }) => {
      const { sessionId } = data;
      socket.leave(`turn:${sessionId}`);
    });
  }
}


