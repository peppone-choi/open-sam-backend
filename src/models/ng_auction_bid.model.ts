import mongoose, { Schema, Document } from 'mongoose';

/**
 * NgAuctionBid - ng_auction_bid
 * 경매 입찰 모델 (legacy)
 */
export interface INgAuctionBid extends Document {
  session_id: string;
  auctionId: mongoose.Types.ObjectId;
  owner: string;
  generalId: number;
  amount: number;
  date: Date;
  aux?: Record<string, any>;
}

const NgAuctionBidSchema = new Schema<INgAuctionBid>({
  session_id: { type: String, required: true, index: true },
  auctionId: { type: Schema.Types.ObjectId, required: true, ref: 'Auction', index: true },
  owner: { type: String, required: true },
  generalId: { type: Number, required: true },
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
  aux: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  collection: 'ng_auction_bid'
});

NgAuctionBidSchema.index({ auctionId: 1, amount: -1 });
NgAuctionBidSchema.index({ session_id: 1, auctionId: 1 });

export const NgAuctionBid = mongoose.models.NgAuctionBid || mongoose.model<INgAuctionBid>('NgAuctionBid', NgAuctionBidSchema);





