import mongoose, { Schema, Document } from 'mongoose';

/**
 * Plock - plock
 * 동적 필드를 위한 완전히 유연한 스키마
 */

export interface IPlock extends Document {
  session_id: string;
  data: Record<string, any>;  // 완전 동적!
}

const PlockSchema = new Schema<IPlock>({
  session_id: { type: String, required: true, index: true },
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  collection: 'plocks'
});

// 복합 인덱스 추가

export const Plock = mongoose.model<IPlock>('Plock', PlockSchema);
