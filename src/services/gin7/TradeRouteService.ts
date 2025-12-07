import mongoose from 'mongoose';
import { TradeRoute, ITradeRoute, ITradeItem } from '../../models/gin7/TradeRoute';
import { MarketPrice } from '../../models/gin7/MarketPrice';
import { ResourceType } from '../../models/gin7/Warehouse';
import { MarketService } from './MarketService';
import { Gin7Error } from '../../common/errors/gin7-errors';

/**
 * Trade route creation options
 */
export interface ICreateRouteOptions {
  sessionId: string;
  ownerId: string;
  factionId: string;
  sourceId: string;
  sourceType: 'PLANET' | 'STATION';
  sourceName: string;
  targetId: string;
  targetType: 'PLANET' | 'STATION';
  targetName: string;
  name: string;
  distance: number;
  items: ITradeItem[];
  frequency?: number;
  escortRequired?: boolean;
}

/**
 * Shipment result
 */
export interface IShipmentResult {
  routeId: string;
  success: boolean;
  transactions: Array<{
    itemType: ResourceType;
    quantity: number;
    buyPrice: number;
    sellPrice: number;
    profit: number;
  }>;
  totalProfit: number;
  piracyAttack?: {
    occurred: boolean;
    severity: number;
    cargoLost: number;
  };
  error?: string;
}

/**
 * TradeRouteService
 * Handles automated trade route operations
 */
export class TradeRouteService {
  /**
   * Create a new trade route
   */
  static async createRoute(options: ICreateRouteOptions): Promise<ITradeRoute> {
    const {
      sessionId,
      ownerId,
      factionId,
      sourceId,
      sourceType,
      sourceName,
      targetId,
      targetType,
      targetName,
      name,
      distance,
      items,
      frequency = 1,
      escortRequired = false
    } = options;

    // Validate source and target are different
    if (sourceId === targetId) {
      throw new Gin7Error('INVALID_ROUTE', 'Source and target must be different');
    }

    // Validate items
    if (!items || items.length === 0) {
      throw new Gin7Error('INVALID_ROUTE', 'At least one trade item is required');
    }

    // Check for existing route between same locations
    const existingRoute = await TradeRoute.findOne({
      sessionId,
      ownerId,
      sourceId,
      targetId
    });

    if (existingRoute) {
      throw new Gin7Error('ROUTE_EXISTS', 'A route already exists between these locations');
    }

    // Calculate travel time based on distance
    const travelTime = Math.max(1, Math.ceil(distance / 10));  // 1 turn per 10 parsecs

    // Calculate operating cost based on distance and items
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const operatingCost = Math.ceil(50 + distance * 5 + totalQuantity * 0.1);

    // Calculate piracy risk based on route
    const piracyRisk = Math.min(50, Math.ceil(distance * 0.5));

    const routeId = `ROUTE-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    const route = new TradeRoute({
      routeId,
      sessionId,
      ownerId,
      factionId,
      sourceId,
      sourceType,
      sourceName,
      targetId,
      targetType,
      targetName,
      name,
      distance,
      travelTime,
      items,
      frequency,
      status: 'PENDING',
      escortRequired,
      piracyRisk,
      operatingCost,
      nextShipment: new Date()  // Ready for first shipment
    });

    await route.save();
    return route;
  }

  /**
   * Activate a route
   */
  static async activateRoute(
    sessionId: string,
    routeId: string
  ): Promise<ITradeRoute> {
    const route = await TradeRoute.findOne({ sessionId, routeId });
    
    if (!route) {
      throw new Gin7Error('ROUTE_NOT_FOUND', 'Trade route not found');
    }

    route.status = 'ACTIVE';
    route.statusReason = undefined;
    route.nextShipment = new Date();  // Immediately available
    
    await route.save();
    return route;
  }

  /**
   * Pause a route
   */
  static async pauseRoute(
    sessionId: string,
    routeId: string,
    reason?: string
  ): Promise<ITradeRoute> {
    const route = await TradeRoute.findOne({ sessionId, routeId });
    
    if (!route) {
      throw new Gin7Error('ROUTE_NOT_FOUND', 'Trade route not found');
    }

    route.status = 'PAUSED';
    route.statusReason = reason || 'Manually paused';
    
    await route.save();
    return route;
  }

  /**
   * Delete a route
   */
  static async deleteRoute(
    sessionId: string,
    routeId: string
  ): Promise<void> {
    const result = await TradeRoute.deleteOne({ sessionId, routeId });
    
    if (result.deletedCount === 0) {
      throw new Gin7Error('ROUTE_NOT_FOUND', 'Trade route not found');
    }
  }

  /**
   * Update route items
   */
  static async updateRouteItems(
    sessionId: string,
    routeId: string,
    items: ITradeItem[]
  ): Promise<ITradeRoute> {
    const route = await TradeRoute.findOne({ sessionId, routeId });
    
    if (!route) {
      throw new Gin7Error('ROUTE_NOT_FOUND', 'Trade route not found');
    }

    route.items = items;
    
    // Recalculate operating cost
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    route.operatingCost = Math.ceil(50 + route.distance * 5 + totalQuantity * 0.1);
    
    await route.save();
    return route;
  }

  /**
   * Execute a shipment for a route
   */
  static async executeShipment(
    sessionId: string,
    routeId: string,
    characterId: string
  ): Promise<IShipmentResult> {
    const route = await TradeRoute.findOne({ sessionId, routeId });
    
    if (!route) {
      return {
        routeId,
        success: false,
        transactions: [],
        totalProfit: 0,
        error: 'Trade route not found'
      };
    }

    const { canOperate, reason } = route.canOperate();
    if (!canOperate) {
      return {
        routeId,
        success: false,
        transactions: [],
        totalProfit: 0,
        error: reason
      };
    }

    // Check for piracy
    const piracyResult = route.rollPiracyCheck();
    if (piracyResult.attacked) {
      // Calculate cargo loss based on severity
      const lossPercent = piracyResult.severity * 0.2;  // 20%, 40%, or 60%
      const totalCargo = route.items.reduce((sum, item) => sum + item.quantity, 0);
      const cargoLost = Math.ceil(totalCargo * lossPercent);

      route.completeTrip(false, cargoLost);
      await route.save();

      return {
        routeId,
        success: false,
        transactions: [],
        totalProfit: -route.operatingCost,  // Lost operating costs
        piracyAttack: {
          occurred: true,
          severity: piracyResult.severity,
          cargoLost
        },
        error: `Pirate attack! Lost ${cargoLost} units of cargo`
      };
    }

    // Get prices at both locations
    const sourcePrices = await MarketService.getMarketPrices(sessionId, route.sourceId);
    const targetPrices = await MarketService.getMarketPrices(sessionId, route.targetId);

    const sourcePriceMap: Record<string, number> = {};
    const targetPriceMap: Record<string, number> = {};

    for (const p of sourcePrices) {
      sourcePriceMap[p.itemType] = p.buyPrice;
    }
    for (const p of targetPrices) {
      targetPriceMap[p.itemType] = p.sellPrice;
    }

    const transactions: Array<{
      itemType: ResourceType;
      quantity: number;
      buyPrice: number;
      sellPrice: number;
      profit: number;
    }> = [];

    let totalProfit = -route.operatingCost;  // Start with operating cost as expense

    // Execute each item trade
    for (const item of route.items) {
      const buyPrice = sourcePriceMap[item.itemType] || 0;
      const sellPrice = targetPriceMap[item.itemType] || 0;

      // Check price thresholds
      if (item.minBuyPrice && buyPrice > item.minBuyPrice) {
        continue;  // Skip - price too high at source
      }
      if (item.maxSellPrice && sellPrice < item.maxSellPrice) {
        continue;  // Skip - price too low at target
      }

      const buyCost = buyPrice * item.quantity * (1 + route.sourceTariff);
      const sellRevenue = sellPrice * item.quantity * (1 - route.targetTariff);
      const profit = sellRevenue - buyCost;

      transactions.push({
        itemType: item.itemType,
        quantity: item.quantity,
        buyPrice,
        sellPrice,
        profit: Math.round(profit)
      });

      totalProfit += profit;

      // Record transactions on route
      route.recordTransaction({
        type: 'BUY',
        itemType: item.itemType,
        quantity: item.quantity,
        unitPrice: buyPrice,
        totalAmount: Math.round(buyCost),
        fee: Math.round(buyCost * route.sourceTariff),
        tax: 0,
        locationId: route.sourceId
      });

      route.recordTransaction({
        type: 'SELL',
        itemType: item.itemType,
        quantity: item.quantity,
        unitPrice: sellPrice,
        totalAmount: Math.round(sellRevenue),
        fee: Math.round(sellRevenue * route.targetTariff),
        tax: 0,
        profit: Math.round(profit),
        locationId: route.targetId
      });
    }

    // Complete trip
    route.completeTrip(true);
    await route.save();

    return {
      routeId,
      success: true,
      transactions,
      totalProfit: Math.round(totalProfit),
      piracyAttack: {
        occurred: false,
        severity: 0,
        cargoLost: 0
      }
    };
  }

  /**
   * Process all due shipments (called by scheduler)
   */
  static async processDueShipments(sessionId: string): Promise<IShipmentResult[]> {
    const dueRoutes = await TradeRoute.getDueRoutes(sessionId);
    const results: IShipmentResult[] = [];

    for (const route of dueRoutes) {
      const result = await this.executeShipment(
        sessionId,
        route.routeId,
        route.ownerId  // Use owner as executor
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Get routes for a character
   */
  static async getCharacterRoutes(
    sessionId: string,
    ownerId: string
  ): Promise<ITradeRoute[]> {
    return TradeRoute.find({
      sessionId,
      ownerId
    }).sort({ averageProfitPerTrip: -1 });
  }

  /**
   * Get routes for a faction
   */
  static async getFactionRoutes(
    sessionId: string,
    factionId: string
  ): Promise<ITradeRoute[]> {
    return TradeRoute.find({
      sessionId,
      factionId
    }).sort({ averageProfitPerTrip: -1 });
  }

  /**
   * Calculate route profitability estimate
   */
  static async estimateProfitability(
    sessionId: string,
    sourceId: string,
    targetId: string,
    items: ITradeItem[],
    distance: number
  ): Promise<{
    estimatedProfit: number;
    details: Array<{
      itemType: ResourceType;
      buyPrice: number;
      sellPrice: number;
      quantity: number;
      itemProfit: number;
    }>;
    operatingCost: number;
    travelTime: number;
  }> {
    const sourcePrices = await MarketService.getMarketPrices(sessionId, sourceId);
    const targetPrices = await MarketService.getMarketPrices(sessionId, targetId);

    const sourcePriceMap: Record<string, number> = {};
    const targetPriceMap: Record<string, number> = {};

    for (const p of sourcePrices) {
      sourcePriceMap[p.itemType] = p.buyPrice;
    }
    for (const p of targetPrices) {
      targetPriceMap[p.itemType] = p.sellPrice;
    }

    const details: Array<{
      itemType: ResourceType;
      buyPrice: number;
      sellPrice: number;
      quantity: number;
      itemProfit: number;
    }> = [];

    let totalProfit = 0;

    for (const item of items) {
      const buyPrice = sourcePriceMap[item.itemType] || 0;
      const sellPrice = targetPriceMap[item.itemType] || 0;
      const itemProfit = (sellPrice - buyPrice) * item.quantity;

      details.push({
        itemType: item.itemType,
        buyPrice,
        sellPrice,
        quantity: item.quantity,
        itemProfit: Math.round(itemProfit)
      });

      totalProfit += itemProfit;
    }

    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const operatingCost = Math.ceil(50 + distance * 5 + totalQuantity * 0.1);
    const travelTime = Math.max(1, Math.ceil(distance / 10));

    return {
      estimatedProfit: Math.round(totalProfit - operatingCost),
      details,
      operatingCost,
      travelTime
    };
  }

  /**
   * Block routes through a location (e.g., during war)
   */
  static async blockRoutesThrough(
    sessionId: string,
    locationId: string,
    reason: string
  ): Promise<number> {
    const result = await TradeRoute.updateMany(
      {
        sessionId,
        status: 'ACTIVE',
        $or: [
          { sourceId: locationId },
          { targetId: locationId }
        ]
      },
      {
        $set: {
          status: 'BLOCKED',
          statusReason: reason
        }
      }
    );

    return result.modifiedCount;
  }

  /**
   * Unblock routes through a location
   */
  static async unblockRoutesThrough(
    sessionId: string,
    locationId: string
  ): Promise<number> {
    const result = await TradeRoute.updateMany(
      {
        sessionId,
        status: 'BLOCKED',
        $or: [
          { sourceId: locationId },
          { targetId: locationId }
        ]
      },
      {
        $set: {
          status: 'ACTIVE',
          statusReason: undefined
        }
      }
    );

    return result.modifiedCount;
  }
}

export default TradeRouteService;

