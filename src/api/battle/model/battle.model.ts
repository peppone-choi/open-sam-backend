import { Schema, model, Document } from 'mongoose';

/**
 * Battle Schema
 * TODO: schema.sql에 battle 테이블 없음. 게임 로직에서 정의 필요
 */
export interface IBattleDocument extends Document {
  sessionId: string;
  
  // 전투 참가자
  attackerGeneralId: string;
  defenderGeneralId: string;
  
  // 전투 정보
  cityId?: string;
  battleType: 'field' | 'siege' | 'ambush'; // TODO: 전투 타입 정의
  
  // 병력 정보
  attackerTroops: number;
  defenderTroops: number;
  
  // 결과
  status: 'pending' | 'in_progress' | 'completed';
  winnerId?: string;
  
  // 손실
  attackerLosses?: number;
  defenderLosses?: number;
  
  // 전투 로그
  battleLog?: any[];
  
  startTime?: Date;
  endTime?: Date;
}

const BattleSchema = new Schema<IBattleDocument>({
  sessionId: { type: String, required: true },
  attackerGeneralId: { type: String, required: true },
  defenderGeneralId: { type: String, required: true },
  cityId: { type: String },
  battleType: { type: String, enum: ['field', 'siege', 'ambush'], default: 'field' },
  attackerTroops: { type: Number, required: true },
  defenderTroops: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
  winnerId: { type: String },
  attackerLosses: { type: Number },
  defenderLosses: { type: Number },
  battleLog: { type: Schema.Types.Mixed },
  startTime: { type: Date },
  endTime: { type: Date },
}, { timestamps: true });

BattleSchema.index({ sessionId: 1, status: 1 });
BattleSchema.index({ sessionId: 1, attackerGeneralId: 1 });
BattleSchema.index({ sessionId: 1, defenderGeneralId: 1 });

export const BattleModel = model<IBattleDocument>('Battle', BattleSchema);
