// @ts-nocheck - Type cleanup pending
/**
 * AuctionExpirationDaemon
 * 
 * 경매 만료 처리 데몬
 */

import { IAuction } from '../models/auction.model';
import { generalRepository } from '../repositories/general.repository';
import { logger } from '../common/logger';
import { ActionLogger } from '../utils/ActionLogger';
import { KVStorage } from '../utils/KVStorage';
import { GameEventEmitter } from '../services/gameEventEmitter';
import { JosaUtil } from '../utils/JosaUtil';
import Redis from 'ioredis';
import { Auction } from '../core/auction/Auction';
import { DummyGeneral } from '../core/auction/DummyGeneral';
import { configManager } from '../config/ConfigManager';

const { redisUrl } = configManager.get().system;

const redis = new Redis(redisUrl, {
  connectTimeout: 5000,
  maxRetriesPerRequest: null, // ioredis에서는 null로 설정하면 무제한 재시도하지만, 일단 기본값 사용
  enableReadyCheck: true
});

/**
 * 경매 만료 확인 및 종료 처리
 */
export class AuctionExpirationDaemon {
  private static isRunning = false;
  private static intervalHandle: NodeJS.Timeout | null = null;

  static start(intervalMs: number = 60000): void {
    if (this.intervalHandle) {
      logger.warn('[AuctionExpirationDaemon] Already running');
      return;
    }

    logger.info('[AuctionExpirationDaemon] Starting daemon', { intervalMs });
    this.processAllSessions();
    this.intervalHandle = setInterval(() => {
      this.processAllSessions();
    }, intervalMs);
  }

  static stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      logger.info('[AuctionExpirationDaemon] Daemon stopped');
    }
  }

  private static async processAllSessions(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    const startTime = Date.now();

    try {
      const sessions = await Auction.distinct('session_id', {
        finished: false,
        closeDate: { $lt: new Date() }
      });

      if (sessions.length === 0) return;

      const results = await Promise.allSettled(
        sessions.map(sessionId => this.processSession(sessionId))
      );

      logger.info('[AuctionExpirationDaemon] Batch processing completed', {
        sessionCount: sessions.length,
        durationMs: Date.now() - startTime
      });
    } catch (error: any) {
      logger.error('[AuctionExpirationDaemon] Error in processAllSessions', error);
    } finally {
      this.isRunning = false;
    }
  }

  private static async processSession(sessionId: string): Promise<void> {
    const lockKey = `auction:process:${sessionId}`;
    const lockValue = `${Date.now()}_${Math.random()}`;
    const lockTTL = 30;

    try {
      const acquired = await redis.set(lockKey, lockValue, 'EX', lockTTL, 'NX');
      if (!acquired) return;

      const expiredAuctions = await Auction.find({
        session_id: sessionId,
        finished: false,
        closeDate: { $lt: new Date() }
      }).sort({ closeDate: 1 });

      if (expiredAuctions.length === 0) return;

      for (const auction of expiredAuctions) {
        try {
          await this.processAuction(sessionId, auction);
        } catch (error: any) {
          logger.error('[AuctionExpirationDaemon] Error processing auction', error);
        }
      }
    } catch (error: any) {
      logger.error('[AuctionExpirationDaemon] Error in processSession', error);
      throw error;
    } finally {
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      await redis.eval(script, 1, lockKey, lockValue);
    }
  }

  private static async processAuction(sessionId: string, auctionDoc: IAuction): Promise<void> {
    const now = new Date();
    if (now < auctionDoc.closeDate) return;

    try {
      const dummyGeneral = new DummyGeneral(sessionId);
      const auctionInstance = await Auction.loadAuction(auctionDoc._id.toString(), dummyGeneral as any);
      if (auctionInstance) {
        await auctionInstance.tryFinish();
      }
    } catch (error: any) {
      logger.error('[AuctionExpirationDaemon] Error in processAuction instance', error);
    }
  }

  private static getHighestBid(auction: IAuction): any | null {
    if (!auction.bids || auction.bids.length === 0) return null;
    const sortedBids = [...auction.bids].sort((a, b) => {
      return auction.isReverse ? a.amount - b.amount : b.amount - a.amount;
    });
    return sortedBids[0];
  }

  private static async finishAuction(
    sessionId: string,
    auction: IAuction,
    highestBid: any
  ): Promise<string | null> {
    if (auction.type === 'UniqueItem') {
      return await this.finishUniqueItemAuction(sessionId, auction, highestBid);
    } else if (auction.type === 'BuyRice' || auction.type === 'SellRice') {
      return await this.finishResourceAuction(sessionId, auction, highestBid);
    }
    return '알 수 없는 경매 타입입니다.';
  }

  private static async finishUniqueItemAuction(
    sessionId: string,
    auction: IAuction,
    highestBid: any
  ): Promise<string | null> {
    const generalId = highestBid.generalId;
    const general = await generalRepository.findByNo(sessionId, generalId);
    if (!general) return '장수를 찾을 수 없습니다.';

    const itemKey = auction.target;
    const gameStor = KVStorage.getStorage(`game_env:${sessionId}`);
    const [year, month, startYear] = await gameStor.getValuesAsArray(['year', 'month', 'startyear']);
    const relYear = year - startYear;

    const generalData = general.data || {};
    let uniqueItemCount = 0;
    const itemSlots = ['horse', 'weapon', 'book', 'item1', 'item2', 'item3'];
    
    for (const slot of itemSlots) {
      const item = generalData[slot];
      if (item && item !== 'None' && item !== 'None_Item') uniqueItemCount += 1;
    }

    let maxUniqueItems = 1;
    if (relYear >= 5) maxUniqueItems = 3;
    else if (relYear >= 3) maxUniqueItems = 2;

    if (uniqueItemCount >= maxUniqueItems) {
      const turnTerm = await gameStor.getValue('turnterm') || 60;
      const extendMinutes = Math.max(30, turnTerm * 24);
      const extendedDate = new Date(auction.closeDate.getTime() + extendMinutes * 60 * 1000);
      auction.closeDate = extendedDate;
      if (auction.availableLatestBidCloseDate) {
        auction.availableLatestBidCloseDate = new Date(auction.availableLatestBidCloseDate.getTime() + extendMinutes * 60 * 1000);
      }
      auction.hostGeneralId = 0;
      auction.hostName = '(상인)';
      await auction.save();
      return '유니크 아이템 소유 제한 상태입니다. 종료 시간이 연장됩니다.';
    }

    let targetSlot: string | null = null;
    for (const slot of itemSlots) {
      const item = generalData[slot];
      if (!item || item === 'None' || item === 'None_Item') {
        targetSlot = slot;
        break;
      }
    }

    if (!targetSlot) return '아이템을 장착할 슬롯이 없습니다.';

    await generalRepository.updateOneByFilter(
      { session_id: sessionId, no: generalId },
      { $set: { [`data.${targetSlot}`]: itemKey } }
    );

    const actionLogger = new ActionLogger(generalId, 0, year, month, sessionId);
    const generalName = generalData.name || '무명';
    const josaYi = JosaUtil.pick(generalName, '이');
    const josaUl = JosaUtil.pick(itemKey, '을');

    actionLogger.pushGeneralActionLog(`<C>${itemKey}</>${josaUl} 습득했습니다!`);
    actionLogger.pushGeneralHistoryLog(`<C>${itemKey}</>${josaUl} 습득`);
    actionLogger.pushGlobalActionLog(`<Y>${generalName}</>${josaYi} <C>${itemKey}</>${josaUl} 습득했습니다!`);
    actionLogger.pushGlobalHistoryLog(`<B><b>【보물수배】</b></><Y>${generalName}</>${josaYi} <C>${itemKey}</>${josaUl} 습득했습니다!`);
    await actionLogger.flush();

    GameEventEmitter.broadcastGameEvent(sessionId, 'auction:unique_won', {
      auctionId: auction._id,
      winnerId: generalId,
      winnerName: generalName,
      itemKey: itemKey,
      amount: highestBid.amount
    });

    GameEventEmitter.broadcastGeneralUpdate(sessionId, generalId, { itemAcquired: itemKey });
    return null;
  }

  private static async finishResourceAuction(
    sessionId: string,
    auction: IAuction,
    highestBid: any
  ): Promise<string | null> {
    const generalId = highestBid.generalId;
    const general = await generalRepository.findByNo(sessionId, generalId);
    if (!general) return '장수를 찾을 수 없습니다.';

    const generalData = general.data || {};

    if (auction.type === 'BuyRice') {
      const riceAmount = auction.amount;
      const goldAmount = highestBid.amount;
      const currentRice = generalData.rice || 0;
      await generalRepository.updateOneByFilter(
        { session_id: sessionId, no: generalId },
        { $set: { 'data.rice': currentRice + riceAmount } }
      );

      if (auction.hostGeneralId > 0) {
        const host = await generalRepository.findByNo(sessionId, auction.hostGeneralId);
        if (host) {
          const hostData = host.data || {};
          await generalRepository.updateOneByFilter(
            { session_id: sessionId, no: auction.hostGeneralId },
            { $set: { 'data.gold': (hostData.gold || 0) + goldAmount } }
          );
        }
      }
    } else if (auction.type === 'SellRice') {
      const riceAmount = auction.amount;
      const goldAmount = highestBid.amount;
      await generalRepository.updateOneByFilter(
        { session_id: sessionId, no: generalId },
        { $set: { 'data.rice': (generalData.rice || 0) + riceAmount } }
      );

      if (auction.hostGeneralId > 0) {
        const host = await generalRepository.findByNo(sessionId, auction.hostGeneralId);
        if (host) {
          const hostData = host.data || {};
          await generalRepository.updateOneByFilter(
            { session_id: sessionId, no: auction.hostGeneralId },
            { $set: { 'data.gold': (hostData.gold || 0) + goldAmount, 'data.rice': (hostData.rice || 0) - riceAmount } }
          );
        }
      }
    }

    GameEventEmitter.broadcastGameEvent(sessionId, 'auction:resource_completed', {
      auctionId: auction._id,
      type: auction.type,
      winnerId: generalId,
      amount: highestBid.amount
    });

    return null;
  }

  private static async closeAuction(
    sessionId: string,
    auction: IAuction,
    isRollback: boolean
  ): Promise<void> {
    auction.finished = true;
    if (isRollback) {
      const highestBid = this.getHighestBid(auction);
      if (highestBid) {
        await this.refundBid(sessionId, auction, highestBid, `${auction._id}번 ${auction.title}가 취소되었습니다.`);
      }
    }
    await auction.save();
    GameEventEmitter.broadcastGameEvent(sessionId, 'auction:closed', { auctionId: auction._id, isRollback });
  }

  private static async refundBid(
    sessionId: string,
    auction: IAuction,
    bid: any,
    reason: string
  ): Promise<void> {
    const generalId = bid.generalId;
    const amount = bid.amount;

    const general = await generalRepository.findByNo(sessionId, generalId);
    if (!general) return;

    const generalData = general.data || {};

    if (auction.reqResource === 'inheritancePoint') {
      const inheritStor = KVStorage.getStorage(`inheritance_${generalId}:${sessionId}`);
      const previous = await inheritStor.getValue('previous') || [0, null];
      await inheritStor.setValue('previous', [previous[0] + amount, previous[1]]);
    } else if (auction.reqResource === 'gold') {
      await generalRepository.updateOneByFilter(
        { session_id: sessionId, no: generalId },
        { $set: { 'data.gold': (generalData.gold || 0) + amount } }
      );
    } else if (auction.reqResource === 'rice') {
      await generalRepository.updateOneByFilter(
        { session_id: sessionId, no: generalId },
        { $set: { 'data.rice': (generalData.rice || 0) + amount } }
      );
    }

    GameEventEmitter.broadcastGeneralUpdate(sessionId, generalId, { refunded: amount, reason });
  }
}
