import { generalRepository } from '../../repositories/general.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { generalRecordRepository } from '../../repositories/general-record.repository';

/**
 * BuildNationCandidate Service (사전 거병)
 * 게임 시작 전 야인 장수가 자신의 국가를 세우는 기능
 * PHP: /sam/hwe/sammo/API/General/BuildNationCandidate.php
 */
export class BuildNationCandidateService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || data.user_id;
    
    if (!userId) {
      return {
        success: false,
        message: '사용자 정보가 없습니다'
      };
    }

    try {
      const session = await sessionRepository.findBySessionId(sessionId);
      if (!session) {
        return { success: false, message: '세션을 찾을 수 없습니다' };
      }

      const gameEnv = session.data || {};

      const general = await generalRepository.findBySessionAndOwner(
        sessionId,
        userId.toString()
      );

      if (!general) {
        return { success: false, message: '장수가 없습니다' };
      }

      if (new Date(gameEnv.turntime) > new Date(gameEnv.opentime)) {
        return { success: false, message: '게임이 시작되었습니다.' };
      }

      if (general.nation !== 0) {
        return { success: false, message: '이미 국가에 소속되어있습니다.' };
      }

      const availableInstantAction = gameEnv.availableInstantAction || {};
      if (!availableInstantAction.buildNationCandidate) {
        return { success: false, message: '거병할 수 없는 모드입니다.' };
      }

      const generalNo = general.no;
      if (!generalNo) {
        return { success: false, message: '장수 번호를 찾을 수 없습니다' };
      }

      const { getNextRecordId } = await import('../../utils/record-helpers');
      const recordId = await getNextRecordId(sessionId);
      await generalRecordRepository.create({
        session_id: sessionId,
        data: {
          id: recordId,
          general_id: generalNo,
          year: gameEnv.year || 184,
          month: gameEnv.month || 1,
          log_type: 'action',
          text: '거병을 신청하였습니다. 게임 시작 시 자동으로 국가를 세웁니다.',
          date: new Date().toISOString()
        }
      });

      await generalRepository.updateBySessionAndNo(sessionId, generalNo, {
        killturn: gameEnv.killturn || 6
      });

      return {
        success: true,
        result: true,
        message: '거병 신청 완료'
      };
    } catch (error: any) {
      console.error('BuildNationCandidate error:', error);
      return {
        success: false,
        message: error.message || '거병 신청 중 오류가 발생했습니다'
      };
    }
  }
}
