import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Terrain types for grid cells
 */
export type GridTerrain = 'normal' | 'nebula' | 'asteroid_field' | 'black_hole' | 'corridor';

/**
 * Grid type
 */
export type GridType = 'SPACE' | 'SYSTEM' | 'BLOCKED';

/**
 * Battle state within a grid
 */
export interface IGridBattleState {
  battleId: string;
  startedAt: Date;
  participants: string[];             // Fleet IDs in battle
  factions: string[];                 // Faction IDs in battle
  status: 'PENDING' | 'ACTIVE' | 'ENDED';
}

/**
 * Fleet info within grid (for quick lookup without joining)
 */
export interface IGridFleetInfo {
  fleetId: string;
  factionId: string;
  unitCount: number;                  // Total units (1 unit = 300 ships)
  commanderId: string;
  name: string;
}

/**
 * GalaxyGrid Schema
 * Represents a 100x100 strategic map grid cell
 * 
 * Constraints:
 * - Max 300 units per faction per grid
 * - Max 2 factions per grid (for combat to occur)
 */
export interface IGalaxyGrid extends Document {
  sessionId: string;
  gridId: string;                     // Unique grid identifier (e.g., "grid_x_y")
  x: number;                          // 0-99
  y: number;                          // 0-99
  
  // Grid type
  type: GridType;
  
  // Occupants
  occupants: string[];                // Unit IDs in this grid (legacy)
  ownerFactions: string[];            // Faction IDs present
  
  // Fleet tracking (new)
  fleets: IGridFleetInfo[];           // Fleets in this grid
  fleetsByFaction: Map<string, string[]>;  // factionId -> fleetIds
  unitCountByFaction: Map<string, number>; // factionId -> total unit count
  
  // Battle state
  battleState?: IGridBattleState;
  battlePending: boolean;             // True if hostile fleets present but battle not started
  hostileFactions: string[];          // Factions that are hostile to each other in this grid
  
  // Terrain
  terrain: GridTerrain;
  terrainModifiers: {
    movementCost: number;             // 1.0 = normal, >1.0 = slower
    detectionRange: number;           // 1.0 = normal, <1.0 = harder to detect
    combatModifier: number;           // 1.0 = normal
  };
  
  // Star systems in this grid
  starSystemIds: string[];
  
  // Celestial bodies (planets, fortresses)
  celestialBodies: Array<{
    bodyId: string;
    type: 'PLANET' | 'FORTRESS' | 'STATION';
    name: string;
    controllingFaction?: string;
  }>;
  
  // Visibility/FOW
  exploredBy: string[];               // Faction IDs that have explored this grid
  
  // Metadata
  name?: string;                      // Optional name for notable grids
  description?: string;
  data: Record<string, any>;          // Extensibility
}

// Sub-schema for fleet info within grid
const GridFleetInfoSchema = new Schema({
  fleetId: { type: String, required: true },
  factionId: { type: String, required: true },
  unitCount: { type: Number, default: 0 },
  commanderId: { type: String },
  name: { type: String }
}, { _id: false });

// Sub-schema for battle state
const GridBattleStateSchema = new Schema({
  battleId: { type: String, required: true },
  startedAt: { type: Date, default: Date.now },
  participants: { type: [String], default: [] },
  factions: { type: [String], default: [] },
  status: { 
    type: String, 
    enum: ['PENDING', 'ACTIVE', 'ENDED'],
    default: 'PENDING'
  }
}, { _id: false });

// Sub-schema for celestial bodies
const CelestialBodySchema = new Schema({
  bodyId: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['PLANET', 'FORTRESS', 'STATION'],
    required: true
  },
  name: { type: String },
  controllingFaction: { type: String }
}, { _id: false });

const GalaxyGridSchema = new Schema<IGalaxyGrid>({
  sessionId: { type: String, required: true },
  gridId: { type: String },  // Will be auto-generated if not provided
  x: { type: Number, required: true, min: 0, max: 99 },
  y: { type: Number, required: true, min: 0, max: 99 },
  
  // Grid type
  type: {
    type: String,
    enum: ['SPACE', 'SYSTEM', 'BLOCKED'],
    default: 'SPACE'
  },
  
  // Legacy occupants
  occupants: { type: [String], default: [] },
  ownerFactions: { type: [String], default: [] },
  
  // Fleet tracking (new)
  fleets: { type: [GridFleetInfoSchema], default: [] },
  fleetsByFaction: { type: Map, of: [String], default: new Map() },
  unitCountByFaction: { type: Map, of: Number, default: new Map() },
  
  // Battle state
  battleState: { type: GridBattleStateSchema },
  battlePending: { type: Boolean, default: false },
  hostileFactions: { type: [String], default: [] },
  
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
  
  // Celestial bodies
  celestialBodies: { type: [CelestialBodySchema], default: [] },
  
  exploredBy: { type: [String], default: [] },
  
  name: String,
  description: String,
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

// Pre-save hook to auto-generate gridId
GalaxyGridSchema.pre('save', function(next) {
  if (!this.gridId) {
    this.gridId = `grid_${this.x}_${this.y}`;
  }
  next();
});

// Compound indexes
GalaxyGridSchema.index({ sessionId: 1, x: 1, y: 1 }, { unique: true });
GalaxyGridSchema.index({ sessionId: 1, gridId: 1 });
GalaxyGridSchema.index({ sessionId: 1, 'ownerFactions': 1 });
GalaxyGridSchema.index({ sessionId: 1, terrain: 1 });
GalaxyGridSchema.index({ sessionId: 1, type: 1 });
GalaxyGridSchema.index({ sessionId: 1, battlePending: 1 });
GalaxyGridSchema.index({ sessionId: 1, 'battleState.status': 1 });
GalaxyGridSchema.index({ sessionId: 1, 'fleets.fleetId': 1 });
GalaxyGridSchema.index({ sessionId: 1, 'fleets.factionId': 1 });

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

/**
 * Add a fleet to a grid (new fleet tracking system)
 */
GalaxyGridSchema.statics.addFleetToGrid = async function(
  sessionId: string,
  x: number,
  y: number,
  fleetInfo: IGridFleetInfo
): Promise<{ success: boolean; grid?: IGalaxyGrid; reason?: string }> {
  const grid = await this.findOne({ sessionId, x, y });
  
  // Check unit limits
  const currentUnits = grid?.unitCountByFaction?.get(fleetInfo.factionId) || 0;
  if (currentUnits + fleetInfo.unitCount > GRID_CONSTANTS.MAX_UNITS_PER_GRID) {
    return { 
      success: false, 
      reason: `GIN7_E004: Adding ${fleetInfo.unitCount} units would exceed limit (${currentUnits}/${GRID_CONSTANTS.MAX_UNITS_PER_GRID})` 
    };
  }
  
  // Check faction limit
  const existingFactions = new Set(grid?.ownerFactions || []);
  if (!existingFactions.has(fleetInfo.factionId) && existingFactions.size >= GRID_CONSTANTS.MAX_FACTIONS_PER_GRID) {
    return { 
      success: false, 
      reason: 'GIN7_E004: Grid already has maximum factions engaged' 
    };
  }
  
  // Upsert grid with fleet info
  const updatedGrid = await this.findOneAndUpdate(
    { sessionId, x, y },
    {
      $push: { fleets: fleetInfo },
      $addToSet: { ownerFactions: fleetInfo.factionId },
      $inc: { [`unitCountByFaction.${fleetInfo.factionId}`]: fleetInfo.unitCount },
      $setOnInsert: {
        sessionId,
        x,
        y,
        gridId: `grid_${x}_${y}`,
        type: 'SPACE',
        terrain: 'normal',
        terrainModifiers: { movementCost: 1.0, detectionRange: 1.0, combatModifier: 1.0 },
        starSystemIds: [],
        exploredBy: [fleetInfo.factionId],
        data: {}
      }
    },
    { upsert: true, new: true }
  );
  
  // Update fleetsByFaction map
  const factionFleets = updatedGrid.fleetsByFaction?.get(fleetInfo.factionId) || [];
  factionFleets.push(fleetInfo.fleetId);
  updatedGrid.fleetsByFaction?.set(fleetInfo.factionId, factionFleets);
  
  // Check for hostile encounter
  await (this as IGalaxyGridModel).checkHostileEncounter(sessionId, x, y);
  
  return { success: true, grid: updatedGrid };
};

/**
 * Remove a fleet from a grid
 */
GalaxyGridSchema.statics.removeFleetFromGrid = async function(
  sessionId: string,
  x: number,
  y: number,
  fleetId: string
): Promise<IGalaxyGrid | null> {
  const grid = await this.findOne({ sessionId, x, y });
  if (!grid) return null;
  
  // Find fleet info
  const fleetInfo = grid.fleets.find((f: IGridFleetInfo) => f.fleetId === fleetId);
  if (!fleetInfo) return grid;
  
  // Remove fleet from array
  grid.fleets = grid.fleets.filter((f: IGridFleetInfo) => f.fleetId !== fleetId);
  
  // Update unit count
  const currentCount = grid.unitCountByFaction?.get(fleetInfo.factionId) || 0;
  grid.unitCountByFaction?.set(fleetInfo.factionId, Math.max(0, currentCount - fleetInfo.unitCount));
  
  // Update fleetsByFaction
  const factionFleets = grid.fleetsByFaction?.get(fleetInfo.factionId) || [];
  grid.fleetsByFaction?.set(
    fleetInfo.factionId, 
    factionFleets.filter((id: string) => id !== fleetId)
  );
  
  // Check if faction still has units
  if ((grid.unitCountByFaction?.get(fleetInfo.factionId) || 0) === 0) {
    grid.ownerFactions = grid.ownerFactions.filter((f: string) => f !== fleetInfo.factionId);
  }
  
  // Update hostile state
  await (this as IGalaxyGridModel).checkHostileEncounter(sessionId, x, y);
  
  await grid.save();
  return grid;
};

/**
 * Check if hostile factions are in the same grid (encounter detection)
 */
GalaxyGridSchema.statics.checkHostileEncounter = async function(
  sessionId: string,
  x: number,
  y: number
): Promise<{ hasEncounter: boolean; factions: string[] }> {
  const grid = await this.findOne({ sessionId, x, y });
  if (!grid) return { hasEncounter: false, factions: [] };
  
  const factions = grid.ownerFactions || [];
  
  // Simple hostile check: different factions = hostile
  // In production, check diplomacy state
  if (factions.length >= 2) {
    grid.battlePending = true;
    grid.hostileFactions = factions;
    await grid.save();
    return { hasEncounter: true, factions };
  }
  
  grid.battlePending = false;
  grid.hostileFactions = [];
  await grid.save();
  return { hasEncounter: false, factions: [] };
};

/**
 * Set battle state for grid
 */
GalaxyGridSchema.statics.setBattleState = async function(
  sessionId: string,
  x: number,
  y: number,
  battleState: IGridBattleState | null
): Promise<IGalaxyGrid | null> {
  const update = battleState 
    ? { battleState, battlePending: false }
    : { $unset: { battleState: 1 }, battlePending: false };
    
  return this.findOneAndUpdate(
    { sessionId, x, y },
    update,
    { new: true }
  );
};

/**
 * Get grids with pending battles
 */
GalaxyGridSchema.statics.getGridsWithPendingBattles = async function(
  sessionId: string
): Promise<IGalaxyGrid[]> {
  return this.find({ 
    sessionId, 
    battlePending: true,
    battleState: { $exists: false }
  });
};

/**
 * Get grids with active battles
 */
GalaxyGridSchema.statics.getGridsWithActiveBattles = async function(
  sessionId: string
): Promise<IGalaxyGrid[]> {
  return this.find({ 
    sessionId, 
    'battleState.status': 'ACTIVE'
  });
};

export interface IGalaxyGridModel extends Model<IGalaxyGrid> {
  canEnterGrid(sessionId: string, x: number, y: number, unitId: string, factionId: string): Promise<{ allowed: boolean; reason?: string }>;
  addUnitToGrid(sessionId: string, x: number, y: number, unitId: string, factionId: string): Promise<IGalaxyGrid>;
  removeUnitFromGrid(sessionId: string, x: number, y: number, unitId: string, factionId: string): Promise<IGalaxyGrid | null>;
  addFleetToGrid(sessionId: string, x: number, y: number, fleetInfo: IGridFleetInfo): Promise<{ success: boolean; grid?: IGalaxyGrid; reason?: string }>;
  removeFleetFromGrid(sessionId: string, x: number, y: number, fleetId: string): Promise<IGalaxyGrid | null>;
  checkHostileEncounter(sessionId: string, x: number, y: number): Promise<{ hasEncounter: boolean; factions: string[] }>;
  setBattleState(sessionId: string, x: number, y: number, battleState: IGridBattleState | null): Promise<IGalaxyGrid | null>;
  getGridsWithPendingBattles(sessionId: string): Promise<IGalaxyGrid[]>;
  getGridsWithActiveBattles(sessionId: string): Promise<IGalaxyGrid[]>;
}

export const GalaxyGrid: IGalaxyGridModel = 
  mongoose.models.GalaxyGrid as IGalaxyGridModel || 
  mongoose.model<IGalaxyGrid, IGalaxyGridModel>('GalaxyGrid', GalaxyGridSchema);

