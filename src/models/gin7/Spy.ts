import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Spy represents an espionage agent deployed to gather intelligence.
 * 
 * Design:
 * - Deployed to a target location (planet, fleet, etc.)
 * - Has infiltration level determining intel quality
 * - Can be discovered and captured
 */
export interface IGin7Spy extends Document {
  spyId: string;
  sessionId: string;
  
  // Owner
  ownerId: string;          // Character who deployed this spy
  ownerFactionId?: string;  // Faction affiliation
  
  // Target
  targetType: 'planet' | 'fleet' | 'character' | 'faction';
  targetId: string;
  
  // Status
  status: 'deploying' | 'active' | 'discovered' | 'captured' | 'extracted' | 'dead';
  
  // Skills & Progress
  intelLevel: number;       // 0~3 (higher = more detailed intel)
  infiltration: number;     // 0~100 (how deep the spy has penetrated)
  cover: number;            // 0~100 (how safe from detection)
  
  // Discovery risk
  suspicion: number;        // 0~100 (accumulated suspicion)
  lastCheckAt: Date;
  
  // Timing
  deployedAt: Date;
  nextReportAt?: Date;
  
  // Capabilities
  skills: string[];         // Special spy skills
  
  data: Record<string, any>;
}

const Gin7SpySchema = new Schema<IGin7Spy>({
  spyId: { type: String, required: true },
  sessionId: { type: String, required: true },
  
  ownerId: { type: String, required: true },
  ownerFactionId: { type: String },
  
  targetType: { 
    type: String, 
    enum: ['planet', 'fleet', 'character', 'faction'],
    required: true 
  },
  targetId: { type: String, required: true },
  
  status: { 
    type: String, 
    enum: ['deploying', 'active', 'discovered', 'captured', 'extracted', 'dead'],
    default: 'deploying'
  },
  
  intelLevel: { type: Number, default: 0, min: 0, max: 3 },
  infiltration: { type: Number, default: 0, min: 0, max: 100 },
  cover: { type: Number, default: 50, min: 0, max: 100 },
  
  suspicion: { type: Number, default: 0, min: 0, max: 100 },
  lastCheckAt: { type: Date, default: Date.now },
  
  deployedAt: { type: Date, default: Date.now },
  nextReportAt: { type: Date },
  
  skills: [{ type: String }],
  
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

// Indexes
Gin7SpySchema.index({ spyId: 1, sessionId: 1 }, { unique: true });
Gin7SpySchema.index({ sessionId: 1, ownerId: 1, status: 1 });
Gin7SpySchema.index({ sessionId: 1, targetType: 1, targetId: 1, status: 1 });

export const Gin7Spy: Model<IGin7Spy> = 
  mongoose.models.Gin7Spy || mongoose.model<IGin7Spy>('Gin7Spy', Gin7SpySchema);

