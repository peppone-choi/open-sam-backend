import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Star types
 */
export type StarType = 'yellow_dwarf' | 'red_giant' | 'blue_giant' | 'white_dwarf' | 'binary' | 'neutron';

/**
 * StarSystem Schema
 * Represents a star system containing planets
 */
export interface IStarSystem extends Document {
  systemId: string;
  sessionId: string;
  name: string;
  
  // Grid reference
  gridRef: {
    x: number;
    y: number;
  };
  
  // Local coordinates within grid (for precise positioning)
  localPosition: {
    x: number;  // 0-1000 within grid
    y: number;  // 0-1000 within grid
  };
  
  // Star properties
  starType: StarType;
  luminosity: number;       // Affects planet habitability
  
  // Strategic importance
  strategicValue: number;   // 0-100
  isCapital: boolean;
  isFortress: boolean;
  
  // Ownership
  controllingFactionId?: string;
  
  // Planets in this system
  planetIds: string[];
  
  // Facilities/Stations
  stations: Array<{
    stationId: string;
    type: 'military_base' | 'trading_post' | 'shipyard' | 'research_station' | 'fortress';
    ownerId?: string;
    hp: number;
    maxHp: number;
  }>;
  
  // Navigation
  warpGateLevel: number;    // 0 = no gate, 1-5 = gate level (affects warp time)
  
  // Metadata
  description?: string;
  originalName?: string;    // For LoGH reference (e.g., "Iserlohn" in German)
  data: Record<string, any>;
}

const StarSystemSchema = new Schema<IStarSystem>({
  systemId: { type: String, required: true },
  sessionId: { type: String, required: true },
  name: { type: String, required: true },
  
  gridRef: {
    x: { type: Number, required: true, min: 0, max: 99 },
    y: { type: Number, required: true, min: 0, max: 99 }
  },
  
  localPosition: {
    x: { type: Number, default: 500, min: 0, max: 1000 },
    y: { type: Number, default: 500, min: 0, max: 1000 }
  },
  
  starType: {
    type: String,
    enum: ['yellow_dwarf', 'red_giant', 'blue_giant', 'white_dwarf', 'binary', 'neutron'],
    default: 'yellow_dwarf'
  },
  luminosity: { type: Number, default: 1.0 },
  
  strategicValue: { type: Number, default: 10, min: 0, max: 100 },
  isCapital: { type: Boolean, default: false },
  isFortress: { type: Boolean, default: false },
  
  controllingFactionId: String,
  
  planetIds: { type: [String], default: [] },
  
  stations: [{
    stationId: { type: String, required: true },
    type: { 
      type: String, 
      enum: ['military_base', 'trading_post', 'shipyard', 'research_station', 'fortress'],
      required: true 
    },
    ownerId: String,
    hp: { type: Number, default: 1000 },
    maxHp: { type: Number, default: 1000 }
  }],
  
  warpGateLevel: { type: Number, default: 0, min: 0, max: 5 },
  
  description: String,
  originalName: String,
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

// Indexes
StarSystemSchema.index({ systemId: 1, sessionId: 1 }, { unique: true });
StarSystemSchema.index({ sessionId: 1, 'gridRef.x': 1, 'gridRef.y': 1 });
StarSystemSchema.index({ sessionId: 1, controllingFactionId: 1 });
StarSystemSchema.index({ sessionId: 1, isCapital: 1 });
StarSystemSchema.index({ sessionId: 1, isFortress: 1 });
StarSystemSchema.index({ sessionId: 1, name: 'text' });

export const StarSystem: Model<IStarSystem> = 
  mongoose.models.StarSystem || mongoose.model<IStarSystem>('StarSystem', StarSystemSchema);

