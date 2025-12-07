import mongoose from 'mongoose';
import { MarketPrice, IMarketPrice, BASE_PRICES } from '../../models/gin7/MarketPrice';
import { Warehouse, ResourceType, IWarehouse } from '../../models/gin7/Warehouse';
import { Character } from '../../models/gin7/Character';
import { Gin7Error } from '../../common/errors/gin7-errors';

/**
 * Transaction result
 */
export interface ITransactionResult {
  success: boolean;
  transactionId?: string;
  itemType: ResourceType;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  fee: number;
  tax: number;
  newBalance?: number;
  error?: string;
}

/**
 * Market price info
 */
export interface IMarketInfo {
  itemType: ResourceType;
  basePrice: number;
  currentPrice: number;
  buyPrice: number;        // Price including fees
  sellPrice: number;       // Price after fees
  supply: number;
  demand: number;
  trend: number;           // Price trend (-1 to +1)
  available: number;       // Available for purchase
}

/**
 * MarketService
 * Handles market operations: buy, sell, price queries
 */
export class MarketService {
  /**
   * Get market prices for a location
   */
  static async getMarketPrices(
    sessionId: string,
    locationId: string,
    quantity: number = 1
  ): Promise<IMarketInfo[]> {
    const markets = await MarketPrice.find({
      sessionId,
      locationId,
      isBlocked: false
    });

    return markets.map(market => ({
      itemType: market.itemType,
      basePrice: market.basePrice,
      currentPrice: market.currentPrice,
      buyPrice: market.getBuyPrice(quantity) / quantity,
      sellPrice: market.getSellPrice(quantity) / quantity,
      supply: market.supply,
      demand: market.demand,
      trend: market.getPriceTrend(),
      available: market.supply
    }));
  }

  /**
   * Get single item price
   */
  static async getItemPrice(
    sessionId: string,
    locationId: string,
    itemType: ResourceType
  ): Promise<IMarketPrice | null> {
    return MarketPrice.findOne({
      sessionId,
      locationId,
      itemType,
      isBlocked: false
    });
  }

  /**
   * Buy items from market
   */
  static async buy(
    sessionId: string,
    userId: string,
    characterId: string,
    locationId: string,
    itemType: ResourceType,
    quantity: number
  ): Promise<ITransactionResult> {
    if (quantity <= 0) {
      return {
        success: false,
        itemType,
        quantity,
        unitPrice: 0,
        totalAmount: 0,
        fee: 0,
        tax: 0,
        error: 'Quantity must be positive'
      };
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Get market
      const market = await MarketPrice.findOne({
        sessionId,
        locationId,
        itemType
      }).session(session);

      if (!market) {
        throw new Gin7Error('MARKET_NOT_FOUND', 'Market not found for this location');
      }

      if (market.isBlocked) {
        throw new Gin7Error('MARKET_BLOCKED', market.blockReason || 'Trading is blocked');
      }

      // 2. Check supply
      if (market.supply < quantity) {
        throw new Gin7Error('INSUFFICIENT_SUPPLY', `Only ${market.supply} available`);
      }

      // 3. Calculate prices
      const unitPrice = market.currentPrice;
      const subtotal = unitPrice * quantity;
      const fee = Math.ceil(subtotal * market.buyFee);
      const tax = Math.ceil(subtotal * market.taxRate);
      const totalAmount = subtotal + fee + tax;

      // 4. Get buyer's warehouse (at location)
      const buyerWarehouse = await Warehouse.findOne({
        sessionId,
        ownerId: locationId, // Planet warehouse
        ownerType: 'PLANET'
      }).session(session);

      if (!buyerWarehouse) {
        throw new Gin7Error('WAREHOUSE_NOT_FOUND', 'No warehouse at this location');
      }

      // 5. Check buyer has enough credits
      const creditsItem = buyerWarehouse.items.find(i => i.type === 'credits');
      const availableCredits = creditsItem ? (creditsItem.amount - creditsItem.reserved) : 0;

      if (availableCredits < totalAmount) {
        throw new Gin7Error('INSUFFICIENT_CREDITS', `Need ${totalAmount} credits, have ${availableCredits}`);
      }

      // 6. Check warehouse capacity
      if (!buyerWarehouse.hasCapacity(quantity)) {
        throw new Gin7Error('WAREHOUSE_FULL', 'Not enough warehouse capacity');
      }

      // 7. Execute transaction
      // Deduct credits
      buyerWarehouse.removeResource('credits', totalAmount, false);
      
      // Add purchased items
      buyerWarehouse.addResource(itemType, quantity);

      // 8. Update market
      market.supply -= quantity;
      market.demand = Math.min(1000, market.demand + Math.ceil(quantity / 10)); // Buying increases demand
      market.totalBought += quantity;
      market.lastTradeAt = new Date();
      market.recalculatePrice();

      // 9. Record transaction in warehouse
      const transactionId = `BUY-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      buyerWarehouse.recentTransactions.unshift({
        transactionId,
        timestamp: new Date(),
        type: 'TRANSFER',
        sourceId: market.marketId,
        targetId: buyerWarehouse.warehouseId,
        items: [{ type: itemType, amount: quantity }],
        executedBy: characterId,
        note: `Bought ${quantity} ${itemType} for ${totalAmount} credits`
      });

      // Keep only last 50 transactions
      if (buyerWarehouse.recentTransactions.length > 50) {
        buyerWarehouse.recentTransactions = buyerWarehouse.recentTransactions.slice(0, 50);
      }

      // 10. Save all changes
      await Promise.all([
        market.save({ session }),
        buyerWarehouse.save({ session })
      ]);

      await session.commitTransaction();

      const newCredits = buyerWarehouse.items.find(i => i.type === 'credits');

      return {
        success: true,
        transactionId,
        itemType,
        quantity,
        unitPrice,
        totalAmount,
        fee,
        tax,
        newBalance: newCredits?.amount || 0
      };

    } catch (error) {
      await session.abortTransaction();
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        itemType,
        quantity,
        unitPrice: 0,
        totalAmount: 0,
        fee: 0,
        tax: 0,
        error: errorMessage
      };
    } finally {
      session.endSession();
    }
  }

  /**
   * Sell items to market
   */
  static async sell(
    sessionId: string,
    userId: string,
    characterId: string,
    locationId: string,
    itemType: ResourceType,
    quantity: number
  ): Promise<ITransactionResult> {
    if (quantity <= 0) {
      return {
        success: false,
        itemType,
        quantity,
        unitPrice: 0,
        totalAmount: 0,
        fee: 0,
        tax: 0,
        error: 'Quantity must be positive'
      };
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Get market
      const market = await MarketPrice.findOne({
        sessionId,
        locationId,
        itemType
      }).session(session);

      if (!market) {
        throw new Gin7Error('MARKET_NOT_FOUND', 'Market not found for this location');
      }

      if (market.isBlocked) {
        throw new Gin7Error('MARKET_BLOCKED', market.blockReason || 'Trading is blocked');
      }

      // 2. Check market capacity
      if (market.supply + quantity > market.maxSupply) {
        throw new Gin7Error('MARKET_FULL', 'Market cannot accept more of this item');
      }

      // 3. Calculate prices
      const unitPrice = market.currentPrice;
      const subtotal = unitPrice * quantity;
      const fee = Math.floor(subtotal * market.sellFee);
      const tax = Math.floor(subtotal * market.taxRate);
      const totalAmount = subtotal - fee - tax;

      // 4. Get seller's warehouse
      const sellerWarehouse = await Warehouse.findOne({
        sessionId,
        ownerId: locationId,
        ownerType: 'PLANET'
      }).session(session);

      if (!sellerWarehouse) {
        throw new Gin7Error('WAREHOUSE_NOT_FOUND', 'No warehouse at this location');
      }

      // 5. Check seller has items
      const itemEntry = sellerWarehouse.items.find(i => i.type === itemType);
      const availableItems = itemEntry ? (itemEntry.amount - itemEntry.reserved) : 0;

      if (availableItems < quantity) {
        throw new Gin7Error('INSUFFICIENT_ITEMS', `Have ${availableItems}, trying to sell ${quantity}`);
      }

      // 6. Execute transaction
      // Remove items
      sellerWarehouse.removeResource(itemType, quantity, false);
      
      // Add credits
      sellerWarehouse.addResource('credits', totalAmount);

      // 7. Update market
      market.supply += quantity;
      market.demand = Math.max(0, market.demand - Math.ceil(quantity / 10)); // Selling decreases demand
      market.totalSold += quantity;
      market.lastTradeAt = new Date();
      market.recalculatePrice();

      // 8. Record transaction
      const transactionId = `SELL-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      sellerWarehouse.recentTransactions.unshift({
        transactionId,
        timestamp: new Date(),
        type: 'TRANSFER',
        sourceId: sellerWarehouse.warehouseId,
        targetId: market.marketId,
        items: [{ type: itemType, amount: quantity }],
        executedBy: characterId,
        note: `Sold ${quantity} ${itemType} for ${totalAmount} credits`
      });

      if (sellerWarehouse.recentTransactions.length > 50) {
        sellerWarehouse.recentTransactions = sellerWarehouse.recentTransactions.slice(0, 50);
      }

      // 9. Save all changes
      await Promise.all([
        market.save({ session }),
        sellerWarehouse.save({ session })
      ]);

      await session.commitTransaction();

      const newCredits = sellerWarehouse.items.find(i => i.type === 'credits');

      return {
        success: true,
        transactionId,
        itemType,
        quantity,
        unitPrice,
        totalAmount,
        fee,
        tax,
        newBalance: newCredits?.amount || 0
      };

    } catch (error) {
      await session.abortTransaction();
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        itemType,
        quantity,
        unitPrice: 0,
        totalAmount: 0,
        fee: 0,
        tax: 0,
        error: errorMessage
      };
    } finally {
      session.endSession();
    }
  }

  /**
   * Process daily market updates (supply/demand changes)
   * Called by TimeEngine on DAY_START
   */
  static async processDailyUpdate(sessionId: string): Promise<void> {
    const markets = await MarketPrice.find({ sessionId });

    for (const market of markets) {
      // Apply daily production
      market.supply = Math.min(market.maxSupply, market.supply + market.dailyProduction);
      
      // Apply daily consumption
      market.supply = Math.max(0, market.supply - market.dailyConsumption);
      
      // Normalize demand towards 500 (equilibrium)
      if (market.demand > 500) {
        market.demand = Math.max(500, market.demand - 10);
      } else if (market.demand < 500) {
        market.demand = Math.min(500, market.demand + 10);
      }

      // Recalculate price
      market.recalculatePrice();
      
      // Record price history
      market.recordPriceHistory();

      await market.save();
    }
  }

  /**
   * Apply market event (war, famine, etc.)
   */
  static async applyMarketEvent(
    sessionId: string,
    locationId: string,
    eventType: 'WAR' | 'FAMINE' | 'BOOM' | 'BLOCKADE' | 'DISCOVERY',
    itemTypes?: ResourceType[]
  ): Promise<void> {
    const query: Record<string, unknown> = { sessionId };
    
    if (locationId) {
      query.locationId = locationId;
    }
    
    if (itemTypes && itemTypes.length > 0) {
      query.itemType = { $in: itemTypes };
    }

    const markets = await MarketPrice.find(query);

    for (const market of markets) {
      switch (eventType) {
        case 'WAR':
          // War increases demand for military goods, decreases civilian
          if (['ammo', 'fuel', 'shipParts'].includes(market.itemType)) {
            market.eventModifier = 0.5;  // +50% price
            market.demand = Math.min(1000, market.demand + 200);
          } else if (market.itemType === 'food') {
            market.eventModifier = 0.3;  // +30% price
          }
          break;

        case 'FAMINE':
          if (market.itemType === 'food') {
            market.eventModifier = 1.0;  // +100% price
            market.supply = Math.floor(market.supply * 0.3);
            market.demand = 1000;
          }
          break;

        case 'BOOM':
          market.eventModifier = -0.2;  // -20% price
          market.supply = Math.min(market.maxSupply, Math.floor(market.supply * 1.5));
          break;

        case 'BLOCKADE':
          market.isBlocked = true;
          market.blockReason = 'Trade blockade in effect';
          break;

        case 'DISCOVERY':
          if (['minerals', 'rareMetals'].includes(market.itemType)) {
            market.eventModifier = -0.4;  // -40% price
            market.supply = Math.min(market.maxSupply, market.supply + 2000);
            market.dailyProduction *= 2;
          }
          break;
      }

      market.recalculatePrice();
      await market.save();
    }
  }

  /**
   * Clear market event
   */
  static async clearMarketEvent(
    sessionId: string,
    locationId: string
  ): Promise<void> {
    await MarketPrice.updateMany(
      { sessionId, locationId },
      { 
        $set: { 
          eventModifier: 0, 
          isBlocked: false, 
          blockReason: undefined 
        } 
      }
    );
  }

  /**
   * Find best buy/sell opportunities
   */
  static async findArbitrage(
    sessionId: string,
    factionId: string
  ): Promise<Array<{
    itemType: ResourceType;
    buyLocation: string;
    buyPrice: number;
    sellLocation: string;
    sellPrice: number;
    profitPerUnit: number;
  }>> {
    // Get all markets accessible to faction
    const markets = await MarketPrice.find({
      sessionId,
      $or: [
        { factionId },
        { marketType: 'PHEZZAN' }  // Phezzan is open to all
      ],
      isBlocked: false
    });

    // Group by item type
    const byItem: Record<ResourceType, IMarketPrice[]> = {} as Record<ResourceType, IMarketPrice[]>;
    for (const market of markets) {
      if (!byItem[market.itemType]) {
        byItem[market.itemType] = [];
      }
      byItem[market.itemType].push(market);
    }

    const opportunities: Array<{
      itemType: ResourceType;
      buyLocation: string;
      buyPrice: number;
      sellLocation: string;
      sellPrice: number;
      profitPerUnit: number;
    }> = [];

    // Find arbitrage opportunities
    for (const [itemType, itemMarkets] of Object.entries(byItem)) {
      if (itemMarkets.length < 2) continue;

      // Sort by current price
      itemMarkets.sort((a, b) => a.currentPrice - b.currentPrice);

      const cheapest = itemMarkets[0];
      const expensive = itemMarkets[itemMarkets.length - 1];

      const buyPrice = cheapest.getBuyPrice(1);
      const sellPrice = expensive.getSellPrice(1);
      const profit = sellPrice - buyPrice;

      if (profit > 0) {
        opportunities.push({
          itemType: itemType as ResourceType,
          buyLocation: cheapest.locationId,
          buyPrice,
          sellLocation: expensive.locationId,
          sellPrice,
          profitPerUnit: profit
        });
      }
    }

    // Sort by profit
    opportunities.sort((a, b) => b.profitPerUnit - a.profitPerUnit);

    return opportunities.slice(0, 10);  // Top 10 opportunities
  }
}

export default MarketService;

