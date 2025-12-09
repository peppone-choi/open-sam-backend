import { Warehouse, IWarehouse, ResourceType, ITransactionLog, WarehouseType } from '../../models/gin7/Warehouse';
import { Planet } from '../../models/gin7/Planet';
import { Fleet } from '../../models/gin7/Fleet';
import mongoose, { ClientSession } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface TransferRequest {
  sourceId: string;
  targetId: string;
  items: Array<{ type: ResourceType; amount: number }>;
  executedBy: string;
  note?: string;
}

export interface AllocationRequest {
  planetWarehouseId: string;
  fleetWarehouseId: string;
  items: Array<{ type: ResourceType; amount: number }>;
  executedBy: string;
}

export interface SupplyRequest {
  fleetId: string;
  executedBy: string;
  resourceTypes?: ResourceType[];  // If not specified, supply all
}

export class WarehouseService {
  /**
   * Create a new warehouse
   */
  static async createWarehouse(
    sessionId: string,
    ownerId: string,
    ownerType: WarehouseType,
    options: {
      factionId?: string;
      managerId?: string;
      capacity?: number;
      parentWarehouseId?: string;
      initialItems?: Array<{ type: ResourceType; amount: number }>;
    } = {}
  ): Promise<IWarehouse> {
    const warehouseId = `WH-${ownerType}-${uuidv4().slice(0, 8)}`;
    
    const warehouse = new Warehouse({
      warehouseId,
      sessionId,
      ownerId,
      ownerType,
      parentWarehouseId: options.parentWarehouseId,
      factionId: options.factionId,
      managerId: options.managerId,
      capacity: options.capacity || this.getDefaultCapacity(ownerType),
      items: (options.initialItems || []).map(item => ({
        type: item.type,
        amount: item.amount,
        reserved: 0,
        lastUpdated: new Date()
      }))
    });
    
    await warehouse.save();
    return warehouse;
  }
  
  /**
   * Get default capacity by warehouse type
   */
  private static getDefaultCapacity(ownerType: WarehouseType): number {
    switch (ownerType) {
      case 'PLANET': return 100000;
      case 'FLEET': return 10000;
      case 'UNIT': return 1000;
      default: return 10000;
    }
  }
  
  /**
   * Get warehouse by ID
   */
  static async getWarehouse(sessionId: string, warehouseId: string): Promise<IWarehouse | null> {
    return Warehouse.findOne({ sessionId, warehouseId });
  }
  
  /**
   * Get warehouse by owner
   */
  static async getWarehouseByOwner(
    sessionId: string, 
    ownerId: string, 
    ownerType: WarehouseType
  ): Promise<IWarehouse | null> {
    return Warehouse.findOne({ sessionId, ownerId, ownerType });
  }
  
  /**
   * Get all warehouses for a faction
   */
  static async getFactionWarehouses(
    sessionId: string, 
    factionId: string,
    ownerType?: WarehouseType
  ): Promise<IWarehouse[]> {
    const query: Record<string, unknown> = { sessionId, factionId };
    if (ownerType) query.ownerType = ownerType;
    return Warehouse.find(query);
  }
  
  /**
   * Transfer resources between warehouses (atomic)
   */
  static async transfer(
    sessionId: string,
    request: TransferRequest
  ): Promise<{ success: boolean; error?: string; transactionId?: string }> {
    // Validate amounts
    for (const item of request.items) {
      if (item.amount <= 0) {
        return { success: false, error: `Invalid amount for ${item.type}: ${item.amount}` };
      }
    }
    
    return Warehouse.atomicTransfer(
      sessionId,
      request.sourceId,
      request.targetId,
      request.items,
      request.executedBy
    );
  }
  
  /**
   * Allocate resources from planet to fleet (high-level operation)
   */
  static async allocate(
    sessionId: string,
    request: AllocationRequest
  ): Promise<{ success: boolean; error?: string; transactionId?: string }> {
    // Verify warehouses exist and are of correct types
    const [planetWh, fleetWh] = await Promise.all([
      Warehouse.findOne({ sessionId, warehouseId: request.planetWarehouseId }),
      Warehouse.findOne({ sessionId, warehouseId: request.fleetWarehouseId })
    ]);
    
    if (!planetWh || planetWh.ownerType !== 'PLANET') {
      return { success: false, error: 'Invalid planet warehouse' };
    }
    if (!fleetWh || fleetWh.ownerType !== 'FLEET') {
      return { success: false, error: 'Invalid fleet warehouse' };
    }
    
    // Verify hierarchy (fleet must be at this planet)
    const fleet = await Fleet.findOne({ sessionId, warehouseId: request.fleetWarehouseId });
    if (fleet && fleet.location.planetId !== planetWh.ownerId) {
      return { success: false, error: 'Fleet must be docked at the planet for allocation' };
    }
    
    return this.transfer(sessionId, {
      sourceId: request.planetWarehouseId,
      targetId: request.fleetWarehouseId,
      items: request.items,
      executedBy: request.executedBy,
      note: 'ALLOCATION'
    });
  }
  
  /**
   * Auto-supply fleet from planet warehouse
   */
  static async autoSupply(
    sessionId: string,
    request: SupplyRequest
  ): Promise<{ success: boolean; supplied: Record<ResourceType, number>; error?: string }> {
    const fleet = await Fleet.findOne({ sessionId, fleetId: request.fleetId });
    if (!fleet) {
      return { success: false, supplied: {} as Record<ResourceType, number>, error: 'Fleet not found' };
    }
    
    if (fleet.status !== 'DOCKED' && fleet.status !== 'RESUPPLY') {
      return { success: false, supplied: {} as Record<ResourceType, number>, error: 'Fleet must be docked for resupply' };
    }
    
    const fleetWh = await Warehouse.findOne({ sessionId, ownerId: fleet.fleetId, ownerType: 'FLEET' });
    if (!fleetWh) {
      return { success: false, supplied: {} as Record<ResourceType, number>, error: 'Fleet warehouse not found' };
    }
    
    const planetWh = await Warehouse.findOne({ 
      sessionId, 
      ownerId: fleet.location.planetId, 
      ownerType: 'PLANET' 
    });
    if (!planetWh) {
      return { success: false, supplied: {} as Record<ResourceType, number>, error: 'Planet warehouse not found' };
    }
    
    // Calculate what the fleet needs
    const needed: Array<{ type: ResourceType; amount: number }> = [];
    const resourcesToCheck: ResourceType[] = request.resourceTypes || ['fuel', 'ammo', 'food'];
    
    for (const resType of resourcesToCheck) {
      const fleetItem = fleetWh.items.find(i => i.type === resType);
      const currentAmount = fleetItem ? fleetItem.amount : 0;
      
      // Calculate max capacity for this resource based on fleet units
      let maxNeeded = 0;
      for (const unit of fleet.units) {
        if (resType === 'fuel') maxNeeded += unit.maxFuel * unit.count;
        else if (resType === 'ammo') maxNeeded += unit.maxAmmo * unit.count;
        else maxNeeded += fleetWh.capacity / resourcesToCheck.length;
      }
      
      const deficit = maxNeeded - currentAmount;
      if (deficit > 0) {
        // Check how much planet can provide
        const planetItem = planetWh.items.find(i => i.type === resType);
        const available = planetItem ? (planetItem.amount - planetItem.reserved) : 0;
        const toTransfer = Math.min(deficit, available);
        
        if (toTransfer > 0) {
          needed.push({ type: resType, amount: toTransfer });
        }
      }
    }
    
    if (needed.length === 0) {
      return { success: true, supplied: {} as Record<ResourceType, number> };
    }
    
    const result = await this.transfer(sessionId, {
      sourceId: planetWh.warehouseId,
      targetId: fleetWh.warehouseId,
      items: needed,
      executedBy: request.executedBy,
      note: 'AUTO_SUPPLY'
    });
    
    if (result.success) {
      const supplied = needed.reduce((acc, item) => {
        acc[item.type] = item.amount;
        return acc;
      }, {} as Record<ResourceType, number>);
      return { success: true, supplied };
    }
    
    return { success: false, supplied: {} as Record<ResourceType, number>, error: result.error };
  }
  
  /**
   * Add production output to planet warehouse
   */
  static async addProduction(
    sessionId: string,
    planetId: string,
    production: Partial<Record<ResourceType, number>>,
    session?: ClientSession
  ): Promise<boolean> {
    const warehouse = await Warehouse.findOne(
      { sessionId, ownerId: planetId, ownerType: 'PLANET' },
      null,
      { session }
    );
    
    if (!warehouse) return false;
    
    for (const [type, amount] of Object.entries(production)) {
      if (amount && amount > 0) {
        warehouse.addResource(type as ResourceType, amount);
      }
    }
    
    // Log production
    const txLog: ITransactionLog = {
      transactionId: `PROD-${Date.now()}`,
      timestamp: new Date(),
      type: 'PRODUCTION',
      targetId: warehouse.warehouseId,
      items: Object.entries(production)
        .filter(([, amount]) => amount && amount > 0)
        .map(([type, amount]) => ({ type: type as ResourceType, amount: amount! })),
      executedBy: 'SYSTEM'
    };
    
    warehouse.recentTransactions = [txLog, ...warehouse.recentTransactions].slice(0, 50);
    
    await warehouse.save({ session });
    return true;
  }
  
  /**
   * Reserve resources for pending operations
   */
  static async reserve(
    sessionId: string,
    warehouseId: string,
    items: Array<{ type: ResourceType; amount: number }>
  ): Promise<boolean> {
    const warehouse = await Warehouse.findOne({ sessionId, warehouseId });
    if (!warehouse) return false;
    
    // Verify all items are available
    for (const item of items) {
      const whItem = warehouse.items.find(i => i.type === item.type);
      const available = whItem ? (whItem.amount - whItem.reserved) : 0;
      if (available < item.amount) return false;
    }
    
    // Apply reservations
    for (const item of items) {
      const whItem = warehouse.items.find(i => i.type === item.type);
      if (whItem) {
        whItem.reserved += item.amount;
      }
    }
    
    await warehouse.save();
    return true;
  }
  
  /**
   * Release reserved resources
   */
  static async release(
    sessionId: string,
    warehouseId: string,
    items: Array<{ type: ResourceType; amount: number }>
  ): Promise<boolean> {
    const warehouse = await Warehouse.findOne({ sessionId, warehouseId });
    if (!warehouse) return false;
    
    for (const item of items) {
      const whItem = warehouse.items.find(i => i.type === item.type);
      if (whItem) {
        whItem.reserved = Math.max(0, whItem.reserved - item.amount);
      }
    }
    
    await warehouse.save();
    return true;
  }
  
  /**
   * Consume resources (subtract reserved and actual)
   */
  static async consume(
    sessionId: string,
    warehouseId: string,
    items: Array<{ type: ResourceType; amount: number }>,
    executedBy: string
  ): Promise<boolean> {
    const warehouse = await Warehouse.findOne({ sessionId, warehouseId });
    if (!warehouse) return false;
    
    for (const item of items) {
      const success = warehouse.removeResource(item.type, item.amount, true);
      if (!success) return false;
      
      // Also reduce reserved if any
      const whItem = warehouse.items.find(i => i.type === item.type);
      if (whItem && whItem.reserved > 0) {
        whItem.reserved = Math.max(0, whItem.reserved - item.amount);
      }
    }
    
    // Log consumption
    const txLog: ITransactionLog = {
      transactionId: `CONS-${Date.now()}`,
      timestamp: new Date(),
      type: 'CONSUMPTION',
      sourceId: warehouseId,
      items,
      executedBy
    };
    
    warehouse.recentTransactions = [txLog, ...warehouse.recentTransactions].slice(0, 50);
    
    await warehouse.save();
    return true;
  }
  
  /**
   * Initialize warehouse for a newly owned planet
   */
  static async initializePlanetWarehouse(
    sessionId: string,
    planetId: string,
    factionId: string
  ): Promise<IWarehouse> {
    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) {
      throw new Error('Planet not found');
    }
    
    // Create warehouse with planet's current resources
    return this.createWarehouse(sessionId, planetId, 'PLANET', {
      factionId,
      capacity: 100000,
      initialItems: [
        { type: 'food', amount: planet.resources.food },
        { type: 'minerals', amount: planet.resources.minerals },
        { type: 'energy', amount: planet.resources.energy },
        { type: 'credits', amount: planet.resources.credits }
      ]
    });
  }

  /**
   * 자원 차감 (LogisticsCommandService용)
   */
  static async deductResources(
    sessionId: string,
    ownerId: string,
    items: Array<{ type: ResourceType; amount: number }>,
    executedBy?: string
  ): Promise<boolean> {
    const warehouse = await this.getWarehouseByOwner(sessionId, ownerId, 'PLANET');
    if (!warehouse) {
      throw new Error('Warehouse not found');
    }
    
    // 자원 차감
    return await this.consume(sessionId, warehouse.warehouseId, items, executedBy || 'system');
  }

  /**
   * 함선 전송 (LogisticsCommandService용)
   */
  static async transferShips(
    sessionId: string,
    fromOwnerId: string,
    toOwnerId: string,
    ships: Array<{ type: string; count: number }>
  ): Promise<{ transferred: number; error?: string }> {
    // TODO: 실제 함선 전송 로직 구현
    const totalTransferred = ships.reduce((sum, s) => sum + s.count, 0);
    return { transferred: totalTransferred };
  }

  /**
   * 화물 적재 (LogisticsCommandService용)
   */
  static async loadCargo(
    sessionId: string,
    planetId: string,
    fleetId: string,
    resources: Array<{ type: ResourceType; amount: number }>
  ): Promise<void> {
    const planetWarehouse = await this.getWarehouseByOwner(sessionId, planetId, 'PLANET');
    const fleetWarehouse = await this.getWarehouseByOwner(sessionId, fleetId, 'FLEET');
    
    if (!planetWarehouse || !fleetWarehouse) {
      throw new Error('Warehouse not found');
    }
    
    await this.transfer(sessionId, {
      sourceId: planetWarehouse.warehouseId,
      targetId: fleetWarehouse.warehouseId,
      items: resources,
      executedBy: 'system'
    });
  }

  /**
   * 화물 하역 (LogisticsCommandService용)
   */
  static async unloadCargo(
    sessionId: string,
    fleetId: string,
    planetId: string,
    resources: Array<{ type: ResourceType; amount: number }>
  ): Promise<void> {
    const fleetWarehouse = await this.getWarehouseByOwner(sessionId, fleetId, 'FLEET');
    const planetWarehouse = await this.getWarehouseByOwner(sessionId, planetId, 'PLANET');
    
    if (!fleetWarehouse || !planetWarehouse) {
      throw new Error('Warehouse not found');
    }
    
    await this.transfer(sessionId, {
      sourceId: fleetWarehouse.warehouseId,
      targetId: planetWarehouse.warehouseId,
      items: resources,
      executedBy: 'system'
    });
  }
}

