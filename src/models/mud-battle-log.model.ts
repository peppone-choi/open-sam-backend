import mongoose, { Schema, Document } from 'mongoose';

export interface IMudBattleLog extends Document {
  session_id: string;
  battleId: string;
  
  cityId: number;
  cityName: string;
  
  attacker: {
    nationId: number;
    nationName: string;
    generalName: string; // 대표 장수 (또는 부대장)
    troops: number; // 총 병력
  };
  
  defender: {
    nationId: number;
    nationName: string;
    generalName: string;
    troops: number;
  };
  
  winner: 'attacker' | 'defender' | 'draw';
  
  // 텍스트 기반 로그 (HTML 태그 포함 가능)
  logs: string[];
  
  // 상세 결과 (JSON)
  resultDetail: {
    attackerLoss: number;
    defenderLoss: number;
    attackerExp: number;
    defenderExp: number;
    capturedGenerals: string[]; // 포로가 된 장수 이름 목록
  };
  
  createdAt: Date;
}

const MudBattleLogSchema = new Schema({
  session_id: { type: String, required: true, index: true },
  battleId: { type: String, required: true, unique: true },
  
  cityId: { type: Number, required: true },
  cityName: { type: String, required: true },
  
  attacker: {
    nationId: { type: Number, required: true },
    nationName: { type: String, required: true },
    generalName: { type: String, required: true },
    troops: { type: Number, required: true }
  },
  
  defender: {
    nationId: { type: Number, required: true },
    nationName: { type: String, required: true },
    generalName: { type: String, required: true },
    troops: { type: Number, required: true }
  },
  
  winner: { type: String, enum: ['attacker', 'defender', 'draw'], required: true },
  
  logs: [{ type: String }],
  
  resultDetail: {
    attackerLoss: { type: Number, default: 0 },
    defenderLoss: { type: Number, default: 0 },
    attackerExp: { type: Number, default: 0 },
    defenderExp: { type: Number, default: 0 },
    capturedGenerals: [{ type: String }]
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

export const MudBattleLog = mongoose.models.MudBattleLog || mongoose.model<IMudBattleLog>('MudBattleLog', MudBattleLogSchema);
