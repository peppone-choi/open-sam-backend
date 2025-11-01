import mongoose, { Schema, Document } from 'mongoose';

/**
 * NgDiplomacy - ng_diplomacy
 * 동적 필드를 위한 완전히 유연한 스키마
 */

export interface INgDiplomacy extends Document {
  session_id: string;
  data: Record<string, any>;  // 완전 동적!
}

const NgDiplomacySchema = new Schema<INgDiplomacy>({
  session_id: { type: String, required: true, index: true },
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  collection: 'ng_diplomacys'
});

// 복합 인덱스 추가

export const NgDiplomacy = mongoose.model<INgDiplomacy>('NgDiplomacy', NgDiplomacySchema);
