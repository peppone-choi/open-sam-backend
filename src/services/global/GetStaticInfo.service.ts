import { Session } from '../../models/session.model';
import { General } from '../../models/general.model';
import mongoose from 'mongoose';
import { getSession } from '../../common/cache/model-cache.helper';

export class GetStaticInfoService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    
    try {
      // Load session (L1 → L2 → DB)
      const session = await getSession(sessionId);
      if (!session) {
        return {
          success: false,
          message: 'Session not found'
        };
      }

      const sessionData = (session as any).data || {};

      const db = mongoose.connection.db;
      if (!db) {
        return {
          success: false,
          message: 'Database connection unavailable'
        };
      }

      const nationCollection = db.collection('nations');
      const nationCount = await nationCollection.countDocuments({
        session_id: sessionId,
        'data.level': { $gt: 0 }
      });

      const generalCount = await (General as any).countDocuments({
        session_id: sessionId,
        owner: { $ne: 'NPC' }
      });

      const npcCount = await (General as any).countDocuments({
        session_id: sessionId,
        owner: 'NPC'
      });

      return {
        success: true,
        result: true,
        game: {
          scenario: sessionData.scenario_text || sessionData.scenario || 'Unknown',
          year: sessionData.year || 180,
          month: sessionData.month || 1,
          startYear: sessionData.startyear || 180,
          turnTerm: sessionData.turnterm || 60, // 분 단위
          maxUserCnt: sessionData.maxgeneral || 50,
          userCnt: generalCount,
          npcCnt: npcCount,
          nationCnt: nationCount,
          isUnited: sessionData.isunited || 0,
          npcMode: sessionData.npcmode || 0,
          fictionMode: sessionData.fiction ? '가상' : '사실',
          block_general_create: sessionData.block_general_create || 0,
          defaultStatTotal: 240
        }
      };
    } catch (error: any) {
      console.error('GetStaticInfo error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}
