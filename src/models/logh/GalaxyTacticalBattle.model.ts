import mongoose, { Schema, Document, Model } from 'mongoose';
import { GalaxyFactionCode } from './GalaxySession.model';

/**
 * 전술 유닛 상태 (메뉴얼 2136행~)
 */
export interface ITacticalUnit {
  unitId: string;
  name: string;
  type: 'flagship' | 'ship_unit' | 'fighter_unit' | 'ground_unit' | 'base'; // 기함, 함정유닛(300척), 전투정, 육전대, 요새
  subtype: string; // 전함I형, 구축함II형 등
  commanderId?: string; // 지휘권자 ID (자동 할당)
  faction: GalaxyFactionCode | 'rebel';
  
  position: { x: number; y: number; z: number; heading: number };
  velocity: { x: number; y: number; z: number };
  
  status: 'active' | 'damaged' | 'destroyed' | 'retreating' | 'docked' | 'landed';
  mode: 'nav' | 'dock' | 'land' | 'combat'; // 항행, 정박, 주류, 전투 (메뉴얼 2470행)
  
  stats: {
    durability: number;     // 내구도
    maxDurability: number;
    shipCount: number;      // 잔존 척수 (함정 유닛의 경우 최대 300)
    crew: number;           // 승무원
    morale: number;         // 사기
    supplies: number;       // 물자
  };

  // 조함 패널 상태 (메뉴얼 884행)
  energyDistribution: {
    beam: number;
    gun: number;
    shield: number;
    engine: number;
    warp: number;
    sensor: number;
  };

  // 커맨드 레인지 (메뉴얼 2190행)
  commandRange: {
    currentRadius: number;
    maxRadius: number;
    expansionRate: number; // 지휘 능력에 비례
  };

  // 현재 명령 상태 (메뉴얼 2215행: 처리 시간 0~20초)
  currentCommand?: {
    code: string;       // MOVE, ATTACK, etc.
    targetId?: string;  // 대상 유닛/좌표
    targetPos?: { x: number; y: number };
    progress: number;   // 진행률 (0~100)
    state: 'preparing' | 'executing' | 'cooldown';
  };
}

export interface ITacticalFactionState {
  code: GalaxyFactionCode | 'rebel';
  label: string;
  commanderIds: string[];
  unitCount: number;
  isRebel?: boolean;
}

export interface IPlanetState {
  name: string;
  occupied: boolean;
  occupiedBy?: GalaxyFactionCode | 'rebel';
  defenseLevel: number; // 방위력 바 (메뉴얼 2309행)
}

export interface IGalaxyTacticalBattle extends Document {
  session_id: string;
  battleId: string;
  gridId: string;
  status: 'pending' | 'active' | 'resolved';
  
  units: ITacticalUnit[]; // 개별 유닛 상태 관리
  
  factions: ITacticalFactionState[];
  planetStates: IPlanetState[];
  
  victoryCheck: {
    enemyPresence: boolean;
    occupiedAllPlanets: boolean;
    resolvedAt?: Date;
  };
  
  casualtyReport: Array<{
    faction: string;
    shipsLost: number;
    troopsLost: number;
  }>;
  
  rewards: Array<{
    characterId: string;
    fame: number;
    evaluation: number;
  }>;
  
  startTime: Date;
  lastTick: Date;
  
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const UnitSchema = new Schema<ITacticalUnit>({
  unitId: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, required: true },
  subtype: { type: String },
  commanderId: { type: String },
  faction: { type: String, required: true },
  
  position: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    z: { type: Number, default: 0 },
    heading: { type: Number, default: 0 }
  },
  velocity: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    z: { type: Number, default: 0 }
  },
  
  status: { type: String, default: 'active' },
  mode: { type: String, default: 'nav' },
  
  stats: {
    durability: { type: Number, default: 100 },
    maxDurability: { type: Number, default: 100 },
    shipCount: { type: Number, default: 300 },
    crew: { type: Number, default: 100 },
    morale: { type: Number, default: 100 },
    supplies: { type: Number, default: 100 }
  },
  
  energyDistribution: {
    beam: { type: Number, default: 20 },
    gun: { type: Number, default: 20 },
    shield: { type: Number, default: 20 },
    engine: { type: Number, default: 20 },
    warp: { type: Number, default: 0 },
    sensor: { type: Number, default: 20 }
  },
  
  commandRange: {
    currentRadius: { type: Number, default: 0 },
    maxRadius: { type: Number, default: 1000 },
    expansionRate: { type: Number, default: 10 }
  },
  
  currentCommand: {
    code: String,
    targetId: String,
    targetPos: { x: Number, y: Number },
    progress: Number,
    state: String
  }
}, { _id: false });

const FactionStateSchema = new Schema<ITacticalFactionState>(
  {
    code: {
      type: String,
      enum: ['empire', 'alliance', 'rebel'],
      required: true,
    },
    label: { type: String, required: true },
    commanderIds: { type: [String], default: [] },
    unitCount: {
      type: Number,
      required: true,
      validate: {
        validator: (value: number) => value <= 300,
        message: '진영별 참여 유닛 수는 최대 300기입니다.'
      },
    },
    isRebel: { type: Boolean, default: false },
  },
  { _id: false }
);

const PlanetStateSchema = new Schema<IPlanetState>(
  {
    name: { type: String, required: true },
    occupied: { type: Boolean, default: false },
    occupiedBy: {
      type: String,
      enum: ['empire', 'alliance', 'rebel'],
    },
    defenseLevel: { type: Number, default: 100 },
  },
  { _id: false }
);

const GalaxyTacticalBattleSchema = new Schema<IGalaxyTacticalBattle>(
  {
    session_id: { type: String, required: true, index: true },
    battleId: { type: String, required: true, unique: true },
    gridId: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'active', 'resolved'],
      default: 'pending',
    },
    
    units: { type: [UnitSchema], default: [] },
    
    factions: {
      type: [FactionStateSchema],
      validate: {
        validator: (factions: ITacticalFactionState[]) => factions.length <= 2,
        message: '하나의 격자에서는 동시에 두 진영만 교전할 수 있습니다.',
      },
    },
    planetStates: { type: [PlanetStateSchema], default: [] },
    victoryCheck: {
      enemyPresence: { type: Boolean, default: true },
      occupiedAllPlanets: { type: Boolean, default: false },
      resolvedAt: { type: Date },
    },
    casualtyReport: {
      type: [
        {
          faction: { type: String, required: true },
          shipsLost: { type: Number, default: 0 },
          troopsLost: { type: Number, default: 0 },
        },
      ],
      default: [],
    },
    rewards: {
      type: [
        {
          characterId: { type: String, required: true },
          fame: { type: Number, default: 0 },
          evaluation: { type: Number, default: 0 },
        },
      ],
      default: [],
    },
    startTime: { type: Date, default: Date.now },
    lastTick: { type: Date, default: Date.now },
    notes: { type: String },
  },
  {
    timestamps: true,
  }
);

GalaxyTacticalBattleSchema.index({ session_id: 1, gridId: 1, status: 1 });

export const GalaxyTacticalBattle =
  (mongoose.models.GalaxyTacticalBattle as Model<IGalaxyTacticalBattle> | undefined) ||
  mongoose.model<IGalaxyTacticalBattle>('GalaxyTacticalBattle', GalaxyTacticalBattleSchema);
