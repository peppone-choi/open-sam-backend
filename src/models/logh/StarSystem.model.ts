/**
 * LOGH Star System Model
 * 은하영웅전설 성계 (별계)
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IStarSystem extends Document {
  session_id: string;
  systemId: string; // System unique ID (e.g., "sirius", "heinessen")
  systemNumber: number; // System number (1-80)

  // Basic info
  systemName: string;
  systemNameJa?: string;
  systemNameEn?: string;
  
  // Faction
  faction: 'empire' | 'alliance' | 'neutral';

  // Planets in this system
  planetIds: string[]; // Array of planet IDs
  planetCount: number; // Number of planets

  // Grid coordinates (100x50)
  gridCoordinates: {
    x: number; // 0-99
    y: number; // 0-49
  };

  // Strategic info
  strategicValue?: 'critical' | 'high' | 'normal' | 'low';
  territoryType?: 'empire' | 'alliance' | 'disputed' | 'neutral';
  description?: string;
  historicalSignificance?: string;

  // Warp routes (connections to other systems)
  warpRoutes?: string[]; // Array of connected system IDs

  createdAt?: Date;
  updatedAt?: Date;
}

const StarSystemSchema = new Schema<IStarSystem>(
  {
    session_id: { type: String, required: true, index: true },
    systemId: { type: String, required: true },
    systemNumber: { type: Number, required: true },

    systemName: { type: String, required: true },
    systemNameJa: { type: String },
    systemNameEn: { type: String },
    
    faction: {
      type: String,
      enum: ['empire', 'alliance', 'neutral'],
      default: 'neutral',
    },

    planetIds: [{ type: String }],
    planetCount: { type: Number, default: 0 },

    gridCoordinates: {
      x: { type: Number, required: true, min: 0, max: 99 },
      y: { type: Number, required: true, min: 0, max: 49 },
    },

    strategicValue: {
      type: String,
      enum: ['critical', 'high', 'normal', 'low'],
    },
    territoryType: {
      type: String,
      enum: ['empire', 'alliance', 'disputed', 'neutral'],
    },
    description: { type: String },
    historicalSignificance: { type: String },

    warpRoutes: [{ type: String }],
  },
  {
    timestamps: true,
  }
);

// Unique index for session + systemId
StarSystemSchema.index({ session_id: 1, systemId: 1 }, { unique: true });
// Index for grid coordinates for spatial queries
StarSystemSchema.index({ session_id: 1, 'gridCoordinates.x': 1, 'gridCoordinates.y': 1 });
// Index for faction
StarSystemSchema.index({ session_id: 1, faction: 1 });

export const StarSystem = mongoose.model<IStarSystem>('StarSystem', StarSystemSchema);
