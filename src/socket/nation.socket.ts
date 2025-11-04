import { Server, Socket } from 'socket.io';
import { Nation } from '../models/nation.model';
import { General } from '../models/general.model';

/**
 * 국가 이벤트 Socket 핸들러
 * 국가 정보 변경, 외교 이벤트 등을 처리합니다.
 */
export class NationSocketHandler {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  handleConnection(socket: Socket) {
    const user = (socket as any).user;
    const userId = user?.userId;

    if (!userId) {
      return;
    }

    // 국가 구독
    socket.on('nation:subscribe', async (data: { sessionId: string, nationId?: number }) => {
      try {
        const { sessionId, nationId } = data;

        // 사용자의 장수 조회
        const general = await (General as any).findOne({
          session_id: sessionId,
          owner: String(userId)
        });

        if (!general) {
          socket.emit('nation:error', { message: '장수를 찾을 수 없습니다' });
          return;
        }

        const actualNationId = nationId || general.data?.nation;

        if (!actualNationId || actualNationId === 0) {
          socket.emit('nation:error', { message: '국가 정보가 없습니다' });
          return;
        }

        // 국가 조회
        const nation = await (Nation as any).findOne({
          session_id: sessionId,
          'data.nation': actualNationId
        });

        if (!nation) {
          socket.emit('nation:error', { message: '국가를 찾을 수 없습니다' });
          return;
        }

        // 국가 룸에 조인
        socket.join(`nation:${actualNationId}`);
        console.log(`사용자 ${userId}가 국가 ${actualNationId}를 구독했습니다`);

        // 현재 국가 정보 전송
        socket.emit('nation:subscribed', {
          nationId: actualNationId,
          nation: {
            nation: actualNationId,
            name: nation.name || nation.data?.name,
            level: nation.data?.level,
            gold: nation.data?.gold,
            rice: nation.data?.rice,
            gennum: nation.data?.gennum,
            allies: nation.data?.allies || []
          },
          timestamp: new Date()
        });
      } catch (error: any) {
        socket.emit('nation:error', { message: error.message });
      }
    });

    // 국가 구독 해제
    socket.on('nation:unsubscribe', (data: { nationId: number }) => {
      const { nationId } = data;
      socket.leave(`nation:${nationId}`);
      console.log(`사용자 ${userId}가 국가 ${nationId} 구독을 해제했습니다`);
    });

    // 외교 이벤트 구독
    socket.on('diplomacy:subscribe', (data: { sessionId: string, nationId: number }) => {
      const { nationId } = data;
      socket.join(`diplomacy:${nationId}`);
    });

    // 외교 이벤트 구독 해제
    socket.on('diplomacy:unsubscribe', (data: { nationId: number }) => {
      const { nationId } = data;
      socket.leave(`diplomacy:${nationId}`);
    });
  }
}

