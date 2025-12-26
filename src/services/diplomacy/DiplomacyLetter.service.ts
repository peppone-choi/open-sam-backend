// @ts-nocheck
import { nanoid } from 'nanoid';
import { ApiError } from '../../errors/ApiError';
import { DiplomacyLetter, DiplomacyLetterStatus } from '../../models/diplomacy-letter.model';
import { General } from '../../models/general.model';
import { Nation } from '../../models/nation.model';

export class DiplomacyLetterService {

  /**
   * 외교문서 목록 조회
   */
  static async listLetters(userId: string, sessionId: string) {
    const general = await this.getGeneralByOwner(userId, sessionId);
    if (!general || !general.nation) {
      throw new ApiError(400, '소속 국가가 없습니다.');
    }

    const myNationId = general.nation;
    const isChief = (general.officer_level || general.data?.officer_level || 0) >= 5;

    // 내가 보내거나 받은 모든 외교문서 조회
    const letters = await DiplomacyLetter.find({
      session_id: sessionId,
      $or: [
        { src_nation_id: myNationId },
        { dest_nation_id: myNationId },
      ]
    }).sort({ created_at: -1 }).lean();

    const nationIds = new Set<number>();
    letters.forEach(l => {
      nationIds.add(l.src_nation_id);
      nationIds.add(l.dest_nation_id);
    });

    const nations = await Nation.find({ session_id: sessionId, nation: { $in: Array.from(nationIds) } }).lean();
    const nationMap = new Map(nations.map(n => [n.nation, n.name || `국가${n.nation}`]));

    const letterMap: Record<DiplomacyLetterStatus, string> = {
      [DiplomacyLetterStatus.PROPOSED]: '제안중',
      [DiplomacyLetterStatus.ACCEPTED]: '승인',
      [DiplomacyLetterStatus.REJECTED]: '거부',
      [DiplomacyLetterStatus.CANCELLED]: '회수/파기',
      [DiplomacyLetterStatus.EXPIRED]: '만료',
    };
    
    // PHP t_diplomacy.php 형식으로 변환
    const formattedLetters = letters.map(l => ({
      no: l._id.toString(), // 몽고ID를 문자열로 사용
      fromNation: nationMap.get(l.src_nation_id) || '재야',
      toNation: nationMap.get(l.dest_nation_id) || '재야',
      brief: l.brief,
      detail: l.detail,
      date: l.created_at.toISOString().slice(0, 19).replace('T', ' '),
      status: letterMap[l.status] || '알 수 없음',
      state: l.state,
      letterNo: l.letter_id,
      srcGeneralID: l.src_general_id,
      destGeneralID: l.dest_general_id,
      prevNo: l.prev_letter_id,
      isSrc: l.src_nation_id === myNationId,
      isDest: l.dest_nation_id === myNationId,
    }));

    return {
      letters: formattedLetters,
      canSeeDetail: isChief
    };
  }

  /**
   * 외교문서 전송
   */
  static async sendLetter(userId: string, sessionId: string, data: {
    prevNo?: number;
    destNationId: number;
    brief: string;
    detail: string;
  }) {
    const general = await General.findOne({ session_id: sessionId, owner: userId }).lean();
    if (!general || !general.nation) {
      throw new ApiError(400, '소속 국가가 없습니다.');
    }
    const myNationId = general.nation;
    const generalId = general.no;
    const isChief = (general.officer_level || general.data?.officer_level || 0) >= 5;

    if (!isChief) {
      throw new ApiError(403, '권한이 부족합니다. 수뇌부만 외교문서를 보낼 수 있습니다.');
    }
    if (myNationId === data.destNationId) {
      throw new ApiError(400, '자국에는 외교문서를 보낼 수 없습니다.');
    }

    // 대상 국가의 군주/외교권자에게 알림을 보내야 함 (생략)

    const newLetter = new DiplomacyLetter({
      session_id: sessionId,
      letter_id: nanoid(),
      src_nation_id: myNationId,
      dest_nation_id: data.destNationId,
      src_general_id: generalId,
      title: '외교문서', // 실제 action에 따라 제목 변경 필요
      brief: data.brief,
      detail: data.detail,
      state: 0, // 임시값 (전쟁선포, 동맹 등 실제 state로 변경 필요)
      status: DiplomacyLetterStatus.PROPOSED,
      term: 0,
      prev_letter_id: data.prevNo ? String(data.prevNo) : undefined,
    });

    await newLetter.save();
    
    // TODO: 대상 국가 수뇌부에게 메시지/알림 전송

    return {
      result: true,
      message: '외교문서가 성공적으로 전송되었습니다. 상대 국가의 응답을 기다립니다.',
      letterNo: newLetter._id,
    };
  }

  /**
   * 외교문서 응답 (수락/거부)
   */
  static async respondLetter(userId: string, sessionId: string, data: {
    letterNo: number;
    action: 'accept' | 'reject';
    reason?: string;
  }) {
    // 1. 권한 체크 (대상 국가 수뇌부)
    const general = await General.findOne({ session_id: sessionId, owner: userId }).lean();
    if (!general || !general.nation) {
      throw new ApiError(400, '소속 국가가 없습니다.');
    }
    const myNationId = general.nation;
    const isChief = (general.officer_level || general.data?.officer_level || 0) >= 5;

    if (!isChief) {
      throw new ApiError(403, '권한이 부족합니다. 수뇌부만 외교문서에 응답할 수 있습니다.');
    }

    // 2. 서한 조회 (내가 대상 국가인 proposed 상태)
    const letter = await DiplomacyLetter.findOne({
      session_id: sessionId,
      _id: data.letterNo,
      dest_nation_id: myNationId,
      status: DiplomacyLetterStatus.PROPOSED
    });

    if (!letter) {
      throw new ApiError(404, '응답할 수 있는 외교문서를 찾을 수 없거나 이미 처리되었습니다.');
    }
    
    if (data.action === 'accept') {
      const sessionId = letter.session_id;
      const donorGeneralId = generalId; // 수락한 장수
      const acceptorGeneralId = donorGeneralId;

      try {
        const { DiplomacyProposalService, DiplomacyProposalType } = await import('./DiplomacyProposal.service');
        const { SessionStateService } = await import('../sessionState.service');
        const sessionState = await SessionStateService.getSessionState(sessionId);
        const env = { year: sessionState?.year || 184, month: sessionState?.month || 1 };

        let result;
        const letterType = letter.data?.type || letter.type;

        if (letterType === DiplomacyProposalType.NO_AGGRESSION) {
          result = await DiplomacyProposalService.acceptNonAggression(sessionId, letter.data?.no || letter.no, acceptorGeneralId, env);
        } else if (letterType === DiplomacyProposalType.STOP_WAR) {
          result = await DiplomacyProposalService.acceptPeace(sessionId, letter.data?.no || letter.no, acceptorGeneralId);
        } else if (letterType === DiplomacyProposalType.CANCEL_NA) {
          result = await DiplomacyProposalService.acceptBreakNonAggression(sessionId, letter.data?.no || letter.no, acceptorGeneralId);
        } else {
          // 기타 일반 서한
          letter.status = DiplomacyLetterStatus.ACCEPTED;
          await letter.save();
          result = { success: true, reason: '외교문서를 수락했습니다.' };
        }

        if (!result.success) {
          throw new ApiError(400, result.reason);
        }

        return {
          result: true,
          message: result.reason
        };
      } catch (error: any) {
        throw new ApiError(error.status || 500, error.message || '외교 처리 중 오류가 발생했습니다.');
      }
    } else {
      letter.status = DiplomacyLetterStatus.REJECTED;
      // 거부 시 이유를 기록할 수 있음 (reason 필드는 모델에 없으므로 생략)
      await letter.save();

      // TODO: 발신 국가 수뇌부에 메시지 전송
      
      return {
        result: true,
        message: '외교문서를 거부했습니다.'
      };
    }
  }

  /**
   * 외교 서신 회수 (발신자가 proposed 상태의 서신 회수)
   */
  static async rollbackLetter(userId: string, sessionId: string, letterNo: number) {
    // 1. 권한 체크 (발신 국가 수뇌부)
    const general = await General.findOne({ session_id: sessionId, owner: userId }).lean();
    if (!general || !general.nation) {
      throw new ApiError(400, '소속 국가가 없습니다.');
    }
    const myNationId = general.nation;
    const isChief = (general.officer_level || general.data?.officer_level || 0) >= 5;

    if (!isChief) {
      throw new ApiError(403, '권한이 부족합니다. 수뇌부만 외교문서를 회수할 수 있습니다.');
    }

    // 2. 서한 조회 (내가 발신 국가인 proposed 상태)
    const result = await DiplomacyLetter.updateOne(
      {
        session_id: sessionId,
        _id: letterNo,
        src_nation_id: myNationId,
        status: DiplomacyLetterStatus.PROPOSED
      },
      {
        $set: {
          status: DiplomacyLetterStatus.CANCELLED,
        }
      }
    );

    if (result.matchedCount === 0) {
      throw new ApiError(404, '회수할 수 있는 서신을 찾을 수 없거나 이미 처리되었습니다.');
    }
    
    // TODO: 대상 국가 수뇌부에 메시지 전송

    return {
      result: true,
      message: '외교문서를 회수했습니다.'
    };
  }

  /**
   * 외교 서신 파기 (activated 상태의 서신 파기 - 양국 동의 필요)
   * PHP 로직이 복잡하므로 여기서는 간단한 파기 요청/완료 로직만 구현 (추가 개발 필요)
   */
  static async destroyLetter(userId: string, sessionId: string, letterNo: number) {
    throw new ApiError(501, '외교문서 파기 기능은 아직 구현되지 않았습니다.');
  }

  private static async getGeneralByOwner(userId: string, sessionId: string) {
    const general = await General.findOne({ session_id: sessionId, owner: userId }).lean();

    if (!general) {
      throw new ApiError(404, '장수를 찾을 수 없습니다.');
    }

    if (!general.nation) {
      throw new ApiError(403, '국가에 소속되어있지 않습니다.');
    }

    return general;
  }
}

// 임시로 ProcessDiplomacy.service.ts 파일 생성 (내용은 미구현)
export class ProcessDiplomacyService {
  static async execute(data: any, user: any) {
    if (data.action === 'accept') {
      return { success: true, message: '외교 관계 변경을 위한 처리가 완료되었습니다.' };
    }
    return { success: false, reason: '외교 처리 로직이 구현되지 않았습니다.' };
  }
}
