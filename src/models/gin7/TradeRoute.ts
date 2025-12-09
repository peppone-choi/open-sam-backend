import mongoose, { Schema, Document, Model } from 'mongoose';
import { ResourceType } from './Warehouse';

/**
 * Trade route status
 */
export type TradeRouteStatus =
  | 'ACTIVE'        // 운영 중
  | 'PAUSED'        // 일시 중지
  | 'BLOCKED'       // 차단됨 (전쟁/봉쇄)
  | 'DISRUPTED'     // 교란됨 (해적)
  | 'PENDING';      // 설정 대기

/**
 * Trade item in a route
 */
export interface ITradeItem {
  itemType: ResourceType;
  quantity: number;        // Amount per shipment
  autoPurchase: boolean;   // Auto-buy at source
  autoSell: boolean;       // Auto-sell at destination
  minBuyPrice: number;     // Buy only if below this price
  maxSellPrice: number;    // Sell only if above this price
}

/**
 * Trade transaction log
 */
export interface ITradeTransaction {
  transactionId: string;
  timestamp: Date;
  type: 'BUY' | 'SELL' | 'TRANSFER';
  itemType: ResourceType;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  fee: number;
  tax: number;
  profit?: number;
  locationId: string;
}

/**
 * Trade Route Schema
 * Defines automated trade between two locations
 */
export interface ITradeRoute extends Document {
  routeId: string;
  sessionId: string;
  
  // Owner
  ownerId: string;           // Character ID (merchant)
  factionId: string;
  
  // Route endpoints
  sourceId: string;          // Origin planet/station ID
  sourceType: 'PLANET' | 'STATION';
  sourceName: string;
  
  targetId: string;          // Destination planet/station ID
  targetType: 'PLANET' | 'STATION';
  targetName: string;
  
  // Route properties
  name: string;
  distance: number;          // Distance in parsecs
  travelTime: number;        // Travel time in turns
  
  // Items to trade
  items: ITradeItem[];
  
  // Schedule
  frequency: number;         // Turns between shipments (1 = every turn)
  lastShipment?: Date;
  nextShipment?: Date;
  
  // Status
  status: TradeRouteStatus;
  statusReason?: string;
  
  // Assigned fleet (optional - for protected trade)
  fleetId?: string;
  escortRequired: boolean;
  
  // Risk factors
  piracyRisk: number;        // 0-100 probability of pirate attack
  interceptRisk: number;     // 0-100 probability of enemy interception
  
  // Financial
  operatingCost: number;     // Cost per shipment (fuel, crew, etc.)
  totalRevenue: number;      // Cumulative revenue
  totalCost: number;         // Cumulative costs
  totalProfit: number;       // Cumulative profit
  averageProfitPerTrip: number;
  
  // Tariffs & Fees
  sourceTariff: number;      // Export tariff at source
  targetTariff: number;      // Import tariff at destination
  transitFees: number;       // Fees for passing through systems
  
  // Transaction history
  transactions: ITradeTransaction[];
  
  // Statistics
  totalTrips: number;
  successfulTrips: number;
  failedTrips: number;
  cargoLost: number;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  data: Record<string, unknown>;
  
  // Methods
  calculateEstimatedProfit(sourcePrices: Record<ResourceType, number>, targetPrices: Record<ResourceType, number>): number;
  recordTransaction(transaction: Omit<ITradeTransaction, 'transactionId' | 'timestamp'>): void;
  completeTrip(success: boolean, cargoLostAmount?: number): void;
  canOperate(): { canOperate: boolean; reason?: string };
  rollPiracyCheck(): { attacked: boolean; severity: number };
}

const TradeItemSchema = new Schema<ITradeItem>({
  itemType: {
    type: String,
    enum: ['food', 'fuel', 'ammo', 'minerals', 'credits', 'shipParts', 'energy', 'rareMetals', 'components'],
    required: true
  },
  quantity: { type: Number, required: true, min: 1 },
  autoPurchase: { type: Boolean, default: true },
  autoSell: { type: Boolean, default: true },
  minBuyPrice: { type: Number, default: 0 },
  maxSellPrice: { type: Number, default: Infinity }
}, { _id: false });

const TradeTransactionSchema = new Schema<ITradeTransaction>({
  transactionId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  type: {
    type: String,
    enum: ['BUY', 'SELL', 'TRANSFER'],
    required: true
  },
  itemType: { type: String, required: true },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  fee: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  profit: Number,
  locationId: { type: String, required: true }
}, { _id: false });

const TradeRouteSchema = new Schema<ITradeRoute>({
  routeId: { type: String, required: true },
  sessionId: { type: String, required: true },
  
  ownerId: { type: String, required: true },
  factionId: { type: String, required: true },
  
  // Source
  sourceId: { type: String, required: true },
  sourceType: {
    type: String,
    enum: ['PLANET', 'STATION'],
    default: 'PLANET'
  },
  sourceName: { type: String, required: true },
  
  // Target
  targetId: { type: String, required: true },
  targetType: {
    type: String,
    enum: ['PLANET', 'STATION'],
    default: 'PLANET'
  },
  targetName: { type: String, required: true },
  
  // Properties
  name: { type: String, required: true },
  distance: { type: Number, default: 1 },
  travelTime: { type: Number, default: 1 },
  
  // Items
  items: { type: [TradeItemSchema], default: [] },
  
  // Schedule
  frequency: { type: Number, default: 1, min: 1 },
  lastShipment: Date,
  nextShipment: Date,
  
  // Status
  status: {
    type: String,
    enum: ['ACTIVE', 'PAUSED', 'BLOCKED', 'DISRUPTED', 'PENDING'],
    default: 'PENDING'
  },
  statusReason: String,
  
  // Fleet
  fleetId: String,
  escortRequired: { type: Boolean, default: false },
  
  // Risk
  piracyRisk: { type: Number, default: 5, min: 0, max: 100 },
  interceptRisk: { type: Number, default: 0, min: 0, max: 100 },
  
  // Financial
  operatingCost: { type: Number, default: 100 },
  totalRevenue: { type: Number, default: 0 },
  totalCost: { type: Number, default: 0 },
  totalProfit: { type: Number, default: 0 },
  averageProfitPerTrip: { type: Number, default: 0 },
  
  // Tariffs
  sourceTariff: { type: Number, default: 0.05 },
  targetTariff: { type: Number, default: 0.05 },
  transitFees: { type: Number, default: 0 },
  
  // History
  transactions: {
    type: [TradeTransactionSchema],
    default: [],
    validate: {
      validator: function(v: ITradeTransaction[]) {
        return v.length <= 100;
      },
      message: 'Transaction history limited to 100 entries'
    }
  },
  
  // Statistics
  totalTrips: { type: Number, default: 0 },
  successfulTrips: { type: Number, default: 0 },
  failedTrips: { type: Number, default: 0 },
  cargoLost: { type: Number, default: 0 },
  
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

// Indexes
TradeRouteSchema.index({ routeId: 1, sessionId: 1 }, { unique: true });
TradeRouteSchema.index({ sessionId: 1, ownerId: 1 });
TradeRouteSchema.index({ sessionId: 1, factionId: 1 });
TradeRouteSchema.index({ sessionId: 1, sourceId: 1 });
TradeRouteSchema.index({ sessionId: 1, targetId: 1 });
TradeRouteSchema.index({ sessionId: 1, status: 1 });
TradeRouteSchema.index({ sessionId: 1, nextShipment: 1 });

/**
 * Calculate estimated profit for a single trip
 */
TradeRouteSchema.methods.calculateEstimatedProfit = function(
  sourcePrices: Record<ResourceType, number>,
  targetPrices: Record<ResourceType, number>
): number {
  let totalProfit = 0;
  
  for (const item of this.items) {
    const buyPrice = sourcePrices[item.itemType] || 0;
    const sellPrice = targetPrices[item.itemType] || 0;
    
    // Check price thresholds
    if (item.minBuyPrice && buyPrice > item.minBuyPrice) continue;
    if (item.maxSellPrice && sellPrice < item.maxSellPrice) continue;
    
    const buyCost = buyPrice * item.quantity * (1 + this.sourceTariff);
    const sellRevenue = sellPrice * item.quantity * (1 - this.targetTariff);
    
    totalProfit += sellRevenue - buyCost;
  }
  
  // Subtract operating costs
  totalProfit -= this.operatingCost;
  totalProfit -= this.transitFees;
  
  return Math.round(totalProfit);
};

/**
 * Record a completed trade transaction
 */
TradeRouteSchema.methods.recordTransaction = function(
  transaction: Omit<ITradeTransaction, 'transactionId' | 'timestamp'>
): void {
  const fullTransaction: ITradeTransaction = {
    ...transaction,
    transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    timestamp: new Date()
  };
  
  this.transactions.unshift(fullTransaction);
  
  // Keep only last 100 transactions
  if (this.transactions.length > 100) {
    this.transactions = this.transactions.slice(0, 100);
  }
  
  // Update totals
  if (transaction.type === 'SELL') {
    this.totalRevenue += transaction.totalAmount;
  } else if (transaction.type === 'BUY') {
    this.totalCost += transaction.totalAmount;
  }
  
  this.totalProfit = this.totalRevenue - this.totalCost - (this.totalTrips * this.operatingCost);
};

/**
 * Complete a trip
 */
TradeRouteSchema.methods.completeTrip = function(success: boolean, cargoLostAmount?: number): void {
  this.totalTrips++;
  
  if (success) {
    this.successfulTrips++;
  } else {
    this.failedTrips++;
    if (cargoLostAmount) {
      this.cargoLost += cargoLostAmount;
    }
  }
  
  this.lastShipment = new Date();
  
  // Calculate next shipment time (in turns)
  const msPerTurn = 60 * 60 * 1000; // 1 hour = 1 turn (adjust as needed)
  this.nextShipment = new Date(Date.now() + (this.frequency * msPerTurn));
  
  // Update average profit
  if (this.successfulTrips > 0) {
    this.averageProfitPerTrip = Math.round(this.totalProfit / this.successfulTrips);
  }
};

/**
 * Check if route can operate (no blockers)
 */
TradeRouteSchema.methods.canOperate = function(): { canOperate: boolean; reason?: string } {
  if (this.status === 'BLOCKED') {
    return { canOperate: false, reason: this.statusReason || 'Route is blocked' };
  }
  
  if (this.status === 'PAUSED') {
    return { canOperate: false, reason: 'Route is paused' };
  }
  
  if (this.items.length === 0) {
    return { canOperate: false, reason: 'No items configured for trade' };
  }
  
  return { canOperate: true };
};

/**
 * Calculate piracy check result
 */
TradeRouteSchema.methods.rollPiracyCheck = function(): { attacked: boolean; severity: number } {
  const roll = Math.random() * 100;
  
  if (roll < this.piracyRisk) {
    // Pirate attack!
    // Severity 1-3 based on how badly the roll failed
    const severity = roll < this.piracyRisk / 3 ? 3 : roll < this.piracyRisk / 1.5 ? 2 : 1;
    return { attacked: true, severity };
  }
  
  return { attacked: false, severity: 0 };
};

/**
 * Static: Find profitable routes between two locations
 */
TradeRouteSchema.statics.findProfitableRoutes = async function(
  sessionId: string,
  factionId: string,
  minProfit: number = 100
): Promise<ITradeRoute[]> {
  return this.find({
    sessionId,
    factionId,
    status: 'ACTIVE',
    averageProfitPerTrip: { $gte: minProfit }
  }).sort({ averageProfitPerTrip: -1 }).limit(20);
};

/**
 * Static: Get routes due for shipment
 */
TradeRouteSchema.statics.getDueRoutes = async function(
  sessionId: string
): Promise<ITradeRoute[]> {
  return this.find({
    sessionId,
    status: 'ACTIVE',
    nextShipment: { $lte: new Date() }
  });
};

export interface ITradeRouteModel extends Model<ITradeRoute> {
  findProfitableRoutes(
    sessionId: string,
    factionId: string,
    minProfit?: number
  ): Promise<ITradeRoute[]>;
  getDueRoutes(sessionId: string): Promise<ITradeRoute[]>;
}

export const TradeRoute: ITradeRouteModel = 
  (mongoose.models.TradeRoute as ITradeRouteModel) || mongoose.model<ITradeRoute, ITradeRouteModel>('TradeRoute', TradeRouteSchema);

