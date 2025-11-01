import { NgDiplomacy } from '../../models/ng_diplomacy.model';
import { Nation } from '../../models/nation.model';
import { Session } from '../../models/session.model';

export class GetDiplomacyInfoService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const nationId = parseInt(data.nation_id) || 0;
    
    try {
      const session = await Session.findOne({ session_id: sessionId });
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

      const nation = await Nation.findOne({
        session_id: sessionId,
        nation: nationId
      }).lean();

      if (!nation) {
        return {
          success: false,
          message: 'Nation not found'
        };
      }

      const diplomacyRecords = await NgDiplomacy.find({
        session_id: sessionId,
        $or: [
          { 'data.me': nationId },
          { 'data.you': nationId }
        ]
      }).lean();

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
