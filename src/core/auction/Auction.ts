import { DB } from '../../config/db';
import { IGeneral } from '../../models/general.model';
import { Util } from '../../utils/Util';
import { AuctionType, ResourceType } from '../../types/auction.types';

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

  protected auctionID: number;
  protected general: IGeneral;
  protected info: any; // AuctionInfo

  constructor(auctionID: number, general: IGeneral) {
    this.auctionID = auctionID;
    this.general = general;
    // TODO: DB에서 경매 정보 로드
  }

  /**
   * 난독화된 이름 생성
   */
  static genObfuscatedName(id: number): string {
    const db = DB.db();
    // TODO: KVStorage 구현
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
  public getHighestBid(): any | null {
    const db = DB.db();
    const info = this.info;

    // TODO: 실제 구현
    // if (!info.detail.isReverse) {
    //   const rawHighestBid = await db.queryFirstRow(
    //     'SELECT * FROM ng_auction_bid WHERE auction_id = ? ORDER BY amount DESC LIMIT 1',
    //     this.auctionID
    //   );
    // } else {
    //   const rawHighestBid = await db.queryFirstRow(
    //     'SELECT * FROM ng_auction_bid WHERE auction_id = ? ORDER BY amount ASC LIMIT 1',
    //     this.auctionID
    //   );
    // }

    return null;
  }

  /**
   * 내 이전 입찰 가져오기
   */
  public getMyPrevBid(): any | null {
    const db = DB.db();
    const info = this.info;

    // TODO: 실제 구현
    return null;
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
  public shrinkCloseDate(date?: Date): string | null {
    if (date === undefined) {
      date = new Date();
    }

    this.info.closeDate = date;
    const db = DB.db();
    // TODO: DB 업데이트
    // await db.update('ng_auction', this.info.toArray('id'), 'id = ?', this.info.id);

    return null;
  }

  /**
   * 최신 입찰 기준 종료 날짜 연장
   */
  public extendLatestBidCloseDate(date?: Date): string | null {
    // TODO: 구현
    return null;
  }

  /**
   * 종료 날짜 연장
   */
  public extendCloseDate(date: Date, force: boolean = false): string | null {
    // TODO: 구현
    return null;
  }

  /**
   * DB에 적용
   */
  public applyDB(): void {
    const db = DB.db();
    // TODO: 구현
    // await db.update('ng_auction', this.info.toArray('id'), 'id = ?', this.info.id);
  }

  /**
   * 입찰 환불
   */
  public refundBid(bidItem: any, reason: string): void {
    // TODO: 구현
  }

  /**
   * 경매 종료
   */
  public closeAuction(isRollback: boolean = false): void {
    // TODO: 구현
  }

  /**
   * 입찰
   */
  public bid(amount: number, tryExtendCloseDate: boolean = false): string | null {
    // TODO: 구현
    return null;
  }

  /**
   * 경매 완료 시도
   */
  public tryFinish(): boolean | null {
    // TODO: 구현
    return null;
  }

  /**
   * 경매 롤백 (추상 메서드)
   */
  protected abstract rollbackAuction(): void;

  /**
   * 경매 완료 처리 (추상 메서드)
   */
  protected abstract finishAuction(highestBid: any, bidder: IGeneral): string | null;
}

