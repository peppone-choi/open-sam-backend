import mongoose, { Schema, Document } from 'mongoose';

// ========================================
// 기본 타입
// ========================================

export interface ITerrainTile {
  x: number;
  y: number;
  type: 'plain' | 'forest' | 'hill' | 'mountain' | 'water' | 'wall' | 'gate' | 'road' | 'bridge' | 'swamp' | 'desert' | 'snow';
  elevation?: number;
  height?: number;
}

export interface IPosition {
  x: number;
  y: number;
}

export interface IPosition3D {
  x: number;
  y: number;
  z?: number;
}

// ========================================
// 3D 구조물 타입
// ========================================

export type StructureType = 
  | 'wall'           // 성벽
  | 'gate'           // 성문
  | 'tower'          // 망루
  | 'moat'           // 해자
  | 'barracks'       // 병영
  | 'granary'        // 곡창
  | 'palace'         // 궁전/관아
  | 'market'         // 시장
  | 'residence'      // 민가
  | 'shrine'         // 사당
  | 'fortress_tower' // 요새 망루
  | 'siege_platform' // 공성 발판
  | 'arrow_tower'    // 화살탑
  | 'bridge'         // 다리
  | 'obstacle';      // 장애물

export interface IStructure {
  id?: string;
  type: StructureType;
  position: IPosition3D;
  rotation?: number;
  size: { width: number; height: number; depth?: number };
  hp?: number;
  maxHp?: number;
  defense?: number;
  destructible?: boolean;
  // 렌더링 옵션
  modelPath?: string;
  textureId?: string;
}

// ========================================
// 성 설정
// ========================================

export interface ICastle {
  centerX: number;
  centerY: number;
  radius?: number;       // 성 반경
  walls: IPosition[];
  gates: IPosition[];
  throne: IPosition;
  // 3D 확장
  wallHeight?: number;
  wallThickness?: number;
  towerCount?: number;
  hasMoat?: boolean;
}

export interface IWallConfig {
  hasWall: boolean;
  wallHeight: number;
  wallThickness: number;
  towerCount: number;
  hasGate: boolean;
  hasMoat: boolean;
}

// ========================================
// 출구 및 스폰 포인트
// ========================================

export type Direction = 'north' | 'northeast' | 'east' | 'southeast' | 'south' | 'southwest' | 'west' | 'northwest';

export interface IMapExit {
  direction: Direction;
  position: IPosition;
  connectedCity?: number;
  connectedCityName?: string;
}

export interface ISpawnPoint {
  direction: Direction;
  position: IPosition;
  capacity?: number;  // 배치 가능 병력 수
}

export interface IDeployment {
  attacker: IPosition[];
  defender: IPosition[];
  // 8방향 스폰 포인트
  spawnPoints?: Record<Direction, IPosition>;
}

// ========================================
// 전략 포인트 및 지형 특성
// ========================================

export interface IStrategicPoint {
  name: string;
  position: IPosition;
  bonus: string;
  type?: 'high_ground' | 'chokepoint' | 'supply' | 'defensive';
  controlValue?: number;
}

// ========================================
// 승리 조건
// ========================================

export type VictoryConditionType = 
  | 'annihilation'       // 전멸
  | 'capture_throne'     // 광장/왕좌 점령
  | 'capture_gates'      // 모든 성문 점령
  | 'time_limit'         // 시간 제한
  | 'morale_collapse'    // 사기 붕괴
  | 'general_killed'     // 장수 사망
  | 'hold_position';     // 거점 사수

export interface IVictoryCondition {
  type: VictoryConditionType;
  target?: string;           // 점령 대상 ID
  targetPosition?: IPosition; // 점령 위치
  duration?: number;         // 점령 유지 시간 (초)
  percentage?: number;       // 퍼센트 조건 (예: 80% 이상 제거)
  description?: string;
}

export interface IControlPoint {
  id: string;
  name: string;
  position: IPosition;
  radius: number;            // 점령 범위
  controlTeam?: 'attacker' | 'defender' | 'neutral';
  controlProgress?: number;  // 점령 진행도 (0-100)
  isVictoryPoint: boolean;   // 승리 조건 여부
  captureTime: number;       // 점령에 필요한 시간 (초)
  bonusEffect?: string;      // 점령 시 보너스
}

export interface ITerrainFeature {
  type: 'tree_cluster' | 'rock' | 'river' | 'bridge' | 'hill' | 'building';
  position: IPosition;
  size: { width: number; height: number };
  rotation?: number;
}

// ========================================
// 지형 타입
// ========================================

export type TerrainType = 
  | 'plains'      // 평원
  | 'forest'      // 숲
  | 'hills'       // 구릉
  | 'mountain'    // 산악
  | 'river'       // 강
  | 'city'        // 도시
  | 'fortress'    // 요새/관문
  | 'desert'      // 사막
  | 'snow'        // 설원
  | 'swamp'       // 늪지
  | 'naval';      // 해전

export interface IBattleMapTemplate extends Document {
  session_id: string;
  city_id: number;
  region_id?: number;
  
  name: string;
  width: number;
  height: number;
  
  // 지형 정보
  terrainType: TerrainType;
  terrain: ITerrainTile[];
  heightMap?: number[][];  // 2D 높이맵 배열
  
  // 성/구조물
  castle: ICastle;
  wallConfig?: IWallConfig;
  structures: IStructure[];
  
  // 출입구 및 배치
  exits: IMapExit[];
  deployment: IDeployment;
  
  // 전략 요소
  strategicPoints?: IStrategicPoint[];
  terrainFeatures?: ITerrainFeature[];
  
  // 승리 조건 및 점령 포인트
  victoryConditions: IVictoryCondition[];
  controlPoints: IControlPoint[];
  thronePosition?: IPosition;  // 광장/왕좌 위치 (승리 조건)
  
  // 환경 설정
  defaultWeather?: 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'storm';
  defaultTimeOfDay?: 'dawn' | 'morning' | 'noon' | 'evening' | 'night';
  
  // 메타데이터
  version?: number;
  author?: string;
  description?: string;
  
  created_at: Date;
  updated_at: Date;
}

// ========================================
// 스키마 정의
// ========================================

const TerrainTileSchema = new Schema({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  type: { 
    type: String, 
    enum: ['plain', 'forest', 'hill', 'mountain', 'water', 'wall', 'gate', 'road', 'bridge', 'swamp', 'desert', 'snow'],
    required: true 
  },
  elevation: { type: Number, default: 0 },
  height: { type: Number, default: 0 }
}, { _id: false });

const PositionSchema = new Schema({
  x: { type: Number, required: true },
  y: { type: Number, required: true }
}, { _id: false });

const Position3DSchema = new Schema({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  z: { type: Number, default: 0 }
}, { _id: false });

const SizeSchema = new Schema({
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  depth: { type: Number }
}, { _id: false });

const StructureSchema = new Schema({
  id: { type: String },
  type: { 
    type: String, 
    enum: ['wall', 'gate', 'tower', 'moat', 'barracks', 'granary', 'palace', 'market', 'residence', 'shrine', 'fortress_tower', 'siege_platform', 'arrow_tower', 'bridge', 'obstacle'],
    required: true 
  },
  position: { type: Position3DSchema, required: true },
  rotation: { type: Number, default: 0 },
  size: { type: SizeSchema, required: true },
  hp: { type: Number },
  maxHp: { type: Number },
  defense: { type: Number },
  destructible: { type: Boolean, default: true },
  modelPath: { type: String },
  textureId: { type: String }
}, { _id: false });

const CastleSchema = new Schema({
  centerX: { type: Number, required: true },
  centerY: { type: Number, required: true },
  radius: { type: Number },
  walls: [PositionSchema],
  gates: [PositionSchema],
  throne: PositionSchema,
  wallHeight: { type: Number, default: 10 },
  wallThickness: { type: Number, default: 5 },
  towerCount: { type: Number, default: 4 },
  hasMoat: { type: Boolean, default: false }
}, { _id: false });

const WallConfigSchema = new Schema({
  hasWall: { type: Boolean, default: true },
  wallHeight: { type: Number, default: 10 },
  wallThickness: { type: Number, default: 5 },
  towerCount: { type: Number, default: 4 },
  hasGate: { type: Boolean, default: true },
  hasMoat: { type: Boolean, default: false }
}, { _id: false });

const DirectionEnum = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];

const MapExitSchema = new Schema({
  direction: { 
    type: String, 
    enum: DirectionEnum,
    required: true 
  },
  position: { type: PositionSchema, required: true },
  connectedCity: { type: Number },
  connectedCityName: { type: String }
}, { _id: false });

const SpawnPointsSchema = new Schema({
  north: PositionSchema,
  northeast: PositionSchema,
  east: PositionSchema,
  southeast: PositionSchema,
  south: PositionSchema,
  southwest: PositionSchema,
  west: PositionSchema,
  northwest: PositionSchema
}, { _id: false });

const DeploymentSchema = new Schema({
  attacker: [PositionSchema],
  defender: [PositionSchema],
  spawnPoints: SpawnPointsSchema
}, { _id: false });

const StrategicPointSchema = new Schema({
  name: { type: String, required: true },
  position: { type: PositionSchema, required: true },
  bonus: { type: String, required: true },
  type: { type: String, enum: ['high_ground', 'chokepoint', 'supply', 'defensive'] },
  controlValue: { type: Number }
}, { _id: false });

const TerrainFeatureSchema = new Schema({
  type: { type: String, enum: ['tree_cluster', 'rock', 'river', 'bridge', 'hill', 'building'], required: true },
  position: { type: PositionSchema, required: true },
  size: { type: SizeSchema, required: true },
  rotation: { type: Number, default: 0 }
}, { _id: false });

// 승리 조건 스키마
const VictoryConditionTypeEnum = ['annihilation', 'capture_throne', 'capture_gates', 'time_limit', 'morale_collapse', 'general_killed', 'hold_position'];

const VictoryConditionSchema = new Schema({
  type: { type: String, enum: VictoryConditionTypeEnum, required: true },
  target: { type: String },
  targetPosition: PositionSchema,
  duration: { type: Number },
  percentage: { type: Number },
  description: { type: String }
}, { _id: false });

// 점령 포인트 스키마
const ControlPointSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  position: { type: PositionSchema, required: true },
  radius: { type: Number, default: 30 },
  controlTeam: { type: String, enum: ['attacker', 'defender', 'neutral'], default: 'neutral' },
  controlProgress: { type: Number, default: 0 },
  isVictoryPoint: { type: Boolean, default: false },
  captureTime: { type: Number, default: 30 },  // 30초 점령
  bonusEffect: { type: String }
}, { _id: false });

// ========================================
// 메인 스키마
// ========================================

const TerrainTypeEnum = ['plains', 'forest', 'hills', 'mountain', 'river', 'city', 'fortress', 'desert', 'snow', 'swamp', 'naval'];
const WeatherEnum = ['clear', 'cloudy', 'rain', 'snow', 'fog', 'storm'];
const TimeOfDayEnum = ['dawn', 'morning', 'noon', 'evening', 'night'];

const BattleMapTemplateSchema = new Schema<IBattleMapTemplate>({
  session_id: { type: String, required: true },
  city_id: { type: Number, required: true },
  region_id: { type: Number },
  
  name: { type: String, required: true },
  width: { type: Number, default: 500 },
  height: { type: Number, default: 500 },
  
  // 지형 정보
  terrainType: { type: String, enum: TerrainTypeEnum, default: 'plains' },
  terrain: [TerrainTileSchema],
  heightMap: [[Number]],  // 2D 배열
  
  // 성/구조물
  castle: { type: CastleSchema, required: true },
  wallConfig: WallConfigSchema,
  structures: [StructureSchema],
  
  // 출입구 및 배치
  exits: [MapExitSchema],
  deployment: { type: DeploymentSchema, required: true },
  
  // 전략 요소
  strategicPoints: [StrategicPointSchema],
  terrainFeatures: [TerrainFeatureSchema],
  
  // 승리 조건 및 점령 포인트
  victoryConditions: { type: [VictoryConditionSchema], default: [] },
  controlPoints: { type: [ControlPointSchema], default: [] },
  thronePosition: PositionSchema,  // 광장/왕좌 위치
  
  // 환경 설정
  defaultWeather: { type: String, enum: WeatherEnum, default: 'clear' },
  defaultTimeOfDay: { type: String, enum: TimeOfDayEnum, default: 'noon' },
  
  // 메타데이터
  version: { type: Number, default: 1 },
  author: { type: String },
  description: { type: String }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

BattleMapTemplateSchema.index({ session_id: 1, city_id: 1 }, { unique: true });
BattleMapTemplateSchema.index({ session_id: 1 });
BattleMapTemplateSchema.index({ session_id: 1, region_id: 1 });
BattleMapTemplateSchema.index({ terrainType: 1 });

export const BattleMapTemplate = mongoose.models.BattleMapTemplate || mongoose.model<IBattleMapTemplate>('BattleMapTemplate', BattleMapTemplateSchema);
