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

// 복합 인덱스 추가
GeneralRecordSchema.index({ session_id: 1, 'data.id': 1 }, { unique: true });

export const GeneralRecord = mongoose.models.GeneralRecord || mongoose.model<IGeneralRecord>('GeneralRecord', GeneralRecordSchema);
