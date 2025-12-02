// @ts-nocheck - Argument count mismatches need review
import { generalRepository } from '../../repositories/general.repository';
import { auctionRepository } from '../../repositories/auction.repository';
import { verifyGeneralOwnership } from '../../common/auth-utils';
import { buildItemClass, ItemSlot } from '../../utils/item-class';
import { GameConst } from '../../constants/GameConst';
import { KVStorage } from '../../utils/KVStorage';
import { ActionLogger } from '../../utils/ActionLogger';
import { JosaUtil } from '../../utils/JosaUtil';
import { logger } from '../../common/logger';

const ITEM_SLOTS: ItemSlot[] = ['item', 'weapon', 'book', 'horse'];

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

      // 최소 경매 금액 검증 (PHP: GameConst::$inheritItemUniqueMinPoint)
      const minPoint = GameConst.inheritItemUniqueMinPoint ?? 100;
      if (amount < minPoint) {
        throw new Error(`최소 경매 금액은 ${minPoint}입니다.`);
      }

      // 유산 포인트 검증 (PHP: 경매 시작 비용)
      const inheritPoint = general.inherit_point ?? general.data?.inherit_point ?? 0;
      if (inheritPoint < amount) {
        throw new Error('경매를 시작할 포인트가 부족합니다.');
      }

      // 아이템 정보 조회
      const itemObj = buildItemClass(itemID);
      if (!itemObj || itemObj.id === 'None') {
        throw new Error('존재하지 않는 아이템입니다.');
      }

      // 구매 가능 아이템은 경매 불가 (PHP: isBuyable())
      if (itemObj.isBuyable()) {
        throw new Error('구매할 수 있는 아이템입니다.');
      }

      // 장수가 해당 아이템을 소유하고 있는지 검증
      const itemSlot = this.findItemSlotForGeneral(general, itemID);
      if (!itemSlot) {
        throw new Error('해당 아이템을 보유하고 있지 않습니다.');
      }

      // 이미 진행 중인 해당 아이템 경매가 있는지 확인
      const existingItemAuction = await auctionRepository.findOneByFilter({
        session_id: sessionId,
        type: 'UniqueItem',
        target: itemID,
        finished: false
      });

      if (existingItemAuction) {
        throw new Error('이미 경매가 진행중입니다.');
      }

      // 장수가 이미 다른 경매를 진행 중인지 확인
      const existingAuction = await auctionRepository.findOneByFilter({
        session_id: sessionId,
        hostGeneralId: generalId,
        type: 'UniqueItem',
        finished: false
      });

      if (existingAuction) {
        throw new Error('아직 경매가 끝나지 않았습니다.');
      }

      // 해당 아이템의 가용 개수 확인 (PHP: availableCnt)
      const availableCnt = this.getAvailableItemCount(sessionId, itemID);
      if (availableCnt <= 0) {
        throw new Error('그 유니크를 더 얻을 수 없습니다.');
      }

      // 게임 환경에서 턴텀 조회
      const gameStor = KVStorage.getStorage(`game_env:${sessionId}`);
      const [turnTermRaw, yearRaw, monthRaw] = await gameStor.getValuesAsArray(['turnterm', 'year', 'month']);
      const turnTerm = typeof turnTermRaw === 'number' ? turnTermRaw : Number(turnTermRaw) || 10;
      const year = typeof yearRaw === 'number' ? yearRaw : Number(yearRaw) || 184;
      const month = typeof monthRaw === 'number' ? monthRaw : Number(monthRaw) || 1;

      const now = new Date();
      // PHP: COEFF_AUCTION_CLOSE_MINUTES = 24, MIN_AUCTION_CLOSE_MINUTES = 30
      const closeMinutes = Math.max(30, turnTerm * 24);
      const closeDate = new Date(now.getTime() + closeMinutes * 60 * 1000);
      // PHP: COEFF_EXTENSION_MINUTES_LIMIT_BY_BID = 0.5, MIN_EXTENSION_MINUTES_LIMIT_BY_BID = 5
      const availableLatestBidCloseDate = new Date(closeDate.getTime() + Math.max(5, turnTerm * 0.5) * 60 * 1000);

      const obfuscatedName = this.genObfuscatedName(generalId);
      const itemName = itemObj.getName();

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
        title: `${itemName} 경매`,
        bids: [{
          generalId: generalId,
          generalName: general.name || `장수 ${generalId}`,
          ownerName: general.owner_name || '',
          amount: amount,
          date: now,
          tryExtendCloseDate: false
        }]
      });

      // 첫 입찰 금액 차감
      const newInheritPoint = inheritPoint - amount;
      await generalRepository.updateBySessionAndNo(sessionId, generalId, {
        inherit_point: newInheritPoint
      });

      // 글로벌 히스토리 로그 (PHP: 【보물수배】)
      const itemRawName = itemObj.getRawName();
      const josaRa = JosaUtil.pick(itemRawName, '라');
      const actionLogger = new ActionLogger(0, 0, year, month, sessionId);
      actionLogger.pushGlobalHistoryLog(
        `<C><b>【보물수배】</b></>누군가가 <C>${itemName}</>${josaRa}는 보물을 구한다는 소문이 들려옵니다.`
      );

      logger.info('[OpenUniqueAuction] Auction created', {
        sessionId,
        auctionId: auction._id,
        itemID,
        hostGeneralId: generalId,
        startAmount: amount
      });

      return {
        success: true,
        result: true,
        auctionID: auction._id
      };
    } catch (error: any) {
      logger.warn('[OpenUniqueAuction] Failed to create auction', {
        sessionId,
        generalId,
        itemID,
        error: error.message
      });
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * 장수가 보유한 아이템 슬롯에서 해당 아이템을 찾습니다.
   */
  private static findItemSlotForGeneral(general: any, itemID: string): ItemSlot | null {
    for (const slot of ITEM_SLOTS) {
      const generalItem = general[slot] ?? general.data?.[slot];
      if (generalItem === itemID) {
        return slot;
      }
    }
    return null;
  }

  /**
   * 해당 아이템의 남은 가용 개수를 계산합니다.
   * (PHP: availableCnt 로직)
   */
  private static getAvailableItemCount(sessionId: string, itemID: string): number {
    const allItems = GameConst.allItems || {};
    let availableCnt = 0;

    for (const [itemType, itemList] of Object.entries(allItems)) {
      if (!itemList || !(itemID in itemList)) {
        continue;
      }
      const maxCount = itemList[itemID];
      if (typeof maxCount === 'number' && maxCount > 0) {
        availableCnt += maxCount;
      }
    }

    // TODO: 현재 점유된 개수를 DB에서 조회하여 차감해야 함
    // const occupiedCnt = await generalRepository.countByFilter({ session_id: sessionId, [itemType]: itemID });
    // availableCnt -= occupiedCnt;

    return availableCnt;
  }

  private static genObfuscatedName(id: number): string {
    const namePool = ['장', '왕', '마', '초', '조', '유', '관', '제갈', '손', '여'];
    const idx = id % namePool.length;
    const dupIdx = Math.floor(id / namePool.length);
    return dupIdx === 0 ? namePool[idx] : `${namePool[idx]}${dupIdx}`;
  }
}
