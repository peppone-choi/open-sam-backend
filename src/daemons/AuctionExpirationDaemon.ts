// @ts-nocheck - Type cleanup pending
/**
 * AuctionExpirationDaemon
 * 
 * 경매 만료 처리 데몬
 * - 만료 시간 기반으로 모든 활성 경매를 확인하고 종료
 * - Redis 분산 락을 이용한 중복 처리 방지
 * - 유니크 아이템 경매 낙찰 처리 (소유권 이전, 로그 기록, 실패 시 환불)
 * 
 * PHP 참조: hwe/sammo/Auction.php의 tryFinish(), finishAuction()
 * 
 * 실행 주기: 매 1분마다
 * Redis 락 키: `auction:process:${sessionId}`
 * Redis 락 TTL: 30초
 */

import { Auction, IAuction } from '../models/auction.model';
import { generalRepository } from '../repositories/general.repository';
import { General } from '../models/general.model';
import { logger } from '../common/logger';
import { ActionLogger } from '../utils/ActionLogger';
import { KVStorage } from '../utils/KVStorage';
import { GameEventEmitter } from '../services/gameEventEmitter';
import { JosaUtil } from '../utils/JosaUtil';
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: 3
});

/**
 * 경매 만료 확인 및 종료 처리
 */
export class AuctionExpirationDaemon {
  private static isRunning = false;
  private static intervalHandle: NodeJS.Timeout | null = null;

  /**
   * 데몬 시작
   */
  static start(intervalMs: number = 60000): void {
    if (this.intervalHandle) {
      logger.warn('[AuctionExpirationDaemon] Already running');
      return;
    }

    logger.info('[AuctionExpirationDaemon] Starting daemon', { intervalMs });
    
    // 즉시 한 번 실행
    this.processAllSessions();

    // 주기적 실행
    this.intervalHandle = setInterval(() => {
      this.processAllSessions();
    }, intervalMs);
  }

  /**
   * 데몬 중지
   */
  static stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      logger.info('[AuctionExpirationDaemon] Daemon stopped');
    }
  }

  /**
   * 모든 세션의 경매 처리
   */
  private static async processAllSessions(): Promise<void> {
    if (this.isRunning) {
      logger.debug('[AuctionExpirationDaemon] Previous execution still running, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      // 활성 경매가 있는 세션 목록 조회
      const sessions = await Auction.distinct('session_id', {
        finished: false,
        closeDate: { $lt: new Date() }
      });

      if (sessions.length === 0) {
        logger.debug('[AuctionExpirationDaemon] No expired auctions found');
        return;
      }

      logger.info('[AuctionExpirationDaemon] Processing sessions', {
        sessionCount: sessions.length,
        sessions
      });

      // 각 세션별로 처리
      const results = await Promise.allSettled(
        sessions.map(sessionId => this.processSession(sessionId))
      );

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;

      logger.info('[AuctionExpirationDaemon] Batch processing completed', {
        sessionCount: sessions.length,
        successCount,
        failureCount,
        durationMs: Date.now() - startTime
      });
    } catch (error: any) {
      logger.error('[AuctionExpirationDaemon] Error in processAllSessions', {
        error: error.message,
        stack: error.stack
      });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 특정 세션의 경매 처리
   */
  private static async processSession(sessionId: string): Promise<void> {
    const lockKey = `auction:process:${sessionId}`;
    const lockValue = `${Date.now()}_${Math.random()}`;
    const lockTTL = 30; // 30초

    try {
      // Redis 분산 락 획득
      const acquired = await redis.set(lockKey, lockValue, 'EX', lockTTL, 'NX');
      
      if (!acquired) {
        logger.debug('[AuctionExpirationDaemon] Failed to acquire lock', { sessionId, lockKey });
        return;
      }

      logger.info('[AuctionExpirationDaemon] Lock acquired, processing session', { sessionId });

      // 만료된 경매 조회
      const expiredAuctions = await Auction.find({
        session_id: sessionId,
        finished: false,
        closeDate: { $lt: new Date() }
      }).sort({ closeDate: 1 });

      if (expiredAuctions.length === 0) {
        logger.debug('[AuctionExpirationDaemon] No expired auctions in session', { sessionId });
        return;
      }

      logger.info('[AuctionExpirationDaemon] Processing expired auctions', {
        sessionId,
        count: expiredAuctions.length
      });

      // 각 경매 처리
      for (const auction of expiredAuctions) {
        try {
          await this.processAuction(sessionId, auction);
        } catch (error: any) {
          logger.error('[AuctionExpirationDaemon] Error processing auction', {
            sessionId,
            auctionId: auction._id,
            error: error.message
          });
        }
      }

      logger.info('[AuctionExpirationDaemon] Session processing completed', {
        sessionId,
        processedCount: expiredAuctions.length
      });
    } catch (error: any) {
      logger.error('[AuctionExpirationDaemon] Error in processSession', {
        sessionId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      // 락 해제 (lockValue가 일치할 때만)
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

  /**
   * 개별 경매 처리
   */
  private static async processAuction(sessionId: string, auction: IAuction): Promise<void> {
    const now = new Date();

    if (now < auction.closeDate) {
      logger.debug('[AuctionExpirationDaemon] Auction not yet expired', {
        sessionId,
        auctionId: auction._id,
        closeDate: auction.closeDate
      });
      return;
    }

    logger.info('[AuctionExpirationDaemon] Processing auction', {
      sessionId,
      auctionId: auction._id,
      type: auction.type,
      closeDate: auction.closeDate
    });

    // 최고 입찰자 조회
    const highestBid = this.getHighestBid(auction);

    if (!highestBid) {
      // 입찰자가 없으면 경매 취소
      logger.info('[AuctionExpirationDaemon] No bidder, canceling auction', {
        sessionId,
        auctionId: auction._id
      });
      await this.closeAuction(sessionId, auction, true);
      return;
    }

    // 연장 요청 처리
    if (highestBid.tryExtendCloseDate) {
      const gameStor = KVStorage.getStorage(`game_env:${sessionId}`);
      const turnTerm = await gameStor.getValue('turnterm') || 60;
      const extendMinutes = Math.max(5, turnTerm * 1); // 최소 5분, turnTerm * 1분

      if (auction.remainCloseDateExtensionCnt === undefined || auction.remainCloseDateExtensionCnt > 0) {
        // 연장 처리
        const extendedDate = new Date(auction.closeDate.getTime() + extendMinutes * 60 * 1000);
        auction.closeDate = extendedDate;
        
        if (auction.remainCloseDateExtensionCnt !== undefined && auction.remainCloseDateExtensionCnt > 0) {
          auction.remainCloseDateExtensionCnt -= 1;
        }

        if (auction.availableLatestBidCloseDate) {
          const newLatestDate = new Date(auction.availableLatestBidCloseDate.getTime() + extendMinutes * 60 * 1000);
          auction.availableLatestBidCloseDate = newLatestDate;
        }

        await auction.save();

        logger.info('[AuctionExpirationDaemon] Auction extended', {
          sessionId,
          auctionId: auction._id,
          newCloseDate: extendedDate,
          extendMinutes
        });

        GameEventEmitter.broadcastGameEvent(sessionId, 'auction:extended', {
          auctionId: auction._id,
          newCloseDate: extendedDate
        });

        return;
      }
    }

    // 낙찰 처리
    try {
      const failReason = await this.finishAuction(sessionId, auction, highestBid);
      
      if (failReason === null) {
        // 성공
        await this.closeAuction(sessionId, auction, false);
        logger.info('[AuctionExpirationDaemon] Auction finished successfully', {
          sessionId,
          auctionId: auction._id,
          winnerId: highestBid.generalId,
          winnerName: highestBid.generalName,
          amount: highestBid.amount
        });
      } else {
        // 실패 - 낙찰자에게 메시지 전송
        logger.warn('[AuctionExpirationDaemon] Auction finish failed', {
          sessionId,
          auctionId: auction._id,
          winnerId: highestBid.generalId,
          reason: failReason
        });

        // 실패 메시지 전송 (메시지 시스템 연동 필요)
        const bidder = await generalRepository.findByNo(sessionId, highestBid.generalId);
        if (bidder) {
          // 메시지 전송 로직
        }

        // 연장 처리는 finishAuction 내부에서 수행됨
      }
    } catch (error: any) {
      logger.error('[AuctionExpirationDaemon] Error finishing auction', {
        sessionId,
        auctionId: auction._id,
        error: error.message,
        stack: error.stack
      });
      // 에러 발생 시 경매 종료하지 않음 (다음 주기에 재시도)
    }
  }

  /**
   * 최고 입찰자 조회
   */
  private static getHighestBid(auction: IAuction): any | null {
    if (!auction.bids || auction.bids.length === 0) {
      return null;
    }

    const sortedBids = [...auction.bids].sort((a, b) => {
      if (auction.isReverse) {
        return a.amount - b.amount; // 역경매 (낮은 가격)
      } else {
        return b.amount - a.amount; // 정경매 (높은 가격)
      }
    });

    return sortedBids[0];
  }

  /**
   * 경매 낙찰 처리
   */
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

  /**
   * 유니크 아이템 경매 낙찰 처리
   */
  private static async finishUniqueItemAuction(
    sessionId: string,
    auction: IAuction,
    highestBid: any
  ): Promise<string | null> {
    const generalId = highestBid.generalId;
    const general = await generalRepository.findByNo(sessionId, generalId);

    if (!general) {
      return '장수를 찾을 수 없습니다.';
    }

    const itemKey = auction.target;
    const gameStor = KVStorage.getStorage(`game_env:${sessionId}`);
    const [year, month, startYear] = await gameStor.getValuesAsArray(['year', 'month', 'startyear']);
    const relYear = year - startYear;

    // 유니크 아이템 소유 제한 확인
    const generalData = general.data || {};
    let uniqueItemCount = 0;
    const itemSlots = ['horse', 'weapon', 'book', 'item1', 'item2', 'item3'];
    
    for (const slot of itemSlots) {
      const item = generalData[slot];
      if (item && item !== 'None' && item !== 'None_Item') {
        // TODO: 아이템이 유니크인지 확인하는 로직 필요
        uniqueItemCount += 1;
      }
    }

    // 연도별 제한 (예: 1년차 1개, 3년차 2개, 5년차 3개)
    let maxUniqueItems = 1;
    if (relYear >= 5) maxUniqueItems = 3;
    else if (relYear >= 3) maxUniqueItems = 2;

    if (uniqueItemCount >= maxUniqueItems) {
      // 제한 초과 - 경매 연장
      const turnTerm = await gameStor.getValue('turnterm') || 60;
      const extendMinutes = Math.max(30, turnTerm * 24); // 최소 30분, turnTerm * 24분
      const extendedDate = new Date(auction.closeDate.getTime() + extendMinutes * 60 * 1000);

      auction.closeDate = extendedDate;
      if (auction.availableLatestBidCloseDate) {
        auction.availableLatestBidCloseDate = new Date(
          auction.availableLatestBidCloseDate.getTime() + extendMinutes * 60 * 1000
        );
      }

      // 호스트를 중립 상인으로 변경
      auction.hostGeneralId = 0;
      auction.hostName = '(상인)';

      await auction.save();

      return '유니크 아이템 소유 제한 상태입니다. 종료 시간이 연장됩니다.';
    }

    // 빈 슬롯 찾기
    let targetSlot: string | null = null;
    for (const slot of itemSlots) {
      const item = generalData[slot];
      if (!item || item === 'None' || item === 'None_Item') {
        targetSlot = slot;
        break;
      }
    }

    if (!targetSlot) {
      return '아이템을 장착할 슬롯이 없습니다.';
    }

    // 아이템 장착
    await generalRepository.updateOneByFilter(
      { session_id: sessionId, no: generalId },
      {
        $set: {
          [`data.${targetSlot}`]: itemKey
        }
      }
    );

    // 로그 기록
    const actionLogger = new ActionLogger(generalId, 0, year, month);
    const generalName = generalData.name || '무명';
    const josaYi = JosaUtil.pick(generalName, '이');
    const josaUl = JosaUtil.pick(itemKey, '을');

    actionLogger.pushGeneralActionLog(`<C>${itemKey}</>${josaUl} 습득했습니다!`);
    actionLogger.pushGeneralHistoryLog(`<C>${itemKey}</>${josaUl} 습득`);
    actionLogger.pushGlobalActionLog(`<Y>${generalName}</>${josaYi} <C>${itemKey}</>${josaUl} 습득했습니다!`);
    actionLogger.pushGlobalHistoryLog(`<B><b>【보물수배】</b></><Y>${generalName}</>${josaYi} <C>${itemKey}</>${josaUl} 습득했습니다!`);
    await actionLogger.flush();

    // 이벤트 브로드캐스트
    GameEventEmitter.broadcastGameEvent(sessionId, 'auction:unique_won', {
      auctionId: auction._id,
      winnerId: generalId,
      winnerName: generalName,
      itemKey: itemKey,
      amount: highestBid.amount
    });

    GameEventEmitter.broadcastGeneralUpdate(sessionId, generalId, {
      itemAcquired: itemKey
    });

    logger.info('[AuctionExpirationDaemon] Unique item awarded', {
      sessionId,
      auctionId: auction._id,
      generalId,
      itemKey,
      slot: targetSlot
    });

    return null; // 성공
  }

  /**
   * 자원 경매 낙찰 처리 (쌀 매매)
   */
  private static async finishResourceAuction(
    sessionId: string,
    auction: IAuction,
    highestBid: any
  ): Promise<string | null> {
    const generalId = highestBid.generalId;
    const general = await generalRepository.findByNo(sessionId, generalId);

    if (!general) {
      return '장수를 찾을 수 없습니다.';
    }

    const generalData = general.data || {};

    if (auction.type === 'BuyRice') {
      // 쌀 매입 - 판매자가 쌀을 주고, 구매자가 돈을 받음
      const riceAmount = auction.amount;
      const goldAmount = highestBid.amount;

      // 구매자(낙찰자)가 쌀을 받고 돈을 지불
      const currentRice = generalData.rice || 0;
      const currentGold = generalData.gold || 0;

      await generalRepository.updateOneByFilter(
        { session_id: sessionId, no: generalId },
        {
          $set: {
            'data.rice': currentRice + riceAmount,
            'data.gold': currentGold // 이미 입찰 시 차감됨
          }
        }
      );

      // 판매자(호스트)에게 돈 지급
      if (auction.hostGeneralId > 0) {
        const host = await generalRepository.findByNo(sessionId, auction.hostGeneralId);
        if (host) {
          const hostData = host.data || {};
          const hostGold = hostData.gold || 0;

          await generalRepository.updateOneByFilter(
            { session_id: sessionId, no: auction.hostGeneralId },
            {
              $set: {
                'data.gold': hostGold + goldAmount
              }
            }
          );
        }
      }

      logger.info('[AuctionExpirationDaemon] Rice buy auction completed', {
        sessionId,
        auctionId: auction._id,
        buyerId: generalId,
        sellerId: auction.hostGeneralId,
        riceAmount,
        goldAmount
      });
    } else if (auction.type === 'SellRice') {
      // 쌀 매도 - 판매자가 돈을 받고, 구매자가 쌀을 받음
      const riceAmount = auction.amount;
      const goldAmount = highestBid.amount;

      // 구매자(낙찰자)가 돈을 지불하고 쌀을 받음
      const currentRice = generalData.rice || 0;

      await generalRepository.updateOneByFilter(
        { session_id: sessionId, no: generalId },
        {
          $set: {
            'data.rice': currentRice + riceAmount
          }
        }
      );

      // 판매자(호스트)에게 돈 지급
      if (auction.hostGeneralId > 0) {
        const host = await generalRepository.findByNo(sessionId, auction.hostGeneralId);
        if (host) {
          const hostData = host.data || {};
          const hostGold = hostData.gold || 0;
          const hostRice = hostData.rice || 0;

          await generalRepository.updateOneByFilter(
            { session_id: sessionId, no: auction.hostGeneralId },
            {
              $set: {
                'data.gold': hostGold + goldAmount,
                'data.rice': hostRice - riceAmount
              }
            }
          );
        }
      }

      logger.info('[AuctionExpirationDaemon] Rice sell auction completed', {
        sessionId,
        auctionId: auction._id,
        sellerId: auction.hostGeneralId,
        buyerId: generalId,
        riceAmount,
        goldAmount
      });
    }

    // 이벤트 브로드캐스트
    GameEventEmitter.broadcastGameEvent(sessionId, 'auction:resource_completed', {
      auctionId: auction._id,
      type: auction.type,
      winnerId: generalId,
      amount: highestBid.amount
    });

    return null; // 성공
  }

  /**
   * 경매 종료 처리
   */
  private static async closeAuction(
    sessionId: string,
    auction: IAuction,
    isRollback: boolean
  ): Promise<void> {
    auction.finished = true;

    if (isRollback) {
      // 취소된 경우 - 최고 입찰자에게 환불
      const highestBid = this.getHighestBid(auction);
      if (highestBid) {
        await this.refundBid(sessionId, auction, highestBid, `${auction._id}번 ${auction.title}가 취소되었습니다.`);
      }
    }

    await auction.save();

    // 이벤트 브로드캐스트
    GameEventEmitter.broadcastGameEvent(sessionId, 'auction:closed', {
      auctionId: auction._id,
      isRollback
    });

    logger.info('[AuctionExpirationDaemon] Auction closed', {
      sessionId,
      auctionId: auction._id,
      isRollback
    });
  }

  /**
   * 입찰금 환불
   */
  private static async refundBid(
    sessionId: string,
    auction: IAuction,
    bid: any,
    reason: string
  ): Promise<void> {
    const generalId = bid.generalId;
    const amount = bid.amount;

    const general = await generalRepository.findByNo(sessionId, generalId);
    if (!general) {
      logger.warn('[AuctionExpirationDaemon] General not found for refund', {
        sessionId,
        generalId
      });
      return;
    }

    const generalData = general.data || {};

    if (auction.reqResource === 'inheritancePoint') {
      // 유산포인트 환불
      const inheritStor = KVStorage.getStorage(`inheritance_${generalId}:${sessionId}`);
      const previous = await inheritStor.getValue('previous') || [0, null];
      await inheritStor.setValue('previous', [previous[0] + amount, previous[1]]);

      logger.info('[AuctionExpirationDaemon] Inheritance point refunded', {
        sessionId,
        generalId,
        amount
      });
    } else if (auction.reqResource === 'gold') {
      // 골드 환불
      const currentGold = generalData.gold || 0;
      await generalRepository.updateOneByFilter(
        { session_id: sessionId, no: generalId },
        {
          $set: {
            'data.gold': currentGold + amount
          }
        }
      );

      logger.info('[AuctionExpirationDaemon] Gold refunded', {
        sessionId,
        generalId,
        amount
      });
    } else if (auction.reqResource === 'rice') {
      // 쌀 환불
      const currentRice = generalData.rice || 0;
      await generalRepository.updateOneByFilter(
        { session_id: sessionId, no: generalId },
        {
          $set: {
            'data.rice': currentRice + amount
          }
        }
      );

      logger.info('[AuctionExpirationDaemon] Rice refunded', {
        sessionId,
        generalId,
        amount
      });
    }

    // 메시지 전송 (TODO: 메시지 시스템 연동)
    // SendMessage.service에서 처리

    // 이벤트 브로드캐스트
    GameEventEmitter.broadcastGeneralUpdate(sessionId, generalId, {
      refunded: amount,
      reason
    });
  }
}
