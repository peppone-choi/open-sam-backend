/**
 * GIN7 Faction Model
 * 은하 전략 게임 파벌 모델
 * 
 * 진영 (EMPIRE, ALLIANCE 등) 및 정치 파벌 표현
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFaction extends Document {
  sessionId: string;
  
  // 파벌 기본 정보
  factionId: string; // 고유 ID (예: 'EMPIRE', 'ALLIANCE', 'PHEZZAN')
  name: string; // 파벌명
  nameKo: string; // 한글 파벌명
  
  // 파벌 유형
  type: 'major' | 'minor' | 'political' | 'rebel' | 'pirate';
  
  // 리더
  leaderId?: string; // 파벌 수장의 Character ID
  leaderName?: string;
  
  // 구성원
  members: Array<{
    characterId: string;
    name: string;
    role: 'leader' | 'high_council' | 'officer' | 'member';
    joinedAt: Date;
    influence: number; // 파벌 내 영향력 (0-100)
  }>;
  
  // 파벌 능력치
  stats: {
    totalInfluence: number; // 총 영향력
    politicalPower: number; // 정치력 (0-100)
    militaryPower: number; // 군사력 (0-100)
    economicPower: number; // 경제력 (0-100)
    popularity: number; // 대중 지지도 (0-100)
  };
  
  // 영토
  territories: {
    systems: string[]; // 소유 성계 ID
    planets: string[]; // 소유 행성 ID
    fortresses: string[]; // 소유 요새 ID
  };
  
  // 파벌 자금
  treasury: number;
  
  // 파벌 관계 (다른 파벌과의 관계)
  relations: Array<{
    targetFactionId: string;
    stance: 'allied' | 'friendly' | 'neutral' | 'hostile' | 'enemy';
    relationValue: number; // -100 ~ 100
  }>;
  
  // 파벌 색상 (UI용)
  color: string;
  
  // 상태
  isActive: boolean;
  dissolvedAt?: Date;
  
  // 내전 관련 상태
  inCivilWar: boolean; // 현재 내전 중 여부
  civilWarId?: string; // 참여 중인 내전 ID
  civilWarFactionId?: string; // 내전 진영 ID
  civilWarRole?: 'INCUMBENT' | 'INSURGENT' | 'THIRD_PARTY'; // 내전 역할
  
  // 메타데이터
  data: Record<string, any>;
  
  createdAt?: Date;
  updatedAt?: Date;
}

const FactionSchema = new Schema<IFaction>(
  {
    sessionId: { type: String, required: true },
    factionId: { type: String, required: true },
    name: { type: String, required: true },
    nameKo: { type: String, required: true },
    
    type: { 
      type: String, 
      enum: ['major', 'minor', 'political', 'rebel', 'pirate'], 
      default: 'major' 
    },
    
    leaderId: { type: String },
    leaderName: { type: String },
    
    members: [{
      characterId: { type: String, required: true },
      name: { type: String, required: true },
      role: { 
        type: String, 
        enum: ['leader', 'high_council', 'officer', 'member'], 
        default: 'member' 
      },
      joinedAt: { type: Date, default: Date.now },
      influence: { type: Number, default: 10, min: 0, max: 100 },
    }],
    
    stats: {
      totalInfluence: { type: Number, default: 0 },
      politicalPower: { type: Number, default: 0, min: 0, max: 100 },
      militaryPower: { type: Number, default: 0, min: 0, max: 100 },
      economicPower: { type: Number, default: 0, min: 0, max: 100 },
      popularity: { type: Number, default: 0, min: 0, max: 100 },
    },
    
    territories: {
      systems: [{ type: String }],
      planets: [{ type: String }],
      fortresses: [{ type: String }],
    },
    
    treasury: { type: Number, default: 0 },
    
    relations: [{
      targetFactionId: { type: String, required: true },
      stance: { 
        type: String, 
        enum: ['allied', 'friendly', 'neutral', 'hostile', 'enemy'], 
        default: 'neutral' 
      },
      relationValue: { type: Number, default: 0, min: -100, max: 100 },
    }],
    
    color: { type: String, default: '#808080' },
    
    isActive: { type: Boolean, default: true },
    dissolvedAt: { type: Date },
    
    // 내전 관련 상태
    inCivilWar: { type: Boolean, default: false },
    civilWarId: { type: String },
    civilWarFactionId: { type: String },
    civilWarRole: { 
      type: String, 
      enum: ['INCUMBENT', 'INSURGENT', 'THIRD_PARTY'] 
    },
    
    data: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: 'gin7_factions',
  }
);

// 인덱스
FactionSchema.index({ sessionId: 1, factionId: 1 }, { unique: true });
FactionSchema.index({ sessionId: 1, leaderId: 1 });
FactionSchema.index({ sessionId: 1, 'members.characterId': 1 });
FactionSchema.index({ sessionId: 1, type: 1, isActive: 1 });
FactionSchema.index({ sessionId: 1, inCivilWar: 1, civilWarId: 1 });

export const Faction: Model<IFaction> = 
  mongoose.models.Gin7Faction || mongoose.model<IFaction>('Gin7Faction', FactionSchema);





