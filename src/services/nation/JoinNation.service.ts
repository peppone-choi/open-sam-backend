import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';

/**
 * JoinNation Service
 * 국가 가입 처리
 */
export class JoinNationService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const targetNationId = parseInt(data.nationId || data.nation_id);
    
    try {
      if (!generalId) {
        return { success: false, message: '장수 ID가 필요합니다' };
      }

      if (!targetNationId) {
        return { success: false, message: '국가 ID가 필요합니다' };
      }

      const general = await generalRepository.findBySessionAndNo(sessionId, generalId);

      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다' };
      }

      const currentNationId = general.data?.nation || 0;

      if (currentNationId !== 0) {
        return { success: false, message: '이미 국가에 소속되어 있습니다' };
      }

      const nation = await nationRepository.findByNationNum(sessionId, targetNationId);

      if (!nation) {
        return { success: false, message: '국가를 찾을 수 없습니다' };
      }

      const scout = nation.data?.scout || 0;
      if (scout === 1) {
        return { success: false, message: '해당 국가는 현재 임관을 받지 않습니다' };
      }

      await generalRepository.updateBySessionAndNo(sessionId, generalId, {
        'data.nation': targetNationId,
        'data.officer_level': 1,
        'data.belong': targetNationId,
        'data.permission': 'normal'
      });

      await nationRepository.incrementGennum(sessionId, targetNationId, 1);

      return {
        success: true,
        result: true,
        message: `${nation.data?.name || '무명국'}에 가입하였습니다`
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}
