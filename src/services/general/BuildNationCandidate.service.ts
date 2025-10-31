import { General } from '../../models/general.model';
import { Session } from '../../models/session.model';
import { GeneralRecord } from '../../models/general_record.model';

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
      const session = await Session.findOne({ session_id: sessionId });
      if (!session) {
        return { success: false, message: '세션을 찾을 수 없습니다' };
      }

      const gameEnv = session.data || {};

      const general = await General.findOne({
        session_id: sessionId,
        owner: userId.toString()
      });

      if (!general) {
        return { success: false, message: '장수가 없습니다' };
      }

      if (new Date(gameEnv.turntime) > new Date(gameEnv.opentime)) {
        return { success: false, message: '게임이 시작되었습니다.' };
      }

      if (general.data?.nation !== 0) {
        return { success: false, message: '이미 국가에 소속되어있습니다.' };
      }

      const availableInstantAction = gameEnv.availableInstantAction || {};
      if (!availableInstantAction.buildNationCandidate) {
        return { success: false, message: '거병할 수 없는 모드입니다.' };
      }

      const generalNo = general.data?.no;
      if (!generalNo) {
        return { success: false, message: '장수 번호를 찾을 수 없습니다' };
      }

      await GeneralRecord.create({
        session_id: sessionId,
        general_id: generalNo,
        year: gameEnv.year || 184,
        month: gameEnv.month || 1,
        type: 'action',
        text: '거병을 신청하였습니다. 게임 시작 시 자동으로 국가를 세웁니다.',
        date: new Date()
      });

      general.data = general.data || {};
      general.data.killturn = gameEnv.killturn || 6;
      general.markModified('data');
      await general.save();

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
