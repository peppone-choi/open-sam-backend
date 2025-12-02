// @ts-nocheck - Type issues need investigation
import { sessionRepository } from '../../repositories/session.repository';
import { Session } from '../../models/session.model';
import { generalRepository } from '../../repositories/general.repository';
import { NgBetting } from '../../models/ng_betting.model';
import { saveGeneral } from '../../common/cache/model-cache.helper';

const MIN_GOLD_REQUIRED_WHEN_BETTING = 500;
const MAX_BETTING_AMOUNT = 1000;

export class BetService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const bettingID = parseInt(data.bettingID);
    const bettingType = data.bettingType;
    const amount = parseInt(data.amount);
    const userId = user?.userId;
    const generalId = user?.generalId;
    
    try {
      if (!bettingID || !bettingType || !amount || !userId || !generalId) {
        return {
          success: false,
          message: '필수 파라미터가 누락되었습니다'
        };
      }

      if (!Array.isArray(bettingType)) {
        return {
          success: false,
          message: '베팅 종류 목록은 배열 형태여야 합니다.'
        };
      }


      const session = await sessionRepository.findBySessionId(sessionId );
      if (!session) {
        return {
          success: false,
          message: '세션을 찾을 수 없습니다'
        };
      }

      const sessionData = session.data as any || {};
      const bettingStor = sessionData.betting || {};
      const bettingInfo = bettingStor[`id_${bettingID}`];
      
      if (!bettingInfo) {
        return {
          success: false,
          message: '해당 베팅이 없습니다'
        };
      }

      if (bettingInfo.finished) {
        return {
          success: false,
          message: '이미 종료된 베팅입니다'
        };
      }

      const year = sessionData.year || 184;
      const month = sessionData.month || 1;
      const yearMonth = year * 12 + month;

      if (bettingInfo.closeYearMonth <= yearMonth) {
        return {
          success: false,
          message: '이미 마감된 베팅입니다'
        };
      }

      if (bettingInfo.openYearMonth > yearMonth) {
        return {
          success: false,
          message: '아직 시작되지 않은 베팅입니다'
        };
      }

      if (bettingType.length !== bettingInfo.selectCnt) {
        return {
          success: false,
          message: '필요한 선택 수를 채우지 못했습니다.'
        };
      }

      const sortedBettingType = [...bettingType].sort((a, b) => a - b);
      const uniqueBettingType = [...new Set(sortedBettingType)];
      
      if (uniqueBettingType.length !== bettingInfo.selectCnt) {
        return {
          success: false,
          message: '중복된 값이 있습니다.'
        };
      }

      for (const key of uniqueBettingType) {
        if (!bettingInfo.candidates || !bettingInfo.candidates[key]) {
          return {
            success: false,
            message: '올바른 후보가 아닙니다.'
          };
        }
      }

      const ngBettingCollection = NgBetting.collection;
      const prevBetResult = await ngBettingCollection.aggregate([
        {
          $match: {
            session_id: sessionId,
            'data.betting_id': bettingID,
            'data.user_id': userId
          }
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$data.amount' }
          }
        }
      ]).toArray();

      const prevBetAmount = prevBetResult.length > 0 ? prevBetResult[0].totalAmount : 0;

      const resKey = bettingInfo.reqInheritancePoint ? '유산포인트' : '금';

      if (prevBetAmount + amount > MAX_BETTING_AMOUNT) {
        const remainingAllowed = MAX_BETTING_AMOUNT - prevBetAmount;
        return {
          success: false,
          message: `${remainingAllowed}${resKey}까지만 베팅 가능합니다.`
        };
      }

      let remainPoint = 0;

      if (bettingInfo.reqInheritancePoint) {
        const inheritStor = sessionData[`inheritance_${userId}`] || {};
        const previous = inheritStor.previous || [0, 0];
        remainPoint = previous[0];
        
        if (remainPoint < amount) {
          return {
            success: false,
            message: '유산포인트가 충분하지 않습니다.'
          };
        }

        inheritStor.previous = [remainPoint - amount, null];
        sessionData[`inheritance_${userId}`] = inheritStor;
        session.data = sessionData;
        await session.save();

      } else {
        const general = await generalRepository.findBySessionAndNo(sessionId, generalId );
        if (!general) {
          return {
            success: false,
            message: '장수를 찾을 수 없습니다'
          };
        }

        const genData = general.data as any || {};
        const gold = genData.gold || 0;
        remainPoint = gold;
        
        if (remainPoint < MIN_GOLD_REQUIRED_WHEN_BETTING + amount) {
          return {
            success: false,
            message: '금이 부족합니다.'
          };
        }

        genData.gold = gold - amount;
        general.data = genData;
        // CQRS: 캐시에 저장
        const generalNo = genData.no || general.no || generalId;
        await saveGeneral(sessionId, generalNo, { ...general.toObject(), data: genData });
      }

      const bettingTypeKey = JSON.stringify(uniqueBettingType);

      const existingBet = await NgBetting.findOne({
        session_id: sessionId,
        'data.betting_id': bettingID,
        'data.general_id': generalId,
        'data.betting_type': bettingTypeKey
      });

      if (existingBet) {
        const existingData = existingBet.data as any;
        existingData.amount = (existingData.amount || 0) + amount;
        existingBet.data = existingData;
        await existingBet.save();
      } else {
        await NgBetting.create({
          session_id: sessionId,
          data: {
            betting_id: bettingID,
            betting_type: bettingTypeKey,
            amount: amount,
            user_id: userId,
            general_id: generalId,
            created_at: new Date()
          }
        });
      }

      return {
        success: true,
        result: true
      };
    } catch (error: any) {
      console.error('Bet 오류:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}
