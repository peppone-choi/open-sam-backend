import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * WorldHistory - world_history
 * PHP의 world_history 테이블과 호환
 * 
 * PHP 구조:
 * - nation_id: INT (0이면 전역, >0이면 국가)
 * - year: INT
 * - month: INT
 * - text: TEXT
 * 
 * 용도:
 * - nation_id = 0: 전역 이력 (pushGlobalHistoryLog)
 * - nation_id > 0: 국가 이력 (pushNationHistoryLog)
 */

export interface IWorldHistory extends Document {
  session_id: string;
  nation_id: number;  // 0=전역, >0=국가
  year: number;
  month: number;
  text: string;
  created_at?: Date;
}

const WorldHistorySchema = new Schema<IWorldHistory>({
  session_id: { type: String, required: true },
  nation_id: { type: Number, required: true, index: true },
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  text: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
}, {
  timestamps: false,
  collection: 'world_historys'
});

// 인덱스 추가 (조회 성능 향상)
WorldHistorySchema.index({ session_id: 1, nation_id: 1, year: 1, month: 1 });
WorldHistorySchema.index({ session_id: 1, nation_id: 1 });
WorldHistorySchema.index({ created_at: -1 });

export const WorldHistory = mongoose.models.WorldHistory || mongoose.model<IWorldHistory>('WorldHistory', WorldHistorySchema);
