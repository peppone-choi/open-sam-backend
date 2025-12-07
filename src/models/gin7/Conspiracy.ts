import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Conspiracy represents a coup d'état plot in progress.
 * 
 * Design:
 * - Characters can conspire to overthrow leadership
 * - Participants must be recruited secretly
 * - Risk of discovery and punishment
 */
export interface IGin7Conspiracy extends Document {
  conspiracyId: string;
  sessionId: string;
  
  // Target to overthrow
  targetFactionId: string;
  targetLeaderId?: string;
  
  // Conspirators
  leaderId: string;         // Ringleader
  participants: Array<{
    characterId: string;
    characterName: string;
    joinedAt: Date;
    role: 'leader' | 'supporter' | 'spy' | 'financier';
    loyalty: number;        // 0~100 (might betray)
  }>;
  
  // Progress
  status: 'planning' | 'recruiting' | 'ready' | 'uprising' | 'succeeded' | 'failed' | 'discovered';
  
  // Resources gathered
  resources: {
    gold: number;
    supporters: number;
    militaryStrength: number;
  };
  
  // Requirements for uprising
  requirements: {
    minSupporters: number;
    minMilitary: number;
    minGold: number;
  };
  
  // Secrecy & Discovery
  secrecy: number;          // 0~100 (higher = safer)
  discoveryRisk: number;    // Accumulated risk
  
  // If discovered
  discoveredBy?: string;
  discoveredAt?: Date;
  
  // Planned action
  plannedUprisingAt?: Date;
  
  // Result
  result?: {
    success: boolean;
    newFactionId?: string;    // If succeeded, new faction created
    casualties?: number;
    punishments?: Array<{
      characterId: string;
      punishment: 'execution' | 'imprisonment' | 'exile' | 'pardon';
    }>;
  };
  
  data: Record<string, any>;
}

const Gin7ConspiracySchema = new Schema<IGin7Conspiracy>({
  conspiracyId: { type: String, required: true },
  sessionId: { type: String, required: true },
  
  targetFactionId: { type: String, required: true },
  targetLeaderId: { type: String },
  
  leaderId: { type: String, required: true },
  participants: [{
    characterId: { type: String, required: true },
    characterName: { type: String, required: true },
    joinedAt: { type: Date, default: Date.now },
    role: { 
      type: String, 
      enum: ['leader', 'supporter', 'spy', 'financier'],
      default: 'supporter'
    },
    loyalty: { type: Number, default: 80, min: 0, max: 100 }
  }],
  
  status: { 
    type: String, 
    enum: ['planning', 'recruiting', 'ready', 'uprising', 'succeeded', 'failed', 'discovered'],
    default: 'planning'
  },
  
  resources: {
    gold: { type: Number, default: 0 },
    supporters: { type: Number, default: 0 },
    militaryStrength: { type: Number, default: 0 }
  },
  
  requirements: {
    minSupporters: { type: Number, default: 5 },
    minMilitary: { type: Number, default: 1000 },
    minGold: { type: Number, default: 10000 }
  },
  
  secrecy: { type: Number, default: 100, min: 0, max: 100 },
  discoveryRisk: { type: Number, default: 0, min: 0, max: 100 },
  
  discoveredBy: { type: String },
  discoveredAt: { type: Date },
  
  plannedUprisingAt: { type: Date },
  
  result: { type: Schema.Types.Mixed },
  
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

// Indexes
Gin7ConspiracySchema.index({ conspiracyId: 1, sessionId: 1 }, { unique: true });
Gin7ConspiracySchema.index({ sessionId: 1, targetFactionId: 1, status: 1 });
Gin7ConspiracySchema.index({ sessionId: 1, leaderId: 1 });
Gin7ConspiracySchema.index({ sessionId: 1, 'participants.characterId': 1 });

export const Gin7Conspiracy: Model<IGin7Conspiracy> = 
  mongoose.models.Gin7Conspiracy || mongoose.model<IGin7Conspiracy>('Gin7Conspiracy', Gin7ConspiracySchema);

