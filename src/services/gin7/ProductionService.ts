import { Planet, IPlanet, FacilityType } from '../../models/gin7/Planet';
import { Warehouse, ResourceType } from '../../models/gin7/Warehouse';
import { WarehouseService } from './WarehouseService';
import mongoose from 'mongoose';

/**
 * Production output per facility level
 */
interface ProductionRate {
  base: number;
  perLevel: number;
}

/**
 * Facility production mapping
 */
const FACILITY_PRODUCTION: Partial<Record<FacilityType, Partial<Record<ResourceType, ProductionRate>>>> = {
  farm: {
    food: { base: 100, perLevel: 50 }
  },
  mine: {
    minerals: { base: 50, perLevel: 30 }
  },
  factory: {
    shipParts: { base: 20, perLevel: 15 },
    components: { base: 10, perLevel: 8 }
  },
  research_lab: {
    // Research points not handled here, handled separately
  },
  spaceport: {
    credits: { base: 100, perLevel: 75 }
  }
};

/**
 * Planet base production by type
 */
const PLANET_BASE_PRODUCTION: Record<string, Partial<Record<ResourceType, number>>> = {
  terran: { food: 200, minerals: 50, energy: 100, credits: 100 },
  ocean: { food: 300, minerals: 20, energy: 80 },
  desert: { minerals: 150, energy: 50, rareMetals: 30 },
  ice: { minerals: 80, energy: 30 },
  gas_giant: { fuel: 500, energy: 200 },
  volcanic: { minerals: 200, energy: 150, rareMetals: 50 },
  artificial: { energy: 200, credits: 200, shipParts: 50 },
  barren: { minerals: 100, rareMetals: 20 }
};

export interface ProductionResult {
  planetId: string;
  produced: Partial<Record<ResourceType, number>>;
  stored: Partial<Record<ResourceType, number>>;
  overflow: Partial<Record<ResourceType, number>>;
}

export class ProductionService {
  /**
   * Calculate production for a planet (without applying)
   */
  static calculatePlanetProduction(planet: IPlanet): Partial<Record<ResourceType, number>> {
    const production: Partial<Record<ResourceType, number>> = {};
    
    // Base production from planet type
    const baseProd = PLANET_BASE_PRODUCTION[planet.type] || {};
    for (const [res, amount] of Object.entries(baseProd)) {
      production[res as ResourceType] = amount;
    }
    
    // Add from operational facilities
    for (const facility of planet.facilities) {
      if (!facility.isOperational) continue;
      
      const facilityProd = FACILITY_PRODUCTION[facility.type];
      if (!facilityProd) continue;
      
      for (const [res, rate] of Object.entries(facilityProd)) {
        const amount = rate.base + (rate.perLevel * facility.level);
        const bonus = 1 + facility.productionBonus;
        production[res as ResourceType] = (production[res as ResourceType] || 0) + Math.floor(amount * bonus);
      }
    }
    
    // Apply population modifier (more population = more production)
    const popMod = Math.min(2, 0.5 + (planet.population / planet.maxPopulation) * 1.5);
    
    // Apply morale modifier
    const moraleMod = 0.5 + (planet.morale / 100) * 0.5;
    
    // Apply modifiers to non-natural resources
    for (const res of Object.keys(production) as ResourceType[]) {
      if (res !== 'minerals' && res !== 'rareMetals') {
        production[res] = Math.floor((production[res] || 0) * popMod * moraleMod);
      }
    }
    
    return production;
  }
  
  /**
   * Process production for a single planet
   */
  static async processPlanetProduction(
    sessionId: string,
    planetId: string
  ): Promise<ProductionResult | null> {
    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) return null;
    
    const produced = this.calculatePlanetProduction(planet);
    const stored: Partial<Record<ResourceType, number>> = {};
    const overflow: Partial<Record<ResourceType, number>> = {};
    
    // Get or create planet warehouse
    let warehouse = await Warehouse.findOne({ 
      sessionId, 
      ownerId: planetId, 
      ownerType: 'PLANET' 
    });
    
    if (!warehouse) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      warehouse = await WarehouseService.initializePlanetWarehouse(
        sessionId, 
        planetId, 
        planet.ownerId || 'NEUTRAL'
      ) as any;
    }
    
    // Add production to warehouse
    for (const [res, amount] of Object.entries(produced)) {
      if (!amount || amount <= 0) continue;
      
      const currentUsage = warehouse.getTotalUsage();
      const available = warehouse.capacity - currentUsage;
      
      if (available >= amount) {
        warehouse.addResource(res as ResourceType, amount);
        stored[res as ResourceType] = amount;
      } else if (available > 0) {
        warehouse.addResource(res as ResourceType, available);
        stored[res as ResourceType] = available;
        overflow[res as ResourceType] = amount - available;
      } else {
        overflow[res as ResourceType] = amount;
      }
    }
    
    // Log production
    await WarehouseService.addProduction(sessionId, planetId, stored);
    
    return { planetId, produced, stored, overflow };
  }
  
  /**
   * Process production for all planets in a session (DAY_START event handler)
   */
  static async processSessionProduction(sessionId: string): Promise<ProductionResult[]> {
    const planets = await Planet.find({ sessionId, ownerId: { $exists: true, $ne: null } });
    const results: ProductionResult[] = [];
    
    // Process in batches to avoid overwhelming DB
    const batchSize = 10;
    for (let i = 0; i < planets.length; i += batchSize) {
      const batch = planets.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(p => this.processPlanetProduction(sessionId, p.planetId))
      );
      results.push(...batchResults.filter((r): r is ProductionResult => r !== null));
    }
    
    return results;
  }
  
  /**
   * Calculate ship production cost and time
   */
  static calculateShipProductionCost(
    shipClass: string,
    quantity: number
  ): {
    cost: { credits: number; minerals: number; shipParts: number };
    turns: number;
  } {
    // Import from Fleet model's SHIP_SPECS would create circular dependency
    // So we define simplified costs here
    const SHIP_COSTS: Record<string, { credits: number; minerals: number; shipParts: number; turns: number }> = {
      flagship: { credits: 50000, minerals: 20000, shipParts: 10000, turns: 20 },
      battleship: { credits: 20000, minerals: 10000, shipParts: 5000, turns: 10 },
      carrier: { credits: 25000, minerals: 12000, shipParts: 8000, turns: 12 },
      cruiser: { credits: 10000, minerals: 5000, shipParts: 2500, turns: 6 },
      destroyer: { credits: 5000, minerals: 2500, shipParts: 1000, turns: 4 },
      frigate: { credits: 3000, minerals: 1500, shipParts: 500, turns: 3 },
      corvette: { credits: 1500, minerals: 750, shipParts: 250, turns: 2 },
      transport: { credits: 4000, minerals: 2000, shipParts: 1000, turns: 4 },
      engineering: { credits: 3500, minerals: 2500, shipParts: 1500, turns: 4 }
    };
    
    const baseCost = SHIP_COSTS[shipClass] || SHIP_COSTS.corvette;
    
    return {
      cost: {
        credits: baseCost.credits * quantity,
        minerals: baseCost.minerals * quantity,
        shipParts: baseCost.shipParts * quantity
      },
      turns: Math.ceil(baseCost.turns * Math.sqrt(quantity))  // Diminishing time for mass production
    };
  }
  
  /**
   * Queue ship production at a planet with shipyard
   */
  static async queueShipProduction(
    sessionId: string,
    planetId: string,
    shipClass: string,
    quantity: number,
    executedBy: string
  ): Promise<{ success: boolean; queueId?: string; error?: string }> {
    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) {
      return { success: false, error: 'Planet not found' };
    }
    
    // Check for shipyard
    const shipyard = planet.facilities.find(f => f.type === 'shipyard' && f.isOperational);
    if (!shipyard) {
      return { success: false, error: 'No operational shipyard on this planet' };
    }
    
    // Calculate cost
    const { cost, turns } = this.calculateShipProductionCost(shipClass, quantity);
    
    // Get warehouse and check resources
    const warehouse = await Warehouse.findOne({ 
      sessionId, 
      ownerId: planetId, 
      ownerType: 'PLANET' 
    });
    
    if (!warehouse) {
      return { success: false, error: 'Planet warehouse not found' };
    }
    
    // Check if we have enough resources
    const items: Array<{ type: ResourceType; amount: number }> = [
      { type: 'credits', amount: cost.credits },
      { type: 'minerals', amount: cost.minerals },
      { type: 'shipParts', amount: cost.shipParts }
    ];
    
    for (const item of items) {
      const available = warehouse.getAvailable(item.type);
      if (available < item.amount) {
        return { 
          success: false, 
          error: `Insufficient ${item.type}: need ${item.amount}, have ${available}` 
        };
      }
    }
    
    // Reserve resources
    const reserved = await WarehouseService.reserve(sessionId, warehouse.warehouseId, items);
    if (!reserved) {
      return { success: false, error: 'Failed to reserve resources' };
    }
    
    // Add to production queue (stored in planet data)
    const queueId = `PROD-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const productionQueue = planet.data.productionQueue || [];
    productionQueue.push({
      queueId,
      shipClass,
      quantity,
      turnsRemaining: turns,
      startedAt: new Date(),
      executedBy,
      cost,
      warehouseId: warehouse.warehouseId
    });
    
    planet.data.productionQueue = productionQueue;
    await planet.save();
    
    return { success: true, queueId };
  }
  
  /**
   * Process ship production queue for a planet
   */
  static async processShipProductionQueue(
    sessionId: string,
    planetId: string
  ): Promise<Array<{ shipClass: string; quantity: number; completed: boolean }>> {
    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) return [];
    
    const queue = planet.data.productionQueue || [];
    if (queue.length === 0) return [];
    
    const results: Array<{ shipClass: string; quantity: number; completed: boolean }> = [];
    const completedIndices: number[] = [];
    
    // Process each queue item
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      
      // Check if shipyard still operational
      const shipyard = planet.facilities.find(f => f.type === 'shipyard' && f.isOperational);
      if (!shipyard) {
        // Pause production if no shipyard
        results.push({ shipClass: item.shipClass, quantity: item.quantity, completed: false });
        continue;
      }
      
      // Apply shipyard level bonus to production speed
      const speedBonus = 1 + (shipyard.level * 0.1);
      item.turnsRemaining -= speedBonus;
      
      if (item.turnsRemaining <= 0) {
        // Production complete!
        completedIndices.push(i);
        results.push({ shipClass: item.shipClass, quantity: item.quantity, completed: true });
        
        // Consume reserved resources
        if (item.warehouseId && item.cost) {
          await WarehouseService.consume(
            sessionId,
            item.warehouseId,
            [
              { type: 'credits', amount: item.cost.credits },
              { type: 'minerals', amount: item.cost.minerals },
              { type: 'shipParts', amount: item.cost.shipParts }
            ],
            'PRODUCTION_SYSTEM'
          );
        }
        
        // Ships are added to garrison or designated fleet (stored in planet data.completedShips)
        const completedShips = planet.data.completedShips || [];
        completedShips.push({
          shipClass: item.shipClass,
          quantity: item.quantity,
          completedAt: new Date()
        });
        planet.data.completedShips = completedShips;
      } else {
        results.push({ shipClass: item.shipClass, quantity: item.quantity, completed: false });
      }
    }
    
    // Remove completed items from queue
    planet.data.productionQueue = queue.filter((_: unknown, i: number) => !completedIndices.includes(i));
    await planet.save();
    
    return results;
  }
  
  /**
   * Get production queue for a planet
   */
  static async getProductionQueue(sessionId: string, planetId: string): Promise<unknown[]> {
    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) return [];
    return planet.data.productionQueue || [];
  }
  
  /**
   * Cancel queued production
   */
  static async cancelProduction(
    sessionId: string,
    planetId: string,
    queueId: string
  ): Promise<{ success: boolean; refunded?: Partial<Record<ResourceType, number>>; error?: string }> {
    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) {
      return { success: false, error: 'Planet not found' };
    }
    
    const queue = planet.data.productionQueue || [];
    const itemIndex = queue.findIndex((q: { queueId: string }) => q.queueId === queueId);
    
    if (itemIndex === -1) {
      return { success: false, error: 'Production item not found in queue' };
    }
    
    const item = queue[itemIndex];
    
    // Release reserved resources (80% refund)
    const refunded: Partial<Record<ResourceType, number>> = {};
    if (item.warehouseId && item.cost) {
      const refundItems: Array<{ type: ResourceType; amount: number }> = [
        { type: 'credits', amount: Math.floor(item.cost.credits * 0.8) },
        { type: 'minerals', amount: Math.floor(item.cost.minerals * 0.8) },
        { type: 'shipParts', amount: Math.floor(item.cost.shipParts * 0.8) }
      ];
      
      await WarehouseService.release(sessionId, item.warehouseId, [
        { type: 'credits', amount: item.cost.credits },
        { type: 'minerals', amount: item.cost.minerals },
        { type: 'shipParts', amount: item.cost.shipParts }
      ]);
      
      // The difference (20%) is lost as cancellation penalty
      for (const refundItem of refundItems) {
        refunded[refundItem.type] = refundItem.amount;
      }
    }
    
    // Remove from queue
    queue.splice(itemIndex, 1);
    planet.data.productionQueue = queue;
    await planet.save();
    
    return { success: true, refunded };
  }
}

