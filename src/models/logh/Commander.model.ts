/**
 * LOGH Commander Model
 * 은하영웅전설 커맨더 (장수와 유사)
 */

import mongoose, { Schema, Document } from 'mongoose';
import type { NobilityRank, CharacterNobility, LegacyInheritance } from '../../types/gin7/nobility.types';

export interface ILoghCommander extends Document {
  session_id: string;
  no: number; // Commander number (unique per session)

  // Basic info
  name: string;
  nameJa?: string;
  nameEn?: string;
  faction: 'empire' | 'alliance';
  gender?: 'male' | 'female';
  age?: number;
  rank: number; // 계급 코드 (1=원수, 2=상급대장, etc.)
  jobPosition: string | null; // 직책 (함대사령관, 참모장 etc.)

  // Ownership (optional, for player binding)
  ownerUserId?: string;

  // Stats (8가지 능력치 - admirals.json 기준)
  stats: {
    leadership: number; // 통솔력
    politics: number; // 정치력
    operations: number; // 정보/분석력
    intelligence: number; // 지략
    command: number; // 지휘력
    maneuver: number; // 기동력
    attack: number; // 공격력
    defense: number; // 방어력
  };

  // Command Points (PCP/MCP 시스템)
  commandPoints: {
    personal: number; // PCP (개인 행동력)
    military: number; // MCP (군사 행동력)
    maxPersonal: number;
    maxMilitary: number;
  };

  // 평가 지표
  fame: number; // 명성
  merit: number; // 공적
  evaluation: number; // 평가
  loyalty: number; // 충성도

  // Authority cards (special permissions)
  authorityCards: string[];

  // 훈장 (Medals)
  medals: Array<{
    medalId: string;
    name: string;
    awardedAt: Date;
  }>;

  // Fleet assignment
  fleetId: string | null;

  // Flagship
  flagship: {
    name: string;
    type: 'battleship' | 'cruiser' | 'destroyer' | 'carrier';
    firepower: number;
  } | null;

  // Position (strategic map coordinates)
  position?: {
    x: number;
    y: number;
    z: number;
  };

  // Character type (군인/정치가 구분)
  characterType: 'military' | 'politician';

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

  // Nobility system (제국 전용)
  nobility: CharacterNobility | null;

  // Legacy & Succession (유산 상속)
  legacy: LegacyInheritance | null;

  createdAt?: Date;
  updatedAt?: Date;

  // Virtual properties (for backward compatibility)
  achievements?: number; // maps to merit
  evaluationPoints?: number; // maps to evaluation
  personalFunds?: number; // stored in customData
  tactics?: number; // computed from command + maneuver

  // Helper methods
  getRankName(): string;
  setRankByName(rankName: string): void;
}

const LoghCommanderSchema = new Schema<ILoghCommander>(
  {
    session_id: { type: String, required: true },
    no: { type: Number, required: true },

    name: { type: String, required: true },
    nameJa: { type: String },
    nameEn: { type: String },
    faction: { type: String, enum: ['empire', 'alliance'], required: true },
    gender: { type: String, enum: ['male', 'female'] },
    age: { type: Number },
    rank: { type: Number, required: true },
    jobPosition: { type: String, default: null },

    // Optional owner binding for authenticated players
    ownerUserId: { type: String, index: true },

    stats: {
      leadership: { type: Number, default: 50 },
      politics: { type: Number, default: 50 },
      operations: { type: Number, default: 50 },
      intelligence: { type: Number, default: 50 },
      command: { type: Number, default: 50 },
      maneuver: { type: Number, default: 50 },
      attack: { type: Number, default: 50 },
      defense: { type: Number, default: 50 },
    },

    commandPoints: {
      personal: { type: Number, default: 100 },
      military: { type: Number, default: 100 },
      maxPersonal: { type: Number, default: 100 },
      maxMilitary: { type: Number, default: 100 },
    },

    fame: { type: Number, default: 0 },
    merit: { type: Number, default: 0 },
    evaluation: { type: Number, default: 0 },
    loyalty: { type: Number, default: 100 },

    authorityCards: { type: [String], default: [] },
    
    medals: [{
      medalId: String,
      name: String,
      awardedAt: Date,
    }],

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

    // Character type (군인/정치가 구분)
    characterType: { type: String, enum: ['military', 'politician'], default: 'military' },

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

    // Nobility system (제국 전용)
    nobility: {
      rank: { type: String, enum: ['knight', 'baron', 'viscount', 'count', 'marquis', 'duke'], default: null },
      fiefs: [{
        planetId: String,
        planetName: String,
        grantedAt: Date,
        annualIncome: { type: Number, default: 0 },
      }],
      ennobbledAt: Date,
      lastPromotedAt: Date,
      totalTaxIncome: { type: Number, default: 0 },
    },

    // Legacy & Succession (유산 상속)
    legacy: {
      previousCharacterId: String,
      previousCharacterName: String,
      inheritedWealth: { type: Number, default: 0 },
      inheritedFame: { type: Number, default: 0 },
      karma: { type: Number, default: 0 },
      inheritedAt: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for session + no (unique)
LoghCommanderSchema.index({ session_id: 1, no: 1 }, { unique: true });

// Virtual properties for backward compatibility
LoghCommanderSchema.virtual('achievements').get(function() {
  // merit를 achievements로 매핑
  return this.merit;
});

LoghCommanderSchema.virtual('achievements').set(function(value: number) {
  this.merit = value;
});

LoghCommanderSchema.virtual('evaluationPoints').get(function() {
  // evaluation을 evaluationPoints로 매핑
  return this.evaluation;
});

LoghCommanderSchema.virtual('evaluationPoints').set(function(value: number) {
  this.evaluation = value;
});

LoghCommanderSchema.virtual('personalFunds').get(function() {
  // customData에서 personalFunds 가져오기
  return this.customData?.personalFunds || 0;
});

LoghCommanderSchema.virtual('personalFunds').set(function(value: number) {
  if (!this.customData) {
    this.customData = {};
  }
  this.customData.personalFunds = value;
  this.markModified('customData');
});

LoghCommanderSchema.virtual('tactics').get(function() {
  // command + maneuver 평균으로 tactics 계산
  return Math.floor((this.stats.command + this.stats.maneuver) / 2);
});

// Helper methods
LoghCommanderSchema.methods.getRankName = function(): string {
  const { getRankName } = require('../../utils/logh-rank-system');
  return getRankName(this.rank, this.faction);
};

LoghCommanderSchema.methods.setRankByName = function(rankName: string): void {
  const { getRankIndex } = require('../../utils/logh-rank-system');
  this.rank = getRankIndex(rankName, this.faction);
};

export const LoghCommander = mongoose.model<ILoghCommander>('LoghCommander', LoghCommanderSchema);
