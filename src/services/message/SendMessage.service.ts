// @ts-nocheck - Argument count mismatches need review
import { generalRepository } from '../../repositories/general.repository';
import { messageRepository } from '../../repositories/message.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { GameEventEmitter } from '../gameEventEmitter';
import { logger } from '../../common/logger';

/**
 * SendMessage Service
 * 메시지 전송 (공개, 국가, 외교, 개인)
 * PHP: /sam/hwe/sammo/API/Message/SendMessage.php
 */
export class SendMessageService {
  static readonly MAILBOX_PUBLIC = 0;
  static readonly MAILBOX_NATIONAL = 1000000;

  static async execute(data: any, user?: any) {
    const sessionId = data.serverID || data.session_id || process.env.DEFAULT_SESSION_ID || 'sangokushi_default';
    const userId = user?.userId || user?.id || data.user_id;
    let generalId = user?.generalId || data.general_id;
    const mailbox = parseInt(data.mailbox) || 0;
    const text = data.text;
    
    console.log('[SendMessage] 요청:', { sessionId, userId, generalId, mailbox, textLength: text?.length });
    
    try {
      // 입력 검증
      if (!text || text.length === 0) {
        logger.warn('메시지 내용 없음', { generalId, mailbox });
        return {
          success: false,
          message: '메시지 내용이 필요합니다'
        };
      }

      // 장수 정보 조회 및 검증
      let general;
      if (generalId) {
        general = await generalRepository.findBySessionAndNo(sessionId, generalId);
        
        // 🔒 보안 검증: 이 장수가 이 유저의 소유인지 확인
        if (general) {
          const generalOwner = String(general.owner || '');
          if (generalOwner !== String(userId)) {
            console.log('[SendMessage] ❌ 권한 없음! generalId:', generalId, 'owner:', generalOwner, 'userId:', userId);
            return {
              success: false,
              message: '해당 장수에 대한 권한이 없습니다'
            };
          }
          
          // NPC 체크 (나중에 NPC도 메시지 사용할 수 있도록 주석 처리)
          // const npc = general.npc || 0;
          // if (npc >= 2) {
          //   console.log('[SendMessage] ❌ NPC 장수는 메시지 전송 불가:', generalId);
          //   return {
          //     success: false,
          //     message: 'NPC 장수는 메시지를 전송할 수 없습니다'
          //   };
          // }
        }
      } else if (userId) {
        console.log('[SendMessage] userId로 장수 찾기:', userId, sessionId);
        general = await generalRepository.findBySessionAndOwner(
          sessionId,
          String(userId)
        );
        if (general) {
          generalId = general.no;
          console.log('[SendMessage] ✅ 장수 찾음! generalId:', generalId);
        }
      }

      if (!generalId || !general) {
        logger.warn('장수 정보 없음', { sessionId, userId, mailbox });
        return {
          success: false,
          message: '장수 정보가 필요합니다'
        };
      }
      
      console.log('[SendMessage] ✅ 장수 권한 검증 완료! generalId:', generalId, 'owner:', general.owner);

      const nationId = general.nation || 0;
      const generalName = general.name || '무명';
      const permission = general.permission;

      // 국가 정보 조회
      const nation = nationId !== 0 ? await nationRepository.findOneByFilter({
        session_id: sessionId,
        'data.nation': nationId
      }) : null;

      const nationName = nation?.data?.name || '재야';
      const nationColor = nation?.data?.color || 0;

      // 메시지 ID 생성
      const messageId = await this.getNextMessageId(sessionId);

      // 메시지 타입 결정 및 전송
      if (mailbox === this.MAILBOX_PUBLIC) {
        // 공개 메시지
        return await this.sendPublicMessage(
          sessionId,
          messageId,
          generalId,
          generalName,
          nationId,
          nationName,
          nationColor,
          text
        );
      } else if (mailbox >= this.MAILBOX_NATIONAL) {
        // 국가/외교 메시지
        const destNationId = permission === 'strategic' 
          ? mailbox - this.MAILBOX_NATIONAL
          : nationId;

        if (destNationId === nationId) {
          // 국가 메시지
          return await this.sendNationalMessage(
            sessionId,
            messageId,
            generalId,
            generalName,
            nationId,
            nationName,
            nationColor,
            text
          );
        } else {
          // 외교 메시지
          return await this.sendDiplomacyMessage(
            sessionId,
            messageId,
            generalId,
            generalName,
            nationId,
            nationName,
            nationColor,
            destNationId,
            text
          );
        }
      } else if (mailbox > 0) {
        // 개인 메시지
        return await this.sendPrivateMessage(
          sessionId,
          messageId,
          generalId,
          generalName,
          nationId,
          nationName,
          nationColor,
          mailbox,
          text
        );
      }

      return {
        success: false,
        message: '알 수 없는 에러입니다'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * 다음 메시지 ID 생성
   */
  private static async getNextMessageId(sessionId: string): Promise<number> {
    const allMessages = await messageRepository.findByFilter({ session_id: sessionId });
    const sortedMessages = allMessages.sort((a: any, b: any) => (b.data?.id || 0) - (a.data?.id || 0));
    const lastMessage = sortedMessages[0];
    return (lastMessage?.data?.id || 0) + 1;
  }

  /**
   * 공개 메시지 전송
   */
  private static async sendPublicMessage(
    sessionId: string,
    messageId: number,
    generalId: number,
    generalName: string,
    nationId: number,
    nationName: string,
    nationColor: number,
    text: string
  ) {
    const now = new Date();

    const messageData = {
      id: messageId,
      type: 'public',
      src_general_id: generalId,
      src_general_name: generalName,
      src_nation_id: nationId,
      src_nation_name: nationName,
      src_nation_color: nationColor,
      dest_general_id: 0,
      dest_nation_id: 0,
      text: text,
      date: now,
      expire_date: new Date('9999-12-31')
    };

    await messageRepository.create({
      session_id: sessionId,
      data: messageData
    });

    // 실시간 브로드캐스트
    GameEventEmitter.broadcastMessage(sessionId, messageData);

    return {
      success: true,
      result: true,
      msgType: 'public',
      msgID: messageId
    };
  }

  /**
   * 국가 메시지 전송
   */
  private static async sendNationalMessage(
    sessionId: string,
    messageId: number,
    generalId: number,
    generalName: string,
    nationId: number,
    nationName: string,
    nationColor: number,
    text: string
  ) {
    const now = new Date();

    const messageData = {
      id: messageId,
      type: 'national',
      src_general_id: generalId,
      src_general_name: generalName,
      src_nation_id: nationId,
      src_nation_name: nationName,
      src_nation_color: nationColor,
      dest_general_id: 0,
      dest_nation_id: nationId,
      dest_nation_name: nationName,
      dest_nation_color: nationColor,
      text: text,
      date: now,
      expire_date: new Date('9999-12-31')
    };

    await messageRepository.create({
      session_id: sessionId,
      data: messageData
    });

    // 실시간 브로드캐스트 (국가 메시지는 해당 국가에만)
    GameEventEmitter.broadcastGameEvent(sessionId, 'message:national', {
      nationId,
      message: messageData
    });

    return {
      success: true,
      result: true,
      msgType: 'national',
      msgID: messageId
    };
  }

  /**
   * 외교 메시지 전송
   */
  private static async sendDiplomacyMessage(
    sessionId: string,
    messageId: number,
    generalId: number,
    generalName: string,
    srcNationId: number,
    srcNationName: string,
    srcNationColor: number,
    destNationId: number,
    text: string
  ) {
    // 대상 국가 조회
      const destNation = await nationRepository.findOneByFilter({
      session_id: sessionId,
      'data.nation': destNationId
    });

    if (!destNation) {
      return {
        success: false,
        message: '존재하지 않는 국가입니다'
      };
    }

    const destNationName = destNation.data?.name || '무명';
    const destNationColor = destNation.data?.color || 0;
    const now = new Date();

    const messageData = {
      id: messageId,
      type: 'diplomacy',
      src_general_id: generalId,
      src_general_name: generalName,
      src_nation_id: srcNationId,
      src_nation_name: srcNationName,
      src_nation_color: srcNationColor,
      dest_general_id: 0,
      dest_nation_id: destNationId,
      dest_nation_name: destNationName,
      dest_nation_color: destNationColor,
      text: text,
      date: now,
      expire_date: new Date('9999-12-31')
    };

    await messageRepository.create({
      session_id: sessionId,
      data: messageData
    });

    // 실시간 브로드캐스트 (외교 메시지는 양 국가에만)
    GameEventEmitter.broadcastGameEvent(sessionId, 'message:diplomacy', {
      srcNationId,
      destNationId,
      message: messageData
    });

    return {
      success: true,
      result: true,
      msgType: 'diplomacy',
      msgID: messageId
    };
  }

  /**
   * 개인 메시지 전송
   */
  private static async sendPrivateMessage(
    sessionId: string,
    messageId: number,
    srcGeneralId: number,
    srcGeneralName: string,
    srcNationId: number,
    srcNationName: string,
    srcNationColor: number,
    destGeneralId: number,
    text: string
  ) {
    // 대상 장수 조회
    const destGeneral = await generalRepository.findBySessionAndNo(sessionId, destGeneralId);

    if (!destGeneral) {
      return {
        success: false,
        message: '존재하지 않는 유저입니다'
      };
    }

    const destGeneralName = destGeneral.name || '무명';
    const destNationId = destGeneral.nation || 0;

    // 대상 국가 정보
    const destNation = destNationId !== 0 ? await nationRepository.findOneByFilter({
      session_id: sessionId,
      'data.nation': destNationId
    }) : null;

    const destNationName = destNation?.data?.name || '재야';
    const destNationColor = destNation?.data?.color || 0;
    const now = new Date();

    const messageData = {
      id: messageId,
      type: 'private',
      src_general_id: srcGeneralId,
      src_general_name: srcGeneralName,
      src_nation_id: srcNationId,
      src_nation_name: srcNationName,
      src_nation_color: srcNationColor,
      dest_general_id: destGeneralId,
      dest_general_name: destGeneralName,
      dest_nation_id: destNationId,
      dest_nation_name: destNationName,
      dest_nation_color: destNationColor,
      text: text,
      date: now,
      expire_date: new Date('9999-12-31')
    };

    await messageRepository.create({
      session_id: sessionId,
      data: messageData
    });

    // 실시간 브로드캐스트 (개인 메시지는 수신자에게만)
    const { getSocketManager } = await import('../../socket/socketManager');
    const socketManager = getSocketManager();
    if (socketManager && destGeneral?.owner) {
      socketManager.sendToUser(destGeneral.owner, 'message:private', {
        message: messageData
      });
    }

    return {
      success: true,
      result: true,
      msgType: 'private',
      msgID: messageId
    };
  }
}
