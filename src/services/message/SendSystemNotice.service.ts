import { messageRepository } from '../../repositories/message.repository';
import { generalRepository } from '../../repositories/general.repository';

/**
 * SendSystemNotice Service
 * 시스템 알림 전송 (운영자 → 장수들)
 * 
 * PHP: Message::sendPrivateMsgAsNotice() 참고
 * - src: MessageTarget::buildSystemTarget() (generalID=0, name='', nation='System')
 * - type: 'private' (시스템 메시지는 개인 메시지 타입)
 * - 받는 사람: 특정 장수들 또는 전체
 */
export class SendSystemNoticeService {
  /**
   * 시스템 알림 전송
   * @param sessionId 세션 ID
   * @param targetGeneralIds 대상 장수 ID 배열 (비어있으면 전체)
   * @param text 메시지 내용
   * @param options 추가 옵션 (deletable 등)
   */
  static async send(
    sessionId: string,
    targetGeneralIds: number[],
    text: string,
    options?: {
      deletable?: boolean;
      year?: number;
      month?: number;
    }
  ): Promise<{ success: boolean; count: number; message?: string }> {
    try {
      if (!text || text.trim().length === 0) {
        return {
          success: false,
          count: 0,
          message: '메시지 내용이 비어있습니다',
        };
      }

      // 시스템 발신자 정보 (PHP: MessageTarget::buildSystemTarget())
      const systemTarget = {
        id: 0,
        name: '',
        nation_id: 0,
        nation: 'System',
        color: '#000000',
        icon: '',
      };

      let targetGenerals: any[] = [];

      // 대상 장수 조회
      if (targetGeneralIds.length === 0) {
        // 전체 장수에게 전송
        targetGenerals = await generalRepository.findByFilter({
          session_id: sessionId,
          npc: { $ne: 5 }, // NPC 제외
        });
      } else {
        // 특정 장수들에게 전송
        for (const generalId of targetGeneralIds) {
          const general = await generalRepository.findBySessionAndNo(sessionId, generalId);
          if (general) {
            targetGenerals.push(general);
          }
        }
      }

      if (targetGenerals.length === 0) {
        return {
          success: false,
          count: 0,
          message: '대상 장수가 없습니다',
        };
      }

      // 각 장수에게 시스템 메시지 전송
      let successCount = 0;
      for (const general of targetGenerals) {
        const destTarget = {
          id: general.no,
          name: general.name,
          nation_id: general.nation || 0,
          nation: general.nation ? '(국가)' : '재야', // TODO: 실제 국가명 조회
          color: '#000000',
          icon: general.picture || '',
        };

        // 메시지 생성
        const messageDoc = {
          session_id: sessionId,
          mailbox: general.no, // 수신자의 mailbox
          type: 'private', // ← 중요: 시스템 메시지는 private 타입!
          src: 0, // 발신자 ID = 0 (시스템)
          dest: general.no, // 수신자 ID
          time: new Date(),
          valid_until: new Date('9999-12-31'),
          message: {
            src: systemTarget,
            dest: destTarget,
            text: text,
            option: {
              deletable: options?.deletable ?? false,
              system: true, // 시스템 메시지 표시
            },
          },
        };

        await messageRepository.create(messageDoc);
        successCount++;
      }

      return {
        success: true,
        count: successCount,
        message: `${successCount}명에게 시스템 메시지를 전송했습니다`,
      };
    } catch (error: any) {
      console.error('[SendSystemNotice] Error:', error);
      return {
        success: false,
        count: 0,
        message: error.message || '시스템 메시지 전송 실패',
      };
    }
  }

  /**
   * 전체 공지 전송 (편의 메서드)
   */
  static async sendToAll(
    sessionId: string,
    text: string
  ): Promise<{ success: boolean; count: number; message?: string }> {
    return this.send(sessionId, [], text, { deletable: false });
  }

  /**
   * 특정 장수에게 알림 전송 (편의 메서드)
   */
  static async sendToGeneral(
    sessionId: string,
    generalId: number,
    text: string
  ): Promise<{ success: boolean; count: number; message?: string }> {
    return this.send(sessionId, [generalId], text, { deletable: false });
  }
}
