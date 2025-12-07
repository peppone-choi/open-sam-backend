import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * IntelReport stores intelligence gathered by spies.
 * 
 * Design:
 * - Different intel levels reveal different amounts of information
 * - Reports expire over time (stale intel)
 * - Linked to the spy that gathered it
 */
export interface IGin7IntelReport extends Document {
  reportId: string;
  sessionId: string;
  
  // Source
  spyId?: string;           // Spy who gathered this intel (optional for other sources)
  sourceType: 'spy' | 'scout' | 'diplomat' | 'defector' | 'captured';
  
  // Owner who can view this report
  ownerId: string;
  ownerFactionId?: string;
  
  // Target
  targetType: 'planet' | 'fleet' | 'character' | 'faction';
  targetId: string;
  targetName?: string;
  
  // Intel Quality
  intelLevel: number;       // 0~3
  // Lv0: Unknown/Unconfirmed
  // Lv1: Existence confirmed, basic info
  // Lv2: Rough estimates (troop counts, resource ranges)
  // Lv3: Detailed information (exact numbers, plans)
  
  // Report Data (varies by level)
  data: {
    // Level 1+
    exists?: boolean;
    type?: string;
    name?: string;
    factionId?: string;
    
    // Level 2+
    populationRange?: [number, number];
    defenseRange?: [number, number];
    fleetSizeRange?: [number, number];
    resourcesEstimate?: Record<string, [number, number]>;
    
    // Level 3
    exactPopulation?: number;
    exactDefense?: number;
    exactFleetSize?: number;
    exactResources?: Record<string, number>;
    garrisonDetails?: Array<{
      unitType: string;
      count: number;
    }>;
    buildingDetails?: Array<{
      buildingId: string;
      level: number;
    }>;
    upcomingPlans?: string[];
    
    // Raw data
    raw?: Record<string, any>;
  };
  
  // Validity
  gatheredAt: Date;
  expiresAt: Date;
  isExpired: boolean;
  
  // Accuracy (can be affected by counter-intelligence)
  accuracy: number;         // 0~100 (how accurate is this intel)
  
  // FOW (Fog of War) reveal
  revealsFOW: boolean;
  fowRegion?: {
    centerX: number;
    centerY: number;
    radius: number;
  };
}

const Gin7IntelReportSchema = new Schema<IGin7IntelReport>({
  reportId: { type: String, required: true },
  sessionId: { type: String, required: true },
  
  spyId: { type: String },
  sourceType: { 
    type: String, 
    enum: ['spy', 'scout', 'diplomat', 'defector', 'captured'],
    default: 'spy'
  },
  
  ownerId: { type: String, required: true },
  ownerFactionId: { type: String },
  
  targetType: { 
    type: String, 
    enum: ['planet', 'fleet', 'character', 'faction'],
    required: true 
  },
  targetId: { type: String, required: true },
  targetName: { type: String },
  
  intelLevel: { type: Number, default: 0, min: 0, max: 3 },
  
  data: { type: Schema.Types.Mixed, default: {} },
  
  gatheredAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  isExpired: { type: Boolean, default: false },
  
  accuracy: { type: Number, default: 100, min: 0, max: 100 },
  
  revealsFOW: { type: Boolean, default: false },
  fowRegion: {
    centerX: Number,
    centerY: Number,
    radius: Number
  }
}, {
  timestamps: true
});

// Indexes
Gin7IntelReportSchema.index({ reportId: 1, sessionId: 1 }, { unique: true });
Gin7IntelReportSchema.index({ sessionId: 1, ownerId: 1, targetType: 1, isExpired: 1 });
Gin7IntelReportSchema.index({ sessionId: 1, targetId: 1, gatheredAt: -1 });
Gin7IntelReportSchema.index({ sessionId: 1, expiresAt: 1, isExpired: 1 }); // For cleanup

export const Gin7IntelReport: Model<IGin7IntelReport> = 
  mongoose.models.Gin7IntelReport || mongoose.model<IGin7IntelReport>('Gin7IntelReport', Gin7IntelReportSchema);

