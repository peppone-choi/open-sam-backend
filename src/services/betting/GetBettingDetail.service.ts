import { Session } from '../../models/session.model';
import { General } from '../../models/general.model';
import mongoose from 'mongoose';

export class GetBettingDetailService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const bettingID = parseInt(data.betting_id);
    const userId = user?.userId;
    const generalId = user?.generalId;
    
    try {
      if (!bettingID) {
        return {
          success: false,
          message: 'betting_id가 필요합니다'
        };
      }

      const session = await Session.findOne({ session_id: sessionId });
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
      const rawBettingInfo = bettingStor[`id_${bettingID}`];
      
      if (!rawBettingInfo) {
        return {
          success: false,
          message: '해당 베팅이 없습니다'
        };
      }

      const db = mongoose.connection.db;
      const bettingDetail: [string, number][] = [];
      const myBetting: [string, number][] = [];
      
      if (db) {
        const ngBettingCollection = db.collection('ng_bettings');
        
        const aggregateResult = await ngBettingCollection.aggregate([
          {
            $match: {
              session_id: sessionId,
              'data.betting_id': bettingID
            }
          },
          {
            $group: {
              _id: '$data.betting_type',
              sumAmount: { $sum: '$data.amount' }
            }
          }
        ]).toArray();

        for (const result of aggregateResult) {
          bettingDetail.push([result._id, result.sumAmount || 0]);
        }

        if (userId) {
          const myAggregateResult = await ngBettingCollection.aggregate([
            {
              $match: {
                session_id: sessionId,
                'data.betting_id': bettingID,
                'data.user_id': userId
              }
            },
            {
              $group: {
                _id: '$data.betting_type',
                sumAmount: { $sum: '$data.amount' }
              }
            }
          ]).toArray();

          for (const result of myAggregateResult) {
            myBetting.push([result._id, result.sumAmount || 0]);
          }
        }
      }

      let remainPoint = 0;
      if (rawBettingInfo.reqInheritancePoint) {
        const inheritStor = sessionData[`inheritance_${userId}`] || {};
        const previous = inheritStor.previous || [0, 0];
        remainPoint = previous[0];
      } else {
        if (generalId) {
          const general = await General.findOne({ session_id: sessionId, no: generalId })
            .select('data')
            .lean();
          if (general) {
            const genData = general.data as any || {};
            remainPoint = genData.gold || 0;
          }
        }
      }

      return {
        success: true,
        result: true,
        bettingInfo: rawBettingInfo,
        bettingDetail,
        myBetting,
        remainPoint,
        year,
        month
      };
    } catch (error: any) {
      console.error('GetBettingDetail 오류:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}
