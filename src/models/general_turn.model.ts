import mongoose, { Schema, Document } from 'mongoose';

/**
 * GeneralTurn - general_turn
 * 동적 필드를 위한 완전히 유연한 스키마
 */

export interface IGeneralTurn extends Document {
  session_id: string;
  data: Record<string, any>;  // 완전 동적!
}

const GeneralTurnSchema = new Schema<IGeneralTurn>({
  session_id: { type: String, required: true, index: true },
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  collection: 'general_turns'
});

// 복합 인덱스 추가
GeneralTurnSchema.index({ session_id: 1, 'data.id': 1 }, { unique: true });

export const GeneralTurn = mongoose.models.GeneralTurn || mongoose.model<IGeneralTurn>('GeneralTurn', GeneralTurnSchema);
