// @ts-nocheck - Argument count mismatches need review
import { generalRepository } from '../../repositories/general.repository';
import { auctionRepository } from '../../repositories/auction.repository';
import { verifyGeneralOwnership } from '../../common/auth-utils';

export class OpenUniqueAuctionService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const userId = user?.userId || user?.id;

    const { itemID, amount } = data;

    try {
      if (!itemID || !amount) {
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

      const minPoint = 100;
      if (amount < minPoint) {
        throw new Error(`최소 경매 금액은 ${minPoint}입니다.`);
      }

      const existingItemAuction = await auctionRepository.findOneByFilter({
        session_id: sessionId,
        type: 'UniqueItem',
        target: itemID,
        finished: false
      });

      if (existingItemAuction) {
        throw new Error('이미 경매가 진행중입니다.');
      }

      const existingAuction = await auctionRepository.findOneByFilter({
        session_id: sessionId,
        hostGeneralId: generalId,
        type: 'UniqueItem',
        finished: false
      });

      if (existingAuction) {
        throw new Error('아직 경매가 끝나지 않았습니다.');
      }

      const now = new Date();
      const turnTerm = 10;
      const closeMinutes = Math.max(30, turnTerm * 24);
      const closeDate = new Date(now.getTime() + closeMinutes * 60 * 1000);
      const availableLatestBidCloseDate = new Date(closeDate.getTime() + Math.max(5, turnTerm * 0.5) * 60 * 1000);

      const obfuscatedName = this.genObfuscatedName(generalId);

      const auction = await auctionRepository.create({
        session_id: sessionId,
        type: 'UniqueItem',
        finished: false,
        target: itemID,
        hostGeneralId: generalId,
        hostName: obfuscatedName,
        reqResource: 'inheritancePoint',
        openDate: now,
        closeDate: closeDate,
        amount: 1,
        startBidAmount: amount,
        finishBidAmount: undefined,
        isReverse: false,
        remainCloseDateExtensionCnt: 1,
        availableLatestBidCloseDate: availableLatestBidCloseDate,
        title: `${itemID} 경매`,
        bids: []
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

  private static genObfuscatedName(id: number): string {
    const namePool = ['장', '왕', '마', '초', '조', '유', '관', '제갈', '손', '여'];
    const idx = id % namePool.length;
    const dupIdx = Math.floor(id / namePool.length);
    return dupIdx === 0 ? namePool[idx] : `${namePool[idx]}${dupIdx}`;
  }
}
