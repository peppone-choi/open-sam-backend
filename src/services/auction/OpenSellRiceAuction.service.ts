import { Auction } from '../../models/auction.model';
import { General } from '../../models/general.model';

export class OpenSellRiceAuctionService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    
    const { amount, closeTurnCnt, startBidAmount, finishBidAmount } = data;
    
    try {
      if (!amount || !closeTurnCnt || !startBidAmount || !finishBidAmount) {
        throw new Error('필수 파라미터가 누락되었습니다.');
      }
      
      if (closeTurnCnt < 1 || closeTurnCnt > 24) {
        throw new Error('종료기한은 1 ~ 24 턴 이어야 합니다.');
      }
      
      if (amount < 100 || amount > 10000) {
        throw new Error('거래량은 100 ~ 10000 이어야 합니다.');
      }
      
      if (startBidAmount < amount * 0.5 || amount * 2 < startBidAmount) {
        throw new Error('시작거래가는 50% ~ 200% 이어야 합니다.');
      }
      
      if (finishBidAmount < amount * 1.1 || amount * 2 < finishBidAmount) {
        throw new Error('즉시거래가는 110% ~ 200% 이어야 합니다.');
      }
      
      if (finishBidAmount < startBidAmount * 1.1) {
        throw new Error('즉시거래가는 시작판매가의 110% 이상이어야 합니다.');
      }
      
      const general = await General.findOne({
        session_id: sessionId,
        'data.no': generalId
      });
      
      if (!general) {
        throw new Error('장수를 찾을 수 없습니다.');
      }

      const minimumGold = 1000;
      if (general.data.gold < amount + minimumGold) {
        throw new Error(`기본 금 ${minimumGold}은 거래할 수 없습니다.`);
      }

      const existingAuction = await Auction.findOne({
        session_id: sessionId,
        hostGeneralId: generalId,
        type: { $in: ['BuyRice', 'SellRice'] },
        finished: false
      });

      if (existingAuction) {
        throw new Error('아직 경매가 끝나지 않았습니다.');
      }

      const now = new Date();
      const turnTerm = 10;
      const closeDate = new Date(now.getTime() + closeTurnCnt * turnTerm * 60 * 1000);

      const auction = await Auction.create({
        session_id: sessionId,
        type: 'SellRice',
        finished: false,
        target: String(amount),
        hostGeneralId: generalId,
        hostName: general.data.name,
        reqResource: 'rice',
        openDate: now,
        closeDate: closeDate,
        amount: amount,
        startBidAmount: startBidAmount,
        finishBidAmount: finishBidAmount,
        isReverse: false,
        title: `금 ${amount} 경매`,
        bids: []
      });

      general.data.gold -= amount;
      await general.save();

      return {
        success: true,
        result: true,
        auctionID: auction._id
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}
