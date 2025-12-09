import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IHallOfFame extends Document {
  session_id: string;
  season: number;
  scenario?: string | number | null;
  category: string;
  rank: number;
  general_no?: number;
  general_name?: string;
  nation_id?: number;
  nation_name?: string;
  value: number;
  recorded_at?: Date;
  meta?: Record<string, any>;
}

const HallOfFameSchema = new Schema<IHallOfFame>(
  {
    session_id: { type: String, required: true, index: true },
    season: { type: Number, default: 1 },
    scenario: { type: Schema.Types.Mixed },
    category: { type: String, required: true, index: true },
    rank: { type: Number, required: true },
    general_no: Number,
    general_name: String,
    nation_id: Number,
    nation_name: String,
    value: { type: Number, required: true },
    recorded_at: { type: Date, default: Date.now },
    meta: { type: Schema.Types.Mixed, default: {} }
  },
  {
    timestamps: true
  }
);

HallOfFameSchema.index(
  { session_id: 1, season: 1, category: 1, rank: 1 },
  { unique: true }
);
HallOfFameSchema.index({ category: 1, value: -1 });
HallOfFameSchema.index({ session_id: 1, category: 1, value: -1 });

export const HallOfFame =
  mongoose.models.HallOfFame ||
  mongoose.model<IHallOfFame>('HallOfFame', HallOfFameSchema);


