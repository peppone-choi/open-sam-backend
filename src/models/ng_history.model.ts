import mongoose, { Schema, Document } from 'mongoose';

/**
 * NgHistory - ng_historys
 * 게임 히스토리 기록
 */

export interface INgHistory extends Document {
  server_id: string;
  year: number;
  month: number;
  global_history?: any;
  global_action?: any;
  nations?: any;
  map?: any;
}

const NgHistorySchema = new Schema<INgHistory>({
  server_id: { type: String, required: true, index: true },
  year: { type: Number, required: true, index: true },
  month: { type: Number, required: true, index: true },
  global_history: { type: Schema.Types.Mixed },
  global_action: { type: Schema.Types.Mixed },
  nations: { type: Schema.Types.Mixed },
  map: { type: Schema.Types.Mixed }
}, {
  timestamps: true,
  collection: 'ng_historys'
});

// 복합 인덱스 추가
NgHistorySchema.index({ server_id: 1, year: 1, month: 1 }, { unique: true });

export const NgHistory = mongoose.models.NgHistory || mongoose.model<INgHistory>('NgHistory', NgHistorySchema);
