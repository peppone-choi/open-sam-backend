/**
 * GIN7 OperationPlan Model
 * 
 * 관료제적 작전 승인 및 평가 시스템
 * 작전 입안 -> 승인 -> 발령 프로세스를 관리
 * 
 * @see agents/gin7-agents/gin7-bureaucracy/CHECKLIST.md
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * 작전 목표 유형
 */
export type OperationObjective = 
  | 'capture'      // 점령 - 적 성계/행성 점령
  | 'defense'      // 방어 - 아군 성계/행성 방어
  | 'sweep'        // 소탕 - 적 함대 격멸
  | 'raid'         // 기습 - 전략적 타격
  | 'patrol'       // 순찰 - 구역 정찰/감시
  | 'escort'       // 호위 - 수송/VIP 호위
  | 'blockade';    // 봉쇄 - 적 보급로 차단

/**
 * 작전 상태
 */
export type OperationStatus = 
  | 'draft'        // 입안 중 (작성 중)
  | 'pending'      // 결재 대기 (승인 요청됨)
  | 'approved'     // 승인됨 (발령 대기)
  | 'rejected'     // 반려됨
  | 'active'       // 진행 중 (부대 할당됨)
  | 'completed'    // 완료
  | 'failed'       // 실패
  | 'cancelled';   // 취소됨

/**
 * 결재 단계
 */
export interface IApprovalStep {
  stepOrder: number;
  positionType: string;           // 결재권자 직책 유형
  positionName: string;           // 직책명
  approverId?: string;            // 결재자 캐릭터 ID
  approverName?: string;          // 결재자 이름
  status: 'pending' | 'approved' | 'rejected';
  comment?: string;               // 결재 코멘트
  processedAt?: Date;
}

/**
 * 할당된 부대 정보
 */
export interface IAssignedUnit {
  fleetId: string;
  fleetName: string;
  commanderId: string;
  commanderName: string;
  assignedAt: Date;
  role: 'main' | 'support' | 'reserve';  // 주력/지원/예비
  orderDocumentId?: string;               // 작전서(Document) ID
}

/**
 * 작전 구역
 */
export interface IOperationZone {
  systemIds: string[];            // 작전 구역 성계 ID 목록
  planetIds: string[];            // 작전 구역 행성 ID 목록
  coordinates?: {                 // 작전 구역 좌표 범위 (선택)
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

/**
 * 작전 결과/평가
 */
export interface IOperationResult {
  success: boolean;
  objectiveAchieved: boolean;
  startedAt: Date;
  completedAt?: Date;
  
  // 전과 요약
  casualties: {
    shipsLost: number;
    shipsDestroyed: number;
    personnelLost: number;
    enemyKilled: number;
  };
  
  // 점령 성과
  capturedSystems: string[];
  capturedPlanets: string[];
  
  // 평가
  evaluation?: {
    rating: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
    meritBonus: number;           // 작전 성공 추가 공적치
    comment: string;
  };
}

/**
 * 작전 참가자 공적 기록
 */
export interface IParticipantMerit {
  characterId: string;
  characterName: string;
  fleetId?: string;
  rawMerit: number;               // 원본 공적치
  bonusRate: number;              // 보너스율 (1.0 = 100%)
  finalMerit: number;             // 최종 공적치
  actions: string[];              // 주요 행동 기록
}

// ============================================================================
// Interface Definition
// ============================================================================

export interface IOperationPlan extends Document {
  operationId: string;
  sessionId: string;
  factionId: string;
  
  // 기본 정보
  operationName: string;          // 작전명 (예: "아스테리온 공략전")
  operationCode?: string;         // 작전 코드명 (예: "OP-2025-001")
  description?: string;           // 작전 개요
  
  // 목표
  objective: OperationObjective;
  targetSystems: string[];        // 목표 성계 ID
  targetPlanets?: string[];       // 목표 행성 ID (선택)
  priorityTargets?: string[];     // 우선 목표 (적 함대/시설 등)
  
  // 작전 구역 (공적치 보정 적용 범위)
  operationZone: IOperationZone;
  
  // 요구 자원
  requiredResources: {
    minFleets: number;            // 최소 참가 함대 수
    maxFleets?: number;           // 최대 참가 함대 수
    minShips: number;             // 최소 함선 수
    estimatedSupply: number;      // 예상 보급 비용
    estimatedDuration: number;    // 예상 소요 시간 (게임 일)
  };
  
  // 입안 정보
  drafterId: string;              // 입안자 캐릭터 ID
  drafterName: string;
  drafterPosition?: string;       // 입안자 직책
  draftedAt: Date;
  
  // 결재 프로세스
  approvalChain: IApprovalStep[];
  currentApprovalStep: number;    // 현재 결재 단계 (0-based)
  
  // 상태
  status: OperationStatus;
  statusHistory: Array<{
    status: OperationStatus;
    changedAt: Date;
    changedBy: string;
    reason?: string;
  }>;
  
  // 일정
  scheduledStartAt?: Date;        // 예정 개시일
  actualStartAt?: Date;           // 실제 개시일
  deadline?: Date;                // 완료 기한
  completedAt?: Date;             // 완료일
  
  // 할당된 부대
  assignedUnits: IAssignedUnit[];
  
  // 결과/평가
  result?: IOperationResult;
  
  // 참가자 공적
  participantMerits: IParticipantMerit[];
  
  // 메타데이터
  createdAt: Date;
  updatedAt: Date;
  data: Record<string, unknown>;
}

// ============================================================================
// Schema Definition
// ============================================================================

const ApprovalStepSchema = new Schema<IApprovalStep>({
  stepOrder: { type: Number, required: true },
  positionType: { type: String, required: true },
  positionName: { type: String, required: true },
  approverId: String,
  approverName: String,
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  comment: String,
  processedAt: Date,
}, { _id: false });

const AssignedUnitSchema = new Schema<IAssignedUnit>({
  fleetId: { type: String, required: true },
  fleetName: { type: String, required: true },
  commanderId: { type: String, required: true },
  commanderName: { type: String, required: true },
  assignedAt: { type: Date, default: Date.now },
  role: { 
    type: String, 
    enum: ['main', 'support', 'reserve'], 
    default: 'main' 
  },
  orderDocumentId: String,
}, { _id: false });

const OperationZoneSchema = new Schema<IOperationZone>({
  systemIds: { type: [String], default: [] },
  planetIds: { type: [String], default: [] },
  coordinates: {
    minX: Number,
    maxX: Number,
    minY: Number,
    maxY: Number,
  },
}, { _id: false });

const OperationResultSchema = new Schema<IOperationResult>({
  success: { type: Boolean, required: true },
  objectiveAchieved: { type: Boolean, required: true },
  startedAt: { type: Date, required: true },
  completedAt: Date,
  casualties: {
    shipsLost: { type: Number, default: 0 },
    shipsDestroyed: { type: Number, default: 0 },
    personnelLost: { type: Number, default: 0 },
    enemyKilled: { type: Number, default: 0 },
  },
  capturedSystems: { type: [String], default: [] },
  capturedPlanets: { type: [String], default: [] },
  evaluation: {
    rating: { type: String, enum: ['S', 'A', 'B', 'C', 'D', 'F'] },
    meritBonus: { type: Number, default: 0 },
    comment: String,
  },
}, { _id: false });

const ParticipantMeritSchema = new Schema<IParticipantMerit>({
  characterId: { type: String, required: true },
  characterName: { type: String, required: true },
  fleetId: String,
  rawMerit: { type: Number, default: 0 },
  bonusRate: { type: Number, default: 1.0 },
  finalMerit: { type: Number, default: 0 },
  actions: { type: [String], default: [] },
}, { _id: false });

const OperationPlanSchema = new Schema<IOperationPlan>({
  operationId: { type: String, required: true },
  sessionId: { type: String, required: true },
  factionId: { type: String, required: true },
  
  operationName: { type: String, required: true },
  operationCode: String,
  description: String,
  
  objective: { 
    type: String, 
    enum: ['capture', 'defense', 'sweep', 'raid', 'patrol', 'escort', 'blockade'],
    required: true 
  },
  targetSystems: { type: [String], required: true },
  targetPlanets: { type: [String], default: [] },
  priorityTargets: { type: [String], default: [] },
  
  operationZone: { type: OperationZoneSchema, required: true },
  
  requiredResources: {
    minFleets: { type: Number, default: 1 },
    maxFleets: Number,
    minShips: { type: Number, default: 1 },
    estimatedSupply: { type: Number, default: 0 },
    estimatedDuration: { type: Number, default: 7 },
  },
  
  drafterId: { type: String, required: true },
  drafterName: { type: String, required: true },
  drafterPosition: String,
  draftedAt: { type: Date, default: Date.now },
  
  approvalChain: { type: [ApprovalStepSchema], default: [] },
  currentApprovalStep: { type: Number, default: 0 },
  
  status: { 
    type: String, 
    enum: ['draft', 'pending', 'approved', 'rejected', 'active', 'completed', 'failed', 'cancelled'],
    default: 'draft' 
  },
  statusHistory: [{
    status: { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: String, required: true },
    reason: String,
  }],
  
  scheduledStartAt: Date,
  actualStartAt: Date,
  deadline: Date,
  completedAt: Date,
  
  assignedUnits: { type: [AssignedUnitSchema], default: [] },
  
  result: OperationResultSchema,
  
  participantMerits: { type: [ParticipantMeritSchema], default: [] },
  
  data: { type: Schema.Types.Mixed, default: {} },
}, {
  timestamps: true,
});

// ============================================================================
// Indexes
// ============================================================================

// 기본 조회
OperationPlanSchema.index({ operationId: 1, sessionId: 1 }, { unique: true });
OperationPlanSchema.index({ sessionId: 1, factionId: 1 });

// 상태별 조회
OperationPlanSchema.index({ sessionId: 1, status: 1 });
OperationPlanSchema.index({ sessionId: 1, factionId: 1, status: 1 });

// 입안자별 조회
OperationPlanSchema.index({ sessionId: 1, drafterId: 1 });

// 작전 구역 조회 (공적치 계산용)
OperationPlanSchema.index({ sessionId: 1, status: 1, 'operationZone.systemIds': 1 });
OperationPlanSchema.index({ sessionId: 1, status: 1, 'operationZone.planetIds': 1 });

// 할당된 부대 조회
OperationPlanSchema.index({ sessionId: 1, 'assignedUnits.fleetId': 1 });
OperationPlanSchema.index({ sessionId: 1, 'assignedUnits.commanderId': 1 });

// ============================================================================
// Methods
// ============================================================================

/**
 * 특정 캐릭터가 작전 구역 내에 있는지 확인
 */
OperationPlanSchema.methods.isInOperationZone = function(
  systemId?: string,
  planetId?: string
): boolean {
  if (systemId && this.operationZone.systemIds.includes(systemId)) {
    return true;
  }
  if (planetId && this.operationZone.planetIds.includes(planetId)) {
    return true;
  }
  return false;
};

/**
 * 결재 체인의 다음 단계로 이동
 */
OperationPlanSchema.methods.advanceApproval = function(
  approverId: string,
  approverName: string,
  approved: boolean,
  comment?: string
): boolean {
  if (this.status !== 'pending') return false;
  
  const currentStep = this.approvalChain[this.currentApprovalStep];
  if (!currentStep) return false;
  
  currentStep.approverId = approverId;
  currentStep.approverName = approverName;
  currentStep.status = approved ? 'approved' : 'rejected';
  currentStep.comment = comment;
  currentStep.processedAt = new Date();
  
  if (!approved) {
    this.status = 'rejected';
    return true;
  }
  
  // 다음 단계로 이동
  this.currentApprovalStep++;
  
  // 모든 결재 완료 시 approved 상태로
  if (this.currentApprovalStep >= this.approvalChain.length) {
    this.status = 'approved';
  }
  
  return true;
};

/**
 * 부대 할당
 */
OperationPlanSchema.methods.assignUnit = function(
  fleetId: string,
  fleetName: string,
  commanderId: string,
  commanderName: string,
  role: 'main' | 'support' | 'reserve' = 'main'
): boolean {
  if (this.status !== 'approved' && this.status !== 'active') return false;
  
  // 중복 체크
  if (this.assignedUnits.some((u: IAssignedUnit) => u.fleetId === fleetId)) {
    return false;
  }
  
  // 최대 함대 수 체크
  if (this.requiredResources.maxFleets && 
      this.assignedUnits.length >= this.requiredResources.maxFleets) {
    return false;
  }
  
  this.assignedUnits.push({
    fleetId,
    fleetName,
    commanderId,
    commanderName,
    assignedAt: new Date(),
    role,
  });
  
  return true;
};

/**
 * 작전 활성화 (발령)
 */
OperationPlanSchema.methods.activate = function(): boolean {
  if (this.status !== 'approved') return false;
  if (this.assignedUnits.length < this.requiredResources.minFleets) return false;
  
  this.status = 'active';
  this.actualStartAt = new Date();
  
  return true;
};

// ============================================================================
// Static Methods
// ============================================================================

interface OperationPlanModel extends Model<IOperationPlan> {
  /**
   * 진행 중인 작전에서 특정 위치가 작전 구역인지 확인
   */
  findActiveOperationForLocation(
    sessionId: string,
    factionId: string,
    systemId?: string,
    planetId?: string
  ): Promise<IOperationPlan | null>;
  
  /**
   * 캐릭터가 참여 중인 작전 조회
   */
  findCharacterOperations(
    sessionId: string,
    characterId: string
  ): Promise<IOperationPlan[]>;
}

/**
 * 특정 위치가 작전 구역인 진행 중인 작전 찾기
 */
OperationPlanSchema.statics.findActiveOperationForLocation = async function(
  sessionId: string,
  factionId: string,
  systemId?: string,
  planetId?: string
): Promise<IOperationPlan | null> {
  const query: Record<string, unknown> = {
    sessionId,
    factionId,
    status: 'active',
  };
  
  const orConditions = [];
  if (systemId) {
    orConditions.push({ 'operationZone.systemIds': systemId });
  }
  if (planetId) {
    orConditions.push({ 'operationZone.planetIds': planetId });
  }
  
  if (orConditions.length > 0) {
    query.$or = orConditions;
  } else {
    return null;
  }
  
  return this.findOne(query);
};

/**
 * 캐릭터가 참여 중인 작전 조회
 */
OperationPlanSchema.statics.findCharacterOperations = async function(
  sessionId: string,
  characterId: string
): Promise<IOperationPlan[]> {
  return this.find({
    sessionId,
    status: { $in: ['approved', 'active'] },
    'assignedUnits.commanderId': characterId,
  });
};

// ============================================================================
// Export
// ============================================================================

export const OperationPlan: OperationPlanModel = 
  (mongoose.models.OperationPlan as OperationPlanModel) || 
  mongoose.model<IOperationPlan, OperationPlanModel>('OperationPlan', OperationPlanSchema);

// ============================================================================
// Constants
// ============================================================================

/**
 * 작전 유형별 기본 결재 체인 (제국)
 */
export const EMPIRE_APPROVAL_CHAIN: Record<OperationObjective, Array<{ positionType: string; positionName: string }>> = {
  capture: [
    { positionType: 'military_secretary', positionName: '군무상서' },
    { positionType: 'marshal', positionName: '원수' },
    { positionType: 'emperor', positionName: '황제' },
  ],
  defense: [
    { positionType: 'military_secretary', positionName: '군무상서' },
    { positionType: 'marshal', positionName: '원수' },
  ],
  sweep: [
    { positionType: 'military_secretary', positionName: '군무상서' },
  ],
  raid: [
    { positionType: 'military_secretary', positionName: '군무상서' },
    { positionType: 'marshal', positionName: '원수' },
  ],
  patrol: [
    { positionType: 'military_secretary', positionName: '군무상서' },
  ],
  escort: [
    { positionType: 'military_secretary', positionName: '군무상서' },
  ],
  blockade: [
    { positionType: 'military_secretary', positionName: '군무상서' },
    { positionType: 'marshal', positionName: '원수' },
  ],
};

/**
 * 작전 유형별 기본 결재 체인 (동맹)
 */
export const ALLIANCE_APPROVAL_CHAIN: Record<OperationObjective, Array<{ positionType: string; positionName: string }>> = {
  capture: [
    { positionType: 'fleet_commander', positionName: '우주함대총사령관' },
    { positionType: 'defense_chair', positionName: '국방위원장' },
    { positionType: 'council_chair', positionName: '최고평의회 의장' },
  ],
  defense: [
    { positionType: 'fleet_commander', positionName: '우주함대총사령관' },
    { positionType: 'defense_chair', positionName: '국방위원장' },
  ],
  sweep: [
    { positionType: 'fleet_commander', positionName: '우주함대총사령관' },
  ],
  raid: [
    { positionType: 'fleet_commander', positionName: '우주함대총사령관' },
    { positionType: 'defense_chair', positionName: '국방위원장' },
  ],
  patrol: [
    { positionType: 'fleet_commander', positionName: '우주함대총사령관' },
  ],
  escort: [
    { positionType: 'fleet_commander', positionName: '우주함대총사령관' },
  ],
  blockade: [
    { positionType: 'fleet_commander', positionName: '우주함대총사령관' },
    { positionType: 'defense_chair', positionName: '국방위원장' },
  ],
};

/**
 * 작전 평가 등급별 공적치 보너스율
 */
export const OPERATION_MERIT_BONUS: Record<string, number> = {
  'S': 1.5,   // 150%
  'A': 1.3,   // 130%
  'B': 1.2,   // 120%
  'C': 1.0,   // 100%
  'D': 0.8,   // 80%
  'F': 0.5,   // 50%
};

/**
 * 작전 참여 보너스율
 */
export const OPERATION_PARTICIPATION_BONUS = {
  IN_ZONE: 1.2,      // 작전 구역 내 전과: +20%
  OUT_ZONE: 0.5,     // 작전 구역 외 전과: -50%
  OBJECTIVE_BONUS: 0.5,  // 목표 달성 시 추가 보너스: +50%
};








