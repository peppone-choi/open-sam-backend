/**
 * LOGH Commander Model
 * 은하영웅전설 커맨더 (장수와 유사)
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface ILoghCommander extends Document {
  session_id: string;
  no: number; // Commander number (unique per session)

  // Basic info
  name: string;
  faction: 'empire' | 'alliance';
  rank: string; // 元帥, 上級大将, 中将, etc.
  jobPosition: string | null; // 직책 (함대사령관, 참모장 etc.)

  // Stats (based on LoghData.ts)
  stats: {
    command: number; // 지휘 능력
    tactics: number; // 전술 능력
    strategy: number; // 전략 능력
    politics: number; // 정치 능력
  };

  // Points
  evaluationPoints: number; // 평가 포인트 (승진)
  famePoints: number; // 명성 포인트
  achievements: number; // 공적
  commandPoints: number; // 커맨드 포인트 (행동력)

  // Authority cards (special permissions)
  authorityCards: string[];

  // Fleet assignment
  fleetId: string | null;

  // Flagship
  flagship: {
    name: string;
    type: 'battleship' | 'cruiser' | 'destroyer' | 'carrier';
    firepower: number;
  } | null;

  // Position (3D coordinates)
  position: {
    x: number;
    y: number;
    z: number;
  };

  // Resources
  supplies: number;
  personalFunds: number; // 개인 자금

  // Game state
  isActive: boolean;
  turnDone: boolean;
  status: 'active' | 'imprisoned' | 'defected' | 'executed'; // 상태
  originalFaction?: 'empire' | 'alliance'; // 원래 소속 (망명자용)

  // Active commands (진행 중인 커맨드)
  activeCommands: Array<{
    commandType: string;
    startedAt: Date;
    completesAt: Date;
    data: any;
  }>;

  // Custom data storage
  customData: Record<string, any>;

  createdAt?: Date;
  updatedAt?: Date;
}

const LoghCommanderSchema = new Schema<ILoghCommander>(
  {
    session_id: { type: String, required: true, index: true },
    no: { type: Number, required: true },

    name: { type: String, required: true },
    faction: { type: String, enum: ['empire', 'alliance'], required: true },
    rank: { type: String, required: true },
    jobPosition: { type: String, default: null },

    stats: {
      command: { type: Number, default: 50 },
      tactics: { type: Number, default: 50 },
      strategy: { type: Number, default: 50 },
      politics: { type: Number, default: 50 },
    },

    evaluationPoints: { type: Number, default: 0 },
    famePoints: { type: Number, default: 0 },
    achievements: { type: Number, default: 0 },
    commandPoints: { type: Number, default: 10 },

    authorityCards: { type: [String], default: [] },

    fleetId: { type: String },

    flagship: {
      name: String,
      type: { type: String, enum: ['battleship', 'cruiser', 'destroyer', 'carrier'] },
      firepower: Number,
    },

    position: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      z: { type: Number, default: 0 },
    },

    supplies: { type: Number, default: 10000 },
    personalFunds: { type: Number, default: 50000 },

    isActive: { type: Boolean, default: true },
    turnDone: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'imprisoned', 'defected', 'executed'], default: 'active' },
    originalFaction: { type: String, enum: ['empire', 'alliance'] },

    activeCommands: [{
      commandType: String,
      startedAt: Date,
      completesAt: Date,
      data: Schema.Types.Mixed,
    }],

    customData: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

// Compound index for session + no (unique)
LoghCommanderSchema.index({ session_id: 1, no: 1 }, { unique: true });

export const LoghCommander = mongoose.model<ILoghCommander>('LoghCommander', LoghCommanderSchema);
