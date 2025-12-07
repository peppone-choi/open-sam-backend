import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Warp state machine states
 * IDLE -> CHARGING -> WARPING -> COOLING -> IDLE
 */
export type WarpState = 'IDLE' | 'CHARGING' | 'WARPING' | 'COOLING';

/**
 * WarpTravel Schema
 * Tracks active and completed warp travels
 */
export interface IWarpTravel extends Document {
  travelId: string;
  sessionId: string;
  unitId: string;               // Fleet or single ship ID
  factionId: string;
  
  // Origin
  origin: {
    gridX: number;
    gridY: number;
    systemId?: string;
    planetId?: string;
  };
  
  // Destination
  destination: {
    gridX: number;
    gridY: number;
    systemId?: string;
    planetId?: string;
  };
  
  // State machine
  state: WarpState;
  
  // Timing
  requestedAt: Date;
  chargeStartedAt?: Date;
  warpStartedAt?: Date;
  coolingStartedAt?: Date;
  completedAt?: Date;
  
  // Durations (in game ticks)
  chargeDuration: number;       // Time to charge warp drive
  warpDuration: number;         // Time in warp
  coolingDuration: number;      // Cooldown after warp
  
  // Calculations
  distance: number;             // Light-years
  engineLevel: number;          // Ship's warp engine level (1-10)
  
  // Misjump handling
  hasMisjump: boolean;
  misjumpOffset?: {
    x: number;                  // Grid offset from intended destination
    y: number;
  };
  actualDestination?: {
    gridX: number;
    gridY: number;
  };
  
  // Status
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'failed';
  failureReason?: string;
  
  // Metadata
  data: Record<string, any>;
}

const WarpTravelSchema = new Schema<IWarpTravel>({
  travelId: { type: String, required: true },
  sessionId: { type: String, required: true },
  unitId: { type: String, required: true },
  factionId: { type: String, required: true },
  
  origin: {
    gridX: { type: Number, required: true },
    gridY: { type: Number, required: true },
    systemId: String,
    planetId: String
  },
  
  destination: {
    gridX: { type: Number, required: true },
    gridY: { type: Number, required: true },
    systemId: String,
    planetId: String
  },
  
  state: {
    type: String,
    enum: ['IDLE', 'CHARGING', 'WARPING', 'COOLING'],
    default: 'IDLE'
  },
  
  requestedAt: { type: Date, default: Date.now },
  chargeStartedAt: Date,
  warpStartedAt: Date,
  coolingStartedAt: Date,
  completedAt: Date,
  
  chargeDuration: { type: Number, default: 10 },
  warpDuration: { type: Number, default: 100 },
  coolingDuration: { type: Number, default: 5 },
  
  distance: { type: Number, required: true },
  engineLevel: { type: Number, default: 1, min: 1, max: 10 },
  
  hasMisjump: { type: Boolean, default: false },
  misjumpOffset: {
    x: Number,
    y: Number
  },
  actualDestination: {
    gridX: Number,
    gridY: Number
  },
  
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'cancelled', 'failed'],
    default: 'pending'
  },
  failureReason: String,
  
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

// Indexes
WarpTravelSchema.index({ travelId: 1, sessionId: 1 }, { unique: true });
WarpTravelSchema.index({ sessionId: 1, unitId: 1, status: 1 });
WarpTravelSchema.index({ sessionId: 1, state: 1 });
WarpTravelSchema.index({ sessionId: 1, status: 1 });

export const WarpTravel: Model<IWarpTravel> = 
  mongoose.models.WarpTravel || mongoose.model<IWarpTravel>('WarpTravel', WarpTravelSchema);

