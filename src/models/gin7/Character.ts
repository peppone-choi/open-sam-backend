import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Battle statistics for character
 */
export interface ICharacterBattleStats {
  battlesWon: number;
  battlesLost: number;
  battlesDrawn: number;
  shipsDestroyed: number;
  shipsLost: number;
  damageDealt: number;
  damageTaken: number;
  killCount: number;         // Enemy admirals killed
  captureCount: number;      // Enemy admirals captured
}

export interface IGin7Character extends Document {
  characterId: string;    // Unique Character ID within the session or globally
  sessionId: string;      // Link to GameSession
  ownerId: string;        // Link to User (Account)
  playerId?: string;      // Link to Player (if controlled)
  
  name: string;
  
  // Online presence (MMO-Battle integration)
  isOnline?: boolean;
  lastActiveAt?: Date;
  socketId?: string;         // Current WebSocket connection ID
  
  // Battle statistics
  battleStats?: ICharacterBattleStats;
  
  // Faction & Origin
  faction?: string;       // Faction ID (e.g., 'EMPIRE', 'ALLIANCE')
  factionId?: string;     // Alternative faction reference
  isOriginal?: boolean;   // Is this an original character or generated?
  
  // Class & Rank (군인/관료 계급)
  characterClass?: 'military' | 'civil' | 'noble' | 'merchant' | 'pirate';
  rank?: string;          // Current military/civil rank
  currentPosition?: string; // Current office/position held
  
  // Core Stats (Fixed structure for optimization)
  stats: {
    command: number;    // 통솔
    might: number;      // 무력
    intellect: number;  // 지력
    politics: number;   // 정치
    charm: number;      // 매력
    agility?: number;   // 민첩 (optional for some services)
    willpower?: number; // 의지력 (optional)
  };
  
  // Merit & Influence (공적/영향력)
  merit?: number;         // Accumulated merit points
  influence?: number;     // Political influence (0-100)
  loyalty?: number;       // Loyalty to faction (0-100)

  // Extended Stats (Flexible)
  extendedStats: Map<string, number>;

  // Location & State
  location: {
    regionId?: number;
    cityId?: number;
    x?: number;
    y?: number;
    zoneId?: string;    // For detailed maps
    facilityId?: string; // Current facility
    roomId?: string;     // Current room within facility
  };
  locationPlanetId?: string;  // Current planet location
  locationSpotId?: string;    // Current spot within location
  homePlanetId?: string;      // Home planet
  
  state: 'idle' | 'working' | 'marching' | 'battle' | 'injured' | 'dead';
  status?: 'ACTIVE' | 'DETAINED' | 'INJURED' | 'DEAD' | 'MISSING' | 'CAPTURED' | 'ON_TRIAL' | 'IMPRISONED' | 'EXILED';  // Extended status
  stateData: Record<string, any>; // Context for current state (e.g., destination when marching)
  
  // Life status
  isAlive?: boolean;
  deathDate?: Date;
  deathReason?: string;
  
  // Detention details (when status is DETAINED)
  detentionDetails?: {
    detainedBy: string;
    reason: string;
    detainedAt: Date;
  };
  
  // Capture details (when status is CAPTURED)
  capturedBy?: string;
  
  // Injury details (when status is INJURED)
  injuryDetails?: {
    injuredBy: string;
    severity: string;
    injuredAt: Date;
    recoveryDate?: Date;
  };

  // Inventory & Resources
  resources: {
    gold: number;
    rice: number;
    [key: string]: number;
  };
  personalFunds?: number;  // Personal wealth
  
  inventory: Array<{
    itemId: string;
    slotId: string; // 'weapon', 'mount', 'accessory', etc.
    durability?: number;
    meta?: any;
  }>;

  // Traits & Skills
  traits: string[];
  skills: string[];
  
  // Nobility
  nobilityTitle?: string;  // Noble title if any
  nobility?: any;          // Full nobility object
  
  // Merit System
  meritPoints?: number;    // Merit points for promotions
  currentRank?: string;    // Current rank string
  
  // Position
  position?: string;       // Current position/title
  
  // Medals
  medals?: Array<{
    medalId: string;
    name: string;
    awardedAt: Date;
    ladderBonus?: number;
  }>;
  
  // Death Details
  deathDetails?: {
    killedBy?: string;
    cause?: string;
    deathAt?: Date;
  };

  // Command Points (CP) System
  commandPoints: {
    pcp: number;    // Political Command Points (정략 CP)
    mcp: number;    // Military Command Points (군사 CP)
    maxPcp: number;
    maxMcp: number;
    lastRecoveredAt: Date;
  };

  // Authority Cards (직무 권한 카드)
  commandCards: Array<{
    cardId: string;
    name: string;
    category: string;
    commands: string[];
  }>;

  // Extensibility
  data: Record<string, any>;
}

const Gin7CharacterSchema = new Schema<IGin7Character>({
  characterId: { type: String, required: true },
  sessionId: { type: String, required: true },
  ownerId: { type: String, required: true },
  playerId: { type: String },
  
  name: { type: String, required: true },
  
  // Online presence (MMO-Battle integration)
  isOnline: { type: Boolean, default: false },
  lastActiveAt: { type: Date },
  socketId: { type: String },
  
  // Battle statistics
  battleStats: {
    battlesWon: { type: Number, default: 0 },
    battlesLost: { type: Number, default: 0 },
    battlesDrawn: { type: Number, default: 0 },
    shipsDestroyed: { type: Number, default: 0 },
    shipsLost: { type: Number, default: 0 },
    damageDealt: { type: Number, default: 0 },
    damageTaken: { type: Number, default: 0 },
    killCount: { type: Number, default: 0 },
    captureCount: { type: Number, default: 0 }
  },
  
  // Faction & Origin
  faction: { type: String },
  factionId: { type: String },
  isOriginal: { type: Boolean, default: false },
  
  // Class & Rank
  characterClass: { 
    type: String, 
    enum: ['military', 'civil', 'noble', 'merchant', 'pirate'],
    default: 'military'
  },
  rank: { type: String },
  currentPosition: { type: String },
  
  stats: {
    command: { type: Number, default: 50 },
    might: { type: Number, default: 50 },
    intellect: { type: Number, default: 50 },
    politics: { type: Number, default: 50 },
    charm: { type: Number, default: 50 }
  },
  
  // Merit & Influence
  merit: { type: Number, default: 0 },
  influence: { type: Number, default: 0, min: 0, max: 100 },
  loyalty: { type: Number, default: 50, min: 0, max: 100 },

  extendedStats: { type: Map, of: Number, default: {} },

  location: {
    regionId: Number,
    cityId: Number,
    x: Number,
    y: Number,
    zoneId: String,
    facilityId: String,
    roomId: String
  },
  locationPlanetId: { type: String },
  locationSpotId: { type: String },
  homePlanetId: { type: String },

  state: { 
    type: String, 
    enum: ['idle', 'working', 'marching', 'battle', 'injured', 'dead'], 
    default: 'idle' 
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'DETAINED', 'INJURED', 'DEAD', 'MISSING', 'CAPTURED'],
    default: 'ACTIVE'
  },
  stateData: { type: Schema.Types.Mixed, default: {} },
  
  // Life status
  isAlive: { type: Boolean, default: true },
  deathDate: { type: Date },
  deathReason: { type: String },
  
  // Detention details
  detentionDetails: {
    detainedBy: { type: String },
    reason: { type: String },
    detainedAt: { type: Date }
  },
  
  // Capture details
  capturedBy: { type: String },
  
  // Injury details
  injuryDetails: {
    injuredBy: { type: String },
    severity: { type: String },
    injuredAt: { type: Date },
    recoveryDate: { type: Date }
  },

  resources: { type: Schema.Types.Mixed, default: { gold: 0, rice: 0 } },
  personalFunds: { type: Number, default: 0 },
  
  inventory: [{
    itemId: String,
    slotId: String,
    durability: Number,
    meta: Schema.Types.Mixed
  }],

  traits: [String],
  skills: [String],
  
  // Nobility
  nobilityTitle: { type: String },

  // Command Points (CP) System - gin7 auth-card
  commandPoints: {
    pcp: { type: Number, default: 12, min: 0 },
    mcp: { type: Number, default: 12, min: 0 },
    maxPcp: { type: Number, default: 24 },
    maxMcp: { type: Number, default: 24 },
    lastRecoveredAt: { type: Date, default: Date.now }
  },

  // Authority Cards (직무 권한 카드)
  commandCards: [{
    cardId: { type: String, required: true },
    name: { type: String, required: true },
    category: { type: String },
    commands: [String]
  }],

  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

// Indexes for quick lookup
Gin7CharacterSchema.index({ characterId: 1, sessionId: 1 }, { unique: true });
Gin7CharacterSchema.index({ sessionId: 1, ownerId: 1 });
Gin7CharacterSchema.index({ sessionId: 1, playerId: 1 });
Gin7CharacterSchema.index({ sessionId: 1, faction: 1 });
Gin7CharacterSchema.index({ sessionId: 1, factionId: 1 });
Gin7CharacterSchema.index({ sessionId: 1, locationPlanetId: 1 });
Gin7CharacterSchema.index({ sessionId: 1, 'location.x': 1, 'location.y': 1 }); // Spatial query support
Gin7CharacterSchema.index({ sessionId: 1, state: 1 });
Gin7CharacterSchema.index({ sessionId: 1, status: 1 });
// Online presence indexes (MMO-Battle integration)
Gin7CharacterSchema.index({ sessionId: 1, isOnline: 1 });
Gin7CharacterSchema.index({ sessionId: 1, socketId: 1 });
Gin7CharacterSchema.index({ sessionId: 1, factionId: 1, isOnline: 1 });

export const Gin7Character: Model<IGin7Character> = 
  mongoose.models.Gin7Character || mongoose.model<IGin7Character>('Gin7Character', Gin7CharacterSchema);

// Alias for backward compatibility
export const Character = Gin7Character;

