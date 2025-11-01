import mongoose, { Schema, Document } from 'mongoose';

/**
 * GeneralAccessLog - general_access_log
 * 동적 필드를 위한 완전히 유연한 스키마
 */

export interface IGeneralAccessLog extends Document {
  session_id: string;
  data: Record<string, any>;  // 완전 동적!
}

const GeneralAccessLogSchema = new Schema<IGeneralAccessLog>({
  session_id: { type: String, required: true, index: true },
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  collection: 'general_access_logs'
});

// 복합 인덱스 추가
GeneralAccessLogSchema.index({ session_id: 1, 'data.id': 1 }, { unique: true });

export const GeneralAccessLog = mongoose.model<IGeneralAccessLog>('GeneralAccessLog', GeneralAccessLogSchema);
