import { Router, Request, Response, NextFunction } from 'express';
import { WarehouseService } from '../../services/gin7/WarehouseService';
import { FleetService } from '../../services/gin7/FleetService';
import { ProductionService } from '../../services/gin7/ProductionService';
import { Warehouse, ResourceType, WarehouseType } from '../../models/gin7/Warehouse';
import { Fleet, SHIP_SPECS, ShipClass } from '../../models/gin7/Fleet';

const router = Router();

// ============================================
// Warehouse Routes
// ============================================

/**
 * GET /api/gin7/warehouse/:id
 * Get warehouse by ID
 */
router.get('/warehouse/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const sessionId = req.headers['x-session-id'] as string;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }
    
    const warehouse = await WarehouseService.getWarehouse(sessionId, id);
    
    if (!warehouse) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }
    
    return res.json(warehouse);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/gin7/warehouse/owner/:ownerId
 * Get warehouse by owner
 */
router.get('/warehouse/owner/:ownerId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ownerId } = req.params;
    const { ownerType } = req.query;
    const sessionId = req.headers['x-session-id'] as string;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }
    
    if (!ownerType || !['PLANET', 'FLEET', 'UNIT'].includes(ownerType as string)) {
      return res.status(400).json({ error: 'Valid ownerType required (PLANET, FLEET, UNIT)' });
    }
    
    const warehouse = await WarehouseService.getWarehouseByOwner(
      sessionId, 
      ownerId, 
      ownerType as WarehouseType
    );
    
    if (!warehouse) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }
    
    return res.json(warehouse);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/gin7/warehouse/faction/:factionId
 * Get all warehouses for a faction
 */
router.get('/warehouse/faction/:factionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { factionId } = req.params;
    const { ownerType } = req.query;
    const sessionId = req.headers['x-session-id'] as string;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }
    
    const warehouses = await WarehouseService.getFactionWarehouses(
      sessionId,
      factionId,
      ownerType as WarehouseType | undefined
    );
    
    return res.json(warehouses);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/gin7/warehouse/transfer
 * Transfer resources between warehouses
 */
router.post('/warehouse/transfer', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sourceId, targetId, items, note } = req.body;
    const sessionId = req.headers['x-session-id'] as string;
    const executedBy = req.headers['x-character-id'] as string;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }
    
    if (!executedBy) {
      return res.status(400).json({ error: 'Character ID required' });
    }
    
    if (!sourceId || !targetId || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'sourceId, targetId, and items[] required' });
    }
    
    // Validate items
    for (const item of items) {
      if (!item.type || typeof item.amount !== 'number' || item.amount <= 0) {
        return res.status(400).json({ error: 'Each item must have type and positive amount' });
      }
    }
    
    const result = await WarehouseService.transfer(sessionId, {
      sourceId,
      targetId,
      items: items as Array<{ type: ResourceType; amount: number }>,
      executedBy,
      note
    });
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    return res.json({ 
      success: true, 
      transactionId: result.transactionId,
      message: 'Transfer completed successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/gin7/warehouse/allocate
 * Allocate resources from planet to fleet
 */
router.post('/warehouse/allocate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planetWarehouseId, fleetWarehouseId, items } = req.body;
    const sessionId = req.headers['x-session-id'] as string;
    const executedBy = req.headers['x-character-id'] as string;
    
    if (!sessionId || !executedBy) {
      return res.status(400).json({ error: 'Session ID and Character ID required' });
    }
    
    if (!planetWarehouseId || !fleetWarehouseId || !items) {
      return res.status(400).json({ error: 'planetWarehouseId, fleetWarehouseId, and items required' });
    }
    
    const result = await WarehouseService.allocate(sessionId, {
      planetWarehouseId,
      fleetWarehouseId,
      items: items as Array<{ type: ResourceType; amount: number }>,
      executedBy
    });
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    return res.json({ 
      success: true, 
      transactionId: result.transactionId 
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Fleet Routes
// ============================================

/**
 * GET /api/gin7/fleet/:id
 * Get fleet by ID
 */
router.get('/fleet/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const sessionId = req.headers['x-session-id'] as string;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }
    
    const fleet = await FleetService.getFleet(sessionId, id);
    
    if (!fleet) {
      return res.status(404).json({ error: 'Fleet not found' });
    }
    
    // Calculate combat power
    const combatPower = FleetService.calculateCombatPower(fleet);
    
    return res.json({ 
      ...fleet.toObject(), 
      combatPower 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/gin7/fleet/commander/:commanderId
 * Get all fleets for a commander
 */
router.get('/fleet/commander/:commanderId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { commanderId } = req.params;
    const sessionId = req.headers['x-session-id'] as string;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }
    
    const fleets = await FleetService.getCommanderFleets(sessionId, commanderId);
    
    return res.json(fleets.map(f => ({
      ...f.toObject(),
      combatPower: FleetService.calculateCombatPower(f)
    })));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/gin7/fleet/faction/:factionId
 * Get all fleets for a faction
 */
router.get('/fleet/faction/:factionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { factionId } = req.params;
    const sessionId = req.headers['x-session-id'] as string;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }
    
    const fleets = await FleetService.getFactionFleets(sessionId, factionId);
    
    return res.json(fleets.map(f => ({
      ...f.toObject(),
      combatPower: FleetService.calculateCombatPower(f)
    })));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/gin7/fleet/create
 * Create a new fleet
 */
router.post('/fleet/create', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { commanderId, factionId, name, callsign, location, units } = req.body;
    const sessionId = req.headers['x-session-id'] as string;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }
    
    if (!commanderId || !factionId || !name || !location) {
      return res.status(400).json({ error: 'commanderId, factionId, name, and location required' });
    }
    
    const fleet = await FleetService.createFleet({
      sessionId,
      commanderId,
      factionId,
      name,
      callsign,
      location,
      units
    });
    
    return res.status(201).json(fleet);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/gin7/fleet/organize
 * Organize/reorganize fleet units
 */
router.post('/fleet/organize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fleetId, units } = req.body;
    const sessionId = req.headers['x-session-id'] as string;
    const executedBy = req.headers['x-character-id'] as string;
    
    if (!sessionId || !executedBy) {
      return res.status(400).json({ error: 'Session ID and Character ID required' });
    }
    
    if (!fleetId || !units || !Array.isArray(units)) {
      return res.status(400).json({ error: 'fleetId and units[] required' });
    }
    
    // Validate units
    for (const unit of units) {
      if (!unit.shipClass || typeof unit.count !== 'number' || unit.count <= 0) {
        return res.status(400).json({ error: 'Each unit must have shipClass and positive count' });
      }
      if (!SHIP_SPECS[unit.shipClass as ShipClass]) {
        return res.status(400).json({ error: `Invalid ship class: ${unit.shipClass}` });
      }
    }
    
    const fleet = await FleetService.organizeFleet({
      fleetId,
      sessionId,
      units: units as Array<{ shipClass: ShipClass; count: number }>,
      executedBy
    });
    
    return res.json({
      success: true,
      fleet,
      combatPower: FleetService.calculateCombatPower(fleet)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/gin7/fleet/supply
 * Supply fleet from planet warehouse
 */
router.post('/fleet/supply', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fleetId, resourceTypes } = req.body;
    const sessionId = req.headers['x-session-id'] as string;
    const executedBy = req.headers['x-character-id'] as string;
    
    if (!sessionId || !executedBy) {
      return res.status(400).json({ error: 'Session ID and Character ID required' });
    }
    
    if (!fleetId) {
      return res.status(400).json({ error: 'fleetId required' });
    }
    
    const result = await FleetService.supplyFleet(
      sessionId, 
      fleetId, 
      executedBy,
      resourceTypes as ResourceType[] | undefined
    );
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    return res.json({
      success: true,
      supplied: result.supplied,
      message: 'Fleet resupplied successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/gin7/fleet/merge
 * Merge two fleets
 */
router.post('/fleet/merge', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sourceFleetId, targetFleetId } = req.body;
    const sessionId = req.headers['x-session-id'] as string;
    const executedBy = req.headers['x-character-id'] as string;
    
    if (!sessionId || !executedBy) {
      return res.status(400).json({ error: 'Session ID and Character ID required' });
    }
    
    if (!sourceFleetId || !targetFleetId) {
      return res.status(400).json({ error: 'sourceFleetId and targetFleetId required' });
    }
    
    const mergedFleet = await FleetService.mergeFleets({
      sourceFleetId,
      targetFleetId,
      sessionId,
      executedBy
    });
    
    return res.json({
      success: true,
      fleet: mergedFleet,
      combatPower: FleetService.calculateCombatPower(mergedFleet)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/gin7/fleet/split
 * Split a fleet into two
 */
router.post('/fleet/split', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sourceFleetId, newName, newCommanderId, unitsToSplit } = req.body;
    const sessionId = req.headers['x-session-id'] as string;
    const executedBy = req.headers['x-character-id'] as string;
    
    if (!sessionId || !executedBy) {
      return res.status(400).json({ error: 'Session ID and Character ID required' });
    }
    
    if (!sourceFleetId || !newName || !newCommanderId || !unitsToSplit) {
      return res.status(400).json({ 
        error: 'sourceFleetId, newName, newCommanderId, and unitsToSplit required' 
      });
    }
    
    const result = await FleetService.splitFleet({
      sourceFleetId,
      sessionId,
      newName,
      newCommanderId,
      unitsToSplit: unitsToSplit as Array<{ shipClass: ShipClass; count: number }>,
      executedBy
    });
    
    return res.json({
      success: true,
      source: {
        ...result.source.toObject(),
        combatPower: FleetService.calculateCombatPower(result.source)
      },
      newFleet: {
        ...result.newFleet.toObject(),
        combatPower: FleetService.calculateCombatPower(result.newFleet)
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Production Routes
// ============================================

/**
 * GET /api/gin7/production/:planetId
 * Get production info for a planet
 */
router.get('/production/:planetId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planetId } = req.params;
    const sessionId = req.headers['x-session-id'] as string;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }
    
    const { Planet } = await import('../../models/gin7/Planet');
    const planet = await Planet.findOne({ sessionId, planetId });
    
    if (!planet) {
      return res.status(404).json({ error: 'Planet not found' });
    }
    
    const production = ProductionService.calculatePlanetProduction(planet);
    const queue = await ProductionService.getProductionQueue(sessionId, planetId);
    
    return res.json({
      planetId,
      currentProduction: production,
      productionQueue: queue,
      completedShips: planet.data.completedShips || []
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/gin7/production/queue
 * Queue ship production
 */
router.post('/production/queue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planetId, shipClass, quantity } = req.body;
    const sessionId = req.headers['x-session-id'] as string;
    const executedBy = req.headers['x-character-id'] as string;
    
    if (!sessionId || !executedBy) {
      return res.status(400).json({ error: 'Session ID and Character ID required' });
    }
    
    if (!planetId || !shipClass || !quantity) {
      return res.status(400).json({ error: 'planetId, shipClass, and quantity required' });
    }
    
    if (!SHIP_SPECS[shipClass as ShipClass]) {
      return res.status(400).json({ error: `Invalid ship class: ${shipClass}` });
    }
    
    if (quantity <= 0 || quantity > 100) {
      return res.status(400).json({ error: 'Quantity must be between 1 and 100' });
    }
    
    const result = await ProductionService.queueShipProduction(
      sessionId,
      planetId,
      shipClass,
      quantity,
      executedBy
    );
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    return res.status(201).json({
      success: true,
      queueId: result.queueId,
      message: 'Production queued successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/gin7/production/queue/:queueId
 * Cancel queued production
 */
router.delete('/production/queue/:queueId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { queueId } = req.params;
    const { planetId } = req.body;
    const sessionId = req.headers['x-session-id'] as string;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }
    
    if (!planetId) {
      return res.status(400).json({ error: 'planetId required in body' });
    }
    
    const result = await ProductionService.cancelProduction(sessionId, planetId, queueId);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    return res.json({
      success: true,
      refunded: result.refunded,
      message: 'Production cancelled, resources partially refunded'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/gin7/ship-specs
 * Get all ship specifications
 */
router.get('/ship-specs', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json(SHIP_SPECS);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/gin7/ship-specs/:shipClass
 * Get specification for a specific ship class
 */
router.get('/ship-specs/:shipClass', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shipClass } = req.params;
    
    const spec = SHIP_SPECS[shipClass as ShipClass];
    if (!spec) {
      return res.status(404).json({ error: 'Ship class not found' });
    }
    
    return res.json(spec);
  } catch (error) {
    next(error);
  }
});

export default router;

