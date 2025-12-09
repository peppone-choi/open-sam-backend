/**
 * LOGH Relationship Model
 * 은하영웅전설 캐릭터 간 관계 모델
 * 
 * 우호도, 영향력, 밀회 기록 등을 저장
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IRelationship extends Document {
  session_id: string;
  
  // 관계의 주체 (from -> to)
  fromCommanderNo: number;
  toCommanderNo: number;
  
  // 우호도 (0-100, 50이 중립)
  friendship: number;
  
  // 신뢰도 (밀담 등으로 축적)
  trust: number;
  
  // 상호작용 기록
  interactions: Array<{
    type: 'meeting' | 'talk' | 'secret_meeting' | 'party' | 'hunting' | 'speech';
    date: Date;
    result: 'success' | 'neutral' | 'failure';
    friendshipChange: number;
    notes?: string;
  }>;
  
  // 마지막 상호작용
  lastInteractionAt?: Date;
  
  // 관계 상태 플래그
  isRival: boolean; // 라이벌 관계
  isAlly: boolean; // 동맹 관계
  isEnemy: boolean; // 적대 관계
  
  createdAt?: Date;
  updatedAt?: Date;
}

const RelationshipSchema = new Schema<IRelationship>(
  {
    session_id: { type: String, required: true },
    fromCommanderNo: { type: Number, required: true },
    toCommanderNo: { type: Number, required: true },
    
    friendship: { type: Number, default: 50, min: 0, max: 100 },
    trust: { type: Number, default: 50, min: 0, max: 100 },
    
    interactions: [{
      type: { 
        type: String, 
        enum: ['meeting', 'talk', 'secret_meeting', 'party', 'hunting', 'speech'],
        required: true 
      },
      date: { type: Date, default: Date.now },
      result: { type: String, enum: ['success', 'neutral', 'failure'], default: 'neutral' },
      friendshipChange: { type: Number, default: 0 },
      notes: { type: String },
    }],
    
    lastInteractionAt: { type: Date },
    
    isRival: { type: Boolean, default: false },
    isAlly: { type: Boolean, default: false },
    isEnemy: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// 복합 유니크 인덱스
RelationshipSchema.index(
  { session_id: 1, fromCommanderNo: 1, toCommanderNo: 1 }, 
  { unique: true }
);

// 조회 최적화 인덱스
RelationshipSchema.index({ session_id: 1, fromCommanderNo: 1 });
RelationshipSchema.index({ session_id: 1, toCommanderNo: 1 });

export const Relationship = mongoose.model<IRelationship>('Relationship', RelationshipSchema);












