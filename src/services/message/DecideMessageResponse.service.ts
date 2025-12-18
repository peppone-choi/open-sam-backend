// @ts-nocheck - Argument count mismatches need review
import { generalRepository } from '../../repositories/general.repository';
import { messageRepository } from '../../repositories/message.repository';
import { JosaUtil } from '../../utils/JosaUtil';

/**
 * DecideMessageResponse Service
 * 외교/스카우트 메시지 응답 (동의/거절)
 * PHP: /sam/hwe/sammo/API/Message/DecideMessageResponse.php
 * 
 * 스카우트 메시지 수락 시: AcceptRecruitCommand(che_등용수락)를 실행하여 국가 이동 처리
 * 외교 메시지 수락 시: 해당 외교 액션 실행
 */
export class DecideMessageResponseService {
  static ACCEPTED = 1;
  static DECLINED = -1;
  static INVALID = 0;

  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const msgID = parseInt(data.msgID);
    const response = data.response === true || data.response === 'true';
    
    try {
      if (!msgID || isNaN(msgID)) {
        return { success: false, message: '메시지 ID가 필요합니다' };
      }

      if (!generalId) {
        return { success: false, message: '장수 ID가 필요합니다' };
      }

      // 메시지 조회 - id 필드 또는 _id로 검색
      let message = await messageRepository.findOneByFilter({
        session_id: sessionId,
        $or: [
          { 'data.id': msgID },
          { id: msgID }
        ]
      });

      if (!message) {
        return { success: false, message: '존재하지 않는 메시지입니다' };
      }

      const msgOption = message.data?.option || message.option || {};
      const action = msgOption.action;

      // 스카우트(등용) 메시지 처리
      if (action === 'scout') {
        return await this.handleScoutMessage(sessionId, generalId, message, response);
      }

      // 외교 메시지 처리
      if (message.data?.type === 'diplomacy' || message.type === 'diplomacy') {
        return await this.handleDiplomacyMessage(sessionId, generalId, message, response);
      }

      return { success: false, message: '처리할 수 없는 메시지 타입입니다' };
    } catch (error: any) {
      console.error('DecideMessageResponse error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * 스카우트(등용) 메시지 처리
   * PHP: ScoutMessage::agreeMessage() / declineMessage()
   */
  private static async handleScoutMessage(
    sessionId: string,
    receiverId: number,
    message: any,
    agree: boolean
  ) {
    const msgData = message.data || message;
    const msgOption = msgData.option || {};

    // 유효성 검사
    const validation = this.checkScoutMessageValidation(message, receiverId);
    if (validation.result === this.INVALID) {
      return { success: false, result: false, reason: validation.reason };
    }

    // 이미 사용된 메시지인지 확인
    if (msgOption.used) {
      return { success: false, result: false, reason: '이미 사용된 등용장입니다' };
    }

    // 유효기간 확인
    const validUntil = msgData.valid_until ? new Date(msgData.valid_until) : null;
    if (validUntil && validUntil <= new Date()) {
      return { success: false, result: false, reason: '유효기간이 만료된 등용장입니다' };
    }

    const srcGeneralId = msgData.from_general || msgData.src?.generalID;
    const srcNationId = msgData.from_nation || msgData.src?.nationID || msgOption.srcNationID;
    const srcNationName = msgData.from_nation_name || msgData.src?.nationName || '';

    if (agree) {
      // 등용 수락 - AcceptRecruitCommand 실행
      try {
        const { AcceptRecruitCommand } = await import('../../commands/general/acceptRecruit');
        const { General } = await import('../../models/general.model');
        const { kvStorageRepository } = await import('../../repositories/kvstorage.repository');

        // 수신자(등용 대상) 장수 로드
        const receiverGeneral = await General.createObjFromDB(receiverId, sessionId);
        if (!receiverGeneral) {
          return { success: false, result: false, reason: '장수를 찾을 수 없습니다' };
        }

        // 게임 환경 로드
        const gameEnv = await kvStorageRepository.findOneByFilter({
          session_id: sessionId,
          storage_id: 'game_env'
        });
        const env = {
          session_id: sessionId,
          ...(gameEnv?.data || {})
        };

        // AcceptRecruitCommand 생성 및 실행
        const commandArg = {
          destNationID: srcNationId,
          destGeneralID: srcGeneralId
        };

        const command = new AcceptRecruitCommand(receiverGeneral, env, commandArg);
        await command.init();
        await command.initWithArg();

        if (!command.hasFullConditionMet()) {
          const failString = command.getFailString ? command.getFailString() : '조건을 충족하지 못했습니다';
          return { success: false, result: false, reason: failString };
        }

        // NoRNG 대용 간단한 RNG
        const rng = { nextBool: () => true, nextInt: () => 0, nextFloat: () => 0.5 };
        await command.run(rng);

        // 메시지 무효화
        await this.invalidateScoutMessage(sessionId, message);

        // 수락 알림 메시지 전송
        const josaRo = JosaUtil.pick(srcNationName, '로');
        await this.sendNotificationMessage(sessionId, message, `${srcNationName}${josaRo} 등용 제의 수락`);

        return { success: true, result: true, reason: '등용을 수락했습니다' };
      } catch (error: any) {
        console.error('Scout agree error:', error);
        return { success: false, result: false, reason: `등용 수락 실패: ${error.message}` };
      }
    } else {
      // 등용 거절
      try {
        // 메시지 무효화
        await this.invalidateScoutMessage(sessionId, message);

        // 거절 알림 메시지 전송
        const josaRo = JosaUtil.pick(srcNationName, '로');
        await this.sendNotificationMessage(sessionId, message, `${srcNationName}${josaRo} 등용 제의 거부`);

        // 로그 기록
        const { ActionLogger } = await import('../../models/ActionLogger');
        const { kvStorageRepository } = await import('../../repositories/kvstorage.repository');
        
        const gameEnv = await kvStorageRepository.findOneByFilter({
          session_id: sessionId,
          storage_id: 'game_env'
        });
        const year = gameEnv?.data?.year || 184;
        const month = gameEnv?.data?.month || 1;

        const receiverLogger = new ActionLogger(receiverId, 0, year, month);
        receiverLogger.pushGeneralActionLog(`${srcNationName}${josaRo} 망명을 거부했습니다.`);
        await receiverLogger.flush();

        const srcLogger = new ActionLogger(srcGeneralId, 0, year, month);
        const destName = msgData.to_name || msgData.dest?.generalName || '';
        const josaYi = JosaUtil.pick(destName, '이');
        srcLogger.pushGeneralActionLog(`<Y>${destName}</>${josaYi} 등용을 거부했습니다.`);
        await srcLogger.flush();

        return { success: true, result: true, reason: '등용을 거절했습니다' };
      } catch (error: any) {
        console.error('Scout decline error:', error);
        return { success: false, result: false, reason: `등용 거절 실패: ${error.message}` };
      }
    }
  }

  /**
   * 외교 메시지 처리
   */
  private static async handleDiplomacyMessage(
    sessionId: string,
    generalId: number,
    message: any,
    response: boolean
  ) {
    const general = await generalRepository.findBySessionAndNo(sessionId, generalId);

    if (!general) {
      return { success: false, message: '장수를 찾을 수 없습니다' };
    }

    const msgData = message.data || message;
    const nationId = general.data?.nation || general.nation || 0;
    const destNationId = msgData.dest_nation_id || msgData.dest?.nationID;

    if (destNationId !== nationId) {
      return { success: false, message: '메시지를 처리할 권한이 없습니다' };
    }

    const permission = general.data?.permission || general.permission;
    if (permission !== 'strategic' && (general.data?.officer_level || 0) < 5) {
      return { success: false, message: '외교권이 없습니다' };
    }

    if (msgData.response) {
      return { success: false, message: '이미 응답한 메시지입니다' };
    }

    // 외교 액션 처리 (불가침, 종전 등)
    const msgOption = msgData.option || {};
    const action = msgOption.action;

    if (response && action) {
      try {
        const { DiplomacyProposalService } = await import('../diplomacy/DiplomacyProposal.service');
        const proposalId = msgOption.proposalId || msgData.id;

        if (action === 'NO_AGGRESSION' || action === 'noAggression') {
          const result = await DiplomacyProposalService.acceptNonAggression(
            sessionId,
            proposalId,
            generalId,
            { year: msgOption.year, month: msgOption.month }
          );
          if (!result.success) {
            return { success: false, result: false, reason: result.reason };
          }
        } else if (action === 'STOP_WAR' || action === 'stopWar') {
          const result = await DiplomacyProposalService.acceptPeace(
            sessionId,
            proposalId,
            generalId
          );
          if (!result.success) {
            return { success: false, result: false, reason: result.reason };
          }
        } else if (action === 'CANCEL_NA' || action === 'cancelNA') {
          const result = await DiplomacyProposalService.acceptBreakNonAggression(
            sessionId,
            proposalId,
            generalId
          );
          if (!result.success) {
            return { success: false, result: false, reason: result.reason };
          }
        }
      } catch (error: any) {
        console.error('Diplomacy action error:', error);
      }
    }

    await messageRepository.updateOneByFilter(
      {
        session_id: sessionId,
        $or: [
          { 'data.id': message.data?.id || message.id },
          { id: message.id }
        ]
      },
      {
        $set: {
          'data.response': response ? 'agree' : 'decline',
          'data.response_date': new Date(),
          'data.response_general_id': generalId,
          'data.response_general_name': general.data?.name || general.name || '무명'
        }
      }
    );

    return {
      success: true,
      result: true,
      reason: 'success'
    };
  }

  /**
   * 스카우트 메시지 유효성 검사
   */
  private static checkScoutMessageValidation(message: any, receiverId: number) {
    const msgData = message.data || message;
    const mailbox = msgData.mailbox || msgData.to_general;
    const destGeneralId = msgData.to_general || msgData.dest?.generalID;

    if (mailbox !== destGeneralId) {
      return { result: this.INVALID, reason: '송신자가 등용장을 처리할 수 없습니다' };
    }

    if (mailbox !== receiverId) {
      return { result: this.INVALID, reason: '올바른 수신자가 아닙니다' };
    }

    return { result: this.ACCEPTED, reason: '성공' };
  }

  /**
   * 스카우트 메시지 무효화
   */
  private static async invalidateScoutMessage(sessionId: string, message: any) {
    const msgId = message.data?.id || message.id || message._id;
    
    await messageRepository.updateOneByFilter(
      {
        session_id: sessionId,
        $or: [
          { 'data.id': msgId },
          { id: msgId },
          { _id: message._id }
        ]
      },
      {
        $set: {
          'data.option.used': true,
          'option.used': true,
          'data.valid_until': new Date()
        }
      }
    );
  }

  /**
   * 알림 메시지 전송
   */
  private static async sendNotificationMessage(sessionId: string, originalMessage: any, text: string) {
    const msgData = originalMessage.data || originalMessage;
    
    try {
      await messageRepository.create({
        session_id: sessionId,
        type: 'private',
        mailbox: msgData.from_general || msgData.src?.generalID,
        from_general: msgData.to_general || msgData.dest?.generalID,
        from_name: msgData.to_name || msgData.dest?.generalName,
        from_nation: msgData.to_nation || msgData.dest?.nationID,
        to_general: msgData.from_general || msgData.src?.generalID,
        to_name: msgData.from_name || msgData.src?.generalName,
        to_nation: msgData.from_nation || msgData.src?.nationID,
        message: text,
        option: {
          delete: msgData.id || originalMessage.id
        },
        time: new Date(),
        valid_until: new Date('9999-12-31'),
        created_at: new Date()
      });
    } catch (error) {
      console.error('Notification message send failed:', error);
    }
  }
}
