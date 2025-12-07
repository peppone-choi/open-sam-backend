import mongoose, { Schema, Document, Model } from 'mongoose';
import { ResourceType } from './Warehouse';

/**
 * Market type - determines pricing rules
 */
export type MarketType = 
  | 'PLANET'        // 행성 일반 시장
  | 'STATION'       // 우주 정거장
  | 'PHEZZAN'       // 페잔 중계 무역
  | 'BLACK_MARKET'; // 암시장

/**
 * Item category for market classification
 */
export type ItemCategory =
  | 'RESOURCE'      // 자원 (food, fuel, minerals 등)
  | 'EQUIPMENT'     // 장비 (ship parts, components)
  | 'LUXURY'        // 사치품
  | 'CONTRABAND';   // 금지 물품

/**
 * Base prices for all resource types (in credits)
 */
export const BASE_PRICES: Record<ResourceType, number> = {
  food: 10,
  fuel: 25,
  ammo: 30,
  minerals: 15,
  credits: 1,
  shipParts: 100,
  energy: 20,
  rareMetals: 200,
  components: 150
};

/**
 * Price history entry for trend analysis
 */
export interface IPriceHistory {
  price: number;
  supply: number;
  demand: number;
  timestamp: Date;
}

/**
 * Market Price Schema
 * Tracks dynamic pricing per item per location
 */
export interface IMarketPrice extends Document {
  marketId: string;
  sessionId: string;
  
  // Location
  locationId: string;        // Planet ID or Station ID
  locationType: 'PLANET' | 'STATION';
  factionId?: string;
  
  // Market type
  marketType: MarketType;
  
  // Item info
  itemType: ResourceType;
  category: ItemCategory;
  
  // Supply & Demand
  supply: number;            // Current available stock
  maxSupply: number;         // Maximum stock capacity
  demand: number;            // Demand level (0-1000, 500 = normal)
  dailyProduction: number;   // Local production per day
  dailyConsumption: number;  // Local consumption per day
  
  // Pricing
  basePrice: number;         // Base price (from static table)
  currentPrice: number;      // Current calculated price
  minPrice: number;          // Price floor (basePrice * 0.2)
  maxPrice: number;          // Price ceiling (basePrice * 5.0)
  
  // Modifiers
  supplyModifier: number;    // -0.5 to +0.5 based on supply
  demandModifier: number;    // -0.5 to +0.5 based on demand
  distanceModifier: number;  // 0 to +0.3 based on distance from capital
  eventModifier: number;     // Special event effects
  taxRate: number;           // Local tax rate (0-0.3)
  
  // Transaction fees
  buyFee: number;            // Fee when buying (0-0.1)
  sellFee: number;           // Fee when selling (0-0.1)
  
  // Restrictions
  isBlocked: boolean;        // Trading blocked
  blockReason?: string;
  requiresLicense: boolean;  // Requires trade license
  minReputation: number;     // Minimum reputation to trade
  
  // Price history (last 30 days)
  priceHistory: IPriceHistory[];
  
  // Statistics
  totalBought: number;       // Total quantity bought
  totalSold: number;         // Total quantity sold
  lastTradeAt?: Date;
  
  // Metadata
  updatedAt: Date;
  data: Record<string, unknown>;
}

const PriceHistorySchema = new Schema<IPriceHistory>({
  price: { type: Number, required: true },
  supply: { type: Number, required: true },
  demand: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const MarketPriceSchema = new Schema<IMarketPrice>({
  marketId: { type: String, required: true },
  sessionId: { type: String, required: true },
  
  locationId: { type: String, required: true },
  locationType: {
    type: String,
    enum: ['PLANET', 'STATION'],
    required: true
  },
  factionId: String,
  
  marketType: {
    type: String,
    enum: ['PLANET', 'STATION', 'PHEZZAN', 'BLACK_MARKET'],
    default: 'PLANET'
  },
  
  itemType: {
    type: String,
    enum: ['food', 'fuel', 'ammo', 'minerals', 'credits', 'shipParts', 'energy', 'rareMetals', 'components'],
    required: true
  },
  category: {
    type: String,
    enum: ['RESOURCE', 'EQUIPMENT', 'LUXURY', 'CONTRABAND'],
    default: 'RESOURCE'
  },
  
  // Supply & Demand
  supply: { type: Number, default: 1000, min: 0 },
  maxSupply: { type: Number, default: 10000, min: 0 },
  demand: { type: Number, default: 500, min: 0, max: 1000 },
  dailyProduction: { type: Number, default: 100, min: 0 },
  dailyConsumption: { type: Number, default: 100, min: 0 },
  
  // Pricing
  basePrice: { type: Number, required: true },
  currentPrice: { type: Number, required: true },
  minPrice: { type: Number, required: true },
  maxPrice: { type: Number, required: true },
  
  // Modifiers
  supplyModifier: { type: Number, default: 0 },
  demandModifier: { type: Number, default: 0 },
  distanceModifier: { type: Number, default: 0 },
  eventModifier: { type: Number, default: 0 },
  taxRate: { type: Number, default: 0.05, min: 0, max: 0.5 },
  
  // Fees
  buyFee: { type: Number, default: 0.02, min: 0, max: 0.2 },
  sellFee: { type: Number, default: 0.03, min: 0, max: 0.2 },
  
  // Restrictions
  isBlocked: { type: Boolean, default: false },
  blockReason: String,
  requiresLicense: { type: Boolean, default: false },
  minReputation: { type: Number, default: 0 },
  
  // History
  priceHistory: {
    type: [PriceHistorySchema],
    default: [],
    validate: {
      validator: function(v: IPriceHistory[]) {
        return v.length <= 30;
      },
      message: 'Price history limited to 30 entries'
    }
  },
  
  // Statistics
  totalBought: { type: Number, default: 0 },
  totalSold: { type: Number, default: 0 },
  lastTradeAt: Date,
  
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

// Indexes
MarketPriceSchema.index({ marketId: 1, sessionId: 1 }, { unique: true });
MarketPriceSchema.index({ sessionId: 1, locationId: 1, itemType: 1 }, { unique: true });
MarketPriceSchema.index({ sessionId: 1, itemType: 1 });
MarketPriceSchema.index({ sessionId: 1, factionId: 1 });
MarketPriceSchema.index({ sessionId: 1, marketType: 1 });
MarketPriceSchema.index({ sessionId: 1, currentPrice: 1 });

/**
 * Calculate supply modifier based on current stock
 * High supply = lower prices, Low supply = higher prices
 */
MarketPriceSchema.methods.calculateSupplyModifier = function(): number {
  const supplyRatio = this.supply / this.maxSupply;
  
  // Supply ratio 0.5 = neutral (0 modifier)
  // Supply ratio 1.0 = -0.4 (40% cheaper)
  // Supply ratio 0.0 = +0.5 (50% more expensive)
  if (supplyRatio >= 0.5) {
    return -0.4 * (supplyRatio - 0.5) * 2; // -0.4 to 0
  } else {
    return 0.5 * (1 - supplyRatio * 2); // 0 to +0.5
  }
};

/**
 * Calculate demand modifier based on demand level
 * High demand = higher prices, Low demand = lower prices
 */
MarketPriceSchema.methods.calculateDemandModifier = function(): number {
  // Demand 500 = neutral (0 modifier)
  // Demand 1000 = +0.5 (50% more expensive)
  // Demand 0 = -0.3 (30% cheaper)
  const demandRatio = this.demand / 500;
  
  if (demandRatio >= 1) {
    return 0.5 * (demandRatio - 1); // 0 to +0.5
  } else {
    return -0.3 * (1 - demandRatio); // -0.3 to 0
  }
};

/**
 * Recalculate current price based on all modifiers
 */
MarketPriceSchema.methods.recalculatePrice = function(): number {
  this.supplyModifier = this.calculateSupplyModifier();
  this.demandModifier = this.calculateDemandModifier();
  
  const totalModifier = 1 + this.supplyModifier + this.demandModifier + 
                        this.distanceModifier + this.eventModifier;
  
  let newPrice = Math.round(this.basePrice * totalModifier);
  
  // Apply price bounds
  newPrice = Math.max(this.minPrice, Math.min(this.maxPrice, newPrice));
  
  this.currentPrice = newPrice;
  return newPrice;
};

/**
 * Get buy price including fees and tax
 */
MarketPriceSchema.methods.getBuyPrice = function(quantity: number): number {
  const subtotal = this.currentPrice * quantity;
  const fee = subtotal * this.buyFee;
  const tax = subtotal * this.taxRate;
  return Math.ceil(subtotal + fee + tax);
};

/**
 * Get sell price after fees and tax
 */
MarketPriceSchema.methods.getSellPrice = function(quantity: number): number {
  const subtotal = this.currentPrice * quantity;
  const fee = subtotal * this.sellFee;
  const tax = subtotal * this.taxRate;
  return Math.floor(subtotal - fee - tax);
};

/**
 * Record price in history
 */
MarketPriceSchema.methods.recordPriceHistory = function(): void {
  const entry: IPriceHistory = {
    price: this.currentPrice,
    supply: this.supply,
    demand: this.demand,
    timestamp: new Date()
  };
  
  this.priceHistory.unshift(entry);
  
  // Keep only last 30 entries
  if (this.priceHistory.length > 30) {
    this.priceHistory = this.priceHistory.slice(0, 30);
  }
};

/**
 * Get price trend (positive = rising, negative = falling)
 */
MarketPriceSchema.methods.getPriceTrend = function(): number {
  if (this.priceHistory.length < 2) return 0;
  
  const recent = this.priceHistory.slice(0, 5);
  const avgRecent = recent.reduce((sum, h) => sum + h.price, 0) / recent.length;
  
  const older = this.priceHistory.slice(5, 10);
  if (older.length === 0) return 0;
  
  const avgOlder = older.reduce((sum, h) => sum + h.price, 0) / older.length;
  
  return (avgRecent - avgOlder) / avgOlder;
};

/**
 * Static: Initialize market for a planet
 */
MarketPriceSchema.statics.initializePlanetMarket = async function(
  sessionId: string,
  planetId: string,
  factionId: string,
  planetData: { distanceFromCapital?: number; specialization?: string }
): Promise<IMarketPrice[]> {
  const markets: IMarketPrice[] = [];
  const resourceTypes: ResourceType[] = ['food', 'fuel', 'ammo', 'minerals', 'shipParts', 'energy', 'rareMetals', 'components'];
  
  // Distance modifier (further from capital = higher prices)
  const distanceMod = Math.min(0.3, (planetData.distanceFromCapital || 0) * 0.01);
  
  // Specialization affects local production
  const specialization = planetData.specialization || 'balanced';
  
  for (const itemType of resourceTypes) {
    const basePrice = BASE_PRICES[itemType];
    
    // Adjust production based on specialization
    let dailyProd = 100;
    let dailyCons = 100;
    
    if (specialization === 'agricultural' && itemType === 'food') {
      dailyProd = 300;
    } else if (specialization === 'industrial' && (itemType === 'shipParts' || itemType === 'components')) {
      dailyProd = 200;
    } else if (specialization === 'mining' && (itemType === 'minerals' || itemType === 'rareMetals')) {
      dailyProd = 250;
    }
    
    const market = new this({
      marketId: `MKT-${planetId}-${itemType}`,
      sessionId,
      locationId: planetId,
      locationType: 'PLANET',
      factionId,
      marketType: 'PLANET',
      itemType,
      category: ['shipParts', 'components', 'rareMetals'].includes(itemType) ? 'EQUIPMENT' : 'RESOURCE',
      supply: 1000,
      maxSupply: 10000,
      demand: 500,
      dailyProduction: dailyProd,
      dailyConsumption: dailyCons,
      basePrice,
      currentPrice: basePrice,
      minPrice: Math.floor(basePrice * 0.2),
      maxPrice: Math.ceil(basePrice * 5),
      distanceModifier: distanceMod
    });
    
    market.recalculatePrice();
    markets.push(market);
  }
  
  await this.insertMany(markets);
  return markets;
};

export interface IMarketPriceModel extends Model<IMarketPrice> {
  initializePlanetMarket(
    sessionId: string,
    planetId: string,
    factionId: string,
    planetData: { distanceFromCapital?: number; specialization?: string }
  ): Promise<IMarketPrice[]>;
}

export const MarketPrice: IMarketPriceModel = 
  mongoose.models.MarketPrice || mongoose.model<IMarketPrice, IMarketPriceModel>('MarketPrice', MarketPriceSchema);

