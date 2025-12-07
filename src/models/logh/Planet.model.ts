/**
 * LOGH Planet Model
 * 은하영웅전설 행성 (도시와 유사)
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IPlanet extends Document {
  session_id: string;
  planetId: string; // Planet unique ID (e.g., "heinessen", "odin")
  planetNumber?: number; // Planet number (1-80)

  // Basic info
  name: string;
  nameJa?: string;
  nameEn?: string;
  owner: 'empire' | 'alliance' | 'neutral';
  
  // Star System
  systemId: string; // 소속 성계
  systemName: string;

  // Stats (from planets-and-systems-with-stats.json)
  stats: {
    population: number; // 인구 (만 단위)
    industry: number; // 공업력 (0-100)
    technology: number; // 기술력 (0-100)
    defense: number; // 방어력 (0-100)
    resources: number; // 자원 (0-100)
    loyalty: number; // 충성도 (0-100)
    security: number; // 치안 (0-100)
    approvalRating: number; // 정부 지지율 (0-100)
    unrest: number; // 민심 불안 (0-100, 높을수록 폭동 위험)
  };

  // 민간인 관련 데이터
  civilianData?: {
    detainees: Array<{
      id: string;
      name: string;
      crime: string;
      arrestedAt: Date;
      status: 'detained' | 'trial' | 'imprisoned' | 'released' | 'executed';
    }>;
    activeProtests: number; // 진행 중인 시위 수
    lastRiotAt?: Date; // 마지막 폭동 발생일
  };

  // Production
  production: {
    ships: number; // 함선 생산력
    resources: number; // 자원 생산력
    shipTypes?: string[]; // 생산 가능한 함선 종류 (일본어)
  };

  // Garrison (주둔 병력)
  garrisonFleetId: string | null; // 주둔 함대 ID
  
  // 행성 수비군
  // 참고: 행성수비대 = 육전대 10 유닛 (약 20,000명)
  // 1 유닛 ≈ 연대급 (약 2,000명 추정)
  garrison?: {
    troops: {
      type: string; // 병종 (장갑병, 장갑척탄병, 경장 육전병)
      count: number; // 유닛 수 (실제 병력 ≈ count × 2,000)
      health?: number; // 병력 상태 (0-100)
    }[];
    totalTroops: number; // 총 수비군 유닛 수
    morale: number; // 수비군 사기 (0-100)
    training: number; // 수비군 훈련도 (0-100)
  };

  // Fortress
  isFortress: boolean;
  fortressGuns: number;

  // Warehouse
  warehouse: {
    supplies: number;
    ships: number;
  };

  // Economy
  economy?: {
    taxRate: number; // 세율 (0-100%)
    treasury: number; // 행성 재정
    income: number; // 턴당 수입
  };

  // Facilities
  facilities?: string[]; // 특수 시설 목록

  // Grid coordinates (100x50)
  gridCoordinates: {
    x: number; // 0-99
    y: number; // 0-49
  };
  
  // Pixel coordinates (reference only)
  pixelCoordinates?: {
    x: number;
    y: number;
  };

  // Strategic info
  strategicValue?: 'critical' | 'high' | 'normal' | 'low';
  territoryType?: 'empire' | 'alliance' | 'disputed' | 'neutral';
  description?: string;
  historicalSignificance?: string;

  // Capital flag
  isCapital?: boolean;

  // 커스텀 데이터 (스파이, 이벤트 등 유연한 저장용)
  customData?: any;

  // 메서드
  getActualGarrisonCount?(): number; // 실제 수비군 병력 수 (유닛 × 2,000)
  getGarrisonCountByType?(type: string): number; // 병종별 실제 병력 수

  createdAt?: Date;
  updatedAt?: Date;
}

const PlanetSchema = new Schema<IPlanet>(
  {
    session_id: { type: String, required: true },
    planetId: { type: String, required: true },
    planetNumber: { type: Number },

    name: { type: String, required: true },
    nameJa: { type: String },
    nameEn: { type: String },
    owner: {
      type: String,
      enum: ['empire', 'alliance', 'neutral'],
      default: 'neutral',
    },
    
    systemId: { type: String, required: true },
    systemName: { type: String, required: true },

    stats: {
      population: { type: Number, default: 1000 },
      industry: { type: Number, default: 20 },
      technology: { type: Number, default: 30 },
      defense: { type: Number, default: 30 },
      resources: { type: Number, default: 40 },
      loyalty: { type: Number, default: 50 },
      security: { type: Number, default: 50, min: 0, max: 100 }, // 치안
      approvalRating: { type: Number, default: 50, min: 0, max: 100 }, // 정부 지지율
      unrest: { type: Number, default: 0, min: 0, max: 100 }, // 민심 불안
    },

    civilianData: {
      detainees: [{
        id: String,
        name: String,
        crime: String,
        arrestedAt: Date,
        status: { type: String, enum: ['detained', 'trial', 'imprisoned', 'released', 'executed'] },
      }],
      activeProtests: { type: Number, default: 0 },
      lastRiotAt: Date,
    },

    production: {
      ships: { type: Number, default: 100 },
      resources: { type: Number, default: 100 },
      shipTypes: [{ type: String }],
    },

    garrisonFleetId: { type: String },

    garrison: {
      troops: [
        {
          type: { type: String, required: true },
          count: { type: Number, required: true, default: 0 },
          health: { type: Number, default: 100, min: 0, max: 100 },
        },
      ],
      totalTroops: { type: Number, default: 0 },
      morale: { type: Number, default: 70, min: 0, max: 100 },
      training: { type: Number, default: 50, min: 0, max: 100 },
    },

    isFortress: { type: Boolean, default: false },
    fortressGuns: { type: Number, default: 0 },

    warehouse: {
      supplies: { type: Number, default: 0 },
      ships: { type: Number, default: 0 },
    },

    economy: {
      taxRate: { type: Number, default: 50, min: 0, max: 100 },
      treasury: { type: Number, default: 10000 },
      income: { type: Number, default: 1000 },
    },

    facilities: [{ type: String }],

    gridCoordinates: {
      x: { type: Number, required: true, min: 0, max: 99 },
      y: { type: Number, required: true, min: 0, max: 49 },
    },
    
    pixelCoordinates: {
      x: { type: Number },
      y: { type: Number },
    },

    strategicValue: {
      type: String,
      enum: ['critical', 'high', 'normal', 'low'],
    },
    territoryType: {
      type: String,
      enum: ['empire', 'alliance', 'disputed', 'neutral'],
    },
    description: { type: String },
    historicalSignificance: { type: String },
    
    isCapital: { type: Boolean, default: false },

    customData: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
  }
);

// 상수 (Fleet 모델과 일관성 유지)
const TROOPS_PER_UNIT = 2000; // 1 육전대 유닛 ≈ 2,000명 (연대급)

// 인스턴스 메서드
PlanetSchema.methods.getActualGarrisonCount = function(): number {
  return (this.garrison?.totalTroops || 0) * TROOPS_PER_UNIT;
};

PlanetSchema.methods.getGarrisonCountByType = function(type: string): number {
  const troopGroup = this.garrison?.troops?.find((t: any) => t.type === type);
  return troopGroup ? troopGroup.count * TROOPS_PER_UNIT : 0;
};

// Unique index for session + planetId
PlanetSchema.index({ session_id: 1, planetId: 1 }, { unique: true });
// Index for grid coordinates for spatial queries
PlanetSchema.index({ session_id: 1, 'gridCoordinates.x': 1, 'gridCoordinates.y': 1 });

export const Planet = mongoose.model<IPlanet>('Planet', PlanetSchema);
