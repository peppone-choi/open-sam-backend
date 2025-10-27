import { NgAuctionBidModel } from '../model/ng-auction-bid.model';
import { INgAuctionBid } from '../@types/ng-auction-bid.types';

export class NgAuctionBidRepository {
  async findById(id: string): Promise<INgAuctionBid | null> {
    const bid = await NgAuctionBidModel.findById(id).lean().exec();
    return bid as INgAuctionBid | null;
  }

  async findAll(limit = 20, skip = 0): Promise<INgAuctionBid[]> {
    const bids = await NgAuctionBidModel.find()
      .limit(limit)
      .skip(skip)
      .sort({ date: -1 })
      .lean()
      .exec();
    
    return bids as INgAuctionBid[];
  }

  async findByAuctionId(auctionId: string, limit = 20, skip = 0): Promise<INgAuctionBid[]> {
    const bids = await NgAuctionBidModel.find({ auctionId })
      .limit(limit)
      .skip(skip)
      .sort({ amount: -1, date: -1 })
      .lean()
      .exec();
    
    return bids as INgAuctionBid[];
  }

  async findHighestBid(auctionId: string): Promise<INgAuctionBid | null> {
    const bid = await NgAuctionBidModel.findOne({ auctionId })
      .sort({ amount: -1, date: -1 })
      .lean()
      .exec();
    
    return bid as INgAuctionBid | null;
  }

  async findByGeneralId(generalId: string, limit = 20, skip = 0): Promise<INgAuctionBid[]> {
    const bids = await NgAuctionBidModel.find({ generalId })
      .limit(limit)
      .skip(skip)
      .sort({ date: -1 })
      .lean()
      .exec();
    
    return bids as INgAuctionBid[];
  }

  async findBySessionId(sessionId: string, limit = 20, skip = 0): Promise<INgAuctionBid[]> {
    const bids = await NgAuctionBidModel.find({ sessionId })
      .limit(limit)
      .skip(skip)
      .sort({ date: -1 })
      .lean()
      .exec();
    
    return bids as INgAuctionBid[];
  }

  async create(data: Partial<INgAuctionBid>): Promise<INgAuctionBid> {
    const bid = new NgAuctionBidModel(data);
    await bid.save();
    return bid.toObject() as INgAuctionBid;
  }

  async update(id: string, data: Partial<INgAuctionBid>): Promise<INgAuctionBid | null> {
    const bid = await NgAuctionBidModel.findByIdAndUpdate(id, data, {
      new: true,
    }).exec();
    
    return bid ? (bid.toObject() as INgAuctionBid) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await NgAuctionBidModel.findByIdAndDelete(id).exec();
    return result !== null;
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await NgAuctionBidModel.countDocuments(filter || {}).exec();
  }
}
