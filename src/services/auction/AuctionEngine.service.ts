/**
 * AuctionEngine Service
 * 
 * 경매 자동 처리 엔진
 * - processAuction: 마감된 경매 처리
 * - registerAuction: 중립 매물 자동 등록
 * 
 * PHP 참조: hwe/func_auction.php
 */

import { Auction } from '../../models/auction.model';
import { General } from '../../models/general.model';
import { AuctionBuyRice } from '../../core/auction/AuctionBuyRice';
import { AuctionSellRice } from '../../core/auction/AuctionSellRice';
import { AuctionBasicResource } from '../../core/auction/AuctionBasicResource';
import { logger } from '../../common/logger';
import { Util } from '../../utils/Util';
import { AuctionType } from '../../types/auction.types';
import { auctionRepository } from '../../repositories/auction.repository';
import { generalRepository } from '../../repositories/general.repository';

/**
 * 경매 마감 처리
 * 
 * 마감 시간이 지난 경매들을 처리하여 낙찰 처리
 */
export async function processAuction(sessionId: string): Promise<void> {
  try {
    const now = new Date();
    
    // 마감 시간이 지나고 아직 완료되지 않은 경매 조회
    const auctions = await auctionRepository.findByFilter({
      session_id: sessionId,
      closeDate: { $lte: now },
      finished: false
    });

    if (!auctions || auctions.length === 0) {
      return;
    }

    logger.info(`[AuctionEngine] Processing ${auctions.length} expired auction(s)`);

    // 더미 General 생성 (중립 경매 처리용)
    const dummyGeneral = AuctionBasicResource.genDummy();

    for (const auctionDoc of auctions) {
      try {
        const auctionType = auctionDoc.type as AuctionType;
        let auction: any;

        // 경매 타입에 따라 인스턴스 생성
        if (auctionType === AuctionType.BuyRice) {
          auction = new AuctionBuyRice(auctionDoc._id, dummyGeneral);
        } else if (auctionType === AuctionType.SellRice) {
          auction = new AuctionSellRice(auctionDoc._id, dummyGeneral);
        } else {
          // UniqueItem은 나중에 구현
          logger.warn(`[AuctionEngine] Auction type ${auctionType} not yet implemented, skipping`);
          continue;
        }

        // 경매 완료 시도
        await auction.tryFinish();
        
        logger.info(`[AuctionEngine] Processed auction ${auctionDoc._id} (${auctionType})`);
      } catch (error: any) {
        logger.error(`[AuctionEngine] Error processing auction ${auctionDoc._id}`, {
          error: error.message,
          stack: error.stack
        });
      }
    }
  } catch (error: any) {
    logger.error('[AuctionEngine] Fatal error in processAuction', {
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * 중립 매물 자동 등록
 * 
 * 시장 안정화를 위해 중립 경매를 자동으로 등록
 * 
 * @param rng 난수 생성기 (선택)
 */
export async function registerAuction(sessionId: string, rng?: any): Promise<void> {
  try {
    // KVStorage에서 마지막 경매 등록 시간 확인
    const { KVStorage } = await import('../../utils/KVStorage');
    const gameStor = KVStorage.getStorage(`game_env:${sessionId}`);
    const lastAuctionRegister = await gameStor.getValue('last_auction_register');
    
    // 마지막 등록 후 1시간 이내면 스킵 (과도한 등록 방지)
    const now = new Date();
    if (lastAuctionRegister) {
      const lastRegisterTime = new Date(lastAuctionRegister);
      const timeDiff = now.getTime() - lastRegisterTime.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      if (hoursDiff < 1) {
        // 1시간 이내면 스킵
        return;
      }
    }
    
    // 난수 생성기 (없으면 기본 사용)
    const random = rng || {
      nextBool: (prob: number) => Math.random() < prob,
      nextRangeInt: (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
    };

    // 장수들의 평균 금, 쌀 조회
    const generals = await generalRepository.findBySession({
      session_id: sessionId,
      'data.npc': { $lt: 2 } // NPC 제외
    });

    if (generals.length === 0) {
      return;
    }

    let totalGold = 0;
    let totalRice = 0;
    
    for (const general of generals) {
      const data = general.data || {};
      totalGold += data.gold || 0;
      totalRice += data.rice || 0;
    }

    const avgGold = Util.valueFit(Math.floor(totalGold / generals.length), 1000, 20000);
    const avgRice = Util.valueFit(Math.floor(totalRice / generals.length), 1000, 20000);

    // 중립 경매 개수 조회 (host_general_id = 0)
    const neutralAuctions = await Auction.aggregate([
      {
        $match: {
          session_id: sessionId,
          hostGeneralId: 0,
          type: { $in: [AuctionType.BuyRice, AuctionType.SellRice] },
          finished: false
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);

    const neutralAuctionCnt: Record<string, number> = {};
    for (const item of neutralAuctions) {
      neutralAuctionCnt[item._id] = item.count;
    }

    const neutralBuyRiceCnt = neutralAuctionCnt[AuctionType.BuyRice] || 0;

    // 판매건 등록 (쌀 판매 → 금 구매)
    if (random.nextBool(1 / (neutralBuyRiceCnt + 5))) {
      const mul = random.nextRangeInt(1, 5);
      let amount = Math.floor(avgRice / 20 * mul);
      let cost = Math.floor(avgGold / 20 * 0.9 * mul);
      const topv = Math.floor(amount * 2);
      
      cost = Util.valueFit(cost, Math.floor(amount * 0.8), Math.floor(amount * 1.2));

      amount = Util.round(amount, -1);
      cost = Util.round(cost, -1);
      const finishBidAmount = Util.round(topv, -1);

      const term = random.nextRangeInt(3, 12);
      const dummyGeneral = AuctionBasicResource.genDummy();

      try {
        await AuctionBuyRice.openResourceAuction(
          dummyGeneral,
          amount,
          term,
          cost,
          finishBidAmount
        );
        // 디버그 모드에서만 로그 출력
        if (process.env.DEBUG_AUCTION === 'true') {
          logger.info(`[AuctionEngine] Registered BuyRice auction: ${amount} rice, ${cost} gold`);
        }
      } catch (error: any) {
        logger.error('[AuctionEngine] Error registering BuyRice auction', {
          error: error.message
        });
      }
    }

    const neutralSellRiceCnt = neutralAuctionCnt[AuctionType.SellRice] || 0;

    // 구매건 등록 (금 판매 → 쌀 구매)
    if (random.nextBool(1 / (neutralSellRiceCnt + 5))) {
      const mul = random.nextRangeInt(1, 5);
      let amount = Math.floor(avgGold / 20 * mul);
      let cost = Math.floor(avgRice / 20 * 1.1 * mul);
      const topv = Math.floor(amount * 2);
      
      cost = Util.valueFit(cost, Math.floor(amount * 0.8), Math.floor(amount * 1.2));

      amount = Util.round(amount, -1);
      cost = Util.round(cost, -1);
      const finishBidAmount = Util.round(topv, -1);

      const term = random.nextRangeInt(3, 12);
      const dummyGeneral = AuctionBasicResource.genDummy();

      try {
        await AuctionSellRice.openResourceAuction(
          dummyGeneral,
          amount,
          term,
          cost,
          finishBidAmount
        );
        // 디버그 모드에서만 로그 출력
        if (process.env.DEBUG_AUCTION === 'true') {
          logger.info(`[AuctionEngine] Registered SellRice auction: ${amount} gold, ${cost} rice`);
        }
      } catch (error: any) {
        logger.error('[AuctionEngine] Error registering SellRice auction', {
          error: error.message
        });
      }
    }
    
    // 마지막 등록 시간 업데이트
    await gameStor.setValue('last_auction_register', now.toISOString());
  } catch (error: any) {
    logger.error('[AuctionEngine] Fatal error in registerAuction', {
      error: error.message,
      stack: error.stack
    });
  }
}

