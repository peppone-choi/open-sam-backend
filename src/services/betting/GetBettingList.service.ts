import { sessionRepository } from '../repositories/session.repository';
import { Session } from '../../models/session.model';
import mongoose from 'mongoose';

export class GetBettingListService {
  static async execute(data: any, _user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const reqType = data.req || null;
    
    try {
      const session = await sessionRepository.findBySessionId(sessionId );
      if (!session) {
        return {
          success: false,
          message: '세션을 찾을 수 없습니다'
        };
      }

      const sessionData = session.data as any || {};
      const year = sessionData.year || 180;
      const month = sessionData.month || 1;

      const bettingStor = sessionData.betting || {};
      
      const bettingList: Record<string, any> = {};
      
      for (const [key, rawItem] of Object.entries(bettingStor)) {
        const item = rawItem as any;
        
        if (reqType !== null && item.type !== reqType) {
          continue;
        }
        
        const { candidates, ...itemWithoutCandidates } = item;
        bettingList[item.id] = {
          ...itemWithoutCandidates,
          totalAmount: 0
        };
      }

      if (Object.keys(bettingList).length === 0) {
        return {
          success: true,
          result: true,
          bettingList: {},
          year,
          month
        };
      }

      const bettingIDList = Object.keys(bettingList).map(id => parseInt(id));
      
      const db = mongoose.connection.db;
      if (db) {
        const ngBettingCollection = db.collection('ng_bettings');
        
        const aggregateResult = await ngBettingCollection.aggregate([
          {
            $match: {
              session_id: sessionId,
              'data.betting_id': { $in: bettingIDList }
            }
          },
          {
            $group: {
              _id: '$data.betting_id',
              totalAmount: { $sum: '$data.amount' }
            }
          }
        ]).toArray();

        for (const result of aggregateResult) {
          const bettingID = result._id;
          if (bettingList[bettingID]) {
            bettingList[bettingID].totalAmount = result.totalAmount || 0;
          }
        }
      }

      return {
        success: true,
        result: true,
        bettingList,
        year,
        month
      };
    } catch (error: any) {
      console.error('GetBettingList 오류:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}
