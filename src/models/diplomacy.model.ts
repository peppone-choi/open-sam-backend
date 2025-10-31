import mongoose, { Schema, Document } from 'mongoose';

export interface IDiplomacy extends Document {
  session_id: string;
  me: number;
  you: number;
  state: number;
  term: number;
}

const DiplomacySchema: Schema = new Schema({
  session_id: { type: String, required: true, index: true },
  me: { type: Number, required: true },
  you: { type: Number, required: true },
  state: { type: Number, required: true, default: 2 },
  term: { type: Number, required: true, default: 0 }
}, {
  timestamps: true,
  collection: 'diplomacy'
});

DiplomacySchema.index({ session_id: 1, me: 1, you: 1 }, { unique: true });

export const Diplomacy = mongoose.model<IDiplomacy>('Diplomacy', DiplomacySchema);
