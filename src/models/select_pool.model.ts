import mongoose, { Schema, Document } from 'mongoose';

/**
 * SelectPool - select_pool
 * 동적 필드를 위한 완전히 유연한 스키마
 */

export interface ISelectPool extends Document {
  session_id: string;
  data: Record<string, any>;  // 완전 동적!
}

const SelectPoolSchema = new Schema<ISelectPool>({
  session_id: { type: String, required: true, index: true },
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  collection: 'select_pools'
});

// 복합 인덱스 추가
SelectPoolSchema.index({ session_id: 1, 'data.id': 1 }, { unique: true });

export const SelectPool = mongoose.model<ISelectPool>('SelectPool', SelectPoolSchema);
