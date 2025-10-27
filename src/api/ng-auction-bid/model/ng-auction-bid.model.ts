import { Schema, model, Document } from 'mongoose';

export interface INgAuctionBidDocument extends Document {
  sessionId: string;
  // TODO: 필드 정의 (schema.sql 참조)
}

const NgAuctionBidSchema = new Schema<INgAuctionBidDocument>({
  sessionId: { type: String, required: true },
  // TODO: 스키마 정의
}, { timestamps: true });

NgAuctionBidSchema.index({ sessionId: 1 });

export const NgAuctionBidModel = model<INgAuctionBidDocument>('NgAuctionBid', NgAuctionBidSchema);
