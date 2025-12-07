import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { WarpTravel, IWarpTravel, WarpState } from '../../models/gin7/WarpTravel';
import { GalaxyGrid, GRID_CONSTANTS } from '../../models/gin7/GalaxyGrid';
import { TimeEngine, GIN7_EVENTS } from '../../core/gin7/TimeEngine';
import { logger } from '../../common/logger';
import { getSocketManager } from '../../socket/socketManager';

// Events for warp navigation
export const WARP_EVENTS = {
  WARP_REQUESTED: 'GIN7:WARP_REQUESTED',
  WARP_CHARGING: 'GIN7:WARP_CHARGING',
  WARP_STARTED: 'GIN7:WARP_STARTED',
  WARP_COMPLETED: 'GIN7:WARP_COMPLETED',
  WARP_MISJUMP: 'GIN7:WARP_MISJUMP',
  WARP_CANCELLED: 'GIN7:WARP_CANCELLED',
  WARP_FAILED: 'GIN7:WARP_FAILED',
} as const;

// Warp calculation constants
export const WARP_CONSTANTS = {
  BASE_CHARGE_TIME: 10,         // Base ticks to charge
  BASE_WARP_SPEED: 10,          // Light-years per tick at engine level 1
  COOLING_TIME: 5,              // Ticks for cooling
  MISJUMP_BASE_CHANCE: 0.05,    // 5% base misjump chance
  MISJUMP_DISTANCE_FACTOR: 0.001, // Additional chance per light-year
  MAX_MISJUMP_OFFSET: 5,        // Max grids off target
  ENGINE_LEVEL_MULTIPLIER: 0.15, // Each level adds 15% speed
} as const;

export interface WarpRequest {
  sessionId: string;
  unitId: string;
  factionId: string;
  origin: {
    gridX: number;
    gridY: number;
    systemId?: string;
    planetId?: string;
  };
  destination: {
    gridX: number;
    gridY: number;
    systemId?: string;
    planetId?: string;
  };
  engineLevel: number;
}

export interface WarpResult {
  success: boolean;
  travelId?: string;
  estimatedDuration?: number;
  error?: string;
  errorCode?: string;
}

/**
 * WarpNavigationService
 * 
 * Handles all warp navigation logic:
 * - Distance calculation
 * - Warp time calculation
 * - Misjump calculation
 * - State machine transitions
 */
export class WarpNavigationService extends EventEmitter {
  private static instance: WarpNavigationService;
  private activeWarps: Map<string, IWarpTravel> = new Map();
  private tickListener: ((payload: any) => void) | null = null;

  private constructor() {
    super();
    this.setMaxListeners(50);
  }

  public static getInstance(): WarpNavigationService {
    if (!WarpNavigationService.instance) {
      WarpNavigationService.instance = new WarpNavigationService();
    }
    return WarpNavigationService.instance;
  }

  /**
   * Initialize the service and subscribe to time events
   */
  public async initialize(): Promise<void> {
    const timeEngine = TimeEngine.getInstance();
    
    // Subscribe to time ticks to process warp state transitions
    this.tickListener = (payload) => this.processTick(payload);
    timeEngine.on(GIN7_EVENTS.TIME_TICK, this.tickListener);
    
    // Load active warps from DB
    await this.loadActiveWarps();
    
    logger.info('[WarpNavigationService] Initialized');
  }

  /**
   * Cleanup
   */
  public async shutdown(): Promise<void> {
    if (this.tickListener) {
      const timeEngine = TimeEngine.getInstance();
      timeEngine.off(GIN7_EVENTS.TIME_TICK, this.tickListener);
    }
    logger.info('[WarpNavigationService] Shutdown');
  }

  /**
   * Load active warps from database
   */
  private async loadActiveWarps(): Promise<void> {
    try {
      const activeWarps = await WarpTravel.find({
        status: 'in_progress'
      });
      
      for (const warp of activeWarps) {
        this.activeWarps.set(warp.travelId, warp);
      }
      
      logger.info(`[WarpNavigationService] Loaded ${activeWarps.length} active warps`);
    } catch (error) {
      logger.error('[WarpNavigationService] Failed to load active warps:', error);
    }
  }

  /**
   * Calculate distance between two grid points (in light-years)
   * Using Euclidean distance, each grid = 100 light-years
   */
  public calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const gridDistance = Math.sqrt(dx * dx + dy * dy);
    return gridDistance * 100; // Each grid = 100 light-years
  }

  /**
   * Calculate warp time based on distance and engine level
   * Formula: baseDuration = distance / (baseSpeed * (1 + engineLevel * multiplier))
   */
  public calculateWarpTime(distance: number, engineLevel: number): number {
    const speedMultiplier = 1 + (engineLevel * WARP_CONSTANTS.ENGINE_LEVEL_MULTIPLIER);
    const effectiveSpeed = WARP_CONSTANTS.BASE_WARP_SPEED * speedMultiplier;
    const warpTime = Math.ceil(distance / effectiveSpeed);
    return Math.max(1, warpTime); // Minimum 1 tick
  }

  /**
   * Calculate misjump probability and offset
   * Chance increases with distance, decreases with engine level
   */
  public calculateMisjump(distance: number, engineLevel: number): { hasMisjump: boolean; offset?: { x: number; y: number } } {
    // Base chance + distance factor, reduced by engine level
    const engineReduction = engineLevel * 0.01; // Each level reduces by 1%
    const chance = Math.max(0, 
      WARP_CONSTANTS.MISJUMP_BASE_CHANCE + 
      (distance * WARP_CONSTANTS.MISJUMP_DISTANCE_FACTOR) - 
      engineReduction
    );
    
    const roll = Math.random();
    if (roll > chance) {
      return { hasMisjump: false };
    }
    
    // Calculate random offset
    const maxOffset = Math.min(
      WARP_CONSTANTS.MAX_MISJUMP_OFFSET,
      Math.ceil(distance / 200) // Longer distances = potentially larger misjumps
    );
    
    const offsetX = Math.floor(Math.random() * (maxOffset * 2 + 1)) - maxOffset;
    const offsetY = Math.floor(Math.random() * (maxOffset * 2 + 1)) - maxOffset;
    
    return {
      hasMisjump: true,
      offset: { x: offsetX, y: offsetY }
    };
  }

  /**
   * Request a warp travel
   */
  public async requestWarp(request: WarpRequest): Promise<WarpResult> {
    try {
      // Validate coordinates
      if (!this.validateCoordinates(request.origin.gridX, request.origin.gridY) ||
          !this.validateCoordinates(request.destination.gridX, request.destination.gridY)) {
        return {
          success: false,
          error: 'Invalid coordinates (must be 0-99)',
          errorCode: 'INVALID_COORDINATES'
        };
      }

      // Check if unit already has active warp
      const existingWarp = await WarpTravel.findOne({
        sessionId: request.sessionId,
        unitId: request.unitId,
        status: 'in_progress'
      });
      
      if (existingWarp) {
        return {
          success: false,
          error: 'Unit already has an active warp travel',
          errorCode: 'WARP_IN_PROGRESS'
        };
      }

      // Check destination grid entry permission
      const canEnter = await GalaxyGrid.canEnterGrid(
        request.sessionId,
        request.destination.gridX,
        request.destination.gridY,
        request.unitId,
        request.factionId
      );
      
      if (!canEnter.allowed) {
        return {
          success: false,
          error: canEnter.reason,
          errorCode: 'GIN7_E004'
        };
      }

      // Calculate travel parameters
      const distance = this.calculateDistance(
        request.origin.gridX, request.origin.gridY,
        request.destination.gridX, request.destination.gridY
      );
      
      const warpDuration = this.calculateWarpTime(distance, request.engineLevel);
      const misjumpResult = this.calculateMisjump(distance, request.engineLevel);

      // Create warp travel record
      const travelId = uuidv4();
      const warpTravel = new WarpTravel({
        travelId,
        sessionId: request.sessionId,
        unitId: request.unitId,
        factionId: request.factionId,
        origin: request.origin,
        destination: request.destination,
        state: 'CHARGING',
        requestedAt: new Date(),
        chargeStartedAt: new Date(),
        chargeDuration: WARP_CONSTANTS.BASE_CHARGE_TIME,
        warpDuration,
        coolingDuration: WARP_CONSTANTS.COOLING_TIME,
        distance,
        engineLevel: request.engineLevel,
        hasMisjump: misjumpResult.hasMisjump,
        misjumpOffset: misjumpResult.offset,
        status: 'in_progress'
      });

      // Calculate actual destination if misjump
      if (misjumpResult.hasMisjump && misjumpResult.offset) {
        const actualX = Math.max(0, Math.min(99, request.destination.gridX + misjumpResult.offset.x));
        const actualY = Math.max(0, Math.min(99, request.destination.gridY + misjumpResult.offset.y));
        warpTravel.actualDestination = { gridX: actualX, gridY: actualY };
      }

      await warpTravel.save();
      this.activeWarps.set(travelId, warpTravel);

      // Emit event
      this.emitWarpEvent(WARP_EVENTS.WARP_CHARGING, {
        travelId,
        sessionId: request.sessionId,
        unitId: request.unitId,
        factionId: request.factionId,
        origin: request.origin,
        destination: request.destination,
        estimatedDuration: WARP_CONSTANTS.BASE_CHARGE_TIME + warpDuration + WARP_CONSTANTS.COOLING_TIME
      });

      logger.info(`[WarpNavigationService] Warp requested: ${travelId}, distance: ${distance}ly, duration: ${warpDuration} ticks`);

      return {
        success: true,
        travelId,
        estimatedDuration: WARP_CONSTANTS.BASE_CHARGE_TIME + warpDuration + WARP_CONSTANTS.COOLING_TIME
      };
    } catch (error: any) {
      logger.error('[WarpNavigationService] Failed to request warp:', error);
      return {
        success: false,
        error: error.message,
        errorCode: 'WARP_REQUEST_FAILED'
      };
    }
  }

  /**
   * Cancel an active warp
   */
  public async cancelWarp(sessionId: string, travelId: string): Promise<{ success: boolean; error?: string }> {
    const warp = this.activeWarps.get(travelId);
    
    if (!warp || warp.sessionId !== sessionId) {
      return { success: false, error: 'Warp travel not found' };
    }

    // Can only cancel during CHARGING state
    if (warp.state !== 'CHARGING') {
      return { success: false, error: 'Can only cancel warp during charging phase' };
    }

    warp.status = 'cancelled';
    warp.state = 'IDLE';
    await warp.save();
    
    this.activeWarps.delete(travelId);
    
    this.emitWarpEvent(WARP_EVENTS.WARP_CANCELLED, {
      travelId,
      sessionId,
      unitId: warp.unitId
    });

    return { success: true };
  }

  /**
   * Process time tick - advance warp state machines
   */
  private async processTick(payload: { sessionId: string; tick: number }): Promise<void> {
    const now = new Date();
    
    for (const [travelId, warp] of this.activeWarps) {
      if (warp.sessionId !== payload.sessionId) continue;
      if (warp.status !== 'in_progress') continue;

      try {
        await this.advanceWarpState(warp, now);
      } catch (error) {
        logger.error(`[WarpNavigationService] Error processing warp ${travelId}:`, error);
      }
    }
  }

  /**
   * Advance warp state machine
   */
  private async advanceWarpState(warp: IWarpTravel, now: Date): Promise<void> {
    switch (warp.state) {
      case 'CHARGING': {
        const chargeElapsed = this.getTicksElapsed(warp.chargeStartedAt!, now);
        if (chargeElapsed >= warp.chargeDuration) {
          warp.state = 'WARPING';
          warp.warpStartedAt = now;
          await warp.save();
          
          this.emitWarpEvent(WARP_EVENTS.WARP_STARTED, {
            travelId: warp.travelId,
            sessionId: warp.sessionId,
            unitId: warp.unitId,
            factionId: warp.factionId,
            origin: warp.origin,
            destination: warp.destination,
            estimatedArrival: warp.warpDuration
          });
          
          logger.info(`[WarpNavigationService] Warp ${warp.travelId} started warping`);
        }
        break;
      }
      
      case 'WARPING': {
        const warpElapsed = this.getTicksElapsed(warp.warpStartedAt!, now);
        if (warpElapsed >= warp.warpDuration) {
          warp.state = 'COOLING';
          warp.coolingStartedAt = now;
          await warp.save();
          
          // Handle misjump notification
          if (warp.hasMisjump && warp.actualDestination) {
            this.emitWarpEvent(WARP_EVENTS.WARP_MISJUMP, {
              travelId: warp.travelId,
              sessionId: warp.sessionId,
              unitId: warp.unitId,
              intendedDestination: warp.destination,
              actualDestination: warp.actualDestination,
              offset: warp.misjumpOffset
            });
          }
          
          logger.info(`[WarpNavigationService] Warp ${warp.travelId} cooling down`);
        }
        break;
      }
      
      case 'COOLING': {
        const coolElapsed = this.getTicksElapsed(warp.coolingStartedAt!, now);
        if (coolElapsed >= warp.coolingDuration) {
          await this.completeWarp(warp, now);
        }
        break;
      }
    }
  }

  /**
   * Complete warp travel
   */
  private async completeWarp(warp: IWarpTravel, now: Date): Promise<void> {
    warp.state = 'IDLE';
    warp.status = 'completed';
    warp.completedAt = now;
    await warp.save();
    
    this.activeWarps.delete(warp.travelId);

    // Determine final destination
    const finalDestination = warp.hasMisjump && warp.actualDestination 
      ? warp.actualDestination 
      : { gridX: warp.destination.gridX, gridY: warp.destination.gridY };

    // Update grid occupancy
    await GalaxyGrid.removeUnitFromGrid(
      warp.sessionId,
      warp.origin.gridX,
      warp.origin.gridY,
      warp.unitId,
      warp.factionId
    );
    
    await GalaxyGrid.addUnitToGrid(
      warp.sessionId,
      finalDestination.gridX,
      finalDestination.gridY,
      warp.unitId,
      warp.factionId
    );

    this.emitWarpEvent(WARP_EVENTS.WARP_COMPLETED, {
      travelId: warp.travelId,
      sessionId: warp.sessionId,
      unitId: warp.unitId,
      factionId: warp.factionId,
      origin: warp.origin,
      finalDestination,
      hasMisjump: warp.hasMisjump,
      totalDuration: warp.chargeDuration + warp.warpDuration + warp.coolingDuration
    });

    logger.info(`[WarpNavigationService] Warp ${warp.travelId} completed at (${finalDestination.gridX}, ${finalDestination.gridY})`);
  }

  /**
   * Get warp status
   */
  public async getWarpStatus(sessionId: string, travelId: string): Promise<IWarpTravel | null> {
    // Check memory first
    const cached = this.activeWarps.get(travelId);
    if (cached && cached.sessionId === sessionId) {
      return cached;
    }
    
    // Check database
    return await WarpTravel.findOne({ sessionId, travelId });
  }

  /**
   * Get all active warps for a session
   */
  public async getActiveWarps(sessionId: string): Promise<IWarpTravel[]> {
    return await WarpTravel.find({
      sessionId,
      status: 'in_progress'
    });
  }

  /**
   * Get warp history for a unit
   */
  public async getUnitWarpHistory(sessionId: string, unitId: string, limit = 10): Promise<IWarpTravel[]> {
    return await WarpTravel.find({
      sessionId,
      unitId
    })
    .sort({ requestedAt: -1 })
    .limit(limit);
  }

  // Helper methods
  private validateCoordinates(x: number, y: number): boolean {
    return x >= 0 && x < GRID_CONSTANTS.GRID_SIZE && y >= 0 && y < GRID_CONSTANTS.GRID_SIZE;
  }

  private getTicksElapsed(startTime: Date, now: Date): number {
    return Math.floor((now.getTime() - startTime.getTime()) / 1000);
  }

  private emitWarpEvent(eventName: string, payload: any): void {
    // Emit to internal listeners
    this.emit(eventName, payload);
    
    // Emit to Socket.IO
    const socketManager = getSocketManager();
    if (socketManager) {
      socketManager.getIO().to(`session:${payload.sessionId}`).emit(eventName, payload);
    }
  }
}

// Export singleton getter
export function getWarpNavigationService(): WarpNavigationService {
  return WarpNavigationService.getInstance();
}

