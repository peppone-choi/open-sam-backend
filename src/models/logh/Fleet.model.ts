/**
 * LOGH Fleet Model
 * 은하영웅전설 함대
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IFleet extends Document {
  session_id: string;
  id: string; // Fleet unique ID

  // Basic info
  name: string;
  commanderId: number; // Commander no
  faction: 'empire' | 'alliance';

  // Ship composition
  ships: {
    type: 'battleship' | 'cruiser' | 'destroyer' | 'carrier';
    count: number;
  }[];

  totalShips: number;

  // Resources
  supplies: number;

  // Position
  position: {
    x: number;
    y: number;
    z: number;
  };

  // Formation
  formation: 'standard' | 'offensive' | 'defensive' | 'encircle';

  createdAt?: Date;
  updatedAt?: Date;
}

const FleetSchema = new Schema<IFleet>(
  {
    session_id: { type: String, required: true, index: true },
    id: { type: String, required: true },

    name: { type: String, required: true },
    commanderId: { type: Number, required: true },
    faction: { type: String, enum: ['empire', 'alliance'], required: true },

    ships: [
      {
        type: {
          type: String,
          enum: ['battleship', 'cruiser', 'destroyer', 'carrier'],
        },
        count: Number,
      },
    ],

    totalShips: { type: Number, default: 0 },
    supplies: { type: Number, default: 0 },

    position: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      z: { type: Number, default: 0 },
    },

    formation: {
      type: String,
      enum: ['standard', 'offensive', 'defensive', 'encircle'],
      default: 'standard',
    },
  },
  {
    timestamps: true,
  }
);

// Unique index for session + id
FleetSchema.index({ session_id: 1, id: 1 }, { unique: true });

export const Fleet = mongoose.model<IFleet>('Fleet', FleetSchema);
