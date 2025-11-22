import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IGalaxyLoopStats {
  lastTickDurationMs: number;
  avgTickDurationMs: number;
  maxTickDurationMs: number;
  sampleCount: number;
  lastTickCompletedAt?: Date;
  consecutiveFailures: number;
  lastAlertAt?: Date;
  lastAlertReason?: string;
}

export interface IGalaxySessionClock extends Document {
  session_id: string;
  gameTime: Date;
  lastRealTickAt: Date;
  timeScaleFactor: number; // game seconds per real second (gin7manual Chapter1)
  phase: 'strategic' | 'logistics' | 'combat';
  manuallyPaused: boolean;
  loopStats?: IGalaxyLoopStats;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const GalaxySessionClockSchema = new Schema<IGalaxySessionClock>(
  {
    session_id: { type: String, required: true, unique: true },
    gameTime: { type: Date, default: () => new Date(Date.UTC(796, 0, 1)) },
    lastRealTickAt: { type: Date, default: () => new Date() },
    timeScaleFactor: { type: Number, default: 24 },
    phase: {
      type: String,
      enum: ['strategic', 'logistics', 'combat'],
      default: 'strategic',
    },
    manuallyPaused: { type: Boolean, default: false },
    notes: { type: String },
    loopStats: {
      lastTickDurationMs: { type: Number, default: 0 },
      avgTickDurationMs: { type: Number, default: 0 },
      maxTickDurationMs: { type: Number, default: 0 },
      sampleCount: { type: Number, default: 0 },
      consecutiveFailures: { type: Number, default: 0 },
      lastTickCompletedAt: { type: Date },
      lastAlertAt: { type: Date },
      lastAlertReason: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

GalaxySessionClockSchema.index({ session_id: 1 });

export const GalaxySessionClock =
  (mongoose.models.GalaxySessionClock as Model<IGalaxySessionClock> | undefined) || mongoose.model<IGalaxySessionClock>('GalaxySessionClock', GalaxySessionClockSchema);
