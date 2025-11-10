/**
 * LOGH Tactical Map Model
 * 특정 그리드 셀을 확대한 전술 전투 맵
 * 
 * 전략 그리드 1칸 = 전술 맵 100x100 (예시)
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface ITacticalMap extends Document {
  session_id: string;
  tacticalMapId: string;
  
  // 전략 맵의 어느 그리드에서 발생한 전투인지
  strategicGridPosition: {
    x: number; // 0-99
    y: number; // 0-49
  };
  
  // 전술 맵 크기 (실수 좌표계)
  tacticalSize: {
    width: number; // 예: 10000 (10000 유닛)
    height: number; // 예: 10000
  };
  
  // 전투 상태
  status: 'active' | 'concluded';
  
  // 참여 함대 ID 목록
  participatingFleetIds: string[];
  
  // 진영별 참여 함대
  factions: {
    empire: string[]; // fleet IDs
    alliance: string[]; // fleet IDs
  };
  
  // 전술 맵 내 장애물/지형 (실수 좌표)
  obstacles?: Array<{
    x: number; // 실수 좌표
    y: number; // 실수 좌표
    radius?: number; // 장애물 반경
    type: string; // 'asteroid', 'debris', 'nebula', etc.
  }>;
  
  // 전투 시작/종료 시간
  startTime: Date;
  endTime?: Date;
  
  // 전투 결과
  result?: {
    winner?: 'empire' | 'alliance' | 'draw';
    casualties: {
      empire: number;
      alliance: number;
    };
  };
  
  createdAt?: Date;
  updatedAt?: Date;
}

const TacticalMapSchema = new Schema<ITacticalMap>(
  {
    session_id: { type: String, required: true, index: true },
    tacticalMapId: { type: String, required: true },
    
    strategicGridPosition: {
      x: { type: Number, required: true, min: 0, max: 99 },
      y: { type: Number, required: true, min: 0, max: 49 },
    },
    
    tacticalSize: {
      width: { type: Number, required: true, default: 10000 },
      height: { type: Number, required: true, default: 10000 },
    },
    
    status: {
      type: String,
      enum: ['active', 'concluded'],
      default: 'active',
    },
    
    participatingFleetIds: [{ type: String }],
    
    factions: {
      empire: [{ type: String }],
      alliance: [{ type: String }],
    },
    
    obstacles: [
      {
        x: { type: Number },
        y: { type: Number },
        radius: { type: Number, default: 100 },
        type: { type: String },
      },
    ],
    
    startTime: { type: Date, required: true, default: Date.now },
    endTime: { type: Date },
    
    result: {
      winner: { type: String, enum: ['empire', 'alliance', 'draw'] },
      casualties: {
        empire: { type: Number, default: 0 },
        alliance: { type: Number, default: 0 },
      },
    },
  },
  {
    timestamps: true,
  }
);

// Unique index
TacticalMapSchema.index({ session_id: 1, tacticalMapId: 1 }, { unique: true });
// Index for strategic grid position
TacticalMapSchema.index({ 
  session_id: 1, 
  'strategicGridPosition.x': 1, 
  'strategicGridPosition.y': 1 
});
// Index for active battles
TacticalMapSchema.index({ session_id: 1, status: 1 });

export const TacticalMap = mongoose.model<ITacticalMap>('TacticalMap', TacticalMapSchema);
