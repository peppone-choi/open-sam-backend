import mongoose, { Schema, Document } from 'mongoose';

/**
 * NgBetting - ng_betting
 * 동적 필드를 위한 완전히 유연한 스키마
 */

export interface INgBetting extends Document {
  session_id: string;
  data: Record<string, any>;  // 완전 동적!
}

const NgBettingSchema = new Schema<INgBetting>({
  session_id: { type: String, required: true, index: true },
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  collection: 'ng_bettings'
});

// 복합 인덱스 추가
NgBettingSchema.index({ session_id: 1, 'data.id': 1 }, { unique: true });

export const NgBetting = mongoose.model<INgBetting>('NgBetting', NgBettingSchema);
