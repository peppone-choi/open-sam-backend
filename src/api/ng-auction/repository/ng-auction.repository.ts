import { NgAuctionModel } from '../model/ng-auction.model';
import { INgAuction } from '../@types/ng-auction.types';

export class NgAuctionRepository {
  async findById(id: string): Promise<INgAuction | null> {
    const auction = await NgAuctionModel.findById(id).lean().exec();
    return auction as INgAuction | null;
  }

  async findAll(limit = 20, skip = 0): Promise<INgAuction[]> {
    const auctions = await NgAuctionModel.find()
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    
    return auctions as INgAuction[];
  }

  async findBySessionId(sessionId: string, limit = 20, skip = 0): Promise<INgAuction[]> {
    const auctions = await NgAuctionModel.find({ sessionId })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    
    return auctions as INgAuction[];
  }

  async findActive(sessionId: string, limit = 20, skip = 0): Promise<INgAuction[]> {
    const now = new Date();
    const auctions = await NgAuctionModel.find({ 
      sessionId,
      finished: false,
      closeDate: { $gt: now }
    })
      .limit(limit)
      .skip(skip)
      .sort({ closeDate: 1 })
      .lean()
      .exec();
    
    return auctions as INgAuction[];
  }

  async findByType(sessionId: string, type: string, limit = 20, skip = 0): Promise<INgAuction[]> {
    const auctions = await NgAuctionModel.find({ sessionId, type })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    
    return auctions as INgAuction[];
  }

  async findByHostGeneralId(hostGeneralId: string, limit = 20, skip = 0): Promise<INgAuction[]> {
    const auctions = await NgAuctionModel.find({ hostGeneralId })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    
    return auctions as INgAuction[];
  }

  async create(data: Partial<INgAuction>): Promise<INgAuction> {
    const auction = new NgAuctionModel(data);
    await auction.save();
    return auction.toObject() as INgAuction;
  }

  async update(id: string, data: Partial<INgAuction>): Promise<INgAuction | null> {
    const auction = await NgAuctionModel.findByIdAndUpdate(id, data, {
      new: true,
    }).exec();
    
    return auction ? (auction.toObject() as INgAuction) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await NgAuctionModel.findByIdAndDelete(id).exec();
    return result !== null;
  }

  async count(filter?: Record<string, any>): Promise<number> {
    return await NgAuctionModel.countDocuments(filter || {}).exec();
  }
}
