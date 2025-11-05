import mongoose, { Schema, Document } from 'mongoose';

/**
 * GeneralRecord - general_record
 * 동적 필드를 위한 완전히 유연한 스키마
 */

export interface IGeneralRecord extends Document {
  session_id: string;
  data: Record<string, any>;  // 완전 동적!
}

const GeneralRecordSchema = new Schema<IGeneralRecord>({
  session_id: { type: String, required: true, index: true },
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  collection: 'general_records'
});

// 인덱스 추가 (조회 성능 향상)
// 원본 SQL: INDEX `date` (`general_id`, `log_type`, `year`, `month`, `id`)
// 원본 SQL: INDEX `plain` (`general_id`, `log_type`, `id`)
GeneralRecordSchema.index({ session_id: 1, 'data.general_id': 1, 'data.log_type': 1, 'data.year': 1, 'data.month': 1 });
GeneralRecordSchema.index({ session_id: 1, 'data.general_id': 1, 'data.log_type': 1 });
// 유니크 인덱스는 제거 - 원본 SQL에도 없고, data.id가 null일 수 있음

export const GeneralRecord = mongoose.models.GeneralRecord || mongoose.model<IGeneralRecord>('GeneralRecord', GeneralRecordSchema);
