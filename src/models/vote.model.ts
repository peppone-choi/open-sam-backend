import mongoose, { Schema, Document } from 'mongoose';

/**
 * Vote - vote
 * 동적 필드를 위한 완전히 유연한 스키마
 */

export interface IVote extends Document {
  session_id: string;
  data: Record<string, any>;  // 완전 동적!
}

const VoteSchema = new Schema<IVote>({
  session_id: { type: String, required: true, index: true },
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  collection: 'votes'
});

// 복합 인덱스 추가
VoteSchema.index({ session_id: 1, 'data.id': 1 }, { unique: true });

export const Vote = mongoose.models.Vote || mongoose.model<IVote>('Vote', VoteSchema);
