import { Schema, model, Document } from 'mongoose';
import { INgAuctionBid } from '../@types/ng-auction-bid.types';

export interface INgAuctionBidDocument extends Omit<INgAuctionBid, 'id'>, Document {
  id: string;
}

const NgAuctionBidSchema = new Schema<INgAuctionBidDocument>(
  {
    sessionId: { type: String, required: true },
    auctionId: { type: String, required: true },
    owner: { type: String },
    generalId: { type: String, required: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true, default: Date.now },
    aux: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
  }
);

NgAuctionBidSchema.index({ sessionId: 1, auctionId: 1 });
NgAuctionBidSchema.index({ auctionId: 1, amount: -1 });
NgAuctionBidSchema.index({ generalId: 1 });
NgAuctionBidSchema.index({ date: -1 });

export const NgAuctionBidModel = model<INgAuctionBidDocument>('NgAuctionBid', NgAuctionBidSchema);
