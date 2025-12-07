import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IGin7GameSession extends Document {
  sessionId: string;
  name: string;
  status: 'preparing' | 'running' | 'paused' | 'finished';
  
  // Time Engine Configuration
  timeConfig: {
    baseTime: Date;        // 게임 시작 현실 시각
    gameStartDate: {       // 게임 내 시작 날짜 (예: 184년 1월 1일)
      year: number;
      month: number;
      day: number;
      hour: number;
    };
    timeScale: number;     // 시간 배율 (기본 24)
    tickRateMs: number;    // 서버 틱 주기 (ms, 기본 1000)
  };

  // Runtime State
  currentState: {
    tick: number;          // 누적 틱
    gameDate: Date;        // 현재 게임 날짜 (계산됨)
    isPaused: boolean;
    lastTickTime: Date;    // 마지막 틱 처리 현실 시각
  };

  // World Data
  worldMapId: string;
  
  // Extensibility
  data: Record<string, any>;
  metadata: Record<string, any>;
}

const Gin7GameSessionSchema = new Schema<IGin7GameSession>({
  sessionId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  status: { type: String, default: 'preparing', enum: ['preparing', 'running', 'paused', 'finished'] },
  
  timeConfig: {
    baseTime: { type: Date, default: Date.now },
    gameStartDate: {
      year: { type: Number, default: 184 },
      month: { type: Number, default: 1 },
      day: { type: Number, default: 1 },
      hour: { type: Number, default: 0 }
    },
    timeScale: { type: Number, default: 24 },
    tickRateMs: { type: Number, default: 1000 }
  },

  currentState: {
    tick: { type: Number, default: 0 },
    gameDate: { type: Date },
    isPaused: { type: Boolean, default: false },
    lastTickTime: { type: Date, default: Date.now }
  },

  worldMapId: { type: String },
  
  data: { type: Schema.Types.Mixed, default: {} },
  metadata: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

// Indexes
Gin7GameSessionSchema.index({ sessionId: 1 });
Gin7GameSessionSchema.index({ status: 1 });

export const Gin7GameSession: Model<IGin7GameSession> = 
  mongoose.models.Gin7GameSession || mongoose.model<IGin7GameSession>('Gin7GameSession', Gin7GameSessionSchema);

