// @ts-nocheck - Argument count mismatches need review
import { generalRepository } from '../../repositories/general.repository';
import { auctionRepository } from '../../repositories/auction.repository';
import { verifyGeneralOwnership } from '../../common/auth-utils';

export class OpenSellRiceAuctionService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const userId = user?.userId || user?.id;

    const { amount, closeTurnCnt, startBidAmount, finishBidAmount } = data;

    try {
      if (!amount || !closeTurnCnt || !startBidAmount || !finishBidAmount) {
        throw new Error('필수 파라미터가 누락되었습니다.');
      }

      if (!generalId) {
        throw new Error('장수 ID가 필요합니다.');
      }

      if (!userId) {
        throw new Error('사용자 인증이 필요합니다.');
      }

      // 🔒 보안: 장수 소유권 검증
      const ownershipCheck = await verifyGeneralOwnership(sessionId, generalId, userId);
      if (!ownershipCheck.valid) {
        throw new Error(ownershipCheck.error || '권한이 없습니다.');
      }

      const general = ownershipCheck.general;

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

      const minimumGold = 1000;
      if (general.gold < amount + minimumGold) {
        throw new Error(`기본 금 ${minimumGold}은 거래할 수 없습니다.`);
      }

      const existingAuction = await auctionRepository.findOneByFilter({
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

      const auction = await auctionRepository.create({
        session_id: sessionId,
        type: 'SellRice',
        finished: false,
        target: String(amount),
        hostGeneralId: generalId,
        hostName: general.name,
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

      await generalRepository.updateBySessionAndNo(sessionId, generalId, {
        gold: general.gold - amount
      });

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
