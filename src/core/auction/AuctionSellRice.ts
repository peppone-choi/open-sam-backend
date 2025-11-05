import { AuctionBasicResource } from './AuctionBasicResource';
import { AuctionType, ResourceType } from '../../types/auction.types';

/**
 * AuctionSellRice
 * 
 * 경매에 금을 매물로 등록, 입찰자가 쌀로 판매
 */
export class AuctionSellRice extends AuctionBasicResource {
  protected static auctionType = AuctionType.SellRice;
  protected static hostRes = ResourceType.gold;
  protected static bidderRes = ResourceType.rice;
}

