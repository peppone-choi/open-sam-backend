import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Planet types
 */
export type PlanetType = 
  | 'terran'          // Earth-like, high population capacity
  | 'ocean'           // Water world
  | 'desert'          // Arid, resource-rich
  | 'ice'             // Frozen, low habitability
  | 'gas_giant'       // Cannot land, resource extraction only
  | 'volcanic'        // Harsh, mineral-rich
  | 'artificial'      // Space station/artificial habitat
  | 'barren';         // No atmosphere, mining only

/**
 * Facility types on planets
 */
export type FacilityType = 
  | 'capital_building'    // Government center
  | 'military_academy'    // Officer training
  | 'shipyard'            // Ship construction
  | 'factory'             // Resource production
  | 'farm'                // Food production
  | 'mine'                // Mineral extraction
  | 'research_lab'        // Tech research
  | 'defense_grid'        // Planetary defense
  | 'spaceport'           // Trade hub
  | 'hospital'            // Population recovery
  | 'entertainment';      // Morale boost

export interface IPlanetFacility {
  facilityId: string;
  type: FacilityType;
  level: number;          // 1-10
  hp: number;
  maxHp: number;
  isOperational: boolean;
  productionBonus: number;
  data?: Record<string, any>;
}

/**
 * Planet Schema
 * Represents a planet within a star system
 */
export interface IPlanet extends Document {
  planetId: string;
  sessionId: string;
  systemId: string;       // Parent star system
  name: string;
  
  // Planet properties
  type: PlanetType;
  size: 'small' | 'medium' | 'large' | 'huge';
  orbitIndex: number;     // Position in system (1 = closest to star)
  
  // Ownership
  ownerId?: string;       // Faction ID
  governorId?: string;    // Character ID of governor
  
  // Population & Economy
  population: number;
  maxPopulation: number;
  populationGrowthRate: number;
  
  morale: number;         // 0-100
  loyalty: number;        // 0-100 (to controlling faction)
  
  // Resources
  resources: {
    food: number;
    minerals: number;
    energy: number;
    credits: number;
    research: number;
  };
  
  resourceProduction: {
    food: number;
    minerals: number;
    energy: number;
    credits: number;
    research: number;
  };
  
  // Storage capacity
  storageCapacity: {
    food: number;
    minerals: number;
    energy: number;
  };
  
  // Facilities
  facilities: IPlanetFacility[];
  maxFacilitySlots: number;
  
  // Defense
  defenseRating: number;  // 0-100
  garrisonIds: string[];  // Unit IDs stationed here
  shieldLevel: number;    // Planetary shield (0-10)
  
  // Special properties
  isHomeworld: boolean;
  hasWarpGate: boolean;
  
  // Metadata
  description?: string;
  originalName?: string;
  data: Record<string, any>;
}

const PlanetFacilitySchema = new Schema<IPlanetFacility>({
  facilityId: { type: String, required: true },
  type: {
    type: String,
    enum: ['capital_building', 'military_academy', 'shipyard', 'factory', 'farm', 
           'mine', 'research_lab', 'defense_grid', 'spaceport', 'hospital', 'entertainment'],
    required: true
  },
  level: { type: Number, default: 1, min: 1, max: 10 },
  hp: { type: Number, default: 100 },
  maxHp: { type: Number, default: 100 },
  isOperational: { type: Boolean, default: true },
  productionBonus: { type: Number, default: 0 },
  data: { type: Schema.Types.Mixed }
}, { _id: false });

const PlanetSchema = new Schema<IPlanet>({
  planetId: { type: String, required: true },
  sessionId: { type: String, required: true },
  systemId: { type: String, required: true },
  name: { type: String, required: true },
  
  type: {
    type: String,
    enum: ['terran', 'ocean', 'desert', 'ice', 'gas_giant', 'volcanic', 'artificial', 'barren'],
    default: 'terran'
  },
  size: {
    type: String,
    enum: ['small', 'medium', 'large', 'huge'],
    default: 'medium'
  },
  orbitIndex: { type: Number, default: 1, min: 1, max: 20 },
  
  ownerId: String,
  governorId: String,
  
  population: { type: Number, default: 1000000 },
  maxPopulation: { type: Number, default: 10000000 },
  populationGrowthRate: { type: Number, default: 0.01 },
  
  morale: { type: Number, default: 50, min: 0, max: 100 },
  loyalty: { type: Number, default: 50, min: 0, max: 100 },
  
  resources: {
    food: { type: Number, default: 1000 },
    minerals: { type: Number, default: 500 },
    energy: { type: Number, default: 500 },
    credits: { type: Number, default: 1000 },
    research: { type: Number, default: 0 }
  },
  
  resourceProduction: {
    food: { type: Number, default: 100 },
    minerals: { type: Number, default: 50 },
    energy: { type: Number, default: 50 },
    credits: { type: Number, default: 100 },
    research: { type: Number, default: 10 }
  },
  
  storageCapacity: {
    food: { type: Number, default: 10000 },
    minerals: { type: Number, default: 5000 },
    energy: { type: Number, default: 5000 }
  },
  
  facilities: { type: [PlanetFacilitySchema], default: [] },
  maxFacilitySlots: { type: Number, default: 10 },
  
  defenseRating: { type: Number, default: 0, min: 0, max: 100 },
  garrisonIds: { type: [String], default: [] },
  shieldLevel: { type: Number, default: 0, min: 0, max: 10 },
  
  isHomeworld: { type: Boolean, default: false },
  hasWarpGate: { type: Boolean, default: false },
  
  description: String,
  originalName: String,
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

// Indexes
PlanetSchema.index({ planetId: 1, sessionId: 1 }, { unique: true });
PlanetSchema.index({ sessionId: 1, systemId: 1 });
PlanetSchema.index({ sessionId: 1, ownerId: 1 });
PlanetSchema.index({ sessionId: 1, isHomeworld: 1 });
PlanetSchema.index({ sessionId: 1, name: 'text' });

// Virtual for total facility count
PlanetSchema.virtual('facilityCount').get(function() {
  return this.facilities.length;
});

// Method to calculate total production
PlanetSchema.methods.calculateTotalProduction = function() {
  const base = { ...this.resourceProduction };
  
  // Apply facility bonuses
  for (const facility of this.facilities) {
    if (!facility.isOperational) continue;
    
    const bonus = 1 + (facility.level * 0.1) + facility.productionBonus;
    
    switch (facility.type) {
      case 'farm':
        base.food *= bonus;
        break;
      case 'mine':
        base.minerals *= bonus;
        break;
      case 'factory':
        base.energy *= bonus;
        base.credits *= bonus;
        break;
      case 'research_lab':
        base.research *= bonus;
        break;
    }
  }
  
  // Apply morale modifier
  const moraleMod = 0.5 + (this.morale / 100) * 0.5;
  base.food *= moraleMod;
  base.credits *= moraleMod;
  
  return {
    food: Math.floor(base.food),
    minerals: Math.floor(base.minerals),
    energy: Math.floor(base.energy),
    credits: Math.floor(base.credits),
    research: Math.floor(base.research)
  };
};

export const Planet: Model<IPlanet> = 
  mongoose.models.Planet || mongoose.model<IPlanet>('Planet', PlanetSchema);

