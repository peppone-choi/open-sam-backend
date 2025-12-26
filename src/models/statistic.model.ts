import mongoose, { Schema, Document } from 'mongoose';

/**
 * Statistic - statistic
 * 동적 필드를 위한 완전히 유연한 스키마
 */

export interface IStatistic extends Document {
  session_id: string;
  year: number;
  month: number;
  nation_count: number;
  nation_name: string;
  gen_count: string;
  personal_hist: string;
  special_hist: string;
  power_hist: string;
  crewtype: string;
  etc: string;
  aux: string;
  data: Record<string, any>;
}

const StatisticSchema = new Schema<IStatistic>({
  session_id: { type: String, required: true, index: true },
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  nation_count: { type: Number },
  nation_name: { type: String },
  gen_count: { type: String },
  personal_hist: { type: String },
  special_hist: { type: String },
  power_hist: { type: String },
  crewtype: { type: String },
  etc: { type: String },
  aux: { type: String },
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  collection: 'statistics'
});

// 복합 인덱스 추가
StatisticSchema.index({ session_id: 1, year: 1, month: 1 });

export const Statistic = mongoose.models.Statistic || mongoose.model<IStatistic>('Statistic', StatisticSchema);
