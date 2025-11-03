import { MessageRepository } from '../../repositories/message.repository';
import { General } from '../../models/general.model';
import { Nation } from '../../models/nation.model';
import { Session } from '../../models/session.model';
import { Message } from '../../models/message.model';

/**
 * SendMessage Service
 * 메시지 전송 (공개, 국가, 외교, 개인)
 * PHP: /sam/hwe/sammo/API/Message/SendMessage.php
 */
export class SendMessageService {
  static readonly MAILBOX_PUBLIC = 0;
  static readonly MAILBOX_NATIONAL = 1000000;

  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const mailbox = parseInt(data.mailbox) || 0;
    const text = data.text;
    
    try {
      // 입력 검증
      if (!text || text.length === 0) {
        return {
          success: false,
          message: '메시지 내용이 필요합니다'
        };
      }

      if (!generalId) {
        return {
          success: false,
          message: '장수 정보가 필요합니다'
        };
      }

      // 장수 정보 조회
      const general = await (General as any).findOne({
        session_id: sessionId,
        'data.no': generalId
      });

      if (!general) {
        return {
          success: false,
          message: '장수를 찾을 수 없습니다'
        };
      }

      const nationId = general.data?.nation || 0;
      const generalName = general.data?.name || '무명';
      const permission = general.data?.permission;

      // 국가 정보 조회
      const nation = nationId !== 0 ? await (Nation as any).findOne({
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
    const lastMessage = await (Message as any).findOne({ session_id: sessionId })
      .sort({ 'data.id': -1 })
      .select('data.id');
    
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

    await (Message as any).create({
      session_id: sessionId,
      data: {
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
      }
    });

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

    await (Message as any).create({
      session_id: sessionId,
      data: {
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
      }
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
      const destNation = await (Nation as any).findOne({
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

    await (Message as any).create({
      session_id: sessionId,
      data: {
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
      }
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
      const destGeneral = await (General as any).findOne({
      session_id: sessionId,
      'data.no': destGeneralId
    });

    if (!destGeneral) {
      return {
        success: false,
        message: '존재하지 않는 유저입니다'
      };
    }

    const destGeneralName = destGeneral.data?.name || '무명';
    const destNationId = destGeneral.data?.nation || 0;

    // 대상 국가 정보
      const destNation = destNationId !== 0 ? await (Nation as any).findOne({
      session_id: sessionId,
      'data.nation': destNationId
    }) : null;

    const destNationName = destNation?.data?.name || '재야';
    const destNationColor = destNation?.data?.color || 0;
    const now = new Date();

    await (Message as any).create({
      session_id: sessionId,
      data: {
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
      }
    });

    return {
      success: true,
      result: true,
      msgType: 'private',
      msgID: messageId
    };
  }
}
