/**
 * LOGH Planet Model
 * 은하영웅전설 행성 (도시와 유사)
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IPlanet extends Document {
  session_id: string;
  id: string; // Planet unique ID

  // Basic info
  name: string;
  owner: 'empire' | 'alliance' | 'neutral';

  // Production
  production: {
    ships: number; // 함선 생산력
    resources: number; // 자원 생산력
  };

  // Garrison
  garrisonFleetId: string | null;

  // Fortress
  isFortress: boolean;
  fortressGuns: number;

  // Warehouse
  warehouse: {
    supplies: number;
    ships: number;
  };

  // Position
  position: {
    x: number;
    y: number;
    z: number;
  };

  createdAt?: Date;
  updatedAt?: Date;
}

const PlanetSchema = new Schema<IPlanet>(
  {
    session_id: { type: String, required: true, index: true },
    id: { type: String, required: true },

    name: { type: String, required: true },
    owner: {
      type: String,
      enum: ['empire', 'alliance', 'neutral'],
      default: 'neutral',
    },

    production: {
      ships: { type: Number, default: 100 },
      resources: { type: Number, default: 100 },
    },

    garrisonFleetId: { type: String },

    isFortress: { type: Boolean, default: false },
    fortressGuns: { type: Number, default: 0 },

    warehouse: {
      supplies: { type: Number, default: 0 },
      ships: { type: Number, default: 0 },
    },

    position: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
      z: { type: Number, required: true },
    },
  },
  {
    timestamps: true,
  }
);

// Unique index for session + id
PlanetSchema.index({ session_id: 1, id: 1 }, { unique: true });

export const Planet = mongoose.model<IPlanet>('Planet', PlanetSchema);
