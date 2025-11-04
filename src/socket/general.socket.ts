import { Server, Socket } from 'socket.io';
import { General } from '../models/general.model';

/**
 * 장수 이벤트 Socket 핸들러
 * 장수 정보 변경, 명령 실행 등을 처리합니다.
 */
export class GeneralSocketHandler {
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

    // 내 장수 구독
    socket.on('general:subscribe', async (data: { sessionId: string, generalId?: number }) => {
      try {
        const { sessionId, generalId } = data;

        // 장수 조회 (generalId가 없으면 사용자의 장수)
        let general;
        if (generalId) {
          general = await (General as any).findOne({
            session_id: sessionId,
            'data.no': generalId
          });
        } else {
          general = await (General as any).findOne({
            session_id: sessionId,
            owner: String(userId)
          });
        }

        if (!general) {
          socket.emit('general:error', { message: '장수를 찾을 수 없습니다' });
          return;
        }

        const actualGeneralId = general.data?.no || general.no;
        
        // 장수 룸에 조인
        socket.join(`general:${actualGeneralId}`);
        console.log(`사용자 ${userId}가 장수 ${actualGeneralId}를 구독했습니다`);

        // 현재 장수 정보 전송
        socket.emit('general:subscribed', {
          generalId: actualGeneralId,
          general: {
            no: actualGeneralId,
            name: general.name || general.data?.name,
            nation: general.data?.nation,
            city: general.data?.city,
            leadership: general.data?.leadership,
            strength: general.data?.strength,
            intel: general.data?.intel,
            experience: general.data?.experience,
            gold: general.data?.gold,
            rice: general.data?.rice,
            troops: general.data?.troops
          },
          timestamp: new Date()
        });
      } catch (error: any) {
        socket.emit('general:error', { message: error.message });
      }
    });

    // 장수 구독 해제
    socket.on('general:unsubscribe', (data: { generalId: number }) => {
      const { generalId } = data;
      socket.leave(`general:${generalId}`);
      console.log(`사용자 ${userId}가 장수 ${generalId} 구독을 해제했습니다`);
    });

    // 명령 실행 알림 구독
    socket.on('command:subscribe', (data: { sessionId: string, generalId: number }) => {
      const { generalId } = data;
      socket.join(`command:${generalId}`);
    });

    // 명령 실행 알림 구독 해제
    socket.on('command:unsubscribe', (data: { generalId: number }) => {
      const { generalId } = data;
      socket.leave(`command:${generalId}`);
    });
  }
}


