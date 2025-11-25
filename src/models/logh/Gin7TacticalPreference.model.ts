import mongoose, { Document, Model, Schema } from 'mongoose';

export interface Gin7EnergyProfile {
  beam: number;
  gun: number;
  shield: number;
  engine: number;
  warp: number;
  sensor: number;
}

export interface IGin7TacticalPreference extends Document {
  session_id: string;
  characterId: string;
  energy: Gin7EnergyProfile;
  telemetry?: {
    avgFps: number;
    cpuPct: number;
    memoryMb: number;
    sampleCount: number;
    collectedAt: Date;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export const DEFAULT_GIN7_ENERGY_PROFILE: Gin7EnergyProfile = {
  beam: 20,
  gun: 20,
  shield: 20,
  engine: 20,
  warp: 10,
  sensor: 10,
};

const Gin7TacticalPreferenceSchema = new Schema<IGin7TacticalPreference>(
  {
    session_id: { type: String, required: true, index: true },
    characterId: { type: String, required: true, index: true },
    energy: {
      beam: { type: Number, default: DEFAULT_GIN7_ENERGY_PROFILE.beam },
      gun: { type: Number, default: DEFAULT_GIN7_ENERGY_PROFILE.gun },
      shield: { type: Number, default: DEFAULT_GIN7_ENERGY_PROFILE.shield },
      engine: { type: Number, default: DEFAULT_GIN7_ENERGY_PROFILE.engine },
      warp: { type: Number, default: DEFAULT_GIN7_ENERGY_PROFILE.warp },
      sensor: { type: Number, default: DEFAULT_GIN7_ENERGY_PROFILE.sensor },
    },
    telemetry: {
      avgFps: { type: Number, default: 0 },
      cpuPct: { type: Number, default: 0 },
      memoryMb: { type: Number, default: 0 },
      sampleCount: { type: Number, default: 0 },
      collectedAt: { type: Date },
    },
  },
  {
    timestamps: true,
  }
);

Gin7TacticalPreferenceSchema.index({ session_id: 1, characterId: 1 }, { unique: true });

export const Gin7TacticalPreference: Model<IGin7TacticalPreference> =
  (mongoose.models.Gin7TacticalPreference as Model<IGin7TacticalPreference>) ||
  mongoose.model<IGin7TacticalPreference>('Gin7TacticalPreference', Gin7TacticalPreferenceSchema);
