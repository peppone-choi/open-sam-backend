import mongoose, { Schema, Document } from 'mongoose';

/**
 * RankData - rank_data
 * 동적 필드를 위한 완전히 유연한 스키마
 */

export interface IRankData extends Document {
  session_id: string;
  data: Record<string, any>;  // 완전 동적!
}

const RankDataSchema = new Schema<IRankData>({
  session_id: { type: String, required: true, index: true },
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  collection: 'rank_datas'
});

// 복합 인덱스 추가
RankDataSchema.index({ session_id: 1, 'data.id': 1 }, { unique: true });

export const RankData = mongoose.model<IRankData>('RankData', RankDataSchema);
