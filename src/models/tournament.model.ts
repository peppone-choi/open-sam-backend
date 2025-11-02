import mongoose, { Schema, Document } from 'mongoose';

/**
 * Tournament - tournament
 * 동적 필드를 위한 완전히 유연한 스키마
 */

export interface ITournament extends Document {
  session_id: string;
  data: Record<string, any>;  // 완전 동적!
}

const TournamentSchema = new Schema<ITournament>({
  session_id: { type: String, required: true, index: true },
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  collection: 'tournaments'
});

// 복합 인덱스 추가

export const Tournament = mongoose.models.Tournament || mongoose.model<ITournament>('Tournament', TournamentSchema);
