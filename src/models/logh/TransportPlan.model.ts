/**
 * TransportPlan Model
 * 수송 계획 (정기 수송편) 정의
 * 행성 간 정기 물자 이동 계획
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface ITransportPackage {
  packageId: string; // 패키지 고유 ID
  itemType: string; // 물품 종류 ('ship', 'supplies', 'fuel', 'troops')
  itemSubType?: string; // 세부 종류 (함선 종류 등)
  quantity: number; // 수량
  status: 'pending' | 'in_transit' | 'delivered' | 'cancelled';
  createdAt: Date;
}

export interface ITransportPlan extends Document {
  session_id: string;
  planId: string; // 수송 계획 고유 ID
  
  // 수송 경로
  sourceId: string; // 출발지 행성/요새 ID
  sourceName: string;
  destinationId: string; // 도착지 행성/요새 ID
  destinationName: string;
  
  // 소유 진영
  faction: 'empire' | 'alliance';
  
  // 수송 설정
  schedule: {
    type: 'once' | 'recurring'; // 일회성 / 반복
    interval: number; // 반복 주기 (턴 단위, recurring일 때만)
    lastExecutedTurn: number; // 마지막 실행 턴
    nextExecutionTurn: number; // 다음 실행 예정 턴
  };
  
  // 수송 내용
  packages: ITransportPackage[];
  
  // 수송 시간 (거리 기반)
  transitTime: number; // 수송 소요 시간 (턴 단위)
  
  // 상태
  status: 'active' | 'paused' | 'cancelled' | 'completed';
  
  // 담당자 (선택)
  assignedCommanderId?: string;
  assignedCommanderName?: string;
  
  // 로그
  executionLog: {
    turn: number;
    timestamp: Date;
    action: string;
    details?: any;
  }[];
  
  createdAt?: Date;
  updatedAt?: Date;
}

const TransportPackageSchema = new Schema({
  packageId: { type: String, required: true },
  itemType: { 
    type: String, 
    enum: ['ship', 'supplies', 'fuel', 'troops'],
    required: true 
  },
  itemSubType: { type: String },
  quantity: { type: Number, required: true, min: 1 },
  status: {
    type: String,
    enum: ['pending', 'in_transit', 'delivered', 'cancelled'],
    default: 'pending',
  },
  createdAt: { type: Date, default: Date.now },
});

const TransportPlanSchema = new Schema<ITransportPlan>(
  {
    session_id: { type: String, required: true },
    planId: { type: String, required: true },
    
    sourceId: { type: String, required: true },
    sourceName: { type: String, required: true },
    destinationId: { type: String, required: true },
    destinationName: { type: String, required: true },
    
    faction: {
      type: String,
      enum: ['empire', 'alliance'],
      required: true,
    },
    
    schedule: {
      type: { type: String, enum: ['once', 'recurring'], default: 'once' },
      interval: { type: Number, default: 1 },
      lastExecutedTurn: { type: Number, default: 0 },
      nextExecutionTurn: { type: Number, default: 1 },
    },
    
    packages: [TransportPackageSchema],
    
    transitTime: { type: Number, default: 1 },
    
    status: {
      type: String,
      enum: ['active', 'paused', 'cancelled', 'completed'],
      default: 'active',
    },
    
    assignedCommanderId: { type: String },
    assignedCommanderName: { type: String },
    
    executionLog: [{
      turn: { type: Number, required: true },
      timestamp: { type: Date, default: Date.now },
      action: { type: String, required: true },
      details: { type: Schema.Types.Mixed },
    }],
  },
  {
    timestamps: true,
  }
);

// 복합 인덱스
TransportPlanSchema.index({ session_id: 1, planId: 1 }, { unique: true });
TransportPlanSchema.index({ session_id: 1, faction: 1 });
TransportPlanSchema.index({ session_id: 1, status: 1 });
TransportPlanSchema.index({ session_id: 1, 'schedule.nextExecutionTurn': 1 });

export const TransportPlan = mongoose.model<ITransportPlan>('TransportPlan', TransportPlanSchema);








