import { AuctionBasicResource } from './AuctionBasicResource';
import { AuctionType, ResourceType } from '../../types/auction.types';

/**
 * AuctionBuyRice
 * 
 * 경매에 쌀을 매물로 등록, 입찰자가 금으로 구매
 */
export class AuctionBuyRice extends AuctionBasicResource {
  protected static auctionType = AuctionType.BuyRice;
  protected static hostRes = ResourceType.rice;
  protected static bidderRes = ResourceType.gold;
}

