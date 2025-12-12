import mongoose, { Schema, Document, Model } from 'mongoose';
import { IVector3 } from './Fleet';

/**
 * Realtime battle status
 */
export type RealtimeBattleStatus = 'PREPARING' | 'ACTIVE' | 'PAUSED' | 'ENDED';

/**
 * Battle participant information
 */
export interface IBattleParticipant {
  fleetId: string;
  faction: string;
  factionId?: string;
  commanderId?: string;
  isNPC?: boolean;
  isPlayerControlled?: boolean;
  joinedAt: Date;
  isReady?: boolean;
  isDefeated: boolean;
  // Initial position when joining battle
  initialPosition: IVector3;
  // Ship count
  shipCount?: number;
  // Current combat stats during battle
  shipsLost: number;
  damageDealt: number;
  damageTaken: number;
}

/**
 * Grid location for MMO integration
 */
export interface IGridLocation {
  x: number;
  y: number;
  gridId: string;
}

/**
 * Battle area bounding box
 */
export interface IBattleArea {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  // Center of the battle area
  center: IVector3;
}

/**
 * Battle result summary
 */
export interface IBattleResult {
  winner?: string;  // faction ID
  winnerFaction?: string;  // faction name
  endReason: 'VICTORY' | 'RETREAT' | 'TIMEOUT' | 'DRAW' | 'CANCELLED' | 'STALEMATE' | 'SUPPLY_DEPLETION';
  duration: number;  // in ticks
  totalShipsDestroyed: number;
  participantResults: Array<{
    fleetId: string;
    faction: string;
    shipsLost: number;
    damageDealt: number;
    damageTaken: number;
    survived: boolean;
  }>;
}

/**
 * RealtimeBattle Schema
 * Represents a single realtime battle instance
 */
export interface IRealtimeBattle extends Document {
  battleId: string;
  sessionId: string;
  
  // Battle info
  name?: string;
  description?: string;
  
  // Status
  status: RealtimeBattleStatus;
  
  // Timing
  startedAt?: Date;
  endedAt?: Date;
  pausedAt?: Date;
  
  // Tick management
  tickCount: number;       // Current tick number
  tickRate: number;        // Ticks per second (default: 10)
  maxTicks?: number;       // Optional max duration in ticks
  
  // Participants
  participants: IBattleParticipant[];
  maxParticipants: number;
  
  // Battle area
  battleArea: IBattleArea;
  
  // Battle rules
  rules: {
    allowRetreat: boolean;
    retreatDelay: number;      // Ticks before retreat completes
    respawnEnabled: boolean;
    friendlyFire: boolean;
    minParticipants: number;
  };
  
  // Result (set when battle ends)
  result?: IBattleResult;
  
  // Location context
  systemId?: string;
  planetId?: string;
  
  // Grid location (MMO integration)
  gridLocation?: IGridLocation;
  
  // Factions in battle
  factions?: string[];
  
  // Initiation info
  initiatedBy?: string;
  initiationReason?: string;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  data: Record<string, unknown>;
}

// Battle participant schema
const BattleParticipantSchema = new Schema<IBattleParticipant>({
  fleetId: { type: String, required: true },
  faction: { type: String, required: true },
  factionId: { type: String },
  commanderId: { type: String },
  isNPC: { type: Boolean, default: false },
  isPlayerControlled: { type: Boolean, default: true },
  joinedAt: { type: Date, default: Date.now },
  isReady: { type: Boolean, default: false },
  isDefeated: { type: Boolean, default: false },
  initialPosition: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    z: { type: Number, default: 0 }
  },
  shipCount: { type: Number, default: 0 },
  shipsLost: { type: Number, default: 0 },
  damageDealt: { type: Number, default: 0 },
  damageTaken: { type: Number, default: 0 }
}, { _id: false });

// Battle area schema
const BattleAreaSchema = new Schema<IBattleArea>({
  minX: { type: Number, default: -1000 },
  maxX: { type: Number, default: 1000 },
  minY: { type: Number, default: -1000 },
  maxY: { type: Number, default: 1000 },
  minZ: { type: Number, default: -500 },
  maxZ: { type: Number, default: 500 },
  center: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    z: { type: Number, default: 0 }
  }
}, { _id: false });

// Battle result schema
const BattleResultSchema = new Schema<IBattleResult>({
  winner: { type: String },
  winnerFaction: { type: String },
  endReason: {
    type: String,
    enum: ['VICTORY', 'RETREAT', 'TIMEOUT', 'DRAW', 'CANCELLED', 'STALEMATE', 'SUPPLY_DEPLETION'],
    required: true
  },
  duration: { type: Number, required: true },
  totalShipsDestroyed: { type: Number, default: 0 },
  participantResults: [{
    fleetId: { type: String, required: true },
    faction: { type: String, required: true },
    shipsLost: { type: Number, default: 0 },
    damageDealt: { type: Number, default: 0 },
    damageTaken: { type: Number, default: 0 },
    survived: { type: Boolean, default: true }
  }]
}, { _id: false });

// Main schema
const RealtimeBattleSchema = new Schema<IRealtimeBattle>({
  battleId: { type: String, required: true, unique: true },
  sessionId: { type: String, required: true },
  
  name: { type: String },
  description: { type: String },
  
  status: {
    type: String,
    enum: ['PREPARING', 'ACTIVE', 'PAUSED', 'ENDED'],
    default: 'PREPARING'
  },
  
  startedAt: { type: Date },
  endedAt: { type: Date },
  pausedAt: { type: Date },
  
  tickCount: { type: Number, default: 0 },
  tickRate: { type: Number, default: 10 },
  maxTicks: { type: Number },
  
  participants: { type: [BattleParticipantSchema], default: [] },
  maxParticipants: { type: Number, default: 10 },
  
  battleArea: { type: BattleAreaSchema, default: () => ({
    minX: -1000,
    maxX: 1000,
    minY: -1000,
    maxY: 1000,
    minZ: -500,
    maxZ: 500,
    center: { x: 0, y: 0, z: 0 }
  }) },
  
  rules: {
    allowRetreat: { type: Boolean, default: true },
    retreatDelay: { type: Number, default: 50 },  // 5 seconds at 10 ticks/sec
    respawnEnabled: { type: Boolean, default: false },
    friendlyFire: { type: Boolean, default: false },
    minParticipants: { type: Number, default: 2 }
  },
  
  result: { type: BattleResultSchema },
  
  systemId: { type: String },
  planetId: { type: String },
  
  // Grid location (MMO integration)
  gridLocation: {
    x: { type: Number },
    y: { type: Number },
    gridId: { type: String }
  },
  
  // Factions in battle
  factions: { type: [String], default: [] },
  
  // Initiation info
  initiatedBy: { type: String },
  initiationReason: { type: String },
  
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

// Indexes
RealtimeBattleSchema.index({ battleId: 1 }, { unique: true });
RealtimeBattleSchema.index({ sessionId: 1 });
RealtimeBattleSchema.index({ sessionId: 1, status: 1 });
RealtimeBattleSchema.index({ 'participants.fleetId': 1 });
RealtimeBattleSchema.index({ systemId: 1 });
RealtimeBattleSchema.index({ status: 1, createdAt: -1 });
// MMO-Battle integration indexes
RealtimeBattleSchema.index({ sessionId: 1, 'gridLocation.gridId': 1 });
RealtimeBattleSchema.index({ sessionId: 1, 'gridLocation.x': 1, 'gridLocation.y': 1 });
RealtimeBattleSchema.index({ 'factions': 1 });

// Virtual for active participant count
RealtimeBattleSchema.virtual('activeParticipantCount').get(function() {
  return this.participants.filter(p => !p.isDefeated).length;
});

// Virtual for battle duration in seconds
RealtimeBattleSchema.virtual('durationSeconds').get(function() {
  return this.tickCount / this.tickRate;
});

// Methods

/**
 * Add a participant to the battle
 */
RealtimeBattleSchema.methods.addParticipant = function(
  fleetId: string,
  faction: string,
  factionId: string,
  isNPC: boolean = false,
  initialPosition?: IVector3
): boolean {
  if (this.status !== 'PREPARING') return false;
  if (this.participants.length >= this.maxParticipants) return false;
  if (this.participants.some((p: IBattleParticipant) => p.fleetId === fleetId)) return false;
  
  this.participants.push({
    fleetId,
    faction,
    factionId,
    isNPC,
    joinedAt: new Date(),
    isReady: false,
    isDefeated: false,
    initialPosition: initialPosition || { x: 0, y: 0, z: 0 },
    shipsLost: 0,
    damageDealt: 0,
    damageTaken: 0
  });
  
  return true;
};

/**
 * Remove a participant from the battle
 */
RealtimeBattleSchema.methods.removeParticipant = function(fleetId: string): boolean {
  if (this.status === 'ACTIVE') return false;
  
  const index = this.participants.findIndex((p: IBattleParticipant) => p.fleetId === fleetId);
  if (index === -1) return false;
  
  this.participants.splice(index, 1);
  return true;
};

/**
 * Set participant ready status
 */
RealtimeBattleSchema.methods.setParticipantReady = function(fleetId: string, ready: boolean): boolean {
  const participant = this.participants.find((p: IBattleParticipant) => p.fleetId === fleetId);
  if (!participant) return false;
  
  participant.isReady = ready;
  return true;
};

/**
 * Check if battle can start
 */
RealtimeBattleSchema.methods.canStart = function(): boolean {
  if (this.status !== 'PREPARING') return false;
  if (this.participants.length < this.rules.minParticipants) return false;
  
  // Check if all participants are ready
  return this.participants.every((p: IBattleParticipant) => p.isReady || p.isNPC);
};

/**
 * Get participant by fleet ID
 */
RealtimeBattleSchema.methods.getParticipant = function(fleetId: string): IBattleParticipant | undefined {
  return this.participants.find((p: IBattleParticipant) => p.fleetId === fleetId);
};

/**
 * Get all fleets for a faction
 */
RealtimeBattleSchema.methods.getFactionFleets = function(factionId: string): IBattleParticipant[] {
  return this.participants.filter((p: IBattleParticipant) => p.factionId === factionId);
};

/**
 * Mark a participant as defeated
 */
RealtimeBattleSchema.methods.defeatParticipant = function(fleetId: string): void {
  const participant = this.participants.find((p: IBattleParticipant) => p.fleetId === fleetId);
  if (participant) {
    participant.isDefeated = true;
  }
};

export const RealtimeBattle: Model<IRealtimeBattle> = 
  mongoose.models.RealtimeBattle || mongoose.model<IRealtimeBattle>('RealtimeBattle', RealtimeBattleSchema);

/**
 * Default battle area sizes
 */
export const BATTLE_AREA_SIZES = {
  SMALL: {
    minX: -500, maxX: 500,
    minY: -500, maxY: 500,
    minZ: -250, maxZ: 250,
    center: { x: 0, y: 0, z: 0 }
  },
  MEDIUM: {
    minX: -1000, maxX: 1000,
    minY: -1000, maxY: 1000,
    minZ: -500, maxZ: 500,
    center: { x: 0, y: 0, z: 0 }
  },
  LARGE: {
    minX: -2000, maxX: 2000,
    minY: -2000, maxY: 2000,
    minZ: -1000, maxZ: 1000,
    center: { x: 0, y: 0, z: 0 }
  },
  EPIC: {
    minX: -5000, maxX: 5000,
    minY: -5000, maxY: 5000,
    minZ: -2500, maxZ: 2500,
    center: { x: 0, y: 0, z: 0 }
  }
} as const;

/**
 * Default tick rates
 */
export const TICK_RATES = {
  SLOW: 5,      // 5 ticks/sec - for slower, more strategic battles
  NORMAL: 10,   // 10 ticks/sec - standard
  FAST: 20,     // 20 ticks/sec - for quick skirmishes
  REALTIME: 30  // 30 ticks/sec - near real-time
} as const;
