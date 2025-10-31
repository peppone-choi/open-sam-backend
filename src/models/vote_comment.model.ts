import mongoose, { Schema, Document } from 'mongoose';

/**
 * VoteComment - vote_comment
 * 동적 필드를 위한 완전히 유연한 스키마
 */

export interface IVoteComment extends Document {
  session_id: string;
  data: Record<string, any>;  // 완전 동적!
}

const VoteCommentSchema = new Schema<IVoteComment>({
  session_id: { type: String, required: true, index: true },
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  collection: 'vote_comments'
});

// 복합 인덱스 추가
VoteCommentSchema.index({ session_id: 1, 'data.id': 1 }, { unique: true });

export const VoteComment = mongoose.model<IVoteComment>('VoteComment', VoteCommentSchema);
