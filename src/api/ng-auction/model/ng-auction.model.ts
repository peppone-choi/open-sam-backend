import { Schema, model, Document } from 'mongoose';

export interface INgAuctionDocument extends Document {
  sessionId: string;
  // TODO: 필드 정의 (schema.sql 참조)
}

const NgAuctionSchema = new Schema<INgAuctionDocument>({
  sessionId: { type: String, required: true },
  // TODO: 스키마 정의
}, { timestamps: true });

NgAuctionSchema.index({ sessionId: 1 });

export const NgAuctionModel = model<INgAuctionDocument>('NgAuction', NgAuctionSchema);
