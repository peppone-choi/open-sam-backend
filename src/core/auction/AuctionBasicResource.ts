// @ts-nocheck - Type issues need investigation
import { Auction } from './Auction';
import { IGeneral } from '../../models/general.model';
import { ResourceType, AuctionType } from '../../types/auction.types';
import { GameConst } from '../../const/GameConst';
import { Util } from '../../utils/Util';
import { DB } from '../../config/db';

/**
 * AuctionBasicResource
 * 
 * 기본 자원 경매 클래스 (쌀 구매/판매)
 */
export abstract class AuctionBasicResource extends Auction {
  static readonly MIN_AUCTION_AMOUNT = 100;
  static readonly MAX_AUCTION_AMOUNT = 10000;
  
  protected static hostRes: ResourceType;
  protected static bidderRes: ResourceType;
  protected static auctionType: AuctionType;

  /**
   * 자원 경매 열기
   */
  static async openResourceAuction(
    general: IGeneral,
    amount: number,
    closeTurnCnt: number,
    startBidAmount: number,
    finishBidAmount: number
  ): Promise<AuctionBasicResource | string> {
    if (closeTurnCnt < 1 || closeTurnCnt > 24) {
      return '종료기한은 1 ~ 24 턴 이어야 합니다.';
    }
    if (amount < this.MIN_AUCTION_AMOUNT || amount > this.MAX_AUCTION_AMOUNT) {
      return `거래량은 ${this.MIN_AUCTION_AMOUNT} ~ ${this.MAX_AUCTION_AMOUNT} 이어야 합니다.`;
    }
    if (startBidAmount < amount * 0.5 || amount * 2 < startBidAmount) {
      return '시작거래가는 50% ~ 200% 이어야 합니다.';
    }
    if (finishBidAmount < amount * 1.1 || amount * 2 < finishBidAmount) {
      return '즉시거래가는 110% ~ 200% 이어야 합니다.';
    }
    if (finishBidAmount < startBidAmount * 1.1) {
      return '즉시거래가는 시작판매가의 110% 이상이어야 합니다.';
    }

    const hostRes = this.hostRes;
    const hostResName = hostRes === ResourceType.rice ? '쌀' : '금';
    const bidderRes = this.bidderRes;
    const minimumRes = hostRes === ResourceType.rice 
      ? GameConst.baserice 
      : GameConst.basegold;
    
    if (general.getVar(hostRes.value) < amount + minimumRes) {
      return `기본 ${hostResName} ${minimumRes}은(는) 거래할 수 없습니다.`;
    }

    const db = DB.db();
    const sessionId = general.session_id;
    const generalId = general.getID();

    // 이전 경매 확인
    const { Auction } = await import('../../models/auction.model');
    const prevAuction = await Auction.findOne({
      session_id: sessionId,
      hostGeneralId: generalId,
      type: { $in: [AuctionType.BuyRice, AuctionType.SellRice] },
      finished: false
    }).lean();


    if (prevAuction) {
      return '아직 경매가 끝나지 않았습니다.';
    }

    // turnTerm 가져오기
    const { Session } = await import('../../models/session.model');
    const session = await Session.findOne({ session_id: sessionId }).lean();
    const turnTerm = session?.data?.game_env?.turnterm || session?.data?.turnterm || 60; // 기본 60분

    const now = new Date();
    const closeDate = new Date(now.getTime() + closeTurnCnt * turnTerm * 60 * 1000);

    // AuctionInfo 생성
    const auctionType = this.auctionType;
    const hostDisplayName =
      general.name ||
      general.data?.name ||
      (typeof general.getVar === 'function' ? general.getVar('name') : undefined) ||
      Auction.genObfuscatedName(generalId);
    
    const auctionInfo = {
      session_id: sessionId,
      type: auctionType,
      finished: false,
      target: String(amount),
      hostGeneralId: generalId,
      hostName: hostDisplayName,

      reqResource: bidderRes.value,
      openDate: now,
      closeDate: closeDate,
      amount: amount,
      startBidAmount: startBidAmount,
      finishBidAmount: finishBidAmount,
      isReverse: false,
      title: `${hostResName} ${amount} 경매`,
      bids: []
    };

    // 경매 열기 (openAuction 메서드 사용)
    const openResult = await Auction.openAuction(auctionInfo, general);
    if (typeof openResult === 'string') {
      return openResult;
    }


    // 자원 차감 (경매 생성 성공 후)
    general.increaseVarWithLimit(hostRes.value, -amount, 0);
    await general.applyDB(db);

    // AuctionBasicResource 인스턴스 반환을 위해 auctionID 반환
    return openResult;
  }

  /**
   * 더미 General 생성
   */
  static genDummy(initFullLogger: boolean = true): IGeneral {
    // sessionId는 나중에 설정
    const { DummyGeneral } = require('./DummyGeneral');
    return new DummyGeneral('') as any;
  }

  /**
   * 경매 롤백
   */
  protected rollbackAuction(): void {
    // FUTURE: 구현
  }

  /**
   * 경매 완료 처리
   */
  protected finishAuction(highestBid: any, bidder: IGeneral): string | null {
    // FUTURE: 구현
    return null;
  }
}

