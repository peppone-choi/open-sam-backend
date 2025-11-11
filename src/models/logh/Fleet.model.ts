/**
 * LOGH Fleet Model
 * 은하영웅전설 함대
 * 
 * 100x50 그리드 맵 상에서 직접 이동하며 전투
 * 전술 맵 없이 전략 맵에서 모든 전투 진행
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IFleet extends Document {
  session_id: string;
  fleetId: string; // Fleet unique ID

  // 기본 정보
  name: string;
  // 부대 유형 (은하영웅전설 VII 매뉴얼 기준)
  // - single_ship (단독함): 기함 1척만
  // - fleet (함대): 최대 60 유닛 (18,000척), 최대 10명 편성
  // - patrol (순찰대): 3 유닛 (900척), 최대 3명 편성
  // - transport (수송함대): 수송함 20 유닛 + 전투함 3 유닛, 최대 3명 편성
  // - ground_force (지상부대): 양륙함 3 유닛 + 육전대 3 유닛, 1명
  // - garrison (행성수비대): 육전대 10 유닛, 1명 (함정 없음)
  fleetType?: 'single_ship' | 'fleet' | 'patrol' | 'transport' | 'ground_force' | 'garrison';
  
  // 최대 유닛 제한 (부대 유형에 따라 다름)
  maxUnits?: number; // 함대: 60, 순찰대: 3, 수송함대: 23 (수송20+전투3), 등
  maxCrewSlots?: number; // 함대: 10, 순찰대: 3, 수송함대: 3, 지상부대: 1, 행성수비대: 1
  
  commanderId?: string; // 사령관 ID (선택)
  commanderName?: string; // 사령관 이름 (표시용)
  faction: 'empire' | 'alliance' | 'neutral';

  // 함선 구성
  // 참고: 1 유닛 = 300척 (매뉴얼 명시)
  ships: {
    type: string; // 함선 종류 (전함, 순양함, 구축함, 항모 등)
    count: number; // 유닛 수 (실제 함선 수 = count × 300)
    health?: number; // 함선 상태 (0-100)
  }[];

  totalShips: number; // 총 함선 유닛 수 (실제 함선 수 = totalShips × 300)
  totalStrength: number; // 총 전투력

  // 육전대 (지상군)
  // 참고: 1 유닛 ≈ 연대급 (약 2,000명 추정)
  // 지상부대: 양륙함 3 유닛(900척) → 육전대 3 유닛(약 6,000명)
  // 행성수비대: 육전대 10 유닛(약 20,000명)
  // 병종: 장갑병, 장갑척탄병, 경장 육전병
  groundTroops?: {
    type: string; // 병종 (장갑병, 장갑척탄병, 경장 육전병)
    count: number; // 유닛 수 (실제 병력 ≈ count × 2,000)
    health?: number; // 병력 상태 (0-100)
  }[];
  totalGroundTroops?: number; // 총 육전대 유닛 수

  // 자원
  supplies: number; // 보급품 (군수물자)
  fuel: number; // 연료 (항속) - 워프 항행에 필요
  morale: number; // 사기 (0-100)

  // 훈련도
  training: {
    discipline: number; // 군기 유지도 (0-100)
    space: number; // 항주 훈련도 (0-100)
    ground: number; // 육전 훈련도 (0-100)
    air: number; // 공전 훈련도 (0-100)
  };

  // 전략적 위치 (100x50 전략 그리드 좌표)
  strategicPosition: {
    x: number; // 0-99
    y: number; // 0-49
  };

  // 그리드 위치 (전투/이동 서비스용, strategicPosition의 별칭)
  gridPosition?: {
    x: number; // 0-99
    y: number; // 0-49
  };

  // 전술적 위치 (전술 맵 내 실시간 좌표, 전투 중일 때만 사용)
  tacticalPosition?: {
    x: number; // 전술 맵 좌표
    y: number;
    velocity?: {
      x: number; // 이동 속도 벡터
      y: number;
    };
    heading?: number; // 함대 진행 방향 (각도)
  };

  // 이동 (실시간)
  movementSpeed: number; // 초당 이동 속도
  movementRange?: number; // 이동 가능 범위 (그리드 단위)
  isMoving: boolean; // 현재 이동 중 여부
  destination?: {
    x: number;
    y: number;
  };
  movementPath?: Array<{ x: number; y: number }>; // 이동 경로

  // 전투 상태
  isInCombat: boolean; // 전투 중 여부
  tacticalMapId?: string; // 참여 중인 전술 맵 ID
  combatRange?: number; // 전투 사정거리
  combatTarget?: string; // 현재 교전 중인 목표 함대 ID

  // 진형
  formation: 'standard' | 'offensive' | 'defensive' | 'encircle' | 'retreat';

  // 전투 자세 (StanceChange 명령에서 사용)
  combatStance?: 'aggressive' | 'defensive' | 'balanced' | 'hold_fire' | 'evasive';

  // 커스텀 데이터 (tactical commands 등에서 사용)
  customData?: any;

  // 상태
  status: 'idle' | 'moving' | 'combat' | 'retreating' | 'docked' | 'destroyed';

  // 위치 정보
  currentSystemId?: string; // 현재 위치한 성계
  dockedPlanetId?: string; // 정박 중인 행성 (status가 docked일 때)

  // 메서드
  getActualShipCount?(): number; // 실제 함선 수 (유닛 × 300)
  getShipCountByType?(type: string): number; // 함선 종류별 실제 함선 수
  getActualTroopCount?(): number; // 실제 육전대 병력 수 (유닛 × 2,000)
  getTroopCountByType?(type: string): number; // 병종별 실제 병력 수

  createdAt?: Date;
  updatedAt?: Date;
}

const FleetSchema = new Schema<IFleet>(
  {
    session_id: { type: String, required: true },
    fleetId: { type: String, required: true },

    name: { type: String, required: true },
    fleetType: {
      type: String,
      enum: ['single_ship', 'fleet', 'patrol', 'transport', 'ground_force', 'garrison'],
      default: 'single_ship',
    },
    maxUnits: { type: Number },
    maxCrewSlots: { type: Number },
    commanderId: { type: String },
    commanderName: { type: String },
    faction: { 
      type: String, 
      enum: ['empire', 'alliance', 'neutral'], 
      required: true 
    },

    ships: [
      {
        type: { type: String, required: true },
        count: { type: Number, required: true, default: 0 },
        health: { type: Number, default: 100, min: 0, max: 100 },
      },
    ],

    totalShips: { type: Number, default: 0 },
    totalStrength: { type: Number, default: 0 },

    groundTroops: [
      {
        type: { type: String, required: true },
        count: { type: Number, required: true, default: 0 },
        health: { type: Number, default: 100, min: 0, max: 100 },
      },
    ],
    totalGroundTroops: { type: Number, default: 0 },

    supplies: { type: Number, default: 10000 }, // 군수물자
    fuel: { type: Number, default: 1000 }, // 연료 (항속)
    morale: { type: Number, default: 70, min: 0, max: 100 },

    training: {
      discipline: { type: Number, default: 50, min: 0, max: 100 },
      space: { type: Number, default: 50, min: 0, max: 100 },
      ground: { type: Number, default: 50, min: 0, max: 100 },
      air: { type: Number, default: 50, min: 0, max: 100 },
    },

    strategicPosition: {
      x: { type: Number, required: true, min: 0, max: 99 },
      y: { type: Number, required: true, min: 0, max: 49 },
    },

    gridPosition: {
      x: { type: Number, min: 0, max: 99 },
      y: { type: Number, min: 0, max: 49 },
    },

    tacticalPosition: {
      x: { type: Number },
      y: { type: Number },
      velocity: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 },
      },
      heading: { type: Number, default: 0 }, // 0-360도
    },

    movementSpeed: { type: Number, default: 1.0 }, // 초당 이동 속도
    movementRange: { type: Number, default: 5 }, // 이동 가능 범위 (그리드 단위)
    isMoving: { type: Boolean, default: false },
    destination: {
      x: { type: Number },
      y: { type: Number },
    },
    movementPath: [
      {
        x: { type: Number },
        y: { type: Number },
      },
    ],

    isInCombat: { type: Boolean, default: false },
    tacticalMapId: { type: String },
    combatRange: { type: Number, default: 100 }, // 사정거리 (전술 맵 좌표 단위)
    combatTarget: { type: String }, // 현재 교전 중인 목표 함대 ID

    formation: {
      type: String,
      enum: ['standard', 'offensive', 'defensive', 'encircle', 'retreat'],
      default: 'standard',
    },

    combatStance: {
      type: String,
      enum: ['aggressive', 'defensive', 'balanced', 'hold_fire', 'evasive'],
      default: 'balanced',
    },

    customData: { type: Schema.Types.Mixed },

    status: {
      type: String,
      enum: ['idle', 'moving', 'combat', 'retreating', 'docked', 'destroyed'],
      default: 'idle',
    },

    currentSystemId: { type: String },
    dockedPlanetId: { type: String },
  },
  {
    timestamps: true,
  }
);

// 상수 (은하영웅전설 VII 매뉴얼 기준)
export const SHIPS_PER_UNIT = 300; // 1 함선 유닛 = 300척 (매뉴얼 명시: "1 艦艇ユニットは 300 隻を表します")
export const CREW_PER_SHIP = 100; // 함선 1척당 승무원 100명 (역산: 900척 = 90,000명 승무원)
// 참고: 육전대 유닛의 정확한 인원수는 매뉴얼에 명시되지 않음
// 추정: 1 유닛 ≈ 연대급 (Regiment) = 약 1,000~3,000명
// 지상부대 3 유닛 ≈ 3,000~9,000명, 행성수비대 10 유닛 ≈ 10,000~30,000명
export const TROOPS_PER_UNIT = 2000; // 1 육전대 유닛 ≈ 2,000명 (연대급 단위로 추정)

// 부대 유형별 제한
export const FLEET_TYPE_LIMITS = {
  single_ship: {
    maxUnits: 0, // 기함만 (유닛 없음)
    maxShips: 1, // 기함 1척
    maxCrewSlots: 1, // 사령관 1명
    maxGroundTroops: 0,
  },
  fleet: {
    maxUnits: 60, // 최대 60 유닛
    maxShips: 18000, // 60 × 300 = 18,000척
    maxCrewSlots: 10, // 사령관1, 부사령관1, 참모장1, 참모6, 부관1
    maxGroundTroops: 0, // 함대는 육전대 미보유 (지상부대가 별도)
  },
  patrol: {
    maxUnits: 3, // 3 유닛
    maxShips: 900, // 3 × 300 = 900척
    maxCrewSlots: 3, // 사령관1, 부사령관1, 부관1
    maxGroundTroops: 0,
  },
  transport: {
    maxUnits: 23, // 수송함 20 + 전투함 3
    maxShips: 6900, // (20 + 3) × 300 = 6,900척
    maxCrewSlots: 3, // 사령관1, 부사령관1, 부관1
    maxGroundTroops: 0,
  },
  ground_force: {
    maxUnits: 3, // 양륙함 3 유닛
    maxShips: 900, // 3 × 300 = 900척
    maxCrewSlots: 1, // 사령관 1명
    maxGroundTroops: 3, // 육전대 3 유닛 (약 6,000명)
  },
  garrison: {
    maxUnits: 0, // 함정 유닛 없음
    maxShips: 1, // 기함만
    maxCrewSlots: 1, // 지휘관 1명
    maxGroundTroops: 10, // 육전대 10 유닛 (약 20,000명)
  },
} as const;

// 인스턴스 메서드
FleetSchema.methods.getActualShipCount = function(): number {
  return this.totalShips * SHIPS_PER_UNIT;
};

FleetSchema.methods.getShipCountByType = function(type: string): number {
  const shipGroup = this.ships.find((s: any) => s.type === type);
  return shipGroup ? shipGroup.count * SHIPS_PER_UNIT : 0;
};

FleetSchema.methods.getActualTroopCount = function(): number {
  return (this.totalGroundTroops || 0) * TROOPS_PER_UNIT;
};

FleetSchema.methods.getTroopCountByType = function(type: string): number {
  const troopGroup = this.groundTroops?.find((t: any) => t.type === type);
  return troopGroup ? troopGroup.count * TROOPS_PER_UNIT : 0;
};

// Unique index for session + fleetId
FleetSchema.index({ session_id: 1, fleetId: 1 }, { unique: true });
// Spatial index for strategic position
FleetSchema.index({ session_id: 1, 'strategicPosition.x': 1, 'strategicPosition.y': 1 });
// Index for combat queries
FleetSchema.index({ session_id: 1, isInCombat: 1 });
FleetSchema.index({ session_id: 1, tacticalMapId: 1 });
FleetSchema.index({ session_id: 1, faction: 1, status: 1 });

export const Fleet = mongoose.model<IFleet>('Fleet', FleetSchema);
