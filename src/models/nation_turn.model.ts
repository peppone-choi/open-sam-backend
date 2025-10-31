import mongoose, { Schema, Document } from 'mongoose';

/**
 * NationTurn - nation_turn
 * 동적 필드를 위한 완전히 유연한 스키마
 */

export interface INationTurn extends Document {
  session_id: string;
  data: Record<string, any>;  // 완전 동적!
}

const NationTurnSchema = new Schema<INationTurn>({
  session_id: { type: String, required: true, index: true },
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  collection: 'nation_turns'
});

// 복합 인덱스 추가
NationTurnSchema.index({ session_id: 1, 'data.id': 1 }, { unique: true });

export const NationTurn = mongoose.model<INationTurn>('NationTurn', NationTurnSchema);
