import mongoose, { Schema, Document } from 'mongoose';

/**
 * GeneralRecord - general_record
 * PHP의 general_record 테이블과 호환
 * 
 * PHP 구조:
 * - general_id: INT
 * - log_type: VARCHAR ('history', 'action', 'battle_brief', 'battle') - PHP와 동일
 * - year: INT
 * - month: INT  
 * - text: TEXT
 */

export interface IGeneralRecord extends Document {
  session_id: string;
  general_id: number;
  log_type: string;
  year: number;
  month: number;
  text: string;
  data?: Record<string, any>;
  created_at?: Date;
}

const GeneralRecordSchema = new Schema<IGeneralRecord>({
  session_id: { type: String, required: true },
  general_id: { type: Number, required: true, index: true },
  log_type: { type: String, required: true, index: true },
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  text: { type: String, required: true },
  data: { type: Schema.Types.Mixed, default: {} },
  created_at: { type: Date, default: Date.now }
}, {
  timestamps: false,
  collection: 'general_records'
});

// 인덱스 추가 (조회 성능 향상)
// 원본 SQL: INDEX `date` (`general_id`, `log_type`, `year`, `month`, `id`)
// 원본 SQL: INDEX `plain` (`general_id`, `log_type`, `id`)
GeneralRecordSchema.index({ session_id: 1, general_id: 1, log_type: 1, year: 1, month: 1 });
GeneralRecordSchema.index({ session_id: 1, general_id: 1, log_type: 1 });
GeneralRecordSchema.index({ created_at: -1 }); // 최근 로그 조회용

// Virtual 'id' 필드 추가 (_id를 id로 매핑, PHP 호환성)
GeneralRecordSchema.virtual('id').get(function() {
  return this._id?.toString();
});

// toJSON/toObject에 virtuals 포함
GeneralRecordSchema.set('toJSON', { virtuals: true });
GeneralRecordSchema.set('toObject', { virtuals: true });

export const GeneralRecord = mongoose.models.GeneralRecord || mongoose.model<IGeneralRecord>('GeneralRecord', GeneralRecordSchema);
