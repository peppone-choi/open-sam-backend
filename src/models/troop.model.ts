import mongoose, { Schema, Document } from 'mongoose';

/**
 * Troop - troop
 * 동적 필드를 위한 완전히 유연한 스키마
 */

export interface ITroop extends Document {
  session_id: string;
  data: Record<string, any>;  // 완전 동적!
}

const TroopSchema = new Schema<ITroop>({
  session_id: { type: String, required: true, index: true },
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  collection: 'troops'
});

// 복합 인덱스 추가

export const Troop = mongoose.model<ITroop>('Troop', TroopSchema);
