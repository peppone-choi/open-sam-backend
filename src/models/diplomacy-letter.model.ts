import mongoose, { Schema, Document, Model } from 'mongoose';

export enum DiplomacyLetterStatus {
  PROPOSED = 0,
  ACCEPTED = 1,
  REJECTED = 2,
  CANCELLED = 3,
  EXPIRED = 4,
}

export interface IDiplomacyLetter extends Document {
  session_id: string;
  letter_id: string;
  src_nation_id: number;
  dest_nation_id: number;
  src_general_id: number;
  dest_general_id?: number;
  title: string;
  brief: string;
  detail: string;
  state: number; // Requested diplomacy state
  status: DiplomacyLetterStatus;
  term: number;
  prev_letter_id?: string;
  created_at: Date;
  updated_at: Date;
}

const DiplomacyLetterSchema: Schema = new Schema({
  session_id: { type: String, required: true },
  letter_id: { type: String, required: true, unique: true },
  src_nation_id: { type: Number, required: true },
  dest_nation_id: { type: Number, required: true },
  src_general_id: { type: Number, required: true },
  dest_general_id: { type: Number },
  title: { type: String, required: true },
  brief: { type: String, default: '' },
  detail: { type: String, default: '' },
  state: { type: Number, required: true },
  status: { type: Number, required: true, default: DiplomacyLetterStatus.PROPOSED },
  term: { type: Number, default: 0 },
  prev_letter_id: { type: String },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'diplomacy_letters'
});

DiplomacyLetterSchema.index({ session_id: 1, src_nation_id: 1 });
DiplomacyLetterSchema.index({ session_id: 1, dest_nation_id: 1 });

export const DiplomacyLetter: Model<IDiplomacyLetter> = mongoose.models.DiplomacyLetter || mongoose.model<IDiplomacyLetter>('DiplomacyLetter', DiplomacyLetterSchema);
