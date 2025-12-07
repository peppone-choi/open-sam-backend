import mongoose from 'mongoose';
import { MarketPrice, IMarketPrice, BASE_PRICES } from '../../models/gin7/MarketPrice';
import { TradeRoute } from '../../models/gin7/TradeRoute';
import { ResourceType } from '../../models/gin7/Warehouse';

/**
 * Market event types
 */
export type MarketEventType =
  | 'BUMPER_HARVEST'    // 풍년 - food prices drop
  | 'FAMINE'            // 흉년 - food prices spike
  | 'WAR_ECONOMY'       // 전쟁 경제 - military goods spike
  | 'PEACE_DIVIDEND'    // 평화 배당 - military goods drop
  | 'MINING_BOOM'       // 광업 호황 - minerals cheap
  | 'RESOURCE_DEPLETION'// 자원 고갈 - minerals expensive
  | 'TECH_BREAKTHROUGH' // 기술 돌파 - components/parts cheaper
  | 'SUPPLY_DISRUPTION' // 공급 차단 - all prices up
  | 'TRADE_FESTIVAL'    // 무역 축제 - fees reduced
  | 'BLOCKADE'          // 봉쇄 - trading blocked
  | 'ECONOMIC_BOOM'     // 경제 호황 - all prices stable/low
  | 'ECONOMIC_CRISIS';  // 경제 위기 - volatility increases

/**
 * Event configuration
 */
export interface IMarketEvent {
  eventId: string;
  type: MarketEventType;
  name: string;
  nameKo: string;
  description: string;
  
  // Scope
  sessionId: string;
  locationId?: string;      // Specific location or undefined for global
  factionId?: string;       // Specific faction or undefined for all
  
  // Effects
  affectedItems: ResourceType[];
  priceModifier: number;    // -0.5 to +2.0
  supplyModifier: number;   // Multiplier for supply changes
  demandModifier: number;   // Additive change to demand
  feeModifier: number;      // Multiplier for fees
  
  // Duration
  startDate: Date;
  endDate: Date;
  duration: number;         // Days
  
  // Status
  isActive: boolean;
}

/**
 * Event templates
 */
const EVENT_TEMPLATES: Record<MarketEventType, Omit<IMarketEvent, 'eventId' | 'sessionId' | 'locationId' | 'factionId' | 'startDate' | 'endDate' | 'isActive'>> = {
  BUMPER_HARVEST: {
    type: 'BUMPER_HARVEST',
    name: 'Bumper Harvest',
    nameKo: '풍년',
    description: '농업 생산량이 크게 증가하여 식량 가격이 하락합니다.',
    affectedItems: ['food'],
    priceModifier: -0.4,
    supplyModifier: 2.0,
    demandModifier: -100,
    feeModifier: 1.0,
    duration: 30
  },
  FAMINE: {
    type: 'FAMINE',
    name: 'Famine',
    nameKo: '기근',
    description: '농작물 흉작으로 식량이 부족합니다.',
    affectedItems: ['food'],
    priceModifier: 1.0,
    supplyModifier: 0.3,
    demandModifier: 300,
    feeModifier: 1.0,
    duration: 30
  },
  WAR_ECONOMY: {
    type: 'WAR_ECONOMY',
    name: 'War Economy',
    nameKo: '전시 경제',
    description: '전쟁으로 인해 군수물자 수요가 급증합니다.',
    affectedItems: ['ammo', 'fuel', 'shipParts'],
    priceModifier: 0.5,
    supplyModifier: 0.7,
    demandModifier: 250,
    feeModifier: 1.2,
    duration: 60
  },
  PEACE_DIVIDEND: {
    type: 'PEACE_DIVIDEND',
    name: 'Peace Dividend',
    nameKo: '평화 배당',
    description: '평화 협정으로 군수물자 가격이 하락합니다.',
    affectedItems: ['ammo', 'fuel', 'shipParts'],
    priceModifier: -0.3,
    supplyModifier: 1.5,
    demandModifier: -150,
    feeModifier: 0.8,
    duration: 30
  },
  MINING_BOOM: {
    type: 'MINING_BOOM',
    name: 'Mining Boom',
    nameKo: '광업 호황',
    description: '새로운 광맥 발견으로 광물 공급이 증가합니다.',
    affectedItems: ['minerals', 'rareMetals'],
    priceModifier: -0.35,
    supplyModifier: 2.5,
    demandModifier: 0,
    feeModifier: 1.0,
    duration: 45
  },
  RESOURCE_DEPLETION: {
    type: 'RESOURCE_DEPLETION',
    name: 'Resource Depletion',
    nameKo: '자원 고갈',
    description: '광산 자원이 고갈되어 광물 가격이 상승합니다.',
    affectedItems: ['minerals', 'rareMetals'],
    priceModifier: 0.6,
    supplyModifier: 0.4,
    demandModifier: 100,
    feeModifier: 1.0,
    duration: 60
  },
  TECH_BREAKTHROUGH: {
    type: 'TECH_BREAKTHROUGH',
    name: 'Tech Breakthrough',
    nameKo: '기술 혁신',
    description: '생산 기술 발전으로 부품 생산비가 감소합니다.',
    affectedItems: ['components', 'shipParts'],
    priceModifier: -0.25,
    supplyModifier: 1.5,
    demandModifier: 50,
    feeModifier: 1.0,
    duration: 90
  },
  SUPPLY_DISRUPTION: {
    type: 'SUPPLY_DISRUPTION',
    name: 'Supply Disruption',
    nameKo: '공급망 붕괴',
    description: '물류 시스템 장애로 모든 물자 공급이 차질을 빚습니다.',
    affectedItems: ['food', 'fuel', 'ammo', 'minerals', 'shipParts', 'energy', 'rareMetals', 'components'],
    priceModifier: 0.3,
    supplyModifier: 0.5,
    demandModifier: 100,
    feeModifier: 1.5,
    duration: 14
  },
  TRADE_FESTIVAL: {
    type: 'TRADE_FESTIVAL',
    name: 'Trade Festival',
    nameKo: '무역 축제',
    description: '무역 박람회 기간으로 거래 수수료가 할인됩니다.',
    affectedItems: [],
    priceModifier: 0,
    supplyModifier: 1.0,
    demandModifier: 0,
    feeModifier: 0.5,
    duration: 7
  },
  BLOCKADE: {
    type: 'BLOCKADE',
    name: 'Blockade',
    nameKo: '봉쇄',
    description: '군사 봉쇄로 모든 무역이 차단됩니다.',
    affectedItems: ['food', 'fuel', 'ammo', 'minerals', 'shipParts', 'energy', 'rareMetals', 'components'],
    priceModifier: 0,
    supplyModifier: 0,
    demandModifier: 0,
    feeModifier: 1.0,
    duration: 30
  },
  ECONOMIC_BOOM: {
    type: 'ECONOMIC_BOOM',
    name: 'Economic Boom',
    nameKo: '경제 호황',
    description: '경제 성장으로 거래가 활발해지고 가격이 안정됩니다.',
    affectedItems: ['food', 'fuel', 'ammo', 'minerals', 'shipParts', 'energy', 'rareMetals', 'components'],
    priceModifier: -0.1,
    supplyModifier: 1.3,
    demandModifier: 0,
    feeModifier: 0.9,
    duration: 60
  },
  ECONOMIC_CRISIS: {
    type: 'ECONOMIC_CRISIS',
    name: 'Economic Crisis',
    nameKo: '경제 위기',
    description: '경제 위기로 가격 변동성이 증가합니다.',
    affectedItems: ['food', 'fuel', 'ammo', 'minerals', 'shipParts', 'energy', 'rareMetals', 'components'],
    priceModifier: 0.2,
    supplyModifier: 0.8,
    demandModifier: -50,
    feeModifier: 1.3,
    duration: 45
  }
};

/**
 * MarketEventService
 * Handles market events that affect prices and trading
 */
export class MarketEventService {
  // In-memory storage for active events (in production, use Redis or DB)
  private static activeEvents: Map<string, IMarketEvent[]> = new Map();

  /**
   * Create a new market event
   */
  static async createEvent(
    sessionId: string,
    type: MarketEventType,
    options: {
      locationId?: string;
      factionId?: string;
      durationOverride?: number;
    } = {}
  ): Promise<IMarketEvent> {
    const template = EVENT_TEMPLATES[type];
    
    if (!template) {
      throw new Error(`Unknown event type: ${type}`);
    }

    const duration = options.durationOverride || template.duration;
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);

    const event: IMarketEvent = {
      eventId: `EVT-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      ...template,
      sessionId,
      locationId: options.locationId,
      factionId: options.factionId,
      startDate,
      endDate,
      duration,
      isActive: true
    };

    // Store event
    const sessionEvents = this.activeEvents.get(sessionId) || [];
    sessionEvents.push(event);
    this.activeEvents.set(sessionId, sessionEvents);

    // Apply event effects to markets
    await this.applyEventEffects(event);

    return event;
  }

  /**
   * Apply event effects to affected markets
   */
  private static async applyEventEffects(event: IMarketEvent): Promise<void> {
    const query: Record<string, unknown> = { sessionId: event.sessionId };
    
    if (event.locationId) {
      query.locationId = event.locationId;
    }
    
    if (event.factionId) {
      query.factionId = event.factionId;
    }

    // Handle blockade (special case - blocks all trading)
    if (event.type === 'BLOCKADE') {
      await MarketPrice.updateMany(query, {
        $set: {
          isBlocked: true,
          blockReason: '군사 봉쇄 중'
        }
      });
      
      // Also block trade routes
      await TradeRoute.updateMany(
        {
          sessionId: event.sessionId,
          status: 'ACTIVE',
          ...(event.locationId ? {
            $or: [
              { sourceId: event.locationId },
              { targetId: event.locationId }
            ]
          } : {})
        },
        {
          $set: {
            status: 'BLOCKED',
            statusReason: '군사 봉쇄로 인한 경로 차단'
          }
        }
      );
      
      return;
    }

    // Apply effects to specific items
    if (event.affectedItems.length > 0) {
      query.itemType = { $in: event.affectedItems };
    }

    const markets = await MarketPrice.find(query);

    for (const market of markets) {
      // Apply price modifier
      market.eventModifier = event.priceModifier;
      
      // Apply supply change
      market.supply = Math.floor(market.supply * event.supplyModifier);
      market.supply = Math.min(market.maxSupply, Math.max(0, market.supply));
      
      // Apply demand change
      market.demand = Math.min(1000, Math.max(0, market.demand + event.demandModifier));
      
      // Apply fee modifier
      market.buyFee *= event.feeModifier;
      market.sellFee *= event.feeModifier;
      
      // Recalculate price
      market.recalculatePrice();
      
      await market.save();
    }
  }

  /**
   * End an event and revert effects
   */
  static async endEvent(sessionId: string, eventId: string): Promise<void> {
    const sessionEvents = this.activeEvents.get(sessionId) || [];
    const eventIndex = sessionEvents.findIndex(e => e.eventId === eventId);
    
    if (eventIndex === -1) return;
    
    const event = sessionEvents[eventIndex];
    event.isActive = false;

    // Revert effects
    await this.revertEventEffects(event);

    // Remove from active events
    sessionEvents.splice(eventIndex, 1);
    this.activeEvents.set(sessionId, sessionEvents);
  }

  /**
   * Revert event effects from markets
   */
  private static async revertEventEffects(event: IMarketEvent): Promise<void> {
    const query: Record<string, unknown> = { sessionId: event.sessionId };
    
    if (event.locationId) {
      query.locationId = event.locationId;
    }
    
    if (event.factionId) {
      query.factionId = event.factionId;
    }

    // Unblock if it was a blockade
    if (event.type === 'BLOCKADE') {
      await MarketPrice.updateMany(query, {
        $set: {
          isBlocked: false,
          blockReason: undefined
        }
      });
      
      await TradeRoute.updateMany(
        {
          sessionId: event.sessionId,
          status: 'BLOCKED',
          statusReason: '군사 봉쇄로 인한 경로 차단'
        },
        {
          $set: {
            status: 'ACTIVE',
            statusReason: undefined
          }
        }
      );
      
      return;
    }

    // Reset event modifier and fees
    if (event.affectedItems.length > 0) {
      query.itemType = { $in: event.affectedItems };
    }

    const markets = await MarketPrice.find(query);

    for (const market of markets) {
      market.eventModifier = 0;
      
      // Reset fees to defaults
      market.buyFee = 0.02;
      market.sellFee = 0.03;
      
      market.recalculatePrice();
      await market.save();
    }
  }

  /**
   * Process expired events (call periodically)
   */
  static async processExpiredEvents(): Promise<string[]> {
    const now = new Date();
    const expiredEvents: string[] = [];

    for (const [sessionId, events] of this.activeEvents.entries()) {
      for (const event of events) {
        if (event.isActive && event.endDate <= now) {
          await this.endEvent(sessionId, event.eventId);
          expiredEvents.push(event.eventId);
        }
      }
    }

    return expiredEvents;
  }

  /**
   * Get active events for a session
   */
  static getActiveEvents(
    sessionId: string,
    locationId?: string
  ): IMarketEvent[] {
    const events = this.activeEvents.get(sessionId) || [];
    
    if (!locationId) {
      return events.filter(e => e.isActive);
    }
    
    return events.filter(e => 
      e.isActive && 
      (!e.locationId || e.locationId === locationId)
    );
  }

  /**
   * Trigger random event (for day processing)
   */
  static async triggerRandomEvent(
    sessionId: string,
    options: {
      locationId?: string;
      factionId?: string;
      eventChance?: number;  // 0-100
    } = {}
  ): Promise<IMarketEvent | null> {
    const chance = options.eventChance || 5;  // 5% default chance
    
    if (Math.random() * 100 >= chance) {
      return null;  // No event triggered
    }

    // Select random event type (weighted)
    const eventTypes: MarketEventType[] = [
      'BUMPER_HARVEST', 'BUMPER_HARVEST',
      'FAMINE',
      'MINING_BOOM', 'MINING_BOOM',
      'RESOURCE_DEPLETION',
      'TECH_BREAKTHROUGH',
      'SUPPLY_DISRUPTION',
      'TRADE_FESTIVAL', 'TRADE_FESTIVAL', 'TRADE_FESTIVAL',
      'ECONOMIC_BOOM', 'ECONOMIC_BOOM',
      'ECONOMIC_CRISIS'
    ];
    
    const selectedType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    
    return this.createEvent(sessionId, selectedType, {
      locationId: options.locationId,
      factionId: options.factionId
    });
  }

  /**
   * Get event template information
   */
  static getEventTemplate(type: MarketEventType): typeof EVENT_TEMPLATES[MarketEventType] | undefined {
    return EVENT_TEMPLATES[type];
  }

  /**
   * Get all event templates
   */
  static getAllEventTemplates(): typeof EVENT_TEMPLATES {
    return EVENT_TEMPLATES;
  }
}

export default MarketEventService;

