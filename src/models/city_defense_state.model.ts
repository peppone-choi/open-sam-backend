import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ICityDefenseState extends Document {
  session_id: string;
  city_id: number;
  city_name: string;

  wall_max: number;
  wall_hp: number;
  gate_max: number;
  gate_hp: number;
  tower_level: number;
  repair_rate: number;

  last_repair_at?: Date;
  last_damage_at?: Date;
  notes?: string;
  created_at?: Date;
  updated_at?: Date;
}

const CityDefenseStateSchema = new Schema<ICityDefenseState>({
  session_id: { type: String, required: true, index: true },
  city_id: { type: Number, required: true, index: true },
  city_name: { type: String, required: true },

  wall_max: { type: Number, default: 1000 },
  wall_hp: { type: Number, default: 1000 },
  gate_max: { type: Number, default: 100 },
  gate_hp: { type: Number, default: 100 },
  tower_level: { type: Number, default: 0 },
  repair_rate: { type: Number, default: 5 },

  last_repair_at: { type: Date },
  last_damage_at: { type: Date },
  notes: { type: String }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

CityDefenseStateSchema.index({ session_id: 1, city_id: 1 }, { unique: true });

CityDefenseStateSchema.pre('validate', function(next) {
  this.wall_hp = Math.min(this.wall_hp ?? 0, this.wall_max ?? 0);
  this.gate_hp = Math.min(this.gate_hp ?? 0, this.gate_max ?? 0);
  if (this.wall_hp < 0) this.wall_hp = 0;
  if (this.gate_hp < 0) this.gate_hp = 0;
  next();
});

export const CityDefenseState = (mongoose.models.CityDefenseState as Model<ICityDefenseState> | undefined) || mongoose.model<ICityDefenseState>('CityDefenseState', CityDefenseStateSchema);
