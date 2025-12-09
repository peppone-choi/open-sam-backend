import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Ship class types
 */
export type ShipClass =
  | 'battleship'      // 전함 - 대형, 고화력
  | 'cruiser'         // 순양함 - 중형, 균형
  | 'destroyer'       // 구축함 - 소형, 기동성
  | 'carrier'         // 항공모함 - 함재기 탑재
  | 'frigate'         // 프리깃 - 호위/정찰
  | 'corvette'        // 초계함 - 소형, 저가
  | 'transport'       // 수송함 - 병력/물자 수송
  | 'landing'         // 상륙정 - 병력 상륙
  | 'engineering'     // 공병함 - 수리/건설
  | 'flagship';       // 기함 - 지휘함

/**
 * Fleet status
 */
export type FleetStatus =
  | 'IDLE'            // 대기
  | 'MOVING'          // 이동 중
  | 'WARPING'         // 워프 중
  | 'COMBAT'          // 전투 중
  | 'REORG'           // 재편성 중 (행동 불가)
  | 'DOCKED'          // 정박 (행성/스테이션)
  | 'RESUPPLY';       // 보급 중

/**
 * Ship type specifications (static data)
 */
export interface IShipSpec {
  shipClass: ShipClass;
  name: string;
  nameKo: string;
  
  // Combat stats
  maxHp: number;
  attack: number;
  defense: number;
  accuracy: number;
  evasion: number;
  
  // Resource consumption (per turn)
  fuelConsumption: number;
  ammoConsumption: number;
  
  // Cargo capacity
  cargoCapacity: number;
  crewCapacity: number;
  
  // Movement
  speed: number;          // Base speed
  warpCapable: boolean;
  
  // Construction
  buildCost: {
    credits: number;
    minerals: number;
    shipParts: number;
  };
  buildTurns: number;
  
  // Special abilities
  abilities: string[];
}

/**
 * Individual ship unit within a fleet
 */
export interface IShipUnit {
  unitId: string;
  name?: string;           // Unit display name
  shipClass: ShipClass;
  count: number;          // Number of ships (max 300)
  currentShipCount?: number; // Current active ship count
  maxShipCount?: number;   // Maximum ships in this unit
  
  // Current state
  hp: number;             // Average HP percentage (0-100)
  currentHp?: number;     // Current HP value
  maxHp?: number;         // Maximum HP value
  morale: number;         // 0-100
  
  // Confusion/Rout state (기함 격침 등으로 인한 혼란/패주)
  confusionLevel?: 'NONE' | 'MINOR' | 'MODERATE' | 'SEVERE' | 'ROUTED';
  
  // Resources
  fuel: number;
  maxFuel: number;
  ammo: number;
  maxAmmo: number;
  
  // Crew
  crewCount: number;
  maxCrew: number;
  currentCrewCount?: number;   // Current crew count
  crewQualityBonus?: number;   // Crew quality modifier
  
  // Command
  commanderId?: string;   // Character ID of unit commander
  
  // Experience
  veterancy: number;      // 0-100, affects combat performance
  
  // Damage tracking
  destroyed: number;      // Ships destroyed in this unit
  damaged: number;        // Ships currently damaged
  
  // Training
  training?: {
    navigation: number;
    ground: number;
    air: number;
    discipline: number;
    gunnery?: number;
    engineering?: number;
    boarding?: number;
  };
  
  // Position
  position?: {
    x: number;
    y: number;
    z?: number;
  };
  
  // Extensible data
  data?: Record<string, any>;
}

/**
 * Fleet Schema
 * A fleet is a collection of ship units commanded by a character
 */
export interface IFleet extends Document {
  fleetId: string;
  sessionId: string;
  
  // Command
  commanderId: string;    // Character ID of fleet commander
  admiralId?: string;     // Character ID of admiral (if different)
  factionId: string;
  
  // Fleet properties
  name: string;
  callsign?: string;
  
  // Status
  status: FleetStatus;
  statusData: Record<string, unknown>;  // Context data for current status
  
  // Location
  location: {
    type: 'SYSTEM' | 'PLANET' | 'WARP' | 'DEEP_SPACE';
    systemId?: string;
    planetId?: string;
    warpTravelId?: string;
    coordinates?: { x: number; y: number };
  };
  
  // Units
  units: IShipUnit[];
  maxUnits: number;       // Max unit types in fleet (default: 6)
  
  // Total fleet capacity
  totalShips: number;     // Sum of all unit counts
  maxShips: number;       // Maximum ships allowed (default: 300)
  
  // Fleet-level warehouse
  warehouseId?: string;
  
  // Formation & Tactics
  // Basic formations (legacy) + Advanced formations (gin7-fleet-formation)
  formation: 'standard' | 'offensive' | 'defensive' | 'wedge' | 'encircle' | 'guerrilla' 
    | 'STANDARD' | 'SPINDLE' | 'LINE' | 'CIRCULAR' | 'ECHELON' | 'WEDGE' | 'ENCIRCLE' | 'RETREAT';
  tactics: {
    engageDistance: 'close' | 'medium' | 'long';
    retreatThreshold: number;  // HP % to auto-retreat
    priorityTargets: ShipClass[];
  };
  
  // Combat history
  combatStats: {
    battlesWon: number;
    battlesLost: number;
    shipsDestroyed: number;
    shipsLost: number;
    damageDealt: number;
    damageTaken: number;
  };
  
  // Organization lock (prevents modification during certain operations)
  isLocked: boolean;
  lockedReason?: string;
  lockedUntil?: Date;
  
  // Crew management
  crewPool?: number;       // Available crew pool for the fleet
  
  // Training levels
  training?: {
    gunnery: number;       // 포술 훈련도
    navigation: number;    // 항해 훈련도
    engineering: number;   // 기관 훈련도
    boarding: number;      // 백병전 훈련도
    // Alternative training types (for TrainingCommandService)
    discipline?: number;   // 군기 유지
    ground?: number;       // 육전 훈련도
    air?: number;          // 공전 훈련도
  };
  
  // Cargo & Supplies
  cargo?: {
    fuel: number;
    ammo: number;
    supplies: number;
    parts: number;
    credits: number;
    materials: number;
  };
  
  // Docking status
  dockedAt?: string;       // Planet/Station ID where docked
  
  // Metadata
  createdAt: Date;
  data: Record<string, unknown>;
}

const ShipUnitSchema = new Schema<IShipUnit>({
  unitId: { type: String, required: true },
  name: { type: String },
  shipClass: {
    type: String,
    enum: ['battleship', 'cruiser', 'destroyer', 'carrier', 'frigate', 'corvette', 'transport', 'engineering', 'flagship'],
    required: true
  },
  count: { type: Number, default: 1, min: 0, max: 300 },
  currentShipCount: { type: Number },
  maxShipCount: { type: Number, default: 300 },
  
  hp: { type: Number, default: 100, min: 0, max: 100 },
  currentHp: { type: Number },
  maxHp: { type: Number },
  morale: { type: Number, default: 100, min: 0, max: 100 },
  
  // Confusion/Rout state
  confusionLevel: {
    type: String,
    enum: ['NONE', 'MINOR', 'MODERATE', 'SEVERE', 'ROUTED'],
    default: 'NONE'
  },
  
  fuel: { type: Number, default: 100 },
  maxFuel: { type: Number, default: 100 },
  ammo: { type: Number, default: 100 },
  maxAmmo: { type: Number, default: 100 },
  
  crewCount: { type: Number, default: 100 },
  maxCrew: { type: Number, default: 100 },
  currentCrewCount: { type: Number },
  crewQualityBonus: { type: Number, default: 0 },
  
  commanderId: { type: String },
  
  veterancy: { type: Number, default: 0, min: 0, max: 100 },
  
  destroyed: { type: Number, default: 0 },
  damaged: { type: Number, default: 0 }
}, { _id: false });

const FleetSchema = new Schema<IFleet>({
  fleetId: { type: String, required: true },
  sessionId: { type: String, required: true },
  
  commanderId: { type: String, required: true },
  admiralId: String,
  factionId: { type: String, required: true },
  
  name: { type: String, required: true },
  callsign: String,
  
  status: {
    type: String,
    enum: ['IDLE', 'MOVING', 'WARPING', 'COMBAT', 'REORG', 'DOCKED', 'RESUPPLY'],
    default: 'IDLE'
  },
  statusData: { type: Schema.Types.Mixed, default: {} },
  
  location: {
    type: {
      type: String,
      enum: ['SYSTEM', 'PLANET', 'WARP', 'DEEP_SPACE'],
      default: 'SYSTEM'
    },
    systemId: String,
    planetId: String,
    warpTravelId: String,
    coordinates: {
      x: Number,
      y: Number
    }
  },
  
  units: { type: [ShipUnitSchema], default: [] },
  maxUnits: { type: Number, default: 6 },
  
  totalShips: { type: Number, default: 0 },
  maxShips: { type: Number, default: 300 },
  
  warehouseId: String,
  
  formation: {
    type: String,
    enum: [
      'standard', 'offensive', 'defensive', 'wedge', 'encircle', 'guerrilla',
      'STANDARD', 'SPINDLE', 'LINE', 'CIRCULAR', 'ECHELON', 'WEDGE', 'ENCIRCLE', 'RETREAT'
    ],
    default: 'standard'
  },
  tactics: {
    engageDistance: {
      type: String,
      enum: ['close', 'medium', 'long'],
      default: 'medium'
    },
    retreatThreshold: { type: Number, default: 20, min: 0, max: 100 },
    priorityTargets: [String]
  },
  
  combatStats: {
    battlesWon: { type: Number, default: 0 },
    battlesLost: { type: Number, default: 0 },
    shipsDestroyed: { type: Number, default: 0 },
    shipsLost: { type: Number, default: 0 },
    damageDealt: { type: Number, default: 0 },
    damageTaken: { type: Number, default: 0 }
  },
  
  isLocked: { type: Boolean, default: false },
  lockedReason: String,
  lockedUntil: Date,
  
  // Crew management
  crewPool: { type: Number, default: 0 },
  
  // Training levels
  training: {
    gunnery: { type: Number, default: 50, min: 0, max: 100 },
    navigation: { type: Number, default: 50, min: 0, max: 100 },
    engineering: { type: Number, default: 50, min: 0, max: 100 },
    boarding: { type: Number, default: 50, min: 0, max: 100 }
  },
  
  // Cargo & Supplies
  cargo: {
    fuel: { type: Number, default: 0 },
    ammo: { type: Number, default: 0 },
    supplies: { type: Number, default: 0 },
    parts: { type: Number, default: 0 },
    credits: { type: Number, default: 0 },
    materials: { type: Number, default: 0 }
  },
  
  // Docking status
  dockedAt: { type: String },
  
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

// Indexes
FleetSchema.index({ fleetId: 1, sessionId: 1 }, { unique: true });
FleetSchema.index({ sessionId: 1, commanderId: 1 });
FleetSchema.index({ sessionId: 1, factionId: 1 });
FleetSchema.index({ sessionId: 1, status: 1 });
FleetSchema.index({ sessionId: 1, 'location.systemId': 1 });
FleetSchema.index({ sessionId: 1, 'location.planetId': 1 });

/**
 * Pre-save hook to calculate total ships
 */
FleetSchema.pre('save', function(next) {
  this.totalShips = this.units.reduce((sum, unit) => sum + unit.count, 0);
  next();
});

/**
 * Virtual for combat power estimation
 */
FleetSchema.virtual('combatPower').get(function() {
  // Simple combat power calculation
  const basepower: Record<ShipClass, number> = {
    flagship: 100,
    battleship: 80,
    carrier: 70,
    cruiser: 50,
    destroyer: 30,
    frigate: 20,
    corvette: 10,
    transport: 5,
    landing: 5,
    engineering: 5
  };
  
  return this.units.reduce((sum, unit) => {
    const base = basepower[unit.shipClass] || 10;
    const hpMod = unit.hp / 100;
    const moraleMod = 0.5 + (unit.morale / 200);
    const vetMod = 1 + (unit.veterancy / 100);
    return sum + (base * unit.count * hpMod * moraleMod * vetMod);
  }, 0);
});

/**
 * Check if fleet can add more ships
 */
FleetSchema.methods.canAddShips = function(count: number): boolean {
  return (this.totalShips + count) <= this.maxShips;
};

/**
 * Check if fleet can add more unit types
 */
FleetSchema.methods.canAddUnit = function(): boolean {
  return this.units.length < this.maxUnits;
};

/**
 * Get unit by ship class
 */
FleetSchema.methods.getUnit = function(shipClass: ShipClass): IShipUnit | undefined {
  return this.units.find((u: IShipUnit) => u.shipClass === shipClass);
};

/**
 * Calculate total fuel consumption per turn
 */
FleetSchema.methods.getFuelConsumption = function(): number {
  const consumption: Record<ShipClass, number> = {
    flagship: 10,
    battleship: 8,
    carrier: 7,
    cruiser: 5,
    destroyer: 3,
    frigate: 2,
    corvette: 1,
    transport: 4,
    landing: 3,
    engineering: 3
  };
  
  return this.units.reduce((sum: number, unit: IShipUnit) => {
    return sum + (consumption[unit.shipClass] || 1) * unit.count;
  }, 0);
};

/**
 * Calculate total ammo consumption per combat turn
 */
FleetSchema.methods.getAmmoConsumption = function(): number {
  const consumption: Record<ShipClass, number> = {
    flagship: 15,
    battleship: 12,
    carrier: 8,
    cruiser: 8,
    destroyer: 5,
    frigate: 3,
    corvette: 2,
    transport: 1,
    landing: 2,
    engineering: 1
  };
  
  return this.units.reduce((sum: number, unit: IShipUnit) => {
    return sum + (consumption[unit.shipClass] || 1) * unit.count;
  }, 0);
};

export const Fleet: Model<IFleet> = 
  mongoose.models.Fleet || mongoose.model<IFleet>('Fleet', FleetSchema);

/**
 * Ship specifications table (static data)
 */
export const SHIP_SPECS: Record<ShipClass, IShipSpec> = {
  flagship: {
    shipClass: 'flagship',
    name: 'Flagship',
    nameKo: '기함',
    maxHp: 5000,
    attack: 150,
    defense: 120,
    accuracy: 90,
    evasion: 20,
    fuelConsumption: 10,
    ammoConsumption: 15,
    cargoCapacity: 500,
    crewCapacity: 1000,
    speed: 3,
    warpCapable: true,
    buildCost: { credits: 50000, minerals: 20000, shipParts: 10000 },
    buildTurns: 20,
    abilities: ['command_boost', 'morale_aura', 'tactical_display']
  },
  battleship: {
    shipClass: 'battleship',
    name: 'Battleship',
    nameKo: '전함',
    maxHp: 3000,
    attack: 120,
    defense: 100,
    accuracy: 80,
    evasion: 15,
    fuelConsumption: 8,
    ammoConsumption: 12,
    cargoCapacity: 200,
    crewCapacity: 500,
    speed: 3,
    warpCapable: true,
    buildCost: { credits: 20000, minerals: 10000, shipParts: 5000 },
    buildTurns: 10,
    abilities: ['heavy_bombardment', 'shield_overcharge']
  },
  carrier: {
    shipClass: 'carrier',
    name: 'Carrier',
    nameKo: '항공모함',
    maxHp: 2500,
    attack: 60,
    defense: 80,
    accuracy: 70,
    evasion: 10,
    fuelConsumption: 7,
    ammoConsumption: 8,
    cargoCapacity: 400,
    crewCapacity: 800,
    speed: 3,
    warpCapable: true,
    buildCost: { credits: 25000, minerals: 12000, shipParts: 8000 },
    buildTurns: 12,
    abilities: ['launch_fighters', 'fighter_screen']
  },
  cruiser: {
    shipClass: 'cruiser',
    name: 'Cruiser',
    nameKo: '순양함',
    maxHp: 1500,
    attack: 80,
    defense: 70,
    accuracy: 85,
    evasion: 25,
    fuelConsumption: 5,
    ammoConsumption: 8,
    cargoCapacity: 100,
    crewCapacity: 300,
    speed: 4,
    warpCapable: true,
    buildCost: { credits: 10000, minerals: 5000, shipParts: 2500 },
    buildTurns: 6,
    abilities: ['rapid_fire', 'evasive_maneuvers']
  },
  destroyer: {
    shipClass: 'destroyer',
    name: 'Destroyer',
    nameKo: '구축함',
    maxHp: 800,
    attack: 60,
    defense: 40,
    accuracy: 90,
    evasion: 40,
    fuelConsumption: 3,
    ammoConsumption: 5,
    cargoCapacity: 50,
    crewCapacity: 150,
    speed: 6,
    warpCapable: true,
    buildCost: { credits: 5000, minerals: 2500, shipParts: 1000 },
    buildTurns: 4,
    abilities: ['torpedo_salvo', 'intercept']
  },
  frigate: {
    shipClass: 'frigate',
    name: 'Frigate',
    nameKo: '프리깃',
    maxHp: 500,
    attack: 40,
    defense: 30,
    accuracy: 85,
    evasion: 35,
    fuelConsumption: 2,
    ammoConsumption: 3,
    cargoCapacity: 30,
    crewCapacity: 80,
    speed: 5,
    warpCapable: true,
    buildCost: { credits: 3000, minerals: 1500, shipParts: 500 },
    buildTurns: 3,
    abilities: ['escort', 'scout']
  },
  corvette: {
    shipClass: 'corvette',
    name: 'Corvette',
    nameKo: '초계함',
    maxHp: 300,
    attack: 25,
    defense: 20,
    accuracy: 80,
    evasion: 50,
    fuelConsumption: 1,
    ammoConsumption: 2,
    cargoCapacity: 20,
    crewCapacity: 40,
    speed: 7,
    warpCapable: true,
    buildCost: { credits: 1500, minerals: 750, shipParts: 250 },
    buildTurns: 2,
    abilities: ['patrol', 'rapid_response']
  },
  transport: {
    shipClass: 'transport',
    name: 'Transport',
    nameKo: '수송함',
    maxHp: 1000,
    attack: 10,
    defense: 50,
    accuracy: 50,
    evasion: 10,
    fuelConsumption: 4,
    ammoConsumption: 1,
    cargoCapacity: 1000,
    crewCapacity: 200,
    speed: 3,
    warpCapable: true,
    buildCost: { credits: 4000, minerals: 2000, shipParts: 1000 },
    buildTurns: 4,
    abilities: ['cargo_hold', 'troop_transport']
  },
  engineering: {
    shipClass: 'engineering',
    name: 'Engineering Ship',
    nameKo: '공병함',
    maxHp: 600,
    attack: 5,
    defense: 40,
    accuracy: 60,
    evasion: 15,
    fuelConsumption: 3,
    ammoConsumption: 1,
    cargoCapacity: 300,
    crewCapacity: 150,
    speed: 3,
    warpCapable: true,
    buildCost: { credits: 3500, minerals: 2500, shipParts: 1500 },
    buildTurns: 4,
    abilities: ['field_repair', 'salvage', 'construction']
  },
  landing: {
    shipClass: 'landing',
    name: 'Landing Craft',
    nameKo: '상륙정',
    maxHp: 800,
    attack: 15,
    defense: 45,
    accuracy: 50,
    evasion: 12,
    fuelConsumption: 3,
    ammoConsumption: 2,
    cargoCapacity: 500,
    crewCapacity: 300,
    speed: 4,
    warpCapable: true,
    buildCost: { credits: 3000, minerals: 1500, shipParts: 800 },
    buildTurns: 3,
    abilities: ['troop_landing', 'beach_assault']
  }
};

