import mongoose, { Schema, Document } from 'mongoose';

/**
 * Board - board
 * 동적 필드를 위한 완전히 유연한 스키마
 */

export interface IBoard extends Document {
  session_id: string;
  data: Record<string, any>;  // 완전 동적!
}

const BoardSchema = new Schema<IBoard>({
  session_id: { type: String, required: true, index: true },
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  collection: 'boards'
});

// 복합 인덱스 추가

export const Board = mongoose.model<IBoard>('Board', BoardSchema);
