import mongoose, { Schema, Document } from 'mongoose';

/**
 * Board - board
 * 동적 필드를 위한 완전히 유연한 스키마
 */

export interface IBoard extends Document {
  session_id: string;
  category: string; // 'free', 'notice', 'nation', 'tip', 'history'
  nation_id?: number;
  title: string;
  content: string;
  author_id: string;
  author_name: string;
  author_general_id?: number;
  is_secret: boolean;
  views: number;
  data: Record<string, any>;
}

const BoardSchema = new Schema<IBoard>({
  session_id: { type: String, required: true, index: true },
  category: { type: String, required: true, index: true },
  nation_id: { type: Number, index: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  author_id: { type: String, required: true },
  author_name: { type: String, required: true },
  author_general_id: { type: Number },
  is_secret: { type: Boolean, default: false },
  views: { type: Number, default: 0 },
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  collection: 'boards'
});

// 복합 인덱스 추가
BoardSchema.index({ session_id: 1, category: 1, createdAt: -1 });
BoardSchema.index({ session_id: 1, nation_id: 1, createdAt: -1 });

export const Board = mongoose.models.Board || mongoose.model<IBoard>('Board', BoardSchema);
