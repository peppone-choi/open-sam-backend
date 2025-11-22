import mongoose, { Schema, Document, Model } from 'mongoose';
import { GalaxyFactionCode } from './GalaxySession.model';

export type GalaxyEconomyEventType =
  | 'tax'
  | 'subsidy'
  | 'logistics'
  | 'trade'
  | 'penalty'
  | 'custom';

export interface IGalaxyEconomyEvent extends Document {
  session_id: string;
  eventId: string;
  type: GalaxyEconomyEventType;
  faction?: GalaxyFactionCode;
  amount: number;
  currency: 'credit';
  summary: string;
  description?: string;
  supplyImpact?: number;
  tradeImpact?: number;
  createdBy?: {
    userId?: string;
    characterId?: string;
    displayName?: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

const GalaxyEconomyEventSchema = new Schema<IGalaxyEconomyEvent>(
  {
    session_id: { type: String, required: true, index: true },
    eventId: { type: String, required: true, unique: true },
    type: {
      type: String,
      enum: ['tax', 'subsidy', 'logistics', 'trade', 'penalty', 'custom'],
      default: 'custom',
    },
    faction: {
      type: String,
      enum: ['empire', 'alliance', 'rebel'],
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'credit' },
    summary: { type: String, required: true },
    description: { type: String },
    supplyImpact: { type: Number, default: 0 },
    tradeImpact: { type: Number, default: 0 },
    createdBy: {
      userId: { type: String },
      characterId: { type: String },
      displayName: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

GalaxyEconomyEventSchema.index({ session_id: 1, createdAt: -1 });

export const GalaxyEconomyEvent =
  (mongoose.models.GalaxyEconomyEvent as Model<IGalaxyEconomyEvent> | undefined) || mongoose.model<IGalaxyEconomyEvent>('GalaxyEconomyEvent', GalaxyEconomyEventSchema);
