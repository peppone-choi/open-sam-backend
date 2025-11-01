import mongoose, { Schema, Document } from 'mongoose';

/**
 * Statistic - statistic
 * 동적 필드를 위한 완전히 유연한 스키마
 */

export interface IStatistic extends Document {
  session_id: string;
  data: Record<string, any>;  // 완전 동적!
}

const StatisticSchema = new Schema<IStatistic>({
  session_id: { type: String, required: true, index: true },
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  collection: 'statistics'
});

// 복합 인덱스 추가

export const Statistic = mongoose.model<IStatistic>('Statistic', StatisticSchema);
