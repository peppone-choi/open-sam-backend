import mongoose, { Schema, Document } from 'mongoose';

export interface IUserRecord extends Document {
  session_id: string;
  user_id: string;
  log_type: string;
  text: string;
  year?: number;
  month?: number;
  date?: string;
  created_at?: Date;
}

const UserRecordSchema = new Schema<IUserRecord>({
  session_id: { type: String, required: true, index: true },
  user_id: { type: String, required: true, index: true },
  log_type: { type: String, required: true },
  text: { type: String, required: true },
  year: { type: Number },
  month: { type: Number },
  date: { type: String },
  created_at: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'user_records'
});

UserRecordSchema.index({ session_id: 1, user_id: 1, created_at: -1 });

export const UserRecord = mongoose.model<IUserRecord>('UserRecord', UserRecordSchema);
