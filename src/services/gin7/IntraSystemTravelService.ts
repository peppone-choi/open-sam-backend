import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { StarSystem, IStarSystem } from '../../models/gin7/StarSystem';
import { Planet, IPlanet } from '../../models/gin7/Planet';
import { TimeEngine, GIN7_EVENTS } from '../../core/gin7/TimeEngine';
import { logger } from '../../common/logger';
import { getSocketManager } from '../../socket/socketManager';

/**
 * Intra-system travel states
 */
export type IntraSystemTravelState = 
  | 'IDLE'
  | 'IN_TRANSIT'     // Moving within system
  | 'ORBITING'       // Orbiting a planet
  | 'LANDING'        // Landing on planet
  | 'LANDED'         // On planet surface
  | 'TAKING_OFF';    // Leaving planet

/**
 * Intra-system travel events
 */
export const INTRA_SYSTEM_EVENTS = {
  TRANSIT_STARTED: 'GIN7:INTRA_TRANSIT_STARTED',
  TRANSIT_COMPLETED: 'GIN7:INTRA_TRANSIT_COMPLETED',
  ORBIT_ENTERED: 'GIN7:ORBIT_ENTERED',
  ORBIT_LEFT: 'GIN7:ORBIT_LEFT',
  LANDING_STARTED: 'GIN7:LANDING_STARTED',
  LANDED: 'GIN7:LANDED',
  TAKEOFF_STARTED: 'GIN7:TAKEOFF_STARTED',
  TAKEOFF_COMPLETED: 'GIN7:TAKEOFF_COMPLETED',
} as const;

/**
 * Travel time constants (in ticks)
 */
export const INTRA_TRAVEL_CONSTANTS = {
  BASE_TRANSIT_TIME: 5,           // Base time to move within system
  ORBIT_APPROACH_TIME: 2,         // Time to enter orbit
  LANDING_TIME: 3,                // Time to land
  TAKEOFF_TIME: 3,                // Time to take off
  ENGINE_SPEED_FACTOR: 0.1,       // Speed bonus per engine level
} as const;

/**
 * Unit position within a star system
 */
export interface SystemPosition {
  systemId: string;
  locationType: 'space' | 'orbit' | 'surface';
  planetId?: string;              // If orbiting or landed
  localX?: number;                // Position in system space
  localY?: number;
}

/**
 * Active travel record (in-memory)
 */
interface ActiveTravel {
  travelId: string;
  sessionId: string;
  unitId: string;
  factionId: string;
  state: IntraSystemTravelState;
  systemId: string;
  
  // Movement details
  origin: SystemPosition;
  destination: SystemPosition;
  
  // Timing
  startedAt: Date;
  estimatedDuration: number;      // In ticks
  
  // Engine
  engineLevel: number;
}

/**
 * IntraSystemTravelService
 * 
 * Handles movement within a star system:
 * - Transit between locations in system
 * - Entering/leaving orbit
 * - Landing/taking off from planets
 */
export class IntraSystemTravelService extends EventEmitter {
  private static instance: IntraSystemTravelService;
  private activeTravels: Map<string, ActiveTravel> = new Map();
  private tickListener: ((payload: any) => void) | null = null;

  private constructor() {
    super();
    this.setMaxListeners(50);
  }

  public static getInstance(): IntraSystemTravelService {
    if (!IntraSystemTravelService.instance) {
      IntraSystemTravelService.instance = new IntraSystemTravelService();
    }
    return IntraSystemTravelService.instance;
  }

  /**
   * Initialize the service
   */
  public async initialize(): Promise<void> {
    const timeEngine = TimeEngine.getInstance();
    this.tickListener = (payload) => this.processTick(payload);
    timeEngine.on(GIN7_EVENTS.TIME_TICK, this.tickListener);
    logger.info('[IntraSystemTravelService] Initialized');
  }

  /**
   * Shutdown
   */
  public async shutdown(): Promise<void> {
    if (this.tickListener) {
      const timeEngine = TimeEngine.getInstance();
      timeEngine.off(GIN7_EVENTS.TIME_TICK, this.tickListener);
    }
    logger.info('[IntraSystemTravelService] Shutdown');
  }

  /**
   * Start transit within a star system
   */
  public async startTransit(
    sessionId: string,
    unitId: string,
    factionId: string,
    systemId: string,
    destination: { planetId?: string; localX?: number; localY?: number },
    engineLevel: number = 1
  ): Promise<{ success: boolean; travelId?: string; error?: string }> {
    try {
      // Verify system exists
      const system = await StarSystem.findOne({ sessionId, systemId });
      if (!system) {
        return { success: false, error: 'Star system not found' };
      }

      // Verify planet if destination specifies one
      if (destination.planetId) {
        const planet = await Planet.findOne({ sessionId, planetId: destination.planetId, systemId });
        if (!planet) {
          return { success: false, error: 'Destination planet not found in this system' };
        }
      }

      // Check if unit already has active travel
      const existingTravel = Array.from(this.activeTravels.values()).find(
        t => t.sessionId === sessionId && t.unitId === unitId && t.state !== 'IDLE'
      );
      if (existingTravel) {
        return { success: false, error: 'Unit already in transit' };
      }

      // Calculate travel time
      const duration = this.calculateTransitTime(engineLevel);

      const travelId = uuidv4();
      const travel: ActiveTravel = {
        travelId,
        sessionId,
        unitId,
        factionId,
        state: 'IN_TRANSIT',
        systemId,
        origin: {
          systemId,
          locationType: 'space',
          localX: 500,
          localY: 500
        },
        destination: {
          systemId,
          locationType: destination.planetId ? 'orbit' : 'space',
          planetId: destination.planetId,
          localX: destination.localX ?? 500,
          localY: destination.localY ?? 500
        },
        startedAt: new Date(),
        estimatedDuration: duration,
        engineLevel
      };

      this.activeTravels.set(travelId, travel);

      this.emitEvent(INTRA_SYSTEM_EVENTS.TRANSIT_STARTED, {
        travelId,
        sessionId,
        unitId,
        factionId,
        systemId,
        destination: travel.destination,
        estimatedDuration: duration
      });

      logger.info(`[IntraSystemTravelService] Transit started: ${travelId} in system ${systemId}`);

      return { success: true, travelId };
    } catch (error: any) {
      logger.error('[IntraSystemTravelService] Failed to start transit:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Enter orbit around a planet
   */
  public async enterOrbit(
    sessionId: string,
    unitId: string,
    factionId: string,
    planetId: string,
    engineLevel: number = 1
  ): Promise<{ success: boolean; travelId?: string; error?: string }> {
    try {
      const planet = await Planet.findOne({ sessionId, planetId });
      if (!planet) {
        return { success: false, error: 'Planet not found' };
      }

      const duration = INTRA_TRAVEL_CONSTANTS.ORBIT_APPROACH_TIME;
      const travelId = uuidv4();

      const travel: ActiveTravel = {
        travelId,
        sessionId,
        unitId,
        factionId,
        state: 'ORBITING',
        systemId: planet.systemId,
        origin: {
          systemId: planet.systemId,
          locationType: 'space'
        },
        destination: {
          systemId: planet.systemId,
          locationType: 'orbit',
          planetId
        },
        startedAt: new Date(),
        estimatedDuration: duration,
        engineLevel
      };

      this.activeTravels.set(travelId, travel);

      this.emitEvent(INTRA_SYSTEM_EVENTS.ORBIT_ENTERED, {
        travelId,
        sessionId,
        unitId,
        factionId,
        planetId,
        planetName: planet.name
      });

      return { success: true, travelId };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Land on a planet (must be in orbit first)
   */
  public async landOnPlanet(
    sessionId: string,
    unitId: string,
    factionId: string,
    planetId: string
  ): Promise<{ success: boolean; travelId?: string; error?: string }> {
    try {
      const planet = await Planet.findOne({ sessionId, planetId });
      if (!planet) {
        return { success: false, error: 'Planet not found' };
      }

      // Check if planet allows landing
      if (planet.type === 'gas_giant') {
        return { success: false, error: 'Cannot land on gas giant' };
      }

      const duration = INTRA_TRAVEL_CONSTANTS.LANDING_TIME;
      const travelId = uuidv4();

      const travel: ActiveTravel = {
        travelId,
        sessionId,
        unitId,
        factionId,
        state: 'LANDING',
        systemId: planet.systemId,
        origin: {
          systemId: planet.systemId,
          locationType: 'orbit',
          planetId
        },
        destination: {
          systemId: planet.systemId,
          locationType: 'surface',
          planetId
        },
        startedAt: new Date(),
        estimatedDuration: duration,
        engineLevel: 1
      };

      this.activeTravels.set(travelId, travel);

      this.emitEvent(INTRA_SYSTEM_EVENTS.LANDING_STARTED, {
        travelId,
        sessionId,
        unitId,
        factionId,
        planetId,
        planetName: planet.name,
        estimatedDuration: duration
      });

      return { success: true, travelId };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Take off from a planet
   */
  public async takeOff(
    sessionId: string,
    unitId: string,
    factionId: string,
    planetId: string
  ): Promise<{ success: boolean; travelId?: string; error?: string }> {
    try {
      const planet = await Planet.findOne({ sessionId, planetId });
      if (!planet) {
        return { success: false, error: 'Planet not found' };
      }

      const duration = INTRA_TRAVEL_CONSTANTS.TAKEOFF_TIME;
      const travelId = uuidv4();

      const travel: ActiveTravel = {
        travelId,
        sessionId,
        unitId,
        factionId,
        state: 'TAKING_OFF',
        systemId: planet.systemId,
        origin: {
          systemId: planet.systemId,
          locationType: 'surface',
          planetId
        },
        destination: {
          systemId: planet.systemId,
          locationType: 'orbit',
          planetId
        },
        startedAt: new Date(),
        estimatedDuration: duration,
        engineLevel: 1
      };

      this.activeTravels.set(travelId, travel);

      this.emitEvent(INTRA_SYSTEM_EVENTS.TAKEOFF_STARTED, {
        travelId,
        sessionId,
        unitId,
        factionId,
        planetId,
        planetName: planet.name
      });

      return { success: true, travelId };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Leave orbit and return to system space
   */
  public async leaveOrbit(
    sessionId: string,
    unitId: string,
    factionId: string,
    planetId: string
  ): Promise<{ success: boolean; travelId?: string; error?: string }> {
    try {
      const planet = await Planet.findOne({ sessionId, planetId });
      if (!planet) {
        return { success: false, error: 'Planet not found' };
      }

      const duration = INTRA_TRAVEL_CONSTANTS.ORBIT_APPROACH_TIME;
      const travelId = uuidv4();

      const travel: ActiveTravel = {
        travelId,
        sessionId,
        unitId,
        factionId,
        state: 'IN_TRANSIT',
        systemId: planet.systemId,
        origin: {
          systemId: planet.systemId,
          locationType: 'orbit',
          planetId
        },
        destination: {
          systemId: planet.systemId,
          locationType: 'space'
        },
        startedAt: new Date(),
        estimatedDuration: duration,
        engineLevel: 1
      };

      this.activeTravels.set(travelId, travel);

      this.emitEvent(INTRA_SYSTEM_EVENTS.ORBIT_LEFT, {
        travelId,
        sessionId,
        unitId,
        factionId,
        planetId
      });

      return { success: true, travelId };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Process tick - advance travel states
   */
  private async processTick(payload: { sessionId: string; tick: number }): Promise<void> {
    const now = new Date();

    for (const [travelId, travel] of this.activeTravels) {
      if (travel.sessionId !== payload.sessionId) continue;
      if (travel.state === 'IDLE' || travel.state === 'LANDED') continue;

      const elapsed = this.getTicksElapsed(travel.startedAt, now);
      
      if (elapsed >= travel.estimatedDuration) {
        await this.completeTravel(travel);
      }
    }
  }

  /**
   * Complete a travel
   */
  private async completeTravel(travel: ActiveTravel): Promise<void> {
    const prevState = travel.state;
    
    switch (travel.state) {
      case 'IN_TRANSIT':
        travel.state = travel.destination.locationType === 'orbit' ? 'ORBITING' : 'IDLE';
        this.emitEvent(INTRA_SYSTEM_EVENTS.TRANSIT_COMPLETED, {
          travelId: travel.travelId,
          sessionId: travel.sessionId,
          unitId: travel.unitId,
          destination: travel.destination
        });
        break;
        
      case 'LANDING':
        travel.state = 'LANDED';
        this.emitEvent(INTRA_SYSTEM_EVENTS.LANDED, {
          travelId: travel.travelId,
          sessionId: travel.sessionId,
          unitId: travel.unitId,
          planetId: travel.destination.planetId
        });
        break;
        
      case 'TAKING_OFF':
        travel.state = 'ORBITING';
        this.emitEvent(INTRA_SYSTEM_EVENTS.TAKEOFF_COMPLETED, {
          travelId: travel.travelId,
          sessionId: travel.sessionId,
          unitId: travel.unitId,
          planetId: travel.origin.planetId
        });
        break;
    }

    // Remove from active if complete
    if (travel.state === 'IDLE' || travel.state === 'LANDED' || travel.state === 'ORBITING') {
      this.activeTravels.delete(travel.travelId);
    }

    logger.info(`[IntraSystemTravelService] Travel ${travel.travelId}: ${prevState} -> ${travel.state}`);
  }

  /**
   * Get active travel for a unit
   */
  public getActiveTravel(sessionId: string, unitId: string): ActiveTravel | undefined {
    return Array.from(this.activeTravels.values()).find(
      t => t.sessionId === sessionId && t.unitId === unitId
    );
  }

  /**
   * Get all active travels in a system
   */
  public getSystemTravels(sessionId: string, systemId: string): ActiveTravel[] {
    return Array.from(this.activeTravels.values()).filter(
      t => t.sessionId === sessionId && t.systemId === systemId
    );
  }

  // Helper methods
  private calculateTransitTime(engineLevel: number): number {
    const speedBonus = 1 + (engineLevel * INTRA_TRAVEL_CONSTANTS.ENGINE_SPEED_FACTOR);
    return Math.ceil(INTRA_TRAVEL_CONSTANTS.BASE_TRANSIT_TIME / speedBonus);
  }

  private getTicksElapsed(startTime: Date, now: Date): number {
    return Math.floor((now.getTime() - startTime.getTime()) / 1000);
  }

  private emitEvent(eventName: string, payload: any): void {
    this.emit(eventName, payload);
    
    const socketManager = getSocketManager();
    if (socketManager) {
      socketManager.getIO().to(`session:${payload.sessionId}`).emit(eventName, payload);
    }
  }
}

export function getIntraSystemTravelService(): IntraSystemTravelService {
  return IntraSystemTravelService.getInstance();
}

