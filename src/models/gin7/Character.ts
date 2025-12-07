import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IGin7Character extends Document {
  characterId: string;    // Unique Character ID within the session or globally
  sessionId: string;      // Link to GameSession
  ownerId: string;        // Link to User (Account)
  
  name: string;
  
  // Core Stats (Fixed structure for optimization)
  stats: {
    command: number;    // 통솔
    might: number;      // 무력
    intellect: number;  // 지력
    politics: number;   // 정치
    charm: number;      // 매력
  };

  // Extended Stats (Flexible)
  extendedStats: Map<string, number>;

  // Location & State
  location: {
    regionId?: number;
    cityId?: number;
    x?: number;
    y?: number;
    zoneId?: string;    // For detailed maps
  };
  
  state: 'idle' | 'working' | 'marching' | 'battle' | 'injured' | 'dead';
  stateData: Record<string, any>; // Context for current state (e.g., destination when marching)

  // Inventory & Resources
  resources: {
    gold: number;
    rice: number;
    [key: string]: number;
  };
  
  inventory: Array<{
    itemId: string;
    slotId: string; // 'weapon', 'mount', 'accessory', etc.
    durability?: number;
    meta?: any;
  }>;

  // Traits & Skills
  traits: string[];
  skills: string[];

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
  
  name: { type: String, required: true },
  
  stats: {
    command: { type: Number, default: 50 },
    might: { type: Number, default: 50 },
    intellect: { type: Number, default: 50 },
    politics: { type: Number, default: 50 },
    charm: { type: Number, default: 50 }
  },

  extendedStats: { type: Map, of: Number, default: {} },

  location: {
    regionId: Number,
    cityId: Number,
    x: Number,
    y: Number,
    zoneId: String
  },

  state: { 
    type: String, 
    enum: ['idle', 'working', 'marching', 'battle', 'injured', 'dead'], 
    default: 'idle' 
  },
  stateData: { type: Schema.Types.Mixed, default: {} },

  resources: { type: Schema.Types.Mixed, default: { gold: 0, rice: 0 } },
  
  inventory: [{
    itemId: String,
    slotId: String,
    durability: Number,
    meta: Schema.Types.Mixed
  }],

  traits: [String],
  skills: [String],

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
Gin7CharacterSchema.index({ sessionId: 1, 'location.x': 1, 'location.y': 1 }); // Spatial query support
Gin7CharacterSchema.index({ sessionId: 1, state: 1 });

export const Gin7Character: Model<IGin7Character> = 
  mongoose.models.Gin7Character || mongoose.model<IGin7Character>('Gin7Character', Gin7CharacterSchema);

