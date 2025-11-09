import { auctionRepository } from '../../repositories/auction.repository';

export class GetUniqueItemAuctionListService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    
    try {
      const auctions = await auctionRepository.findByFilter({
        session_id: sessionId,
        type: 'UniqueItem'
      }).sort({ closeDate: 1 }).exec();

      const obfuscatedName = this.genObfuscatedName(generalId);

      const list = [];
      for (const auction of auctions) {
        const highestBid = auction.bids.length > 0
          ? auction.bids.reduce((max, bid) => bid.amount > max.amount ? bid : max)
          : null;

        if (!highestBid) {
          continue;
        }

        list.push({
          id: auction._id,
          finished: auction.finished,
          title: auction.title,
          target: auction.target,
          isCallerHost: auction.hostGeneralId === generalId,
          hostName: auction.hostName,
          closeDate: auction.closeDate,
          remainCloseDateExtensionCnt: auction.remainCloseDateExtensionCnt,
          availableLatestBidCloseDate: auction.availableLatestBidCloseDate,
          highestBid: {
            generalName: highestBid.generalName,
            amount: highestBid.amount,
            isCallerHighestBidder: highestBid.generalId === generalId,
            date: highestBid.date
          }
        });
      }

      return {
        success: true,
        result: true,
        list: list,
        obfuscatedName: obfuscatedName
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
