import mongoose from 'mongoose';
import { TradeRoute, ITradeRoute } from '../../models/gin7/TradeRoute';
import { Fleet, IFleet } from '../../models/gin7/Fleet';
import { ResourceType } from '../../models/gin7/Warehouse';

/**
 * Piracy attack result
 */
export interface IPiracyResult {
  attacked: boolean;
  severity: 'MINOR' | 'MODERATE' | 'SEVERE' | 'NONE';
  cargoLost: Array<{ type: ResourceType; amount: number }>;
  creditsLost: number;
  fleetDamage: number;  // HP percentage lost
  piratesDestroyed: number;
  escortEffective: boolean;
  message: string;
}

/**
 * Escort effectiveness factors
 */
export interface IEscortEvaluation {
  escortStrength: number;     // 0-100
  effectiveReduction: number; // 0-1 (reduction in piracy risk)
  canRepelPirates: boolean;
  combatPowerRequired: number;
}

/**
 * PiracyService
 * Handles pirate attacks on trade routes
 */
export class PiracyService {
  // Base piracy risk by region (can be expanded)
  private static readonly REGIONAL_RISK: Record<string, number> = {
    'CORE': 5,          // Core systems - low risk
    'FRONTIER': 25,     // Frontier regions - moderate risk
    'NEUTRAL': 35,      // Neutral zones - high risk
    'ISERLOHN': 15,     // Iserlohn corridor - military presence
    'PHEZZAN': 10,      // Phezzan - merchant protection
    'DEEP_SPACE': 50    // Deep space - very high risk
  };

  // Pirate strength levels
  private static readonly PIRATE_STRENGTH = {
    MINOR: { minShips: 5, maxShips: 20, combatPower: 200 },
    MODERATE: { minShips: 20, maxShips: 50, combatPower: 600 },
    SEVERE: { minShips: 50, maxShips: 100, combatPower: 1500 }
  };

  /**
   * Calculate base piracy risk for a trade route
   */
  static calculateRouteRisk(
    distance: number,
    region: string = 'FRONTIER',
    warActive: boolean = false
  ): number {
    // Base risk from region
    let risk = this.REGIONAL_RISK[region] || 20;
    
    // Distance factor: longer routes = more risk
    risk += Math.floor(distance / 20) * 2;  // +2% per 20 parsecs
    
    // War increases piracy (less patrols)
    if (warActive) {
      risk *= 1.5;
    }
    
    // Cap at 80%
    return Math.min(80, Math.max(0, risk));
  }

  /**
   * Evaluate escort fleet effectiveness
   */
  static evaluateEscort(
    sessionId: string,
    fleetId?: string,
    route?: ITradeRoute
  ): IEscortEvaluation {
    if (!fleetId) {
      return {
        escortStrength: 0,
        effectiveReduction: 0,
        canRepelPirates: false,
        combatPowerRequired: this.PIRATE_STRENGTH.MINOR.combatPower
      };
    }

    // In a real implementation, fetch the fleet and calculate combat power
    // For now, return a placeholder
    return {
      escortStrength: 50,
      effectiveReduction: 0.5,
      canRepelPirates: true,
      combatPowerRequired: this.PIRATE_STRENGTH.MODERATE.combatPower
    };
  }

  /**
   * Evaluate escort fleet effectiveness (async version with DB lookup)
   */
  static async evaluateEscortAsync(
    sessionId: string,
    fleetId?: string
  ): Promise<IEscortEvaluation> {
    if (!fleetId) {
      return {
        escortStrength: 0,
        effectiveReduction: 0,
        canRepelPirates: false,
        combatPowerRequired: this.PIRATE_STRENGTH.MINOR.combatPower
      };
    }

    const fleet = await Fleet.findOne({ sessionId, fleetId });
    
    if (!fleet) {
      return {
        escortStrength: 0,
        effectiveReduction: 0,
        canRepelPirates: false,
        combatPowerRequired: this.PIRATE_STRENGTH.MINOR.combatPower
      };
    }

    // Calculate combat power (simplified - use virtual from Fleet model)
    const combatPower = fleet.totalShips * 30;  // Simplified calculation
    
    // Escort strength percentage (100 = can handle SEVERE attacks)
    const escortStrength = Math.min(100, Math.floor(combatPower / 15));
    
    // Risk reduction based on escort strength
    const effectiveReduction = escortStrength / 100 * 0.8;  // Max 80% reduction
    
    // Can repel if combat power exceeds MINOR pirates
    const canRepelPirates = combatPower >= this.PIRATE_STRENGTH.MINOR.combatPower;
    
    // Combat power needed for next tier
    let combatPowerRequired = this.PIRATE_STRENGTH.MINOR.combatPower;
    if (combatPower >= this.PIRATE_STRENGTH.MODERATE.combatPower) {
      combatPowerRequired = this.PIRATE_STRENGTH.SEVERE.combatPower;
    } else if (combatPower >= this.PIRATE_STRENGTH.MINOR.combatPower) {
      combatPowerRequired = this.PIRATE_STRENGTH.MODERATE.combatPower;
    }

    return {
      escortStrength,
      effectiveReduction,
      canRepelPirates,
      combatPowerRequired
    };
  }

  /**
   * Roll for piracy attack on a trade route
   */
  static async rollPiracyAttack(
    sessionId: string,
    route: ITradeRoute,
    cargoValue: number
  ): Promise<IPiracyResult> {
    // Get escort evaluation
    const escort = await this.evaluateEscortAsync(sessionId, route.fleetId);
    
    // Calculate effective risk
    const baseRisk = route.piracyRisk || 10;
    const effectiveRisk = baseRisk * (1 - escort.effectiveReduction);
    
    // Roll for attack
    const roll = Math.random() * 100;
    
    if (roll >= effectiveRisk) {
      // No attack
      return {
        attacked: false,
        severity: 'NONE',
        cargoLost: [],
        creditsLost: 0,
        fleetDamage: 0,
        piratesDestroyed: 0,
        escortEffective: false,
        message: '항해가 무사히 완료되었습니다.'
      };
    }

    // Attack occurred! Determine severity
    let severity: 'MINOR' | 'MODERATE' | 'SEVERE';
    const severityRoll = Math.random() * 100;
    
    if (severityRoll < 60) {
      severity = 'MINOR';
    } else if (severityRoll < 90) {
      severity = 'MODERATE';
    } else {
      severity = 'SEVERE';
    }

    // Check if escort can repel
    const pirateStrength = this.PIRATE_STRENGTH[severity];
    const escortCombatPower = escort.escortStrength * 15;  // Reverse calculation
    
    if (escortCombatPower >= pirateStrength.combatPower) {
      // Escort repelled the pirates!
      const piratesDestroyed = Math.floor(
        (pirateStrength.minShips + pirateStrength.maxShips) / 2 * 
        (escortCombatPower / pirateStrength.combatPower)
      );
      
      return {
        attacked: true,
        severity,
        cargoLost: [],
        creditsLost: 0,
        fleetDamage: Math.floor(20 / (escortCombatPower / pirateStrength.combatPower)),
        piratesDestroyed: Math.min(piratesDestroyed, pirateStrength.maxShips),
        escortEffective: true,
        message: `해적 습격을 격퇴했습니다! ${piratesDestroyed}척의 해적선을 격파.`
      };
    }

    // Pirates won or no escort - calculate losses
    let lossPercentage: number;
    switch (severity) {
      case 'MINOR':
        lossPercentage = 0.1 + Math.random() * 0.1;  // 10-20%
        break;
      case 'MODERATE':
        lossPercentage = 0.2 + Math.random() * 0.2;  // 20-40%
        break;
      case 'SEVERE':
        lossPercentage = 0.4 + Math.random() * 0.3;  // 40-70%
        break;
    }

    // If there's an escort but it failed, reduce losses somewhat
    if (escort.escortStrength > 0) {
      lossPercentage *= (1 - escort.effectiveReduction * 0.5);
    }

    // Calculate cargo losses
    const cargoLost: Array<{ type: ResourceType; amount: number }> = [];
    for (const item of route.items) {
      const lost = Math.ceil(item.quantity * lossPercentage);
      if (lost > 0) {
        cargoLost.push({ type: item.itemType, amount: lost });
      }
    }

    const creditsLost = Math.floor(cargoValue * lossPercentage);
    const fleetDamage = escort.escortStrength > 0 ? 
      Math.floor(30 + Math.random() * 20) : 0;

    const severityText = {
      'MINOR': '소규모',
      'MODERATE': '중규모',
      'SEVERE': '대규모'
    };

    return {
      attacked: true,
      severity,
      cargoLost,
      creditsLost,
      fleetDamage,
      piratesDestroyed: 0,
      escortEffective: false,
      message: `${severityText[severity]} 해적 습격! 화물의 ${Math.round(lossPercentage * 100)}%를 잃었습니다.`
    };
  }

  /**
   * Apply piracy damage to fleet
   */
  static async applyFleetDamage(
    sessionId: string,
    fleetId: string,
    damagePercent: number
  ): Promise<void> {
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    
    if (!fleet) return;

    // Apply damage to all units
    for (const unit of fleet.units) {
      unit.hp = Math.max(10, unit.hp - damagePercent);  // Min 10% HP
      
      // Check for destroyed ships
      const destroyChance = damagePercent / 100;
      const destroyed = Math.floor(unit.count * destroyChance * Math.random());
      
      if (destroyed > 0) {
        unit.count = Math.max(0, unit.count - destroyed);
        unit.destroyed += destroyed;
      }
    }

    // Update fleet combat stats
    fleet.combatStats.battlesLost++;
    
    await fleet.save();
  }

  /**
   * Report piracy incident (for intel/statistics)
   */
  static async reportPiracyIncident(
    sessionId: string,
    routeId: string,
    result: IPiracyResult,
    location?: { systemId?: string; coordinates?: { x: number; y: number } }
  ): Promise<void> {
    // In a full implementation, this would:
    // 1. Log to an incidents collection
    // 2. Update regional piracy statistics
    // 3. Potentially spawn a "pirate base" event
    // 4. Notify affected faction's intel service
    
    console.log(`[PiracyService] Incident reported:`, {
      sessionId,
      routeId,
      severity: result.severity,
      creditsLost: result.creditsLost,
      location
    });
  }

  /**
   * Get piracy statistics for a region
   */
  static async getRegionalPiracyStats(
    sessionId: string,
    region: string
  ): Promise<{
    incidentsLastMonth: number;
    averageLoss: number;
    riskLevel: string;
    hotspots: string[];
  }> {
    // Placeholder - in real implementation, aggregate from incident logs
    const baseRisk = this.REGIONAL_RISK[region] || 20;
    
    let riskLevel: string;
    if (baseRisk < 15) riskLevel = '낮음';
    else if (baseRisk < 30) riskLevel = '보통';
    else if (baseRisk < 50) riskLevel = '높음';
    else riskLevel = '매우 높음';

    return {
      incidentsLastMonth: Math.floor(baseRisk / 5),
      averageLoss: baseRisk * 100,
      riskLevel,
      hotspots: []  // Would list specific dangerous systems
    };
  }

  /**
   * Update route piracy risk based on recent incidents
   */
  static async updateRoutePiracyRisk(
    sessionId: string,
    routeId: string
  ): Promise<number> {
    const route = await TradeRoute.findOne({ sessionId, routeId });
    
    if (!route) return 0;

    // Count recent failed trips (piracy)
    const recentTrips = route.totalTrips - Math.max(0, route.totalTrips - 10);
    const recentFailures = route.failedTrips > 0 ? 
      Math.min(route.failedTrips, recentTrips) : 0;
    
    // Adjust risk based on recent history
    const baseRisk = this.calculateRouteRisk(route.distance);
    const historyModifier = recentFailures > 0 ? 
      1 + (recentFailures / recentTrips) * 0.5 : 0.9;  // Successful routes become safer
    
    route.piracyRisk = Math.floor(baseRisk * historyModifier);
    await route.save();
    
    return route.piracyRisk;
  }
}

export default PiracyService;

