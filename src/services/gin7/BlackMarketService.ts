import mongoose from 'mongoose';
import { MarketPrice, BASE_PRICES } from '../../models/gin7/MarketPrice';
import { Warehouse, ResourceType } from '../../models/gin7/Warehouse';
import { Character } from '../../models/gin7/Character';
import { Gin7Error } from '../../common/errors/gin7-errors';

/**
 * Contraband item types
 */
export type ContrabandType =
  | 'MILITARY_TECH'      // 군사 기술 자료
  | 'WEAPONS_GRADE'      // 무기급 물질
  | 'RESTRICTED_INTEL'   // 기밀 정보
  | 'BANNED_SUBSTANCES'  // 금지 물질
  | 'STOLEN_GOODS'       // 장물
  | 'FORGED_DOCUMENTS'   // 위조 문서
  | 'IMPERIAL_ARTIFACTS' // 제국 유물
  | 'ALLIANCE_SECRETS';  // 동맹 기밀

/**
 * Black market item
 */
export interface IBlackMarketItem {
  itemId: string;
  type: ContrabandType | ResourceType;
  name: string;
  nameKo: string;
  description: string;
  basePrice: number;
  currentPrice: number;
  quantity: number;
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'LEGENDARY';
  detectionRisk: number;     // 0-100 chance of being caught
  penalty: {
    fineMultiplier: number;  // Fine = price * multiplier
    reputationLoss: number;  // -1 to -100
    jailTime?: number;       // Days
  };
  requiresContact: boolean;  // Need black market contact
  factionRestricted?: string[];  // Factions that can't buy
}

/**
 * Smuggling operation
 */
export interface ISmugglingOp {
  opId: string;
  sessionId: string;
  smugglerId: string;       // Character ID
  routeId?: string;         // Associated trade route if any
  
  items: Array<{
    itemId: string;
    type: ContrabandType | ResourceType;
    quantity: number;
    purchasePrice: number;
  }>;
  
  sourceLocation: string;
  targetLocation: string;
  
  status: 'PLANNING' | 'IN_TRANSIT' | 'COMPLETED' | 'INTERCEPTED' | 'CANCELLED';
  
  // Risk assessment
  totalDetectionRisk: number;
  escapeChance: number;
  
  // Results
  outcome?: {
    success: boolean;
    itemsDelivered: number;
    itemsSeized: number;
    fineAmount: number;
    arrested: boolean;
  };
  
  createdAt: Date;
  completedAt?: Date;
}

/**
 * Black market contact
 */
export interface IBlackMarketContact {
  contactId: string;
  sessionId: string;
  characterId: string;
  name: string;
  specialty: ContrabandType[];
  trustLevel: number;        // 0-100
  discountRate: number;      // 0-0.3
  detectionReduction: number; // 0-0.5
  locationId: string;
  lastContact: Date;
  isCompromised: boolean;
}

/**
 * Contraband item templates
 */
const CONTRABAND_ITEMS: Record<ContrabandType, Omit<IBlackMarketItem, 'itemId' | 'currentPrice' | 'quantity'>> = {
  MILITARY_TECH: {
    type: 'MILITARY_TECH',
    name: 'Military Technology Data',
    nameKo: '군사 기술 자료',
    description: '최신 함선 설계도 및 전술 데이터',
    basePrice: 50000,
    rarity: 'RARE',
    detectionRisk: 60,
    penalty: {
      fineMultiplier: 5,
      reputationLoss: 50,
      jailTime: 30
    },
    requiresContact: true,
    factionRestricted: []
  },
  WEAPONS_GRADE: {
    type: 'WEAPONS_GRADE',
    name: 'Weapons-Grade Materials',
    nameKo: '무기급 물질',
    description: '무기 제조용 고순도 물질',
    basePrice: 30000,
    rarity: 'UNCOMMON',
    detectionRisk: 50,
    penalty: {
      fineMultiplier: 4,
      reputationLoss: 30
    },
    requiresContact: false,
    factionRestricted: []
  },
  RESTRICTED_INTEL: {
    type: 'RESTRICTED_INTEL',
    name: 'Restricted Intelligence',
    nameKo: '기밀 정보',
    description: '적국의 군사 배치 및 작전 정보',
    basePrice: 80000,
    rarity: 'LEGENDARY',
    detectionRisk: 80,
    penalty: {
      fineMultiplier: 10,
      reputationLoss: 80,
      jailTime: 90
    },
    requiresContact: true,
    factionRestricted: []
  },
  BANNED_SUBSTANCES: {
    type: 'BANNED_SUBSTANCES',
    name: 'Banned Substances',
    nameKo: '금지 물질',
    description: '불법 약물 및 화학 물질',
    basePrice: 10000,
    rarity: 'COMMON',
    detectionRisk: 40,
    penalty: {
      fineMultiplier: 3,
      reputationLoss: 20
    },
    requiresContact: false,
    factionRestricted: []
  },
  STOLEN_GOODS: {
    type: 'STOLEN_GOODS',
    name: 'Stolen Goods',
    nameKo: '장물',
    description: '도난당한 화물 및 물품',
    basePrice: 5000,
    rarity: 'COMMON',
    detectionRisk: 30,
    penalty: {
      fineMultiplier: 2,
      reputationLoss: 15
    },
    requiresContact: false,
    factionRestricted: []
  },
  FORGED_DOCUMENTS: {
    type: 'FORGED_DOCUMENTS',
    name: 'Forged Documents',
    nameKo: '위조 문서',
    description: '위조된 신분증, 허가증, 면허증',
    basePrice: 15000,
    rarity: 'UNCOMMON',
    detectionRisk: 35,
    penalty: {
      fineMultiplier: 3,
      reputationLoss: 25,
      jailTime: 14
    },
    requiresContact: true,
    factionRestricted: []
  },
  IMPERIAL_ARTIFACTS: {
    type: 'IMPERIAL_ARTIFACTS',
    name: 'Imperial Artifacts',
    nameKo: '제국 유물',
    description: '골덴바움 왕조의 희귀 유물',
    basePrice: 100000,
    rarity: 'LEGENDARY',
    detectionRisk: 70,
    penalty: {
      fineMultiplier: 8,
      reputationLoss: 60,
      jailTime: 60
    },
    requiresContact: true,
    factionRestricted: ['EMPIRE']  // Empire won't sell their own artifacts
  },
  ALLIANCE_SECRETS: {
    type: 'ALLIANCE_SECRETS',
    name: 'Alliance State Secrets',
    nameKo: '동맹 기밀',
    description: '자유행성동맹의 국가 기밀',
    basePrice: 90000,
    rarity: 'LEGENDARY',
    detectionRisk: 75,
    penalty: {
      fineMultiplier: 8,
      reputationLoss: 70,
      jailTime: 60
    },
    requiresContact: true,
    factionRestricted: ['ALLIANCE']
  }
};

/**
 * BlackMarketService
 * Handles illegal trade, smuggling, and contraband
 */
export class BlackMarketService {
  // In-memory storage (use DB in production)
  private static smugglingOps: Map<string, ISmugglingOp[]> = new Map();
  private static contacts: Map<string, IBlackMarketContact[]> = new Map();
  private static inventory: Map<string, IBlackMarketItem[]> = new Map();

  /**
   * Get available black market items at a location
   */
  static getAvailableItems(
    sessionId: string,
    locationId: string,
    characterFaction?: string
  ): IBlackMarketItem[] {
    // Generate or retrieve inventory for location
    let locationInventory = this.inventory.get(`${sessionId}-${locationId}`);
    
    if (!locationInventory) {
      locationInventory = this.generateInventory(sessionId, locationId);
      this.inventory.set(`${sessionId}-${locationId}`, locationInventory);
    }

    // Filter by faction restrictions
    if (characterFaction) {
      locationInventory = locationInventory.filter(item => {
        const template = CONTRABAND_ITEMS[item.type as ContrabandType];
        if (!template?.factionRestricted) return true;
        return !template.factionRestricted.includes(characterFaction);
      });
    }

    return locationInventory;
  }

  /**
   * Generate random inventory for a location
   */
  private static generateInventory(
    sessionId: string,
    locationId: string
  ): IBlackMarketItem[] {
    const inventory: IBlackMarketItem[] = [];
    
    // Add some contraband items
    const contrabandTypes = Object.keys(CONTRABAND_ITEMS) as ContrabandType[];
    
    for (const type of contrabandTypes) {
      // Random chance to have each item
      if (Math.random() > 0.4) continue;  // 60% chance per item type
      
      const template = CONTRABAND_ITEMS[type];
      
      // Price variation (-20% to +30%)
      const priceVariation = 0.8 + Math.random() * 0.5;
      
      inventory.push({
        itemId: `BM-${type}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        ...template,
        currentPrice: Math.round(template.basePrice * priceVariation),
        quantity: Math.floor(1 + Math.random() * 10)
      });
    }

    // Add some "legitimate" items at black market prices (premium)
    const resourceTypes: ResourceType[] = ['shipParts', 'ammo', 'fuel', 'rareMetals'];
    
    for (const resourceType of resourceTypes) {
      if (Math.random() > 0.5) continue;
      
      const basePrice = BASE_PRICES[resourceType];
      const blackMarketPremium = 1.3 + Math.random() * 0.4;  // 30-70% markup
      
      inventory.push({
        itemId: `BM-RES-${resourceType}-${Date.now()}`,
        type: resourceType,
        name: `Black Market ${resourceType}`,
        nameKo: `암시장 ${resourceType}`,
        description: '출처 불명의 물자 (세금/수수료 없음)',
        basePrice: Math.round(basePrice * blackMarketPremium),
        currentPrice: Math.round(basePrice * blackMarketPremium),
        quantity: Math.floor(50 + Math.random() * 200),
        rarity: 'COMMON',
        detectionRisk: 20,
        penalty: {
          fineMultiplier: 1.5,
          reputationLoss: 10
        },
        requiresContact: false
      });
    }

    return inventory;
  }

  /**
   * Purchase from black market
   */
  static async purchaseItem(
    sessionId: string,
    characterId: string,
    locationId: string,
    itemId: string,
    quantity: number
  ): Promise<{
    success: boolean;
    detected: boolean;
    item?: IBlackMarketItem;
    totalCost?: number;
    penalty?: {
      fine: number;
      reputationLoss: number;
      arrested: boolean;
    };
    error?: string;
  }> {
    const inventory = this.inventory.get(`${sessionId}-${locationId}`);
    
    if (!inventory) {
      return { success: false, detected: false, error: 'No black market at this location' };
    }

    const item = inventory.find(i => i.itemId === itemId);
    
    if (!item) {
      return { success: false, detected: false, error: 'Item not available' };
    }

    if (item.quantity < quantity) {
      return { success: false, detected: false, error: `Only ${item.quantity} available` };
    }

    // Check if contact is required
    if (item.requiresContact) {
      const hasContact = this.hasValidContact(sessionId, characterId, item.type as ContrabandType);
      if (!hasContact) {
        return { success: false, detected: false, error: 'Requires black market contact' };
      }
    }

    // Calculate detection risk
    const contact = this.getContact(sessionId, characterId, locationId);
    let detectionRisk = item.detectionRisk;
    
    if (contact) {
      detectionRisk *= (1 - contact.detectionReduction);
    }

    // Larger purchases are riskier
    detectionRisk += Math.min(20, quantity * 2);

    // Roll for detection
    const detected = Math.random() * 100 < detectionRisk;

    if (detected) {
      // Calculate penalty
      const template = CONTRABAND_ITEMS[item.type as ContrabandType] || {
        penalty: { fineMultiplier: 1.5, reputationLoss: 10 }
      };
      
      const fine = Math.round(item.currentPrice * quantity * template.penalty.fineMultiplier);
      const reputationLoss = template.penalty.reputationLoss;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const arrested = (template.penalty as any).jailTime ? Math.random() < 0.3 : false;

      return {
        success: false,
        detected: true,
        penalty: {
          fine,
          reputationLoss,
          arrested
        },
        error: '거래가 적발되었습니다!'
      };
    }

    // Successful purchase
    const totalCost = item.currentPrice * quantity;
    item.quantity -= quantity;

    // Remove item if depleted
    if (item.quantity <= 0) {
      const index = inventory.indexOf(item);
      if (index > -1) {
        inventory.splice(index, 1);
      }
    }

    return {
      success: true,
      detected: false,
      item: { ...item, quantity },
      totalCost
    };
  }

  /**
   * Start a smuggling operation
   */
  static async startSmuggling(
    sessionId: string,
    characterId: string,
    sourceLocation: string,
    targetLocation: string,
    items: Array<{ itemId: string; type: ContrabandType | ResourceType; quantity: number; purchasePrice: number }>
  ): Promise<{ success: boolean; operation?: ISmugglingOp; error?: string }> {
    if (items.length === 0) {
      return { success: false, error: 'No items to smuggle' };
    }

    // Calculate total detection risk
    let totalRisk = 0;
    for (const item of items) {
      const template = CONTRABAND_ITEMS[item.type as ContrabandType];
      const itemRisk = template?.detectionRisk || 20;
      totalRisk += itemRisk * (item.quantity / 10);  // Risk scales with quantity
    }
    totalRisk = Math.min(95, totalRisk);  // Cap at 95%

    // Get contact if available
    const contact = this.getContact(sessionId, characterId, sourceLocation);
    if (contact) {
      totalRisk *= (1 - contact.detectionReduction);
    }

    const operation: ISmugglingOp = {
      opId: `SMUG-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      sessionId,
      smugglerId: characterId,
      items,
      sourceLocation,
      targetLocation,
      status: 'IN_TRANSIT',
      totalDetectionRisk: totalRisk,
      escapeChance: 50 + (100 - totalRisk) * 0.3,  // Higher risk = lower escape chance
      createdAt: new Date()
    };

    const sessionOps = this.smugglingOps.get(sessionId) || [];
    sessionOps.push(operation);
    this.smugglingOps.set(sessionId, sessionOps);

    return { success: true, operation };
  }

  /**
   * Complete a smuggling operation (roll for success)
   */
  static async completeSmuggling(
    sessionId: string,
    opId: string
  ): Promise<{
    success: boolean;
    outcome?: ISmugglingOp['outcome'];
    error?: string;
  }> {
    const sessionOps = this.smugglingOps.get(sessionId) || [];
    const operation = sessionOps.find(op => op.opId === opId);

    if (!operation) {
      return { success: false, error: 'Smuggling operation not found' };
    }

    if (operation.status !== 'IN_TRANSIT') {
      return { success: false, error: 'Operation is not in transit' };
    }

    // Roll for interception
    const intercepted = Math.random() * 100 < operation.totalDetectionRisk;

    if (intercepted) {
      // Try to escape
      const escaped = Math.random() * 100 < operation.escapeChance;

      if (escaped) {
        // Escaped but lost some cargo
        const lossPercent = 0.3 + Math.random() * 0.4;  // 30-70% loss
        const itemsDelivered = Math.floor(
          operation.items.reduce((sum, i) => sum + i.quantity, 0) * (1 - lossPercent)
        );
        const itemsSeized = Math.ceil(
          operation.items.reduce((sum, i) => sum + i.quantity, 0) * lossPercent
        );

        operation.status = 'COMPLETED';
        operation.outcome = {
          success: true,
          itemsDelivered,
          itemsSeized,
          fineAmount: 0,
          arrested: false
        };
      } else {
        // Caught!
        const totalValue = operation.items.reduce(
          (sum, i) => sum + i.purchasePrice * i.quantity, 0
        );

        operation.status = 'INTERCEPTED';
        operation.outcome = {
          success: false,
          itemsDelivered: 0,
          itemsSeized: operation.items.reduce((sum, i) => sum + i.quantity, 0),
          fineAmount: Math.round(totalValue * 3),  // 3x fine
          arrested: Math.random() < 0.4  // 40% arrest chance
        };
      }
    } else {
      // Successful smuggling!
      operation.status = 'COMPLETED';
      operation.outcome = {
        success: true,
        itemsDelivered: operation.items.reduce((sum, i) => sum + i.quantity, 0),
        itemsSeized: 0,
        fineAmount: 0,
        arrested: false
      };
    }

    operation.completedAt = new Date();

    return {
      success: operation.outcome.success,
      outcome: operation.outcome
    };
  }

  /**
   * Get character's smuggling operations
   */
  static getCharacterOperations(
    sessionId: string,
    characterId: string
  ): ISmugglingOp[] {
    const sessionOps = this.smugglingOps.get(sessionId) || [];
    return sessionOps.filter(op => op.smugglerId === characterId);
  }

  // ==================== Contacts ====================

  /**
   * Establish a black market contact
   */
  static async establishContact(
    sessionId: string,
    characterId: string,
    locationId: string,
    specialty: ContrabandType[]
  ): Promise<{ success: boolean; contact?: IBlackMarketContact; cost: number; error?: string }> {
    // Cost to establish contact
    const cost = 5000 + specialty.length * 2000;

    // Check if already has contact at this location
    const existingContacts = this.contacts.get(sessionId) || [];
    const existing = existingContacts.find(
      c => c.characterId === characterId && c.locationId === locationId
    );

    if (existing) {
      return { success: false, cost, error: 'Already have a contact at this location' };
    }

    // Roll for success (base 70% chance)
    if (Math.random() > 0.7) {
      return { success: false, cost: Math.floor(cost * 0.5), error: 'Failed to establish contact' };
    }

    const contact: IBlackMarketContact = {
      contactId: `CONTACT-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      sessionId,
      characterId,
      name: this.generateContactName(),
      specialty,
      trustLevel: 20 + Math.floor(Math.random() * 30),  // 20-50 initial trust
      discountRate: 0.05 + Math.random() * 0.1,  // 5-15% discount
      detectionReduction: 0.1 + Math.random() * 0.2,  // 10-30% detection reduction
      locationId,
      lastContact: new Date(),
      isCompromised: false
    };

    existingContacts.push(contact);
    this.contacts.set(sessionId, existingContacts);

    return { success: true, contact, cost };
  }

  /**
   * Get character's contacts
   */
  static getCharacterContacts(
    sessionId: string,
    characterId: string
  ): IBlackMarketContact[] {
    const sessionContacts = this.contacts.get(sessionId) || [];
    return sessionContacts.filter(c => c.characterId === characterId && !c.isCompromised);
  }

  /**
   * Check if character has valid contact for item type
   */
  private static hasValidContact(
    sessionId: string,
    characterId: string,
    itemType: ContrabandType
  ): boolean {
    const contacts = this.getCharacterContacts(sessionId, characterId);
    return contacts.some(c => c.specialty.includes(itemType));
  }

  /**
   * Get contact at location
   */
  private static getContact(
    sessionId: string,
    characterId: string,
    locationId: string
  ): IBlackMarketContact | undefined {
    const contacts = this.getCharacterContacts(sessionId, characterId);
    return contacts.find(c => c.locationId === locationId);
  }

  /**
   * Generate random contact name
   */
  private static generateContactName(): string {
    const firstNames = ['Shadow', 'Ghost', 'Silent', 'Dark', 'Night', 'Iron', 'Steel', 'Silver'];
    const lastNames = ['Runner', 'Walker', 'Hand', 'Eye', 'Voice', 'Blade', 'Wolf', 'Fox'];
    return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
  }

  /**
   * Refresh black market inventory (call periodically)
   */
  static refreshInventory(sessionId: string, locationId: string): void {
    this.inventory.delete(`${sessionId}-${locationId}`);
  }

  /**
   * Get contraband item templates
   */
  static getContrabandTemplates(): typeof CONTRABAND_ITEMS {
    return CONTRABAND_ITEMS;
  }
}

export default BlackMarketService;

