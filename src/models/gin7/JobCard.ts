import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * JobCard represents a queued or active command/action for a Character.
 * 
 * Design rationale:
 * - Decoupled from Character to avoid circular reference issues
 * - Uses string IDs (not ObjectId refs) to prevent Mongoose populate overhead
 * - Indexed for efficient lookup by session, character, and status
 */
export interface IGin7JobCard extends Document {
  jobId: string;
  sessionId: string;
  characterId: string;
  
  // Job Definition
  jobType: string;  // e.g., 'DEVELOP', 'RECRUIT', 'MARCH', 'BATTLE', 'REST'
  priority: number; // Lower = higher priority (0 = immediate)
  
  // Timing
  startTick: number;      // Game tick when job started
  durationTicks: number;  // How many ticks this job takes
  endTick: number;        // Calculated: startTick + durationTicks
  
  // Status
  status: 'queued' | 'active' | 'completed' | 'cancelled' | 'failed';
  progress: number;       // 0-100 percentage
  
  // Job Parameters (flexible)
  params: Record<string, any>;
  // Example for MARCH: { targetX: 10, targetY: 20, speed: 1.5 }
  // Example for DEVELOP: { cityId: 5, field: 'agriculture', amount: 10 }
  
  // Result (populated on completion)
  result?: {
    success: boolean;
    message?: string;
    rewards?: Record<string, number>;
    changes?: Record<string, any>;
  };
  
  // Extensibility
  data: Record<string, any>;
}

const Gin7JobCardSchema = new Schema<IGin7JobCard>({
  jobId: { type: String, required: true },
  sessionId: { type: String, required: true },
  characterId: { type: String, required: true },
  
  jobType: { type: String, required: true },
  priority: { type: Number, default: 10 },
  
  startTick: { type: Number, default: 0 },
  durationTicks: { type: Number, default: 1 },
  endTick: { type: Number, default: 0 },
  
  status: { 
    type: String, 
    enum: ['queued', 'active', 'completed', 'cancelled', 'failed'], 
    default: 'queued' 
  },
  progress: { type: Number, default: 0 },
  
  params: { type: Schema.Types.Mixed, default: {} },
  result: { type: Schema.Types.Mixed },
  
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

// === INDEXES ===
// Primary lookup: find jobs for a character in a session
Gin7JobCardSchema.index({ sessionId: 1, characterId: 1, status: 1 });

// Find all active jobs in a session (for tick processing)
Gin7JobCardSchema.index({ sessionId: 1, status: 1, endTick: 1 });

// Unique job ID within session
Gin7JobCardSchema.index({ jobId: 1, sessionId: 1 }, { unique: true });

// Priority queue lookup
Gin7JobCardSchema.index({ sessionId: 1, characterId: 1, priority: 1, status: 1 });

export const Gin7JobCard: Model<IGin7JobCard> = 
  mongoose.models.Gin7JobCard || mongoose.model<IGin7JobCard>('Gin7JobCard', Gin7JobCardSchema);

