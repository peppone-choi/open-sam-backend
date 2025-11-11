import mongoose, { Schema, Document } from 'mongoose';

export interface IAuctionBid {
  generalId: number;
  generalName: string;
  ownerName: string;
  amount: number;
  date: Date;
  tryExtendCloseDate?: boolean;
}

export interface IAuction extends Document {
  session_id: string;
  type: 'BuyRice' | 'SellRice' | 'UniqueItem';
  finished: boolean;
  target: string;
  hostGeneralId: number;
  hostName: string;
  reqResource: 'rice' | 'gold' | 'inheritancePoint';
  openDate: Date;
  closeDate: Date;
  amount: number;
  startBidAmount: number;
  finishBidAmount?: number;
  isReverse: boolean;
  remainCloseDateExtensionCnt?: number;
  availableLatestBidCloseDate?: Date;
  title: string;
  bids: IAuctionBid[];
  createdAt: Date;
  updatedAt: Date;
}

const AuctionBidSchema = new Schema({
  generalId: { type: Number, required: true },
  generalName: { type: String, required: true },
  ownerName: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
  tryExtendCloseDate: { type: Boolean, default: false }
}, { _id: false });

const AuctionSchema = new Schema({
  session_id: { type: String, required: true },
  type: { 
    type: String, 
    required: true, 
    enum: ['BuyRice', 'SellRice', 'UniqueItem'],
    index: true 
  },
  finished: { type: Boolean, default: false, index: true },
  target: { type: String, required: true },
  hostGeneralId: { type: Number, required: true },
  hostName: { type: String, required: true },
  reqResource: { 
    type: String, 
    required: true,
    enum: ['rice', 'gold', 'inheritancePoint']
  },
  openDate: { type: Date, required: true },
  closeDate: { type: Date, required: true, index: true },
  amount: { type: Number, required: true },
  startBidAmount: { type: Number, required: true },
  finishBidAmount: { type: Number },
  isReverse: { type: Boolean, default: false },
  remainCloseDateExtensionCnt: { type: Number },
  availableLatestBidCloseDate: { type: Date },
  title: { type: String, required: true },
  bids: [AuctionBidSchema]
}, {
  timestamps: true,
  collection: 'auctions'
});

AuctionSchema.index({ session_id: 1, type: 1, finished: 1 });
AuctionSchema.index({ session_id: 1, target: 1, finished: 1 });

export const Auction = mongoose.models.Auction || mongoose.model<IAuction>('Auction', AuctionSchema);

// Legacy export names (NgAuction)
export const NgAuction = Auction;