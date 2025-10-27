import { Schema, model, Document } from 'mongoose';
import { INgAuction } from '../@types/ng-auction.types';

export interface INgAuctionDocument extends Omit<INgAuction, 'id'>, Document {
  id: string;
}

const NgAuctionSchema = new Schema<INgAuctionDocument>(
  {
    sessionId: { type: String, required: true },
    type: { 
      type: String, 
      required: true,
      enum: ['buyRice', 'sellRice', 'uniqueItem']
    },
    finished: { type: Boolean, required: true, default: false },
    target: { type: String },
    hostGeneralId: { type: String, required: true },
    reqResource: { 
      type: String, 
      required: true,
      enum: ['gold', 'rice', 'inheritPoint']
    },
    openDate: { type: Date, required: true },
    closeDate: { type: Date, required: true },
    detail: { type: Schema.Types.Mixed, required: true },
  },
  {
    timestamps: true,
  }
);

NgAuctionSchema.index({ sessionId: 1, finished: 1 });
NgAuctionSchema.index({ hostGeneralId: 1 });
NgAuctionSchema.index({ type: 1 });
NgAuctionSchema.index({ closeDate: 1 });

export const NgAuctionModel = model<INgAuctionDocument>('NgAuction', NgAuctionSchema);
