import { Fleet, IFleet, IShipUnit, ShipClass, FleetStatus, SHIP_SPECS } from '../../models/gin7/Fleet';
import { Warehouse, ResourceType } from '../../models/gin7/Warehouse';
import { WarehouseService } from './WarehouseService';
import { v4 as uuidv4 } from 'uuid';

export interface CreateFleetRequest {
  sessionId: string;
  commanderId: string;
  factionId: string;
  name: string;
  callsign?: string;
  location: {
    type: 'SYSTEM' | 'PLANET';
    systemId?: string;
    planetId?: string;
  };
  units?: Array<{
    shipClass: ShipClass;
    count: number;
  }>;
}

export interface OrganizeFleetRequest {
  fleetId: string;
  sessionId: string;
  units: Array<{
    shipClass: ShipClass;
    count: number;
  }>;
  executedBy: string;
}

export interface MergeFleetRequest {
  sourceFleetId: string;
  targetFleetId: string;
  sessionId: string;
  executedBy: string;
}

export interface SplitFleetRequest {
  sourceFleetId: string;
  sessionId: string;
  newName: string;
  newCommanderId: string;
  unitsToSplit: Array<{
    shipClass: ShipClass;
    count: number;
  }>;
  executedBy: string;
}

export class FleetService {
  /**
   * Create a new fleet
   */
  static async createFleet(request: CreateFleetRequest): Promise<IFleet> {
    const fleetId = `FLT-${uuidv4().slice(0, 8)}`;
    
    // Calculate total ships
    const totalShips = (request.units || []).reduce((sum, u) => sum + u.count, 0);
    if (totalShips > 300) {
      throw new Error('Fleet cannot exceed 300 ships');
    }
    
    // Create units with full resource allocation
    const units: IShipUnit[] = (request.units || []).map(u => {
      const spec = SHIP_SPECS[u.shipClass];
      return {
        unitId: `UNIT-${uuidv4().slice(0, 8)}`,
        shipClass: u.shipClass,
        count: u.count,
        hp: 100,
        morale: 100,
        fuel: spec.fuelConsumption * 10 * u.count,  // 10 turns worth
        maxFuel: spec.fuelConsumption * 10 * u.count,
        ammo: spec.ammoConsumption * 10 * u.count,  // 10 combat turns worth
        maxAmmo: spec.ammoConsumption * 10 * u.count,
        crewCount: spec.crewCapacity * u.count,
        maxCrew: spec.crewCapacity * u.count,
        veterancy: 0,
        destroyed: 0,
        damaged: 0
      };
    });
    
    const fleet = new Fleet({
      fleetId,
      sessionId: request.sessionId,
      commanderId: request.commanderId,
      factionId: request.factionId,
      name: request.name,
      callsign: request.callsign,
      status: 'IDLE',
      location: request.location,
      units,
      totalShips
    });
    
    await fleet.save();
    
    // Create associated warehouse
    await WarehouseService.createWarehouse(
      request.sessionId,
      fleetId,
      'FLEET',
      {
        factionId: request.factionId,
        capacity: this.calculateFleetCargoCapacity(units)
      }
    );
    
    // Update fleet with warehouse ID
    const warehouse = await Warehouse.findOne({ 
      sessionId: request.sessionId, 
      ownerId: fleetId, 
      ownerType: 'FLEET' 
    });
    if (warehouse) {
      fleet.warehouseId = warehouse.warehouseId;
      await fleet.save();
    }
    
    return fleet;
  }
  
  /**
   * Calculate total cargo capacity for fleet
   */
  private static calculateFleetCargoCapacity(units: IShipUnit[]): number {
    return units.reduce((sum, unit) => {
      const spec = SHIP_SPECS[unit.shipClass];
      return sum + (spec.cargoCapacity * unit.count);
    }, 0);
  }
  
  /**
   * Get fleet by ID
   */
  static async getFleet(sessionId: string, fleetId: string): Promise<IFleet | null> {
    return Fleet.findOne({ sessionId, fleetId });
  }
  
  /**
   * Get all fleets for a commander
   */
  static async getCommanderFleets(sessionId: string, commanderId: string): Promise<IFleet[]> {
    return Fleet.find({ sessionId, commanderId });
  }
  
  /**
   * Get all fleets for a faction
   */
  static async getFactionFleets(sessionId: string, factionId: string): Promise<IFleet[]> {
    return Fleet.find({ sessionId, factionId });
  }
  
  /**
   * Get fleets at a location
   */
  static async getFleetsAtLocation(
    sessionId: string,
    locationType: 'SYSTEM' | 'PLANET',
    locationId: string
  ): Promise<IFleet[]> {
    const query: Record<string, unknown> = { sessionId };
    if (locationType === 'SYSTEM') {
      query['location.systemId'] = locationId;
    } else {
      query['location.planetId'] = locationId;
    }
    return Fleet.find(query);
  }
  
  /**
   * Organize/reorganize fleet units
   */
  static async organizeFleet(request: OrganizeFleetRequest): Promise<IFleet> {
    const fleet = await Fleet.findOne({ sessionId: request.sessionId, fleetId: request.fleetId });
    if (!fleet) {
      throw new Error('Fleet not found');
    }
    
    // Check if fleet can be reorganized
    if (fleet.isLocked) {
      throw new Error(`Fleet is locked: ${fleet.lockedReason}`);
    }
    if (fleet.status === 'COMBAT' || fleet.status === 'MOVING' || fleet.status === 'WARPING') {
      throw new Error('Cannot reorganize fleet during combat or movement');
    }
    
    // Validate total ships
    const totalShips = request.units.reduce((sum, u) => sum + u.count, 0);
    if (totalShips > fleet.maxShips) {
      throw new Error(`Fleet cannot exceed ${fleet.maxShips} ships`);
    }
    
    // Validate unit types
    if (request.units.length > fleet.maxUnits) {
      throw new Error(`Fleet cannot have more than ${fleet.maxUnits} unit types`);
    }
    
    // Lock fleet during reorganization
    fleet.isLocked = true;
    fleet.lockedReason = 'REORGANIZATION';
    fleet.status = 'REORG';
    
    // Create new units
    const newUnits: IShipUnit[] = request.units.map(u => {
      // Try to preserve existing unit data
      const existingUnit = fleet.units.find(eu => eu.shipClass === u.shipClass);
      const spec = SHIP_SPECS[u.shipClass];
      
      if (existingUnit) {
        // Scale resources proportionally
        const ratio = u.count / existingUnit.count;
        return {
          ...existingUnit,
          unitId: existingUnit.unitId,
          count: u.count,
          fuel: Math.floor(existingUnit.fuel * ratio),
          maxFuel: spec.fuelConsumption * 10 * u.count,
          ammo: Math.floor(existingUnit.ammo * ratio),
          maxAmmo: spec.ammoConsumption * 10 * u.count,
          crewCount: Math.floor(existingUnit.crewCount * ratio),
          maxCrew: spec.crewCapacity * u.count
        };
      }
      
      // New unit type
      return {
        unitId: `UNIT-${uuidv4().slice(0, 8)}`,
        shipClass: u.shipClass,
        count: u.count,
        hp: 100,
        morale: 100,
        fuel: spec.fuelConsumption * 10 * u.count,
        maxFuel: spec.fuelConsumption * 10 * u.count,
        ammo: spec.ammoConsumption * 10 * u.count,
        maxAmmo: spec.ammoConsumption * 10 * u.count,
        crewCount: spec.crewCapacity * u.count,
        maxCrew: spec.crewCapacity * u.count,
        veterancy: 0,
        destroyed: 0,
        damaged: 0
      };
    });
    
    fleet.units = newUnits;
    fleet.totalShips = totalShips;
    
    // Unlock fleet
    fleet.isLocked = false;
    fleet.lockedReason = undefined;
    fleet.status = 'IDLE';
    
    await fleet.save();
    return fleet;
  }
  
  /**
   * Merge two fleets
   */
  static async mergeFleets(request: MergeFleetRequest): Promise<IFleet> {
    const [source, target] = await Promise.all([
      Fleet.findOne({ sessionId: request.sessionId, fleetId: request.sourceFleetId }),
      Fleet.findOne({ sessionId: request.sessionId, fleetId: request.targetFleetId })
    ]);
    
    if (!source || !target) {
      throw new Error('Fleet not found');
    }
    
    if (source.factionId !== target.factionId) {
      throw new Error('Cannot merge fleets from different factions');
    }
    
    if (source.isLocked || target.isLocked) {
      throw new Error('One or both fleets are locked');
    }
    
    // Check total ship limit
    const totalShips = source.totalShips + target.totalShips;
    if (totalShips > target.maxShips) {
      throw new Error(`Merged fleet would exceed ${target.maxShips} ships`);
    }
    
    // Merge units
    for (const sourceUnit of source.units) {
      const targetUnit = target.units.find(u => u.shipClass === sourceUnit.shipClass);
      
      if (targetUnit) {
        // Combine existing unit type
        const totalCount = targetUnit.count + sourceUnit.count;
        const ratio = sourceUnit.count / totalCount;
        
        targetUnit.count = totalCount;
        targetUnit.hp = Math.floor(targetUnit.hp * (1 - ratio) + sourceUnit.hp * ratio);
        targetUnit.morale = Math.floor(targetUnit.morale * (1 - ratio) + sourceUnit.morale * ratio);
        targetUnit.fuel += sourceUnit.fuel;
        targetUnit.maxFuel += sourceUnit.maxFuel;
        targetUnit.ammo += sourceUnit.ammo;
        targetUnit.maxAmmo += sourceUnit.maxAmmo;
        targetUnit.crewCount += sourceUnit.crewCount;
        targetUnit.maxCrew += sourceUnit.maxCrew;
        targetUnit.veterancy = Math.floor(targetUnit.veterancy * (1 - ratio) + sourceUnit.veterancy * ratio);
      } else if (target.units.length < target.maxUnits) {
        // Add new unit type
        target.units.push({ ...sourceUnit });
      } else {
        throw new Error('Target fleet cannot accommodate more unit types');
      }
    }
    
    // Transfer warehouse contents
    if (source.warehouseId && target.warehouseId) {
      const sourceWh = await Warehouse.findOne({ 
        sessionId: request.sessionId, 
        warehouseId: source.warehouseId 
      });
      
      if (sourceWh && sourceWh.items.length > 0) {
        await WarehouseService.transfer(request.sessionId, {
          sourceId: source.warehouseId,
          targetId: target.warehouseId,
          items: sourceWh.items
            .filter(i => i.amount > 0)
            .map(i => ({ type: i.type, amount: i.amount })),
          executedBy: request.executedBy,
          note: 'FLEET_MERGE'
        });
      }
    }
    
    // Combine combat stats
    target.combatStats.battlesWon += source.combatStats.battlesWon;
    target.combatStats.battlesLost += source.combatStats.battlesLost;
    target.combatStats.shipsDestroyed += source.combatStats.shipsDestroyed;
    target.combatStats.shipsLost += source.combatStats.shipsLost;
    target.combatStats.damageDealt += source.combatStats.damageDealt;
    target.combatStats.damageTaken += source.combatStats.damageTaken;
    
    // Delete source fleet and its warehouse
    await Fleet.deleteOne({ sessionId: request.sessionId, fleetId: request.sourceFleetId });
    if (source.warehouseId) {
      await Warehouse.deleteOne({ sessionId: request.sessionId, warehouseId: source.warehouseId });
    }
    
    await target.save();
    return target;
  }
  
  /**
   * Split fleet into two
   */
  static async splitFleet(request: SplitFleetRequest): Promise<{ source: IFleet; newFleet: IFleet }> {
    const source = await Fleet.findOne({ sessionId: request.sessionId, fleetId: request.sourceFleetId });
    if (!source) {
      throw new Error('Source fleet not found');
    }
    
    if (source.isLocked) {
      throw new Error(`Fleet is locked: ${source.lockedReason}`);
    }
    
    // Validate units to split
    for (const splitUnit of request.unitsToSplit) {
      const sourceUnit = source.units.find(u => u.shipClass === splitUnit.shipClass);
      if (!sourceUnit || sourceUnit.count < splitUnit.count) {
        throw new Error(`Insufficient ${splitUnit.shipClass} ships to split`);
      }
    }
    
    // Create new fleet
    const newFleet = await this.createFleet({
      sessionId: request.sessionId,
      commanderId: request.newCommanderId,
      factionId: source.factionId,
      name: request.newName,
      location: source.location as { type: 'SYSTEM' | 'PLANET'; systemId?: string; planetId?: string },
      units: request.unitsToSplit
    });
    
    // Copy relevant data from source to new units
    for (const newUnit of newFleet.units) {
      const sourceUnit = source.units.find(u => u.shipClass === newUnit.shipClass);
      if (sourceUnit) {
        // Calculate ratio for resource distribution
        const ratio = newUnit.count / sourceUnit.count;
        
        newUnit.hp = sourceUnit.hp;
        newUnit.morale = sourceUnit.morale;
        newUnit.fuel = Math.floor(sourceUnit.fuel * ratio);
        newUnit.ammo = Math.floor(sourceUnit.ammo * ratio);
        newUnit.crewCount = Math.floor(sourceUnit.crewCount * ratio);
        newUnit.veterancy = sourceUnit.veterancy;
        
        // Reduce source unit
        sourceUnit.count -= newUnit.count;
        sourceUnit.fuel -= newUnit.fuel;
        sourceUnit.ammo -= newUnit.ammo;
        sourceUnit.crewCount -= newUnit.crewCount;
        sourceUnit.maxFuel = SHIP_SPECS[sourceUnit.shipClass].fuelConsumption * 10 * sourceUnit.count;
        sourceUnit.maxAmmo = SHIP_SPECS[sourceUnit.shipClass].ammoConsumption * 10 * sourceUnit.count;
        sourceUnit.maxCrew = SHIP_SPECS[sourceUnit.shipClass].crewCapacity * sourceUnit.count;
      }
    }
    
    // Remove empty units from source
    source.units = source.units.filter(u => u.count > 0);
    
    await Promise.all([source.save(), newFleet.save()]);
    
    return { source, newFleet };
  }
  
  /**
   * Supply fleet from planet warehouse
   */
  static async supplyFleet(
    sessionId: string,
    fleetId: string,
    executedBy: string,
    resourceTypes?: ResourceType[]
  ): Promise<{ success: boolean; supplied: Record<ResourceType, number>; error?: string }> {
    return WarehouseService.autoSupply(sessionId, {
      fleetId,
      executedBy,
      resourceTypes
    });
  }
  
  /**
   * Update fleet status
   */
  static async updateStatus(
    sessionId: string,
    fleetId: string,
    status: FleetStatus,
    statusData?: Record<string, unknown>
  ): Promise<IFleet | null> {
    return Fleet.findOneAndUpdate(
      { sessionId, fleetId },
      { 
        status, 
        statusData: statusData || {},
        ...(status === 'DOCKED' && { isLocked: false, lockedReason: undefined })
      },
      { new: true }
    );
  }
  
  /**
   * Lock fleet for operation
   */
  static async lockFleet(
    sessionId: string,
    fleetId: string,
    reason: string,
    durationMs: number = 60000
  ): Promise<boolean> {
    const result = await Fleet.updateOne(
      { sessionId, fleetId, isLocked: false },
      { 
        isLocked: true, 
        lockedReason: reason,
        lockedUntil: new Date(Date.now() + durationMs)
      }
    );
    return result.modifiedCount > 0;
  }
  
  /**
   * Unlock fleet
   */
  static async unlockFleet(sessionId: string, fleetId: string): Promise<boolean> {
    const result = await Fleet.updateOne(
      { sessionId, fleetId },
      { isLocked: false, lockedReason: undefined, lockedUntil: undefined }
    );
    return result.modifiedCount > 0;
  }
  
  /**
   * Consume fleet resources (fuel/ammo) for a turn or combat
   */
  static async consumeResources(
    sessionId: string,
    fleetId: string,
    type: 'movement' | 'combat'
  ): Promise<{ success: boolean; error?: string }> {
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) {
      return { success: false, error: 'Fleet not found' };
    }
    
    for (const unit of fleet.units) {
      const spec = SHIP_SPECS[unit.shipClass];
      
      if (type === 'movement') {
        unit.fuel = Math.max(0, unit.fuel - spec.fuelConsumption * unit.count);
      } else if (type === 'combat') {
        unit.fuel = Math.max(0, unit.fuel - spec.fuelConsumption * unit.count);
        unit.ammo = Math.max(0, unit.ammo - spec.ammoConsumption * unit.count);
      }
    }
    
    await fleet.save();
    return { success: true };
  }
  
  /**
   * Get fleet combat power
   */
  static calculateCombatPower(fleet: IFleet): number {
    const basePower: Record<ShipClass, number> = {
      flagship: 100,
      battleship: 80,
      carrier: 70,
      cruiser: 50,
      destroyer: 30,
      frigate: 20,
      corvette: 10,
      transport: 5,
      landing: 5,
      engineering: 5
    };
    
    return fleet.units.reduce((sum, unit) => {
      const base = basePower[unit.shipClass] || 10;
      const hpMod = unit.hp / 100;
      const moraleMod = 0.5 + (unit.morale / 200);
      const vetMod = 1 + (unit.veterancy / 100);
      return sum + (base * unit.count * hpMod * moraleMod * vetMod);
    }, 0);
  }
}

