import { Auction } from '../../models/auction.model';
import { General } from '../../models/general.model';
import { auctionRepository } from '../../repositories/auction.repository';
import { generalRepository } from '../../repositories/general.repository';

export class GetUniqueItemAuctionDetailService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    
    const { auctionID } = data;
    
    try {
      if (!auctionID) {
        throw new Error('auctionID가 필요합니다.');
      }

      const auction = await auctionRepository.findOneByFilter({
        _id: auctionID,
        session_id: sessionId,
        type: 'UniqueItem'
      });

      if (!auction) {
        throw new Error('선택한 경매가 없습니다.');
      }

      const bidList = [...auction.bids]
        .sort((a, b) => b.amount - a.amount)
        .map(bid => ({
          generalName: bid.generalName,
          amount: bid.amount,
          isCallerHighestBidder: bid.generalId === generalId,
          date: bid.date
        }));

      const general = await generalRepository.findBySessionAndNo({
        session_id: sessionId,
        'data.no': generalId
      });

      const remainPoint = general?.data.inherit_point || 0;
      const obfuscatedName = this.genObfuscatedName(generalId);

      return {
        success: true,
        result: true,
        auction: {
          id: auction._id,
          finished: auction.finished,
          title: auction.title,
          target: auction.target,
          isCallerHost: auction.hostGeneralId === generalId,
          hostName: auction.hostName,
          closeDate: auction.closeDate,
          remainCloseDateExtensionCnt: auction.remainCloseDateExtensionCnt,
          availableLatestBidCloseDate: auction.availableLatestBidCloseDate
        },
        bidList: bidList,
        obfuscatedName: obfuscatedName,
        remainPoint: remainPoint
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
