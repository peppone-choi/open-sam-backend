import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { ngDiplomacyRepository } from '../../repositories/ng-diplomacy.repository';
import { checkPermission } from '../../utils/permission-helper';
import { ApiError } from '../../errors/ApiError';

interface SendLetterPayload {
  prevNo?: number;
  destNationId: number;
  brief: string;
  detail?: string;
}

interface RespondLetterPayload {
  letterNo: number | string;
  action: 'accept' | 'reject';
  reason?: string;
}

interface LetterListItem {
  no: number | string;
  fromNation: string;
  toNation: string;
  brief: string;
  detail: string;
  date: Date;
  status: string;
}

export class DiplomacyLetterService {
  static async listLetters(userId: string, sessionId: string) {
    const general = await this.getGeneralByOwner(userId, sessionId);
    const perm = checkPermission(general);
    const canSeeDetail = perm.level >= 3;
    const nationId = general.data?.nation || general.nation;

    const letters = await ngDiplomacyRepository
      .findByFilter({
        session_id: sessionId,
        $or: [
          { 'data.srcNationId': nationId },
          { 'data.destNationId': nationId }
        ],
        'data.state': { $ne: 'cancelled' }
      })
      .sort({ 'data.date': -1, createdAt: -1 })
      .lean();

    const nationMap = await this.buildNationMap(sessionId, letters);

    const letterList: LetterListItem[] = letters.map((letter: any) => {
      const letterData = letter?.data || {};
      const state = letterData.state || letterData.status || 'pending';
      const status = this.normalizeStatus(state);
      const detail = canSeeDetail
        ? (letterData.detail || '')
        : (letterData.detail ? '(권한이 부족합니다)' : '');

      return {
        no: letterData.no || letter._id,
        fromNation: nationMap.get(letterData.srcNationId) || `국가 ${letterData.srcNationId}`,
        toNation: nationMap.get(letterData.destNationId) || `국가 ${letterData.destNationId}`,
        brief: letterData.brief || letterData.text || '',
        detail,
        date: letterData.date || letter.createdAt || new Date(),
        status
      };
    });

    return {
      result: true,
      letters: letterList,
      canSeeDetail
    };
  }

  static async sendLetter(userId: string, sessionId: string, payload: SendLetterPayload) {
    const general = await this.getGeneralByOwner(userId, sessionId);
    const perm = checkPermission(general);

    if (perm.level < 4) {
      throw new ApiError(403, perm.message || '권한이 부족합니다. 수뇌부가 아닙니다.');
    }

    const srcNationId = general.data?.nation || general.nation;
    const destNationId = Number(payload.destNationId);

    if (!destNationId || Number.isNaN(destNationId)) {
      throw new ApiError(400, '올바른 국가 번호가 필요합니다.');
    }

    if (destNationId === srcNationId) {
      throw new ApiError(400, '자국으로는 보낼 수 없습니다.');
    }

    const destNation = await nationRepository.findByNationNum(sessionId, destNationId);
    if (!destNation) {
      throw new ApiError(404, '대상 국가를 찾을 수 없습니다.');
    }

    const brief = (payload.brief || '').trim();
    const detail = (payload.detail || '').trim();

    if (!brief) {
      throw new ApiError(400, '요약문이 비어있습니다.');
    }

    const letterNo = await ngDiplomacyRepository.getNextLetterNo(sessionId);

    await ngDiplomacyRepository.create({
      session_id: sessionId,
      data: {
        no: letterNo,
        srcNationId,
        destNationId,
        prevNo: payload.prevNo || null,
        brief,
        detail,
        date: new Date(),
        state: 'proposed',
        status: 'pending'
      }
    });

    return {
      result: true,
      reason: '외교문서가 전송되었습니다.',
      letterNo
    };
  }

  static async respondLetter(userId: string, sessionId: string, payload: RespondLetterPayload) {
    const general = await this.getGeneralByOwner(userId, sessionId);
    const nationId = general.data?.nation || general.nation;
    const perm = checkPermission(general);

    if (perm.level < 4) {
      throw new ApiError(403, perm.message || '권한이 부족합니다. 수뇌부가 아닙니다.');
    }

    if (!payload.letterNo) {
      throw new ApiError(400, '서한 번호가 필요합니다.');
    }

    if (!['accept', 'reject'].includes(payload.action)) {
      throw new ApiError(400, '유효하지 않은 승인 요청입니다.');
    }

    const letter = await ngDiplomacyRepository.findByLetterNo(sessionId, payload.letterNo);
    if (!letter) {
      throw new ApiError(404, '외교 서한을 찾을 수 없습니다.');
    }

    const letterData = letter.data || {};
    if (letterData.destNationId !== nationId) {
      throw new ApiError(403, '해당 외교 서한을 처리할 권한이 없습니다.');
    }

    if (letterData.state !== 'proposed') {
      throw new ApiError(400, '응답할 수 없는 상태의 서한입니다.');
    }

    const accepted = payload.action === 'accept';
    const generalNo = general.data?.no || general.no;
    const generalName = general.name || general.data?.name;

    // 이전 서한들을 'replaced' 상태로 변경 (PHP 로직과 동일)
    if (accepted && letterData.prevNo) {
      let prevLetterNo = letterData.prevNo;
      while (prevLetterNo) {
        const prevLetter = await ngDiplomacyRepository.findByLetterNo(sessionId, prevLetterNo);
        if (!prevLetter || prevLetter.data?.state === 'cancelled') break;
        
        await ngDiplomacyRepository.updateById(prevLetter._id, {
          'data.state': 'replaced',
          'data.status': 'replaced'
        });
        prevLetterNo = prevLetter.data?.prevNo;
      }
    }

    await ngDiplomacyRepository.updateById(letter._id, {
      'data.status': accepted ? 'accepted' : 'rejected',
      'data.state': accepted ? 'activated' : 'cancelled',
      'data.responseDate': new Date(),
      'data.responderId': generalNo,
      'data.responderName': generalName,
      'data.aux': {
        ...(letterData.aux || {}),
        reason: accepted ? null : {
          who: generalNo,
          action: 'disagree',
          reason: payload.reason || ''
        }
      }
    });

    return {
      result: true,
      reason: `외교 서한이 ${accepted ? '수락' : '거절'}되었습니다.`
    };
  }

  /**
   * 외교 서신 회수 (발신자가 proposed 상태의 서신을 회수)
   * PHP: j_diplomacy_rollback_letter.php
   */
  static async rollbackLetter(userId: string, sessionId: string, letterNo: number | string) {
    const general = await this.getGeneralByOwner(userId, sessionId);
    const nationId = general.data?.nation || general.nation;
    const perm = checkPermission(general);

    if (perm.level < 4) {
      throw new ApiError(403, perm.message || '권한이 부족합니다. 수뇌부가 아닙니다.');
    }

    if (!letterNo) {
      throw new ApiError(400, '서한 번호가 필요합니다.');
    }

    const letter = await ngDiplomacyRepository.findByLetterNo(sessionId, letterNo);
    if (!letter) {
      throw new ApiError(404, '서신이 없습니다.');
    }

    const letterData = letter.data || {};

    // 발신 국가만 회수 가능
    if (letterData.srcNationId !== nationId) {
      throw new ApiError(403, '발신 국가만 서신을 회수할 수 있습니다.');
    }

    // proposed 상태만 회수 가능
    if (letterData.state !== 'proposed') {
      throw new ApiError(400, '제안 상태의 서신만 회수할 수 있습니다.');
    }

    const generalNo = general.data?.no || general.no;

    await ngDiplomacyRepository.updateById(letter._id, {
      'data.state': 'cancelled',
      'data.status': 'cancelled',
      'data.aux': {
        ...(letterData.aux || {}),
        reason: {
          who: generalNo,
          action: 'cancelled',
          reason: '회수'
        }
      }
    });

    return {
      result: true,
      reason: '외교 서신이 회수되었습니다.'
    };
  }

  /**
   * 외교 서신 파기 (activated 상태의 서신을 파기 - 양국 동의 필요)
   * PHP: j_diplomacy_destroy_letter.php
   */
  static async destroyLetter(userId: string, sessionId: string, letterNo: number | string) {
    const general = await this.getGeneralByOwner(userId, sessionId);
    const nationId = general.data?.nation || general.nation;
    const perm = checkPermission(general);

    if (perm.level < 4) {
      throw new ApiError(403, perm.message || '권한이 부족합니다. 수뇌부가 아닙니다.');
    }

    if (!letterNo) {
      throw new ApiError(400, '서한 번호가 필요합니다.');
    }

    const letter = await ngDiplomacyRepository.findByLetterNo(sessionId, letterNo);
    if (!letter) {
      throw new ApiError(404, '서신이 없습니다.');
    }

    const letterData = letter.data || {};

    // 관련 국가만 파기 가능
    const isSrcNation = letterData.srcNationId === nationId;
    const isDestNation = letterData.destNationId === nationId;
    
    if (!isSrcNation && !isDestNation) {
      throw new ApiError(403, '관련 국가만 서신을 파기할 수 있습니다.');
    }

    // activated 상태만 파기 가능
    if (letterData.state !== 'activated') {
      throw new ApiError(400, '활성화된 서신만 파기할 수 있습니다.');
    }

    const generalNo = general.data?.no || general.no;
    const stateOpt = letterData.aux?.state_opt;

    // 이미 파기 신청했는지 확인
    if ((stateOpt === 'try_destroy_src' && isSrcNation) ||
        (stateOpt === 'try_destroy_dest' && isDestNation)) {
      throw new ApiError(400, '이미 파기 신청을 했습니다.');
    }

    // 상대방이 이미 파기 신청했으면 완전히 파기
    if ((stateOpt === 'try_destroy_src' && isDestNation) ||
        (stateOpt === 'try_destroy_dest' && isSrcNation)) {
      
      // 이전 연결된 서신들도 모두 파기
      let prevLetterNo = letterData.prevNo;
      while (prevLetterNo) {
        const prevLetter = await ngDiplomacyRepository.findByLetterNo(sessionId, prevLetterNo);
        if (!prevLetter || prevLetter.data?.state !== 'replaced') break;
        
        await ngDiplomacyRepository.updateById(prevLetter._id, {
          'data.state': 'cancelled',
          'data.aux': {
            ...(prevLetter.data?.aux || {}),
            reason: {
              who: generalNo,
              action: 'destroy',
              reason: '파기'
            }
          }
        });
        prevLetterNo = prevLetter.data?.prevNo;
      }

      await ngDiplomacyRepository.updateById(letter._id, {
        'data.state': 'cancelled',
        'data.status': 'cancelled',
        'data.aux': {
          ...(letterData.aux || {}),
          state_opt: null,
          reason: {
            who: generalNo,
            action: 'destroy',
            reason: '파기'
          }
        }
      });

      return {
        result: true,
        reason: '외교 서신이 파기되었습니다.',
        state: 'cancelled'
      };
    }

    // 파기 요청 등록
    const newStateOpt = isSrcNation ? 'try_destroy_src' : 'try_destroy_dest';
    
    await ngDiplomacyRepository.updateById(letter._id, {
      'data.aux': {
        ...(letterData.aux || {}),
        state_opt: newStateOpt
      }
    });

    return {
      result: true,
      reason: '외교 서신 파기를 요청했습니다. 상대 국가의 동의가 필요합니다.',
      state: 'activated'
    };
  }

  private static async getGeneralByOwner(userId: string, sessionId: string) {
    const general = await generalRepository.findBySessionAndOwner(sessionId, String(userId));

    if (!general) {
      throw new ApiError(404, '장수를 찾을 수 없습니다.');
    }

    if (!general.data?.nation && !general.nation) {
      throw new ApiError(403, '국가에 소속되어있지 않습니다.');
    }

    return general;
  }

  private static async buildNationMap(sessionId: string, letters: any[]) {
    const ids = new Set<number>();
    letters.forEach(letter => {
      const data = letter?.data || {};
      if (data.srcNationId) {
        ids.add(data.srcNationId);
      }
      if (data.destNationId) {
        ids.add(data.destNationId);
      }
    });

    const map = new Map<number, string>();
    if (ids.size === 0) {
      return map;
    }

    const nations = await nationRepository
      .findByFilter({
        session_id: sessionId,
        $or: [
          { 'data.nation': { $in: Array.from(ids) } },
          { nation: { $in: Array.from(ids) } }
        ]
      })
      .lean();

    nations.forEach((nation: any) => {
      const id = nation.data?.nation || nation.nation;
      if (!id) {
        return;
      }
      const name = nation.data?.name || nation.name || '무명';
      map.set(id, name);
    });

    return map;
  }

  private static normalizeStatus(state: string) {
    switch (state) {
      case 'activated':
        return 'accepted';
      case 'cancelled':
        return 'rejected';
      case 'replaced':
        return 'replaced';
      default:
        return 'pending';
    }
  }
}
