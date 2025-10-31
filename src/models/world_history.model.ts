import mongoose, { Schema, Document } from 'mongoose';

/**
 * WorldHistory - world_history
 * 동적 필드를 위한 완전히 유연한 스키마
 */

export interface IWorldHistory extends Document {
  session_id: string;
  data: Record<string, any>;  // 완전 동적!
}

const WorldHistorySchema = new Schema<IWorldHistory>({
  session_id: { type: String, required: true, index: true },
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  collection: 'world_historys'
});

// 복합 인덱스 추가
WorldHistorySchema.index({ session_id: 1, 'data.id': 1 }, { unique: true });

export const WorldHistory = mongoose.model<IWorldHistory>('WorldHistory', WorldHistorySchema);
