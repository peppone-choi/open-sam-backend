/**
 * LOGH Faction Model
 * 은하영웅전설 파벌 모델
 * 
 * 정치 집단, 군벌, 파벌 등을 표현
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IFaction extends Document {
  session_id: string;
  
  // 파벌 기본 정보
  factionId: string; // 고유 ID
  name: string; // 파벌명 (예: "로엔그람 파", "트뤼니히트 파")
  
  // 소속 진영
  alignment: 'empire' | 'alliance' | 'neutral';
  
  // 리더
  leaderNo: number; // 파벌 수장의 Commander no
  leaderName: string;
  
  // 구성원
  members: Array<{
    commanderNo: number;
    name: string;
    role: 'leader' | 'core' | 'member' | 'affiliate'; // 수장/핵심/일반/준회원
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
  
  // 파벌 자금
  treasury: number;
  
  // 파벌 관계 (다른 파벌과의 관계)
  relations: Array<{
    targetFactionId: string;
    stance: 'allied' | 'friendly' | 'neutral' | 'hostile' | 'enemy';
    relationValue: number; // -100 ~ 100
  }>;
  
  // 파벌 목표/정책
  policies: string[];
  
  // 상태
  isActive: boolean;
  dissolvedAt?: Date;
  
  createdAt?: Date;
  updatedAt?: Date;
}

const FactionSchema = new Schema<IFaction>(
  {
    session_id: { type: String, required: true },
    factionId: { type: String, required: true },
    name: { type: String, required: true },
    
    alignment: { 
      type: String, 
      enum: ['empire', 'alliance', 'neutral'], 
      required: true 
    },
    
    leaderNo: { type: Number, required: true },
    leaderName: { type: String, required: true },
    
    members: [{
      commanderNo: { type: Number, required: true },
      name: { type: String, required: true },
      role: { 
        type: String, 
        enum: ['leader', 'core', 'member', 'affiliate'], 
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
    
    policies: [{ type: String }],
    
    isActive: { type: Boolean, default: true },
    dissolvedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// 인덱스
FactionSchema.index({ session_id: 1, factionId: 1 }, { unique: true });
FactionSchema.index({ session_id: 1, leaderNo: 1 });
FactionSchema.index({ session_id: 1, 'members.commanderNo': 1 });
FactionSchema.index({ session_id: 1, alignment: 1, isActive: 1 });

export const Faction = mongoose.model<IFaction>('Faction', FactionSchema);














