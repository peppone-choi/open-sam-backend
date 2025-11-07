import { NgDiplomacy } from '../../models/ng_diplomacy.model';
import { nationRepository } from '../../repositories/nation.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { ngDiplomacyRepository } from '../../repositories/ng-diplomacy.repository';

export class GetDiplomacyInfoService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const nationId = parseInt(data.nation_id) || 0;
    
    try {
      const session = await sessionRepository.findBySessionId(sessionId );
      if (!session) {
        return {
          success: false,
          message: 'Session not found'
        };
      }

      if (!nationId) {
        return {
          success: false,
          message: 'Nation ID required'
        };
      }

      const nation = await nationRepository.findOneByFilter({
        session_id: sessionId,
        nation: nationId
      });

      if (!nation) {
        return {
          success: false,
          message: 'Nation not found'
        };
      }

      const diplomacyRecords = await ngDiplomacyRepository.findByFilter({
        session_id: sessionId,
        $or: [
          { 'data.me': nationId },
          { 'data.you': nationId }
        ]
      });

      const diplomacyList: any[] = [];
      for (const record of diplomacyRecords) {
        const data = record.data as any || {};
        diplomacyList.push({
          me: data.me,
          you: data.you,
          state: data.state || 0,
          state_msg: data.state_msg || ''
        });
      }

      return {
        success: true,
        result: true,
        nation: {
          nation: nation.nation,
          name: nation.name,
          ...nation.data
        },
        diplomacy: diplomacyList
      };
    } catch (error: any) {
      console.error('GetDiplomacyInfo error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}
