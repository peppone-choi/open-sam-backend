import mongoose, { Schema, Document } from 'mongoose';

export interface ITournamentHistory extends Document {
  session_id: string;
  year: number;
  month: number;
  tnmt_type: number;
  tnmt_type_name: string;
  winner_id: number;
  winner_name: string;
  runner_up_id: number;
  runner_up_name: string;
  created_at: Date;
}

const TournamentHistorySchema = new Schema<ITournamentHistory>({
  session_id: { type: String, required: true, index: true },
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  tnmt_type: { type: Number, required: true },
  tnmt_type_name: { type: String, required: true },
  winner_id: { type: Number, required: true },
  winner_name: { type: String, required: true },
  runner_up_id: { type: Number, required: true },
  runner_up_name: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

export const TournamentHistory = mongoose.models.TournamentHistory || mongoose.model<ITournamentHistory>('TournamentHistory', TournamentHistorySchema);
