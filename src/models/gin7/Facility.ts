import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * 시설 상태
 */
export type FacilityStatus = 'BUILDING' | 'ACTIVE' | 'DAMAGED' | 'DESTROYED' | 'UPGRADING' | 'REPAIRING';

/**
 * 확장된 시설 타입 (요새 특수 시설 포함)
 */
export type ExtendedFacilityType = 
  | 'capital_building'    // 정부 청사
  | 'military_academy'    // 사관학교
  | 'shipyard'            // 조선소
  | 'factory'             // 공장
  | 'farm'                // 농장
  | 'mine'                // 광산
  | 'research_lab'        // 연구소
  | 'defense_grid'        // 방어 그리드
  | 'spaceport'           // 우주항
  | 'hospital'            // 병원
  | 'entertainment'       // 오락 시설
  | 'defense_shield'      // 방어막 발생기
  | 'cannon'              // 포대
  // 요새 특수 시설
  | 'fortress_cannon'     // 요새포 (토르 해머)
  | 'liquid_metal_armor'; // 유체 금속 장갑

/**
 * 시설 비용 구조
 */
export interface IFacilityCost {
  credits: number;
  minerals: number;
  energy: number;
  shipParts?: number;
  rareMetals?: number;
  turns: number;  // 건설 시간 (게임 일)
}

/**
 * 시설 레벨별 효과
 */
export interface IFacilityEffect {
  productionBonus?: number;       // 생산 보너스 (%)
  defenseBonus?: number;          // 방어력 보너스
  populationCapacity?: number;    // 인구 수용량 증가
  storageBonus?: number;          // 저장 용량 보너스
  researchBonus?: number;         // 연구 속도 보너스 (%)
  moraleBonus?: number;           // 사기 보너스
  healingRate?: number;           // 치유율 (병원)
  trainingSpeed?: number;         // 훈련 속도 (사관학교)
  shipBuildSpeed?: number;        // 함선 건조 속도 (%)
  damage?: number;                // 공격력 (포대/요새포)
  shieldStrength?: number;        // 방어막 강도
  autoRepairRate?: number;        // 자동 수리율 (유체 금속 장갑)
}

/**
 * 시설 정의 테이블
 */
export interface IFacilityDefinition {
  type: ExtendedFacilityType;
  name: string;
  description: string;
  maxLevel: number;
  baseCost: IFacilityCost;
  levelUpMultiplier: number;      // 레벨업 시 비용 배수
  baseHp: number;
  hpPerLevel: number;
  effects: IFacilityEffect[];     // 레벨별 효과 (index = level - 1)
  prerequisite?: {
    facilityType?: ExtendedFacilityType;
    facilityLevel?: number;
    techRequired?: string;
  };
  isUnique?: boolean;             // 행성당 하나만 건설 가능
  isFortressOnly?: boolean;       // 요새에만 건설 가능
}

/**
 * 시설 정의 테이블 데이터
 */
export const FACILITY_DEFINITIONS: Record<ExtendedFacilityType, IFacilityDefinition> = {
  capital_building: {
    type: 'capital_building',
    name: '정부 청사',
    description: '행성 통치의 중심. 사기와 충성도에 영향을 줍니다.',
    maxLevel: 10,
    baseCost: { credits: 5000, minerals: 2000, energy: 1000, turns: 5 },
    levelUpMultiplier: 1.5,
    baseHp: 500,
    hpPerLevel: 100,
    effects: Array.from({ length: 10 }, (_, i) => ({
      moraleBonus: 5 + i * 2,
      populationCapacity: 100000 * (i + 1)
    })),
    isUnique: true
  },
  military_academy: {
    type: 'military_academy',
    name: '사관학교',
    description: '장교 훈련 및 군사 연구를 수행합니다.',
    maxLevel: 10,
    baseCost: { credits: 8000, minerals: 3000, energy: 2000, turns: 7 },
    levelUpMultiplier: 1.6,
    baseHp: 400,
    hpPerLevel: 80,
    effects: Array.from({ length: 10 }, (_, i) => ({
      trainingSpeed: 10 + i * 10
    })),
    isUnique: true
  },
  shipyard: {
    type: 'shipyard',
    name: '조선소',
    description: '우주 함선을 건조합니다. 레벨이 높을수록 더 빠르게 건조합니다.',
    maxLevel: 10,
    baseCost: { credits: 15000, minerals: 8000, energy: 5000, shipParts: 2000, turns: 10 },
    levelUpMultiplier: 1.8,
    baseHp: 600,
    hpPerLevel: 120,
    effects: Array.from({ length: 10 }, (_, i) => ({
      shipBuildSpeed: 10 + i * 10,
      productionBonus: i * 5
    }))
  },
  factory: {
    type: 'factory',
    name: '공장',
    description: '자원을 가공하여 부품과 상품을 생산합니다.',
    maxLevel: 10,
    baseCost: { credits: 5000, minerals: 3000, energy: 2000, turns: 5 },
    levelUpMultiplier: 1.4,
    baseHp: 300,
    hpPerLevel: 60,
    effects: Array.from({ length: 10 }, (_, i) => ({
      productionBonus: 10 + i * 10
    }))
  },
  farm: {
    type: 'farm',
    name: '농장',
    description: '식량을 생산합니다.',
    maxLevel: 10,
    baseCost: { credits: 2000, minerals: 1000, energy: 500, turns: 3 },
    levelUpMultiplier: 1.3,
    baseHp: 200,
    hpPerLevel: 40,
    effects: Array.from({ length: 10 }, (_, i) => ({
      productionBonus: 10 + i * 10
    }))
  },
  mine: {
    type: 'mine',
    name: '광산',
    description: '광물을 채굴합니다.',
    maxLevel: 10,
    baseCost: { credits: 3000, minerals: 500, energy: 1000, turns: 4 },
    levelUpMultiplier: 1.4,
    baseHp: 250,
    hpPerLevel: 50,
    effects: Array.from({ length: 10 }, (_, i) => ({
      productionBonus: 10 + i * 10
    }))
  },
  research_lab: {
    type: 'research_lab',
    name: '연구소',
    description: '기술 연구를 수행합니다.',
    maxLevel: 10,
    baseCost: { credits: 10000, minerals: 4000, energy: 3000, turns: 8 },
    levelUpMultiplier: 1.7,
    baseHp: 300,
    hpPerLevel: 60,
    effects: Array.from({ length: 10 }, (_, i) => ({
      researchBonus: 10 + i * 10
    })),
    isUnique: true
  },
  defense_grid: {
    type: 'defense_grid',
    name: '방어 그리드',
    description: '행성 전체 방어 시스템을 관리합니다.',
    maxLevel: 10,
    baseCost: { credits: 12000, minerals: 6000, energy: 4000, turns: 8 },
    levelUpMultiplier: 1.6,
    baseHp: 500,
    hpPerLevel: 100,
    effects: Array.from({ length: 10 }, (_, i) => ({
      defenseBonus: 10 + i * 5
    })),
    isUnique: true
  },
  spaceport: {
    type: 'spaceport',
    name: '우주항',
    description: '무역 및 함대 운용의 중심지입니다.',
    maxLevel: 10,
    baseCost: { credits: 8000, minerals: 4000, energy: 2000, turns: 6 },
    levelUpMultiplier: 1.5,
    baseHp: 400,
    hpPerLevel: 80,
    effects: Array.from({ length: 10 }, (_, i) => ({
      productionBonus: 5 + i * 5,
      storageBonus: 1000 * (i + 1)
    }))
  },
  hospital: {
    type: 'hospital',
    name: '병원',
    description: '부상자 치료 및 인구 회복을 담당합니다.',
    maxLevel: 10,
    baseCost: { credits: 6000, minerals: 2000, energy: 1500, turns: 5 },
    levelUpMultiplier: 1.4,
    baseHp: 300,
    hpPerLevel: 60,
    effects: Array.from({ length: 10 }, (_, i) => ({
      healingRate: 5 + i * 5,
      populationCapacity: 50000 * (i + 1)
    }))
  },
  entertainment: {
    type: 'entertainment',
    name: '오락 시설',
    description: '인구의 사기를 높입니다.',
    maxLevel: 10,
    baseCost: { credits: 4000, minerals: 1000, energy: 1000, turns: 4 },
    levelUpMultiplier: 1.3,
    baseHp: 200,
    hpPerLevel: 40,
    effects: Array.from({ length: 10 }, (_, i) => ({
      moraleBonus: 5 + i * 3
    }))
  },
  defense_shield: {
    type: 'defense_shield',
    name: '방어막 발생기',
    description: '행성을 보호하는 에너지 방어막을 생성합니다.',
    maxLevel: 10,
    baseCost: { credits: 20000, minerals: 8000, energy: 10000, rareMetals: 500, turns: 12 },
    levelUpMultiplier: 2.0,
    baseHp: 800,
    hpPerLevel: 200,
    effects: Array.from({ length: 10 }, (_, i) => ({
      shieldStrength: 100 + i * 100,
      defenseBonus: 5 + i * 5
    })),
    prerequisite: { facilityType: 'defense_grid', facilityLevel: 3 }
  },
  cannon: {
    type: 'cannon',
    name: '포대',
    description: '행성 방어용 대형 포대입니다.',
    maxLevel: 10,
    baseCost: { credits: 10000, minerals: 5000, energy: 3000, turns: 6 },
    levelUpMultiplier: 1.6,
    baseHp: 400,
    hpPerLevel: 80,
    effects: Array.from({ length: 10 }, (_, i) => ({
      damage: 50 + i * 30,
      defenseBonus: 3 + i * 2
    })),
    prerequisite: { facilityType: 'defense_grid', facilityLevel: 1 }
  },
  // 요새 특수 시설
  fortress_cannon: {
    type: 'fortress_cannon',
    name: '요새포 (토르 해머)',
    description: '강력한 주포로, 함대를 일격에 섬멸할 수 있습니다. 충전이 필요합니다.',
    maxLevel: 5,
    baseCost: { credits: 100000, minerals: 50000, energy: 30000, rareMetals: 5000, turns: 30 },
    levelUpMultiplier: 2.5,
    baseHp: 2000,
    hpPerLevel: 500,
    effects: Array.from({ length: 5 }, (_, i) => ({
      damage: 1000 + i * 500  // 매우 높은 데미지
    })),
    isUnique: true,
    isFortressOnly: true
  },
  liquid_metal_armor: {
    type: 'liquid_metal_armor',
    name: '유체 금속 장갑',
    description: '자기 회복 능력을 가진 특수 장갑입니다.',
    maxLevel: 5,
    baseCost: { credits: 80000, minerals: 40000, energy: 20000, rareMetals: 8000, turns: 25 },
    levelUpMultiplier: 2.2,
    baseHp: 3000,
    hpPerLevel: 1000,
    effects: Array.from({ length: 5 }, (_, i) => ({
      autoRepairRate: 5 + i * 3,  // 턴당 자동 회복 %
      defenseBonus: 20 + i * 10
    })),
    isUnique: true,
    isFortressOnly: true
  }
};

/**
 * 시설 레벨업 비용 계산
 */
export function calculateFacilityCost(type: ExtendedFacilityType, level: number): IFacilityCost {
  const def = FACILITY_DEFINITIONS[type];
  if (!def) throw new Error(`Unknown facility type: ${type}`);
  
  const multiplier = Math.pow(def.levelUpMultiplier, level - 1);
  
  return {
    credits: Math.floor(def.baseCost.credits * multiplier),
    minerals: Math.floor(def.baseCost.minerals * multiplier),
    energy: Math.floor(def.baseCost.energy * multiplier),
    shipParts: def.baseCost.shipParts ? Math.floor(def.baseCost.shipParts * multiplier) : undefined,
    rareMetals: def.baseCost.rareMetals ? Math.floor(def.baseCost.rareMetals * multiplier) : undefined,
    turns: Math.floor(def.baseCost.turns * Math.sqrt(level))
  };
}

/**
 * 시설 효과 가져오기
 */
export function getFacilityEffect(type: ExtendedFacilityType, level: number): IFacilityEffect {
  const def = FACILITY_DEFINITIONS[type];
  if (!def) return {};
  
  const effectIndex = Math.min(level - 1, def.effects.length - 1);
  return def.effects[effectIndex] || {};
}

/**
 * 시설 최대 HP 계산
 */
export function calculateFacilityMaxHp(type: ExtendedFacilityType, level: number): number {
  const def = FACILITY_DEFINITIONS[type];
  if (!def) return 100;
  
  return def.baseHp + (def.hpPerLevel * (level - 1));
}

/**
 * ConstructionQueue 모델
 * 시설 건설/업그레이드/수리 대기열
 */
export type ConstructionType = 'BUILD' | 'UPGRADE' | 'REPAIR';

export interface IConstructionQueue extends Document {
  queueId: string;
  sessionId: string;
  planetId: string;
  ownerId: string;            // 건설 명령자 (faction ID)
  
  constructionType: ConstructionType;
  facilityType: ExtendedFacilityType;
  targetLevel: number;        // 완료 시 목표 레벨
  
  // 진행 상태
  startTime: Date;
  endTime: Date;
  turnsRequired: number;
  turnsRemaining: number;
  
  // 비용 (예약됨)
  cost: {
    credits: number;
    minerals: number;
    energy: number;
    shipParts?: number;
    rareMetals?: number;
  };
  warehouseId: string;
  
  // 메타데이터
  priority: number;           // 높을수록 먼저 처리
  executedBy: string;         // 실행자 캐릭터 ID
  facilityId?: string;        // 기존 시설 ID (업그레이드/수리 시)
  
  status: 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

const ConstructionQueueSchema = new Schema<IConstructionQueue>({
  queueId: { type: String, required: true },
  sessionId: { type: String, required: true },
  planetId: { type: String, required: true },
  ownerId: { type: String, required: true },
  
  constructionType: { 
    type: String, 
    enum: ['BUILD', 'UPGRADE', 'REPAIR'], 
    required: true 
  },
  facilityType: { type: String, required: true },
  targetLevel: { type: Number, default: 1 },
  
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  turnsRequired: { type: Number, required: true },
  turnsRemaining: { type: Number, required: true },
  
  cost: {
    credits: { type: Number, default: 0 },
    minerals: { type: Number, default: 0 },
    energy: { type: Number, default: 0 },
    shipParts: Number,
    rareMetals: Number
  },
  warehouseId: { type: String, required: true },
  
  priority: { type: Number, default: 0 },
  executedBy: { type: String, required: true },
  facilityId: String,
  
  status: { 
    type: String, 
    enum: ['QUEUED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], 
    default: 'QUEUED' 
  }
}, {
  timestamps: true
});

// Indexes
ConstructionQueueSchema.index({ queueId: 1, sessionId: 1 }, { unique: true });
ConstructionQueueSchema.index({ sessionId: 1, planetId: 1, status: 1 });
ConstructionQueueSchema.index({ sessionId: 1, status: 1 });
ConstructionQueueSchema.index({ sessionId: 1, endTime: 1 });

export const ConstructionQueue: Model<IConstructionQueue> = 
  mongoose.models.ConstructionQueue || mongoose.model<IConstructionQueue>('ConstructionQueue', ConstructionQueueSchema);

/**
 * FortressCannon (요새포) 상태 모델
 * Planet.data에 저장될 수 있는 요새포 상태
 */
export interface IFortressCannonState {
  isCharged: boolean;
  chargeProgress: number;      // 0-100
  chargePerTurn: number;       // 턴당 충전량
  lastFiredAt?: Date;
  cooldownTurns: number;
  damage: number;              // 발사 시 데미지
}

/**
 * 기본 요새포 상태 생성
 */
export function createFortressCannonState(level: number): IFortressCannonState {
  const effect = getFacilityEffect('fortress_cannon', level);
  return {
    isCharged: false,
    chargeProgress: 0,
    chargePerTurn: 10 + level * 5,  // 레벨당 충전 속도 증가
    cooldownTurns: Math.max(1, 5 - level),
    damage: effect.damage || 1000
  };
}

