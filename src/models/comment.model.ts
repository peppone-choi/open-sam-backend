import mongoose, { Schema, Document } from 'mongoose';

/**
 * Comment - comment
 * 동적 필드를 위한 완전히 유연한 스키마
 */

export interface IComment extends Document {
  session_id: string;
  data: Record<string, any>;  // 완전 동적!
}

const CommentSchema = new Schema<IComment>({
  session_id: { type: String, required: true, index: true },
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  collection: 'comments'
});

// 복합 인덱스 추가

export const Comment = mongoose.model<IComment>('Comment', CommentSchema);
