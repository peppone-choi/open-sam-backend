// @ts-nocheck - Type issues need investigation
import { Types } from 'mongoose';
import { IGeneral } from '../../models/general.model';
import { Util } from '../../utils/Util';
import { AuctionType, ResourceType } from '../../types/auction.types';
import { IAuctionBid, Auction as AuctionModel } from '../../models/auction.model';


/**
 * Auction 추상 클래스
 * 
 * PHP 버전의 sammo\Auction 클래스를 TypeScript로 변환
 */
export abstract class Auction {
  protected static readonly COEFF_AUCTION_CLOSE_MINUTES = 24;
  protected static readonly COEFF_EXTENSION_MINUTES_PER_BID = 1 / 6;
  protected static readonly COEFF_EXTENSION_MINUTES_LIMIT_BY_BID = 0.5;
  protected static readonly MIN_AUCTION_CLOSE_MINUTES = 30;
  protected static readonly MIN_EXTENSION_MINUTES_PER_BID = 1;
  protected static readonly MIN_EXTENSION_MINUTES_LIMIT_BY_BID = 5;
  protected static readonly MIN_EXTENSION_MINUTES_BY_EXTENSION_QUERY = 5;

  protected auctionID: string;
  protected general: IGeneral;
  protected info: any; // AuctionInfo
 
  constructor(auctionID: string, general: IGeneral, info: any) {
    this.auctionID = auctionID;
    this.general = general;
    this.info = info;
  }

  /**
   * 경매 로드
   */
  public static async loadAuction(auctionID: string, general: IGeneral): Promise<any> {
    const info = await AuctionModel.findById(auctionID).lean();
    if (!info) {
      throw new Error(`Auction ${auctionID} not found.`);
    }

    // 타입에 따라 적절한 클래스 인스턴스 반환
    if (info.type === AuctionType.BuyRice) {
      const { AuctionBuyRice } = await import('./AuctionBuyRice');
      return new AuctionBuyRice(auctionID, general, info);
    } else if (info.type === AuctionType.SellRice) {
      const { AuctionSellRice } = await import('./AuctionSellRice');
      return new AuctionSellRice(auctionID, general, info);
    }
    // FUTURE: UniqueItem 등 추가
    
    return null;
  }


  /**
   * 난독화된 이름 생성
   */
  static genObfuscatedName(id: number): string {
    // FUTURE: KVStorage 구현
    // const gameStor = KVStorage.getStorage(db, 'game_env');
    
    // 임시 구현
    return `상인${id}`;
  }

  /**
   * 경매 열기
   */
  protected static async openAuction(info: any, general: IGeneral): Promise<number | string> {
    if (info.id !== null && info.id !== undefined) {
      return 'id가 지정되어 있습니다.';
    }

    // MongoDB에 경매 생성
    const { Auction } = await import('../../models/auction.model');
    try {
      const auction = await Auction.create(info);
      return auction._id;
    } catch (error: any) {
      return `경매 생성 실패: ${error.message}`;
    }
  }

  /**
   * 최고 입찰 가져오기
   */
  public getHighestBid(): IAuctionBid | null {
    const bids = this.info.bids || [];
    if (bids.length === 0) {
      return null;
    }

    if (!this.info.isReverse) {
      // 일반 경매: 금액이 가장 높은 것
      return [...bids].sort((a, b) => b.amount - a.amount)[0];
    } else {
      // 역경매: 금액이 가장 낮은 것
      return [...bids].sort((a, b) => a.amount - b.amount)[0];
    }
  }

  /**
   * 내 이전 입찰 가져오기
   */
  public getMyPrevBid(): IAuctionBid | null {
    const generalId = this.general.getID();
    const bids = this.info.bids || [];
    return bids.find(bid => bid.generalId === generalId) || null;
  }

  /**
   * 경매 정보 가져오기
   */
  public getInfo(): any {
    return this.info;
  }

  /**
   * 종료 날짜 줄이기
   */
  public async shrinkCloseDate(date?: Date): Promise<string | null> {
    if (date === undefined) {
      date = new Date();
    }

    this.info.closeDate = date;
    await AuctionModel.updateOne(
      { _id: this.auctionID },
      { $set: { closeDate: date } }
    );

    return null;
  }

  /**
   * 최신 입찰 기준 종료 날짜 연장
   */
  public async extendLatestBidCloseDate(date?: Date): Promise<string | null> {
    if (date === undefined) {
      date = new Date();
    }

    this.info.availableLatestBidCloseDate = date;
    await AuctionModel.updateOne(
      { _id: this.auctionID },
      { $set: { availableLatestBidCloseDate: date } }
    );
    return null;
  }

  /**
   * 종료 날짜 연장
   */
  public async extendCloseDate(date: Date, force: boolean = false): Promise<string | null> {
    if (!force && this.info.closeDate >= date) {
      return null;
    }

    this.info.closeDate = date;
    await AuctionModel.updateOne(
      { _id: this.auctionID },
      { $set: { closeDate: date } }
    );

    return null;
  }

  /**
   * DB에 적용
   */
  public async applyDB(): Promise<void> {
    await AuctionModel.updateOne(
      { _id: this.auctionID },
      { 
        $set: { 
          closeDate: this.info.closeDate,
          finished: this.info.finished,
          bids: this.info.bids,
          remainCloseDateExtensionCnt: this.info.remainCloseDateExtensionCnt,
          availableLatestBidCloseDate: this.info.availableLatestBidCloseDate
        } 
      }
    );
  }

  /**
   * 입찰 환불
   */
  public async refundBid(bidItem: IAuctionBid, reason: string): Promise<void> {
    const { generalRepository } = await import('../../repositories/general.repository');
    const bidder = await generalRepository.findOneByFilter({
      session_id: this.info.session_id,
      'no': bidItem.generalId
    });

    if (!bidder) {
      console.error(`Refund failed: General ${bidItem.generalId} not found.`);
      return;
    }

    const resType = this.info.reqResource;
    if (resType === 'inheritancePoint') {
      const { KVStorage } = await import('../../utils/KVStorage');
      const inheritStor = KVStorage.getStorage(`inheritance_${bidItem.generalId}:${this.info.session_id}`);
      const previous = await inheritStor.getValue('previous') || [0, null];
      await inheritStor.setValue('previous', [previous[0] + bidItem.amount, previous[1]]);
    } else {
      bidder.increaseVar(resType, bidItem.amount);
      await bidder.applyDB();
    }
    
    const logger = bidder.getLogger();
    logger.pushGeneralActionLog(`<C>${this.info.title}</C> 입찰금 <C>${bidItem.amount}</C> ${resType === 'rice' ? '군량' : (resType === 'gold' ? '금' : '유산포인트')}이 환불되었습니다. (이유: ${reason})`);
  }

  /**
   * 경매 종료
   */
  public async closeAuction(isRollback: boolean = false): Promise<void> {
    if (this.info.finished) {
      return;
    }

    if (isRollback) {
      this.rollbackAuction();
      
      // 모든 입찰자에게 환불
      for (const bid of this.info.bids) {
        await this.refundBid(bid, '경매가 취소되었습니다.');
      }
    } else {
      const highestBid = this.getHighestBid();
      if (!highestBid) {
        // 유찰 시 호스트에게 롤백
        this.rollbackAuction();
      } else {
        const { generalRepository } = await import('../../repositories/general.repository');
        const bidder = await generalRepository.findOneByFilter({
          session_id: this.info.session_id,
          'no': highestBid.generalId
        });
        
        if (bidder) {
          this.finishAuction(highestBid, bidder);
        } else {
          // 입찰자가 사라진 경우 (매우 희귀)
          this.rollbackAuction();
        }
      }
    }

    this.info.finished = true;
    await this.applyDB();
  }

  /**
   * 입찰
   */
  public async bid(amount: number, tryExtendCloseDate: boolean = false): Promise<string | null> {
    if (this.info.finished) {
      return '이미 종료된 경매입니다.';
    }

    const now = new Date();
    if (this.info.closeDate < now) {
      return '입찰 시간이 지났습니다.';
    }

    // 최소 입찰가 확인
    const highestBid = this.getHighestBid();
    if (!this.info.isReverse) {
      const minAmount = highestBid ? highestBid.amount + 1 : this.info.startBidAmount;
      if (amount < minAmount) {
        return `최소 입찰가는 ${minAmount}입니다.`;
      }
    } else {
      const maxAmount = highestBid ? highestBid.amount - 1 : this.info.startBidAmount;
      if (amount > maxAmount) {
        return `최대 입찰가는 ${maxAmount}입니다.`;
      }
    }

    // 자금 확인
    const resType = this.info.reqResource;
    if (this.general.getVar(resType) < amount) {
      return `${resType === 'rice' ? '군량' : '금'}이 부족합니다.`;
    }

    // 이전 내 입찰이 있다면 차액만큼만 차감하거나 환불 후 다시 차감
    const myPrevBid = this.getMyPrevBid();
    if (myPrevBid) {
      await this.refundBid(myPrevBid, '새로운 입찰을 위해 이전 입찰금이 환불되었습니다.');
      // bids 배열에서 제거
      this.info.bids = this.info.bids.filter(b => b.generalId !== this.general.getID());
    }

    // 자금 차감
    this.general.increaseVar(resType, -amount);
    await this.general.applyDB();

    // 새 입찰 추가
    const newBid: IAuctionBid = {
      generalId: this.general.getID(),
      generalName: this.general.name,
      ownerName: this.general.owner_name || '',
      amount: amount,
      date: now,
      tryExtendCloseDate: tryExtendCloseDate
    };

    this.info.bids.push(newBid);

    // 시간 연장 로직 (선택적)
    if (tryExtendCloseDate) {
      // PHP의 extendLatestBidCloseDate 관련 로직 구현 필요
      const extensionMinutes = Auction.MIN_EXTENSION_MINUTES_BY_EXTENSION_QUERY;
      const newCloseDate = new Date(this.info.closeDate.getTime() + extensionMinutes * 60 * 1000);
      await this.extendCloseDate(newCloseDate);
    }

    await this.applyDB();

    // 즉시 거래가 확인
    if (this.info.finishBidAmount && (
      (!this.info.isReverse && amount >= this.info.finishBidAmount) ||
      (this.info.isReverse && amount <= this.info.finishBidAmount)
    )) {
      await this.closeAuction();
    }

    return null;
  }

  /**
   * 경매 완료 시도
   */
  public async tryFinish(): Promise<boolean | null> {
    if (this.info.finished) {
      return true;
    }

    const now = new Date();
    if (this.info.closeDate <= now) {
      await this.closeAuction();
      return true;
    }

    return false;
  }

  /**
   * 경매 롤백 (추상 메서드)
   */
  protected abstract rollbackAuction(): Promise<void>;

  /**
   * 경매 완료 처리 (추상 메서드)
   */
  protected abstract finishAuction(highestBid: any, bidder: IGeneral): Promise<string | null>;
}

