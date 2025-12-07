import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Ground Unit Types (지상 유닛 타입)
 */
export type GroundUnitType =
  | 'armored'          // 기갑병 (Armored Infantry) - 높은 공격/방어, 척탄병에 약함
  | 'grenadier'        // 척탄병 (Grenadier) - 대기갑 보너스, 보병에 약함
  | 'infantry';        // 보병 (Light Infantry) - 점령 속도 보너스, 기갑병에 약함

/**
 * Ground Battle Status
 */
export type GroundBattleStatus =
  | 'WAITING'          // 대기 중 (병력 집결)
  | 'DROPPING'         // 강하 중
  | 'COMBAT'           // 전투 중
  | 'CONQUERING'       // 점령 진행 중 (방어군 전멸 후)
  | 'ENDED';           // 종료

/**
 * Battle Result Types
 */
export type GroundBattleResult =
  | 'ATTACKER_WIN'     // 공격측 승리 (점령 완료)
  | 'DEFENDER_WIN'     // 방어측 승리
  | 'DRAW'             // 무승부 (타임아웃)
  | 'ATTACKER_RETREAT' // 공격측 철수
  | 'DEFENDER_RETREAT';// 방어측 철수 (드물게 발생)

/**
 * Ground Unit Stats Interface
 */
export interface IGroundUnitStats {
  hp: number;           // 체력
  maxHp: number;        // 최대 체력
  attack: number;       // 공격력
  defense: number;      // 방어력
  morale: number;       // 사기 (0-100)
  conquestPower: number;// 점령력 (보병 보너스)
}

/**
 * Ground Unit Interface
 */
export interface IGroundUnit {
  unitId: string;
  type: GroundUnitType;
  count: number;          // 유닛 수 (최대 1000명/유닛)
  
  // Current stats
  stats: IGroundUnitStats;
  
  // Origin
  sourceFleetId: string;  // 강하한 함대 ID
  factionId: string;      // 소속 팩션
  commanderId?: string;   // 지휘관 (옵션)
  
  // Status
  isDestroyed: boolean;
  isChaos: boolean;       // 사기 붕괴 상태
  isRetreating: boolean;  // 철수 중
  
  // Combat tracking
  kills: number;          // 처치 수
  damageDealt: number;
  damageTaken: number;
  
  // Deployment timestamp
  deployedAt: Date;
}

/**
 * Drop Queue Item - 강하 대기열
 */
export interface IDropQueueItem {
  unitId: string;
  fleetId: string;
  factionId: string;
  unitType: GroundUnitType;
  count: number;
  queuedAt: Date;
  expectedDropAt: Date;   // 예상 강하 완료 시각
}

/**
 * Combat Log Entry
 */
export interface ICombatLogEntry {
  tick: number;
  timestamp: Date;
  action: 'ATTACK' | 'DAMAGE' | 'KILL' | 'CHAOS' | 'RETREAT' | 'ORBITAL_STRIKE' | 'CONQUEST_TICK';
  sourceUnitId?: string;
  targetUnitId?: string;
  damage?: number;
  conquestGaugeChange?: number;
  description: string;
}

/**
 * Ground Battle Schema
 * Represents a ground combat instance on a planet
 */
export interface IGroundBattle extends Document {
  battleId: string;
  sessionId: string;
  planetId: string;
  systemId: string;       // 성계 ID (빠른 조회용)
  
  // Status
  status: GroundBattleStatus;
  result?: GroundBattleResult;
  
  // Participants
  attackerFactionId: string;
  defenderFactionId?: string;  // null이면 중립 행성
  
  // Units - 30 vs 30 제한
  attackerUnits: IGroundUnit[];
  defenderUnits: IGroundUnit[];
  
  // Drop Queue (강하 대기열)
  attackerDropQueue: IDropQueueItem[];
  defenderDropQueue: IDropQueueItem[];  // 방어측도 증원 가능
  
  // Conquest
  conquestGauge: number;  // 0-100, 100이면 점령 완료
  conquestRate: number;   // 턴당 증가량 (아군 유닛 수에 비례)
  
  // Combat Settings
  maxUnitsPerSide: number;  // 기본 30
  tickInterval: number;     // ms, 기본 10000 (10초)
  currentTick: number;
  
  // Terrain
  terrainModifier: {
    attackerBonus: number;  // 공격측 보정 (-20 ~ +20)
    defenderBonus: number;  // 방어측 보정 (보통 양수)
    conquestMultiplier: number; // 점령 속도 배수 (0.5 ~ 2.0)
  };
  
  // Orbital Support
  orbitalStrike: {
    available: boolean;     // 궤도 폭격 가능 여부
    cooldownTicks: number;  // 쿨다운 (틱)
    lastUsedTick?: number;
    friendlyFireRisk: number; // 아군 오폭 확률 (0-100)
  };
  
  // Combat Log
  combatLog: ICombatLogEntry[];
  
  // Timestamps
  startedAt?: Date;
  endedAt?: Date;
  
  // Metadata
  data: Record<string, unknown>;
}

// ============================================================
// Sub-Schemas
// ============================================================

const GroundUnitStatsSchema = new Schema<IGroundUnitStats>({
  hp: { type: Number, required: true },
  maxHp: { type: Number, required: true },
  attack: { type: Number, required: true },
  defense: { type: Number, required: true },
  morale: { type: Number, default: 100, min: 0, max: 100 },
  conquestPower: { type: Number, default: 1 },
}, { _id: false });

const GroundUnitSchema = new Schema<IGroundUnit>({
  unitId: { type: String, required: true },
  type: {
    type: String,
    enum: ['armored', 'grenadier', 'infantry'],
    required: true
  },
  count: { type: Number, required: true, min: 0, max: 1000 },
  
  stats: { type: GroundUnitStatsSchema, required: true },
  
  sourceFleetId: { type: String, required: true },
  factionId: { type: String, required: true },
  commanderId: { type: String },
  
  isDestroyed: { type: Boolean, default: false },
  isChaos: { type: Boolean, default: false },
  isRetreating: { type: Boolean, default: false },
  
  kills: { type: Number, default: 0 },
  damageDealt: { type: Number, default: 0 },
  damageTaken: { type: Number, default: 0 },
  
  deployedAt: { type: Date, default: Date.now },
}, { _id: false });

const DropQueueItemSchema = new Schema<IDropQueueItem>({
  unitId: { type: String, required: true },
  fleetId: { type: String, required: true },
  factionId: { type: String, required: true },
  unitType: {
    type: String,
    enum: ['armored', 'grenadier', 'infantry'],
    required: true
  },
  count: { type: Number, required: true },
  queuedAt: { type: Date, default: Date.now },
  expectedDropAt: { type: Date, required: true },
}, { _id: false });

const CombatLogEntrySchema = new Schema<ICombatLogEntry>({
  tick: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  action: {
    type: String,
    enum: ['ATTACK', 'DAMAGE', 'KILL', 'CHAOS', 'RETREAT', 'ORBITAL_STRIKE', 'CONQUEST_TICK'],
    required: true
  },
  sourceUnitId: { type: String },
  targetUnitId: { type: String },
  damage: { type: Number },
  conquestGaugeChange: { type: Number },
  description: { type: String, required: true },
}, { _id: false });

// ============================================================
// Main Schema
// ============================================================

const GroundBattleSchema = new Schema<IGroundBattle>({
  battleId: { type: String, required: true },
  sessionId: { type: String, required: true },
  planetId: { type: String, required: true },
  systemId: { type: String, required: true },
  
  status: {
    type: String,
    enum: ['WAITING', 'DROPPING', 'COMBAT', 'CONQUERING', 'ENDED'],
    default: 'WAITING'
  },
  result: {
    type: String,
    enum: ['ATTACKER_WIN', 'DEFENDER_WIN', 'DRAW', 'ATTACKER_RETREAT', 'DEFENDER_RETREAT']
  },
  
  attackerFactionId: { type: String, required: true },
  defenderFactionId: { type: String },
  
  attackerUnits: { type: [GroundUnitSchema], default: [] },
  defenderUnits: { type: [GroundUnitSchema], default: [] },
  
  attackerDropQueue: { type: [DropQueueItemSchema], default: [] },
  defenderDropQueue: { type: [DropQueueItemSchema], default: [] },
  
  conquestGauge: { type: Number, default: 0, min: 0, max: 100 },
  conquestRate: { type: Number, default: 0 },
  
  maxUnitsPerSide: { type: Number, default: 30 },
  tickInterval: { type: Number, default: 10000 },  // 10 seconds
  currentTick: { type: Number, default: 0 },
  
  terrainModifier: {
    attackerBonus: { type: Number, default: 0 },
    defenderBonus: { type: Number, default: 10 },  // 방어측 기본 이점
    conquestMultiplier: { type: Number, default: 1.0 }
  },
  
  orbitalStrike: {
    available: { type: Boolean, default: false },
    cooldownTicks: { type: Number, default: 10 },
    lastUsedTick: { type: Number },
    friendlyFireRisk: { type: Number, default: 15 }  // 15% 아군 오폭
  },
  
  combatLog: { type: [CombatLogEntrySchema], default: [] },
  
  startedAt: { type: Date },
  endedAt: { type: Date },
  
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

// ============================================================
// Indexes
// ============================================================

GroundBattleSchema.index({ battleId: 1, sessionId: 1 }, { unique: true });
GroundBattleSchema.index({ sessionId: 1, planetId: 1 });
GroundBattleSchema.index({ sessionId: 1, status: 1 });
GroundBattleSchema.index({ sessionId: 1, attackerFactionId: 1 });
GroundBattleSchema.index({ sessionId: 1, defenderFactionId: 1 });
GroundBattleSchema.index({ sessionId: 1, systemId: 1 });

// ============================================================
// Virtual Fields
// ============================================================

// 총 공격 유닛 수
GroundBattleSchema.virtual('attackerUnitCount').get(function() {
  return this.attackerUnits.filter(u => !u.isDestroyed).length;
});

// 총 방어 유닛 수
GroundBattleSchema.virtual('defenderUnitCount').get(function() {
  return this.defenderUnits.filter(u => !u.isDestroyed).length;
});

// 공격측 총 병력
GroundBattleSchema.virtual('attackerTroopCount').get(function() {
  return this.attackerUnits
    .filter(u => !u.isDestroyed)
    .reduce((sum, u) => sum + u.count, 0);
});

// 방어측 총 병력
GroundBattleSchema.virtual('defenderTroopCount').get(function() {
  return this.defenderUnits
    .filter(u => !u.isDestroyed)
    .reduce((sum, u) => sum + u.count, 0);
});

// ============================================================
// Methods
// ============================================================

/**
 * 공격측 유닛 추가 가능 여부
 */
GroundBattleSchema.methods.canAddAttackerUnit = function(): boolean {
  return this.attackerUnits.filter((u: IGroundUnit) => !u.isDestroyed).length < this.maxUnitsPerSide;
};

/**
 * 방어측 유닛 추가 가능 여부
 */
GroundBattleSchema.methods.canAddDefenderUnit = function(): boolean {
  return this.defenderUnits.filter((u: IGroundUnit) => !u.isDestroyed).length < this.maxUnitsPerSide;
};

/**
 * 전투 로그 추가
 */
GroundBattleSchema.methods.addCombatLog = function(entry: Omit<ICombatLogEntry, 'tick' | 'timestamp'>): void {
  this.combatLog.push({
    tick: this.currentTick,
    timestamp: new Date(),
    ...entry
  });
  
  // 로그 크기 제한 (최근 1000개만 유지)
  if (this.combatLog.length > 1000) {
    this.combatLog = this.combatLog.slice(-1000);
  }
};

/**
 * 점령 게이지 계산
 */
GroundBattleSchema.methods.calculateConquestRate = function(): number {
  const aliveAttackers = this.attackerUnits.filter((u: IGroundUnit) => !u.isDestroyed && !u.isChaos);
  const aliveDefenders = this.defenderUnits.filter((u: IGroundUnit) => !u.isDestroyed && !u.isChaos);
  
  if (aliveDefenders.length > 0) {
    // 방어군이 있으면 점령 불가
    return 0;
  }
  
  // 보병의 점령력 보너스 반영
  let totalConquestPower = 0;
  for (const unit of aliveAttackers) {
    totalConquestPower += unit.count * unit.stats.conquestPower;
  }
  
  // 기본: 유닛 수 * 0.5 + 점령력 보너스
  const baseRate = aliveAttackers.length * 0.5;
  const bonusRate = totalConquestPower / 1000; // 스케일링
  
  return (baseRate + bonusRate) * this.terrainModifier.conquestMultiplier;
};

// ============================================================
// Statics
// ============================================================

/**
 * 행성에 활성 전투가 있는지 확인
 */
GroundBattleSchema.statics.findActiveBattle = function(
  sessionId: string,
  planetId: string
): Promise<IGroundBattle | null> {
  return this.findOne({
    sessionId,
    planetId,
    status: { $in: ['WAITING', 'DROPPING', 'COMBAT', 'CONQUERING'] }
  }).exec();
};

/**
 * 팩션의 모든 활성 지상전 조회
 */
GroundBattleSchema.statics.findFactionBattles = function(
  sessionId: string,
  factionId: string
): Promise<IGroundBattle[]> {
  return this.find({
    sessionId,
    $or: [
      { attackerFactionId: factionId },
      { defenderFactionId: factionId }
    ],
    status: { $ne: 'ENDED' }
  }).exec();
};

// ============================================================
// Unit Type Specifications (Static Data)
// ============================================================

export const GROUND_UNIT_SPECS: Record<GroundUnitType, {
  name: string;
  nameKo: string;
  baseHp: number;
  baseAttack: number;
  baseDefense: number;
  conquestPower: number;  // 점령력 (보병 보너스)
  dropTime: number;       // 강하 시간 (틱)
  cost: {
    credits: number;
    minerals: number;
  };
}> = {
  armored: {
    name: 'Armored Infantry',
    nameKo: '기갑병',
    baseHp: 150,
    baseAttack: 50,
    baseDefense: 40,
    conquestPower: 1,
    dropTime: 3,
    cost: {
      credits: 500,
      minerals: 300
    }
  },
  grenadier: {
    name: 'Grenadier',
    nameKo: '척탄병',
    baseHp: 100,
    baseAttack: 60,
    baseDefense: 25,
    conquestPower: 1,
    dropTime: 2,
    cost: {
      credits: 400,
      minerals: 200
    }
  },
  infantry: {
    name: 'Light Infantry',
    nameKo: '보병',
    baseHp: 80,
    baseAttack: 30,
    baseDefense: 20,
    conquestPower: 3,  // 점령 보너스!
    dropTime: 1,
    cost: {
      credits: 200,
      minerals: 100
    }
  }
};

/**
 * 병과 상성 매트릭스
 * [공격자][방어자] = 데미지 배수
 * 
 * 기갑병 → 보병: 1.5배 (기갑의 화력이 보병을 압도)
 * 척탄병 → 기갑병: 1.5배 (대기갑 무기)
 * 보병 → 척탄병: 1.3배 (수적 우세, 근접전)
 */
export const COUNTER_MATRIX: Record<GroundUnitType, Record<GroundUnitType, number>> = {
  armored: {
    armored: 1.0,
    grenadier: 0.7,  // 척탄병에 약함
    infantry: 1.5    // 보병에 강함
  },
  grenadier: {
    armored: 1.5,    // 기갑병에 강함
    grenadier: 1.0,
    infantry: 0.8    // 보병에 약함
  },
  infantry: {
    armored: 0.7,    // 기갑병에 약함
    grenadier: 1.3,  // 척탄병에 강함
    infantry: 1.0
  }
};

/**
 * 지형 타입별 보정값
 */
export const TERRAIN_MODIFIERS: Record<string, {
  attackerBonus: number;
  defenderBonus: number;
  conquestMultiplier: number;
}> = {
  terran: { attackerBonus: 0, defenderBonus: 10, conquestMultiplier: 1.0 },
  ocean: { attackerBonus: -10, defenderBonus: 15, conquestMultiplier: 0.8 },
  desert: { attackerBonus: -5, defenderBonus: 5, conquestMultiplier: 1.2 },
  ice: { attackerBonus: -15, defenderBonus: 10, conquestMultiplier: 0.7 },
  volcanic: { attackerBonus: -10, defenderBonus: 0, conquestMultiplier: 1.0 },
  artificial: { attackerBonus: 5, defenderBonus: 20, conquestMultiplier: 0.6 },
  barren: { attackerBonus: 0, defenderBonus: 0, conquestMultiplier: 1.5 }
};

// ============================================================
// Export Model
// ============================================================

export const GroundBattle: Model<IGroundBattle> =
  mongoose.models.GroundBattle || mongoose.model<IGroundBattle>('GroundBattle', GroundBattleSchema);

