import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Terrain types for grid cells
 */
export type GridTerrain = 'normal' | 'nebula' | 'asteroid_field' | 'black_hole' | 'corridor';

/**
 * GalaxyGrid Schema
 * Represents a 100x100 strategic map grid cell
 * 
 * Constraints:
 * - Max 300 units per grid
 * - Max 2 factions per grid (for combat to occur)
 */
export interface IGalaxyGrid extends Document {
  sessionId: string;
  x: number;                          // 0-99
  y: number;                          // 0-99
  
  // Occupants
  occupants: string[];                // Unit IDs in this grid
  ownerFactions: string[];            // Faction IDs present
  
  // Terrain
  terrain: GridTerrain;
  terrainModifiers: {
    movementCost: number;             // 1.0 = normal, >1.0 = slower
    detectionRange: number;           // 1.0 = normal, <1.0 = harder to detect
    combatModifier: number;           // 1.0 = normal
  };
  
  // Star systems in this grid
  starSystemIds: string[];
  
  // Visibility/FOW
  exploredBy: string[];               // Faction IDs that have explored this grid
  
  // Metadata
  name?: string;                      // Optional name for notable grids
  description?: string;
  data: Record<string, any>;          // Extensibility
}

const GalaxyGridSchema = new Schema<IGalaxyGrid>({
  sessionId: { type: String, required: true },
  x: { type: Number, required: true, min: 0, max: 99 },
  y: { type: Number, required: true, min: 0, max: 99 },
  
  occupants: { type: [String], default: [] },
  ownerFactions: { type: [String], default: [] },
  
  terrain: { 
    type: String, 
    enum: ['normal', 'nebula', 'asteroid_field', 'black_hole', 'corridor'],
    default: 'normal'
  },
  terrainModifiers: {
    movementCost: { type: Number, default: 1.0 },
    detectionRange: { type: Number, default: 1.0 },
    combatModifier: { type: Number, default: 1.0 }
  },
  
  starSystemIds: { type: [String], default: [] },
  exploredBy: { type: [String], default: [] },
  
  name: String,
  description: String,
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

// Compound indexes
GalaxyGridSchema.index({ sessionId: 1, x: 1, y: 1 }, { unique: true });
GalaxyGridSchema.index({ sessionId: 1, 'ownerFactions': 1 });
GalaxyGridSchema.index({ sessionId: 1, terrain: 1 });

// Constants
export const GRID_CONSTANTS = {
  MAX_UNITS_PER_GRID: 300,
  MAX_FACTIONS_PER_GRID: 2,
  GRID_SIZE: 100,
} as const;

// Static methods
GalaxyGridSchema.statics.canEnterGrid = async function(
  sessionId: string, 
  x: number, 
  y: number, 
  unitId: string, 
  factionId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const grid = await this.findOne({ sessionId, x, y });
  if (!grid) {
    return { allowed: true }; // Grid doesn't exist yet, will be created
  }
  
  // Check unit limit
  if (grid.occupants.length >= GRID_CONSTANTS.MAX_UNITS_PER_GRID) {
    return { allowed: false, reason: 'GIN7_E004: Grid is full (300 units max)' };
  }
  
  // Check faction limit
  const factionsInGrid = new Set(grid.ownerFactions);
  if (!factionsInGrid.has(factionId) && factionsInGrid.size >= GRID_CONSTANTS.MAX_FACTIONS_PER_GRID) {
    return { allowed: false, reason: 'GIN7_E004: Grid already has 2 factions engaged' };
  }
  
  // Check terrain
  if (grid.terrain === 'black_hole') {
    return { allowed: false, reason: 'Cannot enter black hole' };
  }
  
  return { allowed: true };
};

GalaxyGridSchema.statics.addUnitToGrid = async function(
  sessionId: string,
  x: number,
  y: number,
  unitId: string,
  factionId: string
): Promise<IGalaxyGrid> {
  const grid = await this.findOneAndUpdate(
    { sessionId, x, y },
    {
      $addToSet: { 
        occupants: unitId, 
        ownerFactions: factionId 
      },
      $setOnInsert: {
        sessionId,
        x,
        y,
        terrain: 'normal',
        terrainModifiers: { movementCost: 1.0, detectionRange: 1.0, combatModifier: 1.0 },
        starSystemIds: [],
        exploredBy: [factionId],
        data: {}
      }
    },
    { upsert: true, new: true }
  );
  return grid;
};

GalaxyGridSchema.statics.removeUnitFromGrid = async function(
  sessionId: string,
  x: number,
  y: number,
  unitId: string,
  factionId: string
): Promise<IGalaxyGrid | null> {
  const grid = await this.findOne({ sessionId, x, y });
  if (!grid) return null;
  
  // Remove unit
  grid.occupants = grid.occupants.filter((id: string) => id !== unitId);
  
  // Check if faction still has units in this grid
  // This would require checking all units, simplified here
  // In production, you'd check if any unit of this faction remains
  
  await grid.save();
  return grid;
};

export interface IGalaxyGridModel extends Model<IGalaxyGrid> {
  canEnterGrid(sessionId: string, x: number, y: number, unitId: string, factionId: string): Promise<{ allowed: boolean; reason?: string }>;
  addUnitToGrid(sessionId: string, x: number, y: number, unitId: string, factionId: string): Promise<IGalaxyGrid>;
  removeUnitFromGrid(sessionId: string, x: number, y: number, unitId: string, factionId: string): Promise<IGalaxyGrid | null>;
}

export const GalaxyGrid: IGalaxyGridModel = 
  mongoose.models.GalaxyGrid as IGalaxyGridModel || 
  mongoose.model<IGalaxyGrid, IGalaxyGridModel>('GalaxyGrid', GalaxyGridSchema);

