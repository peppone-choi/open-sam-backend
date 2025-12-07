import mongoose, { Schema, Document, Model, ClientSession } from 'mongoose';

/**
 * Resource types available in the game
 */
export type ResourceType =
  | 'food'           // 식량
  | 'fuel'           // 연료
  | 'ammo'           // 탄약
  | 'minerals'       // 광물
  | 'credits'        // 크레딧
  | 'shipParts'      // 함선 부품
  | 'energy'         // 에너지
  | 'rareMetals'     // 희귀 금속
  | 'components';    // 전자 부품

/**
 * Warehouse types (hierarchy)
 * PLANET: Central storage on a planet
 * FLEET: Fleet-level storage
 * UNIT: Individual ship cargo
 */
export type WarehouseType = 'PLANET' | 'FLEET' | 'UNIT';

/**
 * Resource item stored in warehouse
 */
export interface IResourceItem {
  type: ResourceType;
  amount: number;
  reserved: number;    // Amount reserved for pending operations
  lastUpdated: Date;
}

/**
 * Transaction log entry
 */
export interface ITransactionLog {
  transactionId: string;
  timestamp: Date;
  type: 'TRANSFER' | 'PRODUCTION' | 'CONSUMPTION' | 'ALLOCATION' | 'SUPPLY';
  sourceId?: string;
  targetId?: string;
  items: Array<{ type: ResourceType; amount: number }>;
  executedBy: string;  // Character ID
  note?: string;
}

/**
 * Warehouse Schema
 * Hierarchical storage system: Planet -> Fleet -> Unit
 */
export interface IWarehouse extends Document {
  warehouseId: string;
  sessionId: string;
  
  // Owner identification
  ownerId: string;       // Planet ID, Fleet ID, or Unit ID
  ownerType: WarehouseType;
  
  // Parent reference (for hierarchy)
  parentWarehouseId?: string;
  
  // Ownership & Access
  factionId?: string;
  managerId?: string;    // Character ID with management rights
  
  // Storage
  items: IResourceItem[];
  capacity: number;      // Total capacity (sum of all items cannot exceed)
  
  // Auto-supply settings
  autoSupply: {
    enabled: boolean;
    minLevels: Partial<Record<ResourceType, number>>;
    priority: number;    // Lower = higher priority for resupply
  };
  
  // Transaction history (recent only)
  recentTransactions: ITransactionLog[];
  
  // Lock for concurrent operations
  lockVersion: number;
  lockedUntil?: Date;
  lockedBy?: string;
  
  // Metadata
  data: Record<string, unknown>;
}

const ResourceItemSchema = new Schema<IResourceItem>({
  type: {
    type: String,
    enum: ['food', 'fuel', 'ammo', 'minerals', 'credits', 'shipParts', 'energy', 'rareMetals', 'components'],
    required: true
  },
  amount: { type: Number, default: 0, min: 0 },
  reserved: { type: Number, default: 0, min: 0 },
  lastUpdated: { type: Date, default: Date.now }
}, { _id: false });

const TransactionLogSchema = new Schema<ITransactionLog>({
  transactionId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  type: {
    type: String,
    enum: ['TRANSFER', 'PRODUCTION', 'CONSUMPTION', 'ALLOCATION', 'SUPPLY'],
    required: true
  },
  sourceId: String,
  targetId: String,
  items: [{
    type: { type: String, required: true },
    amount: { type: Number, required: true }
  }],
  executedBy: { type: String, required: true },
  note: String
}, { _id: false });

const WarehouseSchema = new Schema<IWarehouse>({
  warehouseId: { type: String, required: true },
  sessionId: { type: String, required: true },
  
  ownerId: { type: String, required: true },
  ownerType: {
    type: String,
    enum: ['PLANET', 'FLEET', 'UNIT'],
    required: true
  },
  
  parentWarehouseId: String,
  
  factionId: String,
  managerId: String,
  
  items: { type: [ResourceItemSchema], default: [] },
  capacity: { type: Number, default: 10000 },
  
  autoSupply: {
    enabled: { type: Boolean, default: false },
    minLevels: { type: Schema.Types.Mixed, default: {} },
    priority: { type: Number, default: 5 }
  },
  
  recentTransactions: { 
    type: [TransactionLogSchema], 
    default: [],
    // Keep only last 50 transactions
    validate: {
      validator: function(v: ITransactionLog[]) {
        return v.length <= 50;
      },
      message: 'Recent transactions cannot exceed 50 entries'
    }
  },
  
  lockVersion: { type: Number, default: 0 },
  lockedUntil: Date,
  lockedBy: String,
  
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

// Indexes
WarehouseSchema.index({ warehouseId: 1, sessionId: 1 }, { unique: true });
WarehouseSchema.index({ sessionId: 1, ownerId: 1 });
WarehouseSchema.index({ sessionId: 1, ownerType: 1 });
WarehouseSchema.index({ sessionId: 1, factionId: 1 });
WarehouseSchema.index({ sessionId: 1, parentWarehouseId: 1 });

/**
 * Get available amount (total - reserved)
 */
WarehouseSchema.methods.getAvailable = function(resourceType: ResourceType): number {
  const item = this.items.find((i: IResourceItem) => i.type === resourceType);
  if (!item) return 0;
  return Math.max(0, item.amount - item.reserved);
};

/**
 * Get total usage (sum of all items)
 */
WarehouseSchema.methods.getTotalUsage = function(): number {
  return this.items.reduce((sum: number, item: IResourceItem) => sum + item.amount, 0);
};

/**
 * Check if warehouse has enough capacity
 */
WarehouseSchema.methods.hasCapacity = function(amount: number): boolean {
  const usage = this.getTotalUsage();
  return (usage + amount) <= this.capacity;
};

/**
 * Add resources to warehouse
 */
WarehouseSchema.methods.addResource = function(
  type: ResourceType, 
  amount: number
): boolean {
  if (amount <= 0) return false;
  if (!this.hasCapacity(amount)) return false;
  
  let item = this.items.find((i: IResourceItem) => i.type === type);
  if (!item) {
    item = { type, amount: 0, reserved: 0, lastUpdated: new Date() };
    this.items.push(item);
  }
  
  item.amount += amount;
  item.lastUpdated = new Date();
  return true;
};

/**
 * Remove resources from warehouse
 */
WarehouseSchema.methods.removeResource = function(
  type: ResourceType, 
  amount: number,
  ignoreReserved: boolean = false
): boolean {
  if (amount <= 0) return false;
  
  const item = this.items.find((i: IResourceItem) => i.type === type);
  if (!item) return false;
  
  const available = ignoreReserved ? item.amount : (item.amount - item.reserved);
  if (available < amount) return false;
  
  item.amount -= amount;
  item.lastUpdated = new Date();
  return true;
};

/**
 * Static method: Atomic transfer between warehouses
 */
WarehouseSchema.statics.atomicTransfer = async function(
  sessionId: string,
  sourceId: string,
  targetId: string,
  items: Array<{ type: ResourceType; amount: number }>,
  executedBy: string,
  session?: ClientSession
): Promise<{ success: boolean; error?: string; transactionId?: string }> {
  const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const useSession = session || await mongoose.startSession();
  if (!session) useSession.startTransaction();
  
  try {
    // 1. Get both warehouses with lock
    const [source, target] = await Promise.all([
      this.findOneAndUpdate(
        { warehouseId: sourceId, sessionId, lockedUntil: { $lt: new Date() } },
        { 
          $set: { lockedUntil: new Date(Date.now() + 30000), lockedBy: executedBy },
          $inc: { lockVersion: 1 }
        },
        { session: useSession, new: true }
      ),
      this.findOneAndUpdate(
        { warehouseId: targetId, sessionId, lockedUntil: { $lt: new Date() } },
        { 
          $set: { lockedUntil: new Date(Date.now() + 30000), lockedBy: executedBy },
          $inc: { lockVersion: 1 }
        },
        { session: useSession, new: true }
      )
    ]);
    
    if (!source) {
      throw new Error('Source warehouse not found or locked');
    }
    if (!target) {
      throw new Error('Target warehouse not found or locked');
    }
    
    // 2. Validate source has enough resources
    for (const item of items) {
      const available = source.getAvailable(item.type);
      if (available < item.amount) {
        throw new Error(`Insufficient ${item.type}: need ${item.amount}, have ${available}`);
      }
    }
    
    // 3. Validate target has capacity
    const totalTransfer = items.reduce((sum, item) => sum + item.amount, 0);
    if (!target.hasCapacity(totalTransfer)) {
      throw new Error('Target warehouse does not have enough capacity');
    }
    
    // 4. Execute transfer
    for (const item of items) {
      source.removeResource(item.type, item.amount);
      target.addResource(item.type, item.amount);
    }
    
    // 5. Add transaction log
    const txLog: ITransactionLog = {
      transactionId,
      timestamp: new Date(),
      type: 'TRANSFER',
      sourceId,
      targetId,
      items,
      executedBy
    };
    
    // Keep only last 50 transactions
    source.recentTransactions = [txLog, ...source.recentTransactions].slice(0, 50);
    target.recentTransactions = [txLog, ...target.recentTransactions].slice(0, 50);
    
    // 6. Release locks and save
    source.lockedUntil = undefined;
    source.lockedBy = undefined;
    target.lockedUntil = undefined;
    target.lockedBy = undefined;
    
    await Promise.all([
      source.save({ session: useSession }),
      target.save({ session: useSession })
    ]);
    
    if (!session) await useSession.commitTransaction();
    
    return { success: true, transactionId };
    
  } catch (error: unknown) {
    if (!session) await useSession.abortTransaction();
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  } finally {
    if (!session) useSession.endSession();
  }
};

export interface IWarehouseModel extends Model<IWarehouse> {
  atomicTransfer(
    sessionId: string,
    sourceId: string,
    targetId: string,
    items: Array<{ type: ResourceType; amount: number }>,
    executedBy: string,
    session?: ClientSession
  ): Promise<{ success: boolean; error?: string; transactionId?: string }>;
}

export const Warehouse: IWarehouseModel = 
  mongoose.models.Warehouse || mongoose.model<IWarehouse, IWarehouseModel>('Warehouse', WarehouseSchema);

