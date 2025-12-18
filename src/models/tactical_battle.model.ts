/**
 * 전술전투 세션 모델
 * 20x20 격자 기반 턴제 전술 전투
 */
import mongoose, { Schema, Document, Model } from 'mongoose';

// ============================================================
// 지형 타입
// ============================================================
export enum TerrainType {
  PLAIN = 'plain',           // 평지 - 기본 지형
  FOREST = 'forest',         // 숲 - 매복 가능, 화공 피해↑
  MOUNTAIN = 'mountain',     // 산 - 보병만 통과, 방어↑
  WATER = 'water',           // 강/물 - 통과 불가
  WALL = 'wall',             // 성벽 - 사다리 필요
  GATE = 'gate',             // 성문 - 파괴 후 통과
  CASTLE = 'castle',         // 성 내부 - 평지와 동일
  HEADQUARTERS = 'headquarters', // 본진 - 점령 목표
}

// 지형별 속성
export const TerrainProperties: Record<TerrainType, {
  moveCost: number;
  defenseBonus: number;
  passable: boolean;
  canAmbush: boolean;
  fireVulnerable: boolean;
}> = {
  [TerrainType.PLAIN]: { moveCost: 1, defenseBonus: 0, passable: true, canAmbush: false, fireVulnerable: false },
  [TerrainType.FOREST]: { moveCost: 2, defenseBonus: 10, passable: true, canAmbush: true, fireVulnerable: true },
  [TerrainType.MOUNTAIN]: { moveCost: 3, defenseBonus: 20, passable: true, canAmbush: false, fireVulnerable: false }, // 보병만
  [TerrainType.WATER]: { moveCost: 99, defenseBonus: 0, passable: false, canAmbush: false, fireVulnerable: false },
  [TerrainType.WALL]: { moveCost: 99, defenseBonus: 50, passable: false, canAmbush: false, fireVulnerable: false },
  [TerrainType.GATE]: { moveCost: 2, defenseBonus: 30, passable: false, canAmbush: false, fireVulnerable: false }, // 파괴 후 통과
  [TerrainType.CASTLE]: { moveCost: 1, defenseBonus: 10, passable: true, canAmbush: false, fireVulnerable: false },
  [TerrainType.HEADQUARTERS]: { moveCost: 1, defenseBonus: 0, passable: true, canAmbush: false, fireVulnerable: false },
};

// ============================================================
// 전투 상태
// ============================================================
export enum BattleStatus {
  WAITING = 'waiting',       // 참여 대기 중
  READY = 'ready',           // 시작 준비 완료
  PLACEMENT = 'placement',   // 유닛 배치 단계
  ONGOING = 'ongoing',       // 전투 진행 중
  FINISHED = 'finished',     // 전투 종료
}

// ============================================================
// 유닛 상태
// ============================================================
export enum UnitStatus {
  ACTIVE = 'active',         // 활성
  RETREATED = 'retreated',   // 퇴각
  DEAD = 'dead',             // 전멸
  CAPTURED = 'captured',     // 포로
}

// ============================================================
// 유닛 타입 (병종)
// ============================================================
export enum UnitType {
  INFANTRY = 'infantry',     // 보병
  CAVALRY = 'cavalry',       // 기병
  ARCHER = 'archer',         // 궁병
  CROSSBOW = 'crossbow',     // 노병
  SIEGE = 'siege',           // 공성병기
  WALL = 'wall',             // 성벽 (건물)
  GATE = 'gate',             // 성문 (건물)
}

// 유닛 타입별 기본 속성
export const UnitTypeProperties: Record<UnitType, {
  attackRange: number;
  moveRange: number;
  canClimbWall: boolean;
  canPassMountain: boolean;
}> = {
  [UnitType.INFANTRY]: { attackRange: 1, moveRange: 3, canClimbWall: true, canPassMountain: true },
  [UnitType.CAVALRY]: { attackRange: 1, moveRange: 5, canClimbWall: false, canPassMountain: false },
  [UnitType.ARCHER]: { attackRange: 3, moveRange: 3, canClimbWall: true, canPassMountain: true },
  [UnitType.CROSSBOW]: { attackRange: 4, moveRange: 2, canClimbWall: false, canPassMountain: false },
  [UnitType.SIEGE]: { attackRange: 5, moveRange: 1, canClimbWall: false, canPassMountain: false },
  [UnitType.WALL]: { attackRange: 0, moveRange: 0, canClimbWall: false, canPassMountain: false },
  [UnitType.GATE]: { attackRange: 0, moveRange: 0, canClimbWall: false, canPassMountain: false },
};

// ============================================================
// 인터페이스 정의
// ============================================================

// 좌표
export interface Position {
  x: number;
  y: number;
}

// 지형 셀
export interface TerrainCell {
  type: TerrainType;
  hp?: number;              // 성벽/성문의 HP
  maxHp?: number;
  destroyed?: boolean;      // 파괴 여부
}

// 전술 유닛
export interface ITacticalUnit {
  id: string;
  generalId: number;        // 장수 ID (0이면 건물)
  name: string;
  side: 'attacker' | 'defender';
  nationId: number;
  
  // 위치
  position: Position;
  
  // 상태
  hp: number;
  maxHp: number;
  morale: number;           // 사기 (0-100)
  status: UnitStatus;
  
  // 유닛 타입
  unitType: UnitType;
  crewTypeId?: number;      // 원본 병종 ID
  
  // 스탯 (장수 기반)
  attack: number;
  defense: number;
  speed: number;            // 기동력
  
  // 행동
  actionPoints: number;     // 남은 행동력
  maxActionPoints: number;
  hasMoved: boolean;        // 이번 턴 이동 여부
  hasActed: boolean;        // 이번 턴 행동 여부
  
  // 특수 상태
  isAmbushed?: boolean;     // 매복 중
  hasLadder?: boolean;      // 사다리 보유
}

// 전투 참여자
export interface BattleParticipant {
  nationId: number;
  nationName: string;
  nationColor: string;
  generals: number[];       // 장수 ID 목록
  userId?: string;          // 조종하는 유저
  isUserControlled: boolean;
  aiStrategy?: 'aggressive' | 'defensive' | 'balanced';
}

// 전투 행동 로그
export interface BattleActionLog {
  turn: number;
  phase: number;
  actorId: string;          // 유닛 ID
  actorName: string;
  action: 'move' | 'attack' | 'skill' | 'wait' | 'retreat';
  targetId?: string;
  targetName?: string;
  targetPosition?: Position;
  damage?: number;
  result?: string;
  timestamp: Date;
}

// ============================================================
// Mongoose 스키마
// ============================================================

const PositionSchema = new Schema<Position>({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
}, { _id: false });

const TerrainCellSchema = new Schema<TerrainCell>({
  type: { type: String, enum: Object.values(TerrainType), required: true },
  hp: { type: Number },
  maxHp: { type: Number },
  destroyed: { type: Boolean, default: false },
}, { _id: false });

const TacticalUnitSchema = new Schema<ITacticalUnit>({
  id: { type: String, required: true },
  generalId: { type: Number, required: true },
  name: { type: String, required: true },
  side: { type: String, enum: ['attacker', 'defender'], required: true },
  nationId: { type: Number, required: true },
  
  position: { type: PositionSchema, required: true },
  
  hp: { type: Number, required: true },
  maxHp: { type: Number, required: true },
  morale: { type: Number, default: 100 },
  status: { type: String, enum: Object.values(UnitStatus), default: UnitStatus.ACTIVE },
  
  unitType: { type: String, enum: Object.values(UnitType), required: true },
  crewTypeId: { type: Number },
  
  attack: { type: Number, required: true },
  defense: { type: Number, required: true },
  speed: { type: Number, required: true },
  
  actionPoints: { type: Number, default: 2 },
  maxActionPoints: { type: Number, default: 2 },
  hasMoved: { type: Boolean, default: false },
  hasActed: { type: Boolean, default: false },
  
  isAmbushed: { type: Boolean, default: false },
  hasLadder: { type: Boolean, default: false },
}, { _id: false });

const BattleParticipantSchema = new Schema<BattleParticipant>({
  nationId: { type: Number, required: true },
  nationName: { type: String, required: true },
  nationColor: { type: String, default: '#888888' },
  generals: [{ type: Number }],
  userId: { type: String },
  isUserControlled: { type: Boolean, default: false },
  aiStrategy: { type: String, enum: ['aggressive', 'defensive', 'balanced'], default: 'balanced' },
}, { _id: false });

const BattleActionLogSchema = new Schema<BattleActionLog>({
  turn: { type: Number, required: true },
  phase: { type: Number, default: 0 },
  actorId: { type: String, required: true },
  actorName: { type: String, required: true },
  action: { type: String, enum: ['move', 'attack', 'skill', 'wait', 'retreat'], required: true },
  targetId: { type: String },
  targetName: { type: String },
  targetPosition: { type: PositionSchema },
  damage: { type: Number },
  result: { type: String },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

// ============================================================
// 전술전투 세션 스키마
// ============================================================
export interface ITacticalBattle extends Document {
  session_id: string;       // 게임 세션 ID
  battle_id: string;        // 전투 고유 ID
  
  // 전투 정보
  cityId: number;
  cityName: string;
  status: BattleStatus;
  
  // 맵 정보
  mapWidth: number;
  mapHeight: number;
  terrain: TerrainCell[][];  // 2D 배열
  
  // 참여자
  attacker: BattleParticipant;
  defender: BattleParticipant;
  
  // 유닛
  units: ITacticalUnit[];
  
  // 턴 정보
  currentTurn: number;
  currentSide: 'attacker' | 'defender';
  turnTimeLimit: number;    // 턴 제한 시간 (초)
  turnStartedAt?: Date;
  maxTurns: number;         // 최대 턴 수
  
  // 타이밍
  createdAt: Date;
  battleStartAt?: Date;
  finishedAt?: Date;
  maxWaitTime: number;      // 대기 시간 (초)
  
  // 결과
  winner?: 'attacker' | 'defender' | 'draw';
  result?: {
    attackerCasualties: number;
    defenderCasualties: number;
    cityOccupied: boolean;
  };
  
  // 로그
  actionLogs: BattleActionLog[];
}

const TacticalBattleSchema = new Schema<ITacticalBattle>({
  session_id: { type: String, required: true, index: true },
  battle_id: { type: String, required: true, unique: true },
  
  cityId: { type: Number, required: true },
  cityName: { type: String, required: true },
  status: { type: String, enum: Object.values(BattleStatus), default: BattleStatus.WAITING },
  
  mapWidth: { type: Number, default: 20 },
  mapHeight: { type: Number, default: 20 },
  terrain: [[TerrainCellSchema]],
  
  attacker: { type: BattleParticipantSchema, required: true },
  defender: { type: BattleParticipantSchema, required: true },
  
  units: [TacticalUnitSchema],
  
  currentTurn: { type: Number, default: 0 },
  currentSide: { type: String, enum: ['attacker', 'defender'], default: 'attacker' },
  turnTimeLimit: { type: Number, default: 30 },
  turnStartedAt: { type: Date },
  maxTurns: { type: Number, default: 50 },
  
  createdAt: { type: Date, default: Date.now },
  battleStartAt: { type: Date },
  finishedAt: { type: Date },
  maxWaitTime: { type: Number, default: 300 }, // 5분
  
  winner: { type: String, enum: ['attacker', 'defender', 'draw'] },
  result: {
    attackerCasualties: { type: Number },
    defenderCasualties: { type: Number },
    cityOccupied: { type: Boolean },
  },
  
  actionLogs: [BattleActionLogSchema],
}, {
  timestamps: true,
  collection: 'tactical_battles',
});

// 인덱스
TacticalBattleSchema.index({ session_id: 1, status: 1 });
TacticalBattleSchema.index({ session_id: 1, cityId: 1 });
TacticalBattleSchema.index({ battle_id: 1 }, { unique: true });

export const TacticalBattle: Model<ITacticalBattle> = mongoose.models.TacticalBattle || 
  mongoose.model<ITacticalBattle>('TacticalBattle', TacticalBattleSchema);

