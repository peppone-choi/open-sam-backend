// @ts-nocheck - Argument count mismatches need review
import { auctionRepository } from '../../repositories/auction.repository';
import { generalRepository } from '../../repositories/general.repository';
import { verifyGeneralOwnership } from '../../common/auth-utils';
import { buildItemClass, ItemSlot } from '../../utils/item-class';
import { GameConst } from '../../constants/GameConst';
import { KVStorage } from '../../utils/KVStorage';
import { logger } from '../../common/logger';

const ITEM_SLOTS: ItemSlot[] = ['item', 'weapon', 'book', 'horse'];

export class BidUniqueAuctionService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const userId = user?.userId || user?.id;

    const auctionID = data.auctionID || data.auction_id;
    const amount = data.amount || data.bid_price;
    const extendCloseDate = data.extendCloseDate || data.try_extend_close_date;

    try {
      if (!auctionID || !amount) {
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

      const auction = await auctionRepository.findOneByFilter({
        _id: auctionID,
        session_id: sessionId,
        type: 'UniqueItem'
      });

      if (!auction) {
        throw new Error('경매를 찾을 수 없습니다.');
      }

      if (auction.finished) {
        throw new Error('경매가 이미 끝났습니다.');
      }

      const now = new Date();
      if (auction.closeDate < now) {
        throw new Error('경매가 이미 끝났습니다.');
      }

      // 경매 아이템 코드와 슬롯 확인
      const itemCode = auction.target;
      if (!itemCode) {
        throw new Error('경매 아이템 정보가 없습니다.');
      }

      // 이 아이템이 장착되는 슬롯들 확인 (PHP: bidItemTypes)
      const bidItemSlots = this.getItemSlots(itemCode);
      if (bidItemSlots.length === 0) {
        throw new Error('아이템 슬롯 정보를 찾을 수 없습니다.');
      }

      // 장수가 해당 슬롯에 이미 유니크를 보유하고 있는지 확인 (PHP: ownItem check)
      for (const slot of bidItemSlots) {
        const ownItem = general[slot] ?? general.data?.[slot];
        if (ownItem && ownItem !== 'None') {
          const ownItemObj = buildItemClass(ownItem);
          if (ownItemObj && !ownItemObj.isBuyable()) {
            throw new Error('이미 가진 아이템이 있습니다.');
          }
        }
      }

      // 다른 유니크 경매에서 1순위 입찰자인 경우 같은 슬롯인지 확인 (PHP 로직)
      const otherAuctions = await auctionRepository.findByFilter({
        session_id: sessionId,
        type: 'UniqueItem',
        finished: false,
        _id: { $ne: auctionID }
      });

      for (const otherAuction of otherAuctions) {
        const otherBids = otherAuction.bids || [];
        if (otherBids.length === 0) continue;

        // 최고 입찰 확인
        const otherHighestBid = otherBids.reduce((max, bid) => 
          bid.amount > max.amount ? bid : max
        );

        // 내가 1순위 입찰자인지 확인
        if (otherHighestBid.generalId !== generalId) continue;

        // 같은 슬롯인지 확인
        const otherItemSlots = this.getItemSlots(otherAuction.target);
        for (const slot of otherItemSlots) {
          if (bidItemSlots.includes(slot)) {
            throw new Error('1순위 입찰자인 경매중에 같은 부위가 있습니다.');
          }
        }
      }

      const highestBid = auction.bids.length > 0
        ? auction.bids.reduce((max, bid) => bid.amount > max.amount ? bid : max)
        : null;

      if (highestBid && amount < highestBid.amount * 1.01) {
        throw new Error('현재입찰가보다 1% 높게 입찰해야 합니다.');
      }

      if (highestBid && amount < highestBid.amount + 10) {
        throw new Error('현재입찰가보다 10 포인트 높게 입찰해야 합니다.');
      }

      const myPrevBid = auction.bids.find(b => b.generalId === generalId);
      const morePoint = amount - (myPrevBid ? myPrevBid.amount : 0);

      const currPoint = general.inherit_point || 0;
      if (currPoint < morePoint) {
        throw new Error('유산포인트가 부족합니다.');
      }

      // 이전 최고 입찰자 환불 (내가 아닌 경우)
      if (highestBid && !myPrevBid) {
        const oldBidder = await generalRepository.findBySessionAndNo(sessionId, highestBid.generalId);
        if (oldBidder) {
          await generalRepository.updateBySessionAndNo(sessionId, highestBid.generalId, {
            inherit_point: (oldBidder.inherit_point || 0) + highestBid.amount
          });
          logger.info('[BidUniqueAuction] Refunded previous bidder', {
            sessionId,
            auctionId: auctionID,
            previousBidderId: highestBid.generalId,
            refundAmount: highestBid.amount
          });
        }
      }

      auction.bids.push({
        generalId: generalId,
        generalName: general.name,
        ownerName: general.owner_name || '',
        amount: amount,
        date: now,
        tryExtendCloseDate: extendCloseDate || false
      });

      const newInheritPoint = (general.inherit_point || 0) - morePoint;

      // 게임 환경에서 턴텀 조회
      const gameStor = KVStorage.getStorage(`game_env:${sessionId}`);
      const turnTermRaw = await gameStor.getValue('turnterm');
      const turnTerm = typeof turnTermRaw === 'number' ? turnTermRaw : Number(turnTermRaw) || 10;
      
      if (auction.availableLatestBidCloseDate) {
        const extendMinutes = Math.max(1, turnTerm * (1/6));
        const extendedCloseDate = new Date(now.getTime() + extendMinutes * 60 * 1000);

        if (extendedCloseDate > auction.closeDate && auction.closeDate < auction.availableLatestBidCloseDate) {
          auction.closeDate = extendedCloseDate < auction.availableLatestBidCloseDate 
            ? extendedCloseDate 
            : auction.availableLatestBidCloseDate;
        }
      }

      await auction.save();
      await generalRepository.updateBySessionAndNo(sessionId, generalId, {
        inherit_point: newInheritPoint
      });

      // 경매 입찰 이벤트 브로드캐스트
      const { GameEventEmitter } = await import('../gameEventEmitter');
      GameEventEmitter.broadcastAuctionUpdate(sessionId, auctionID, {
        status: 'bid',
        bidderId: generalId,
        bidderName: general.name,
        amount,
        closeDate: auction.closeDate
      });

      return {
        success: true,
        result: true
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * 아이템 코드가 장착되는 슬롯들을 반환합니다.
   * (PHP: GameConst::$allItems에서 해당 아이템이 있는 슬롯들)
   */
  private static getItemSlots(itemCode: string): ItemSlot[] {
    const allItems = GameConst.allItems || {};
    const slots: ItemSlot[] = [];

    for (const [itemType, itemList] of Object.entries(allItems)) {
      if (!itemList || !(itemCode in itemList)) {
        continue;
      }
      const count = itemList[itemCode];
      if (typeof count === 'number' && count > 0) {
        if (ITEM_SLOTS.includes(itemType as ItemSlot)) {
          slots.push(itemType as ItemSlot);
        }
      }
    }

    return slots;
  }
}
