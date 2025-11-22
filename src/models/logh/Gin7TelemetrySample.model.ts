import mongoose, { Document, Model, Schema } from 'mongoose';

export type Gin7TelemetryScene = 'strategy' | 'tactical' | 'hud' | 'operations';

export interface IGin7TelemetrySample extends Document {
  session_id: string;
  characterId?: string;
  scene: Gin7TelemetryScene | string;
  avgFps: number;
  cpuPct: number;
  memoryMb: number;
  sampleCount: number;
  durationMs: number;
  collectedAt: Date;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

const Gin7TelemetrySampleSchema = new Schema<IGin7TelemetrySample>(
  {
    session_id: { type: String, required: true, index: true },
    characterId: { type: String },
    scene: { type: String, required: true },
    avgFps: { type: Number, required: true },
    cpuPct: { type: Number, required: true },
    memoryMb: { type: Number, required: true },
    sampleCount: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },
    collectedAt: { type: Date, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
  }
);

Gin7TelemetrySampleSchema.index({ session_id: 1, scene: 1, collectedAt: -1 });

export const Gin7TelemetrySample: Model<IGin7TelemetrySample> =
  (mongoose.models.Gin7TelemetrySample as Model<IGin7TelemetrySample>) ||
  mongoose.model<IGin7TelemetrySample>('Gin7TelemetrySample', Gin7TelemetrySampleSchema);
