/**
 * TradeExtensionService - 무역 확장 시스템
 * Agent F: 외교/경제 시스템 확장
 *
 * 기능:
 * - 무역 품목 상세 (무기/식량/사치품)
 * - 밀수 시스템
 * - 무역 제재/봉쇄
 * - 무역 협정
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../common/logger';

// ============================================================
// Types
// ============================================================

export enum TradeGoodsCategory {
  WEAPONS = 'WEAPONS',           // 무기
  AMMUNITION = 'AMMUNITION',     // 탄약/미사일
  FOOD = 'FOOD',                 // 식량
  FUEL = 'FUEL',                 // 연료
  LUXURY = 'LUXURY',             // 사치품
  MEDICINE = 'MEDICINE',         // 의약품
  ELECTRONICS = 'ELECTRONICS',   // 전자부품
  RAW_MATERIALS = 'RAW_MATERIALS', // 원자재
  INDUSTRIAL = 'INDUSTRIAL',     // 산업재
  CONTRABAND = 'CONTRABAND',     // 밀수품
}

export enum TradeRestrictionType {
  EMBARGO = 'EMBARGO',           // 전면 금수
  SANCTION = 'SANCTION',         // 경제 제재
  BLOCKADE = 'BLOCKADE',         // 봉쇄
  TARIFF = 'TARIFF',             // 높은 관세
  QUOTA = 'QUOTA',               // 수량 제한
  LICENSE = 'LICENSE',           // 허가 필요
}

export enum SmugglingRisk {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  EXTREME = 'EXTREME',
}

export interface TradeGoods {
  goodsId: string;
  category: TradeGoodsCategory;
  name: string;
  description: string;
  basePrice: number;
  weight: number;               // 단위당 무게 (톤)
  isIllegal: boolean;           // 불법 품목 여부
  producingFactions: string[];  // 주요 생산지
  demandModifiers: Record<string, number>; // 세력별 수요 보정
}

export interface TradeRestriction {
  restrictionId: string;
  sessionId: string;
  imposingFaction: string;
  targetFaction?: string;       // 특정 세력 대상 (없으면 전체)
  type: TradeRestrictionType;
  affectedGoods: TradeGoodsCategory[];
  severity: number;             // 1-100
  reason: string;
  imposedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export interface ExtendedTradeAgreement {
  agreementId: string;
  sessionId: string;
  parties: string[];
  name: string;
  terms: ExtendedTradeAgreementTerms;
  signedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
  tradeVolume: number;          // 누적 거래량
  lastTradeAt?: Date;
}

export interface ExtendedTradeAgreementTerms {
  tariffRate: number;           // 관세율 (%)
  quotas?: Record<TradeGoodsCategory, number>; // 품목별 쿼터
  preferredGoods?: TradeGoodsCategory[];       // 우선 품목
  exclusiveRights?: boolean;    // 독점권
  minimumVolume?: number;       // 최소 거래량
  priceGuarantee?: number;      // 가격 보장 (%)
}

export interface SmugglingOperation {
  operationId: string;
  sessionId: string;
  smugglerId: string;           // 밀수업자 캐릭터/세력 ID
  originId: string;             // 출발지
  destinationId: string;        // 목적지
  goods: SmuggledGoods[];
  risk: SmugglingRisk;
  detectChance: number;         // 적발 확률 (%)
  profit: number;               // 예상 수익
  status: 'PLANNING' | 'IN_TRANSIT' | 'COMPLETED' | 'INTERCEPTED' | 'CANCELLED';
  startedAt?: Date;
  completedAt?: Date;
  interceptedBy?: string;
}

export interface SmuggledGoods {
  category: TradeGoodsCategory;
  quantity: number;
  unitPrice: number;
  concealmentMethod?: string;   // 은닉 방법
}

export interface TradeTransaction {
  transactionId: string;
  sessionId: string;
  sellerId: string;
  buyerId: string;
  goods: TradeGoodsCategory;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  tariff: number;
  isSmuggling: boolean;
  location: string;
  timestamp: Date;
}

export interface MarketCondition {
  sessionId: string;
  locationId: string;
  goods: TradeGoodsCategory;
  supply: number;               // 공급량
  demand: number;               // 수요량
  currentPrice: number;
  priceChange: number;          // 가격 변동률 (%)
  trend: 'RISING' | 'STABLE' | 'FALLING';
  lastUpdated: Date;
}

// ============================================================
// Constants
// ============================================================

const BASE_TRADE_GOODS: TradeGoods[] = [
  {
    goodsId: 'WEAPONS_STANDARD',
    category: TradeGoodsCategory.WEAPONS,
    name: '표준 함포',
    description: '레이저 및 실체탄 함포',
    basePrice: 5000,
    weight: 10,
    isIllegal: false,
    producingFactions: ['empire', 'alliance'],
    demandModifiers: { empire: 1.0, alliance: 1.2 },
  },
  {
    goodsId: 'WEAPONS_ADVANCED',
    category: TradeGoodsCategory.WEAPONS,
    name: '고급 무장',
    description: '최신형 함대 무장 시스템',
    basePrice: 15000,
    weight: 20,
    isIllegal: false,
    producingFactions: ['empire'],
    demandModifiers: { alliance: 1.5 },
  },
  {
    goodsId: 'AMMO_MISSILES',
    category: TradeGoodsCategory.AMMUNITION,
    name: '함대 미사일',
    description: '대함 유도 미사일',
    basePrice: 1000,
    weight: 2,
    isIllegal: false,
    producingFactions: ['empire', 'alliance', 'fezzan'],
    demandModifiers: {},
  },
  {
    goodsId: 'FOOD_BASIC',
    category: TradeGoodsCategory.FOOD,
    name: '기본 식량',
    description: '합성 식량 및 비타민',
    basePrice: 100,
    weight: 1,
    isIllegal: false,
    producingFactions: ['empire', 'alliance'],
    demandModifiers: {},
  },
  {
    goodsId: 'FOOD_LUXURY',
    category: TradeGoodsCategory.FOOD,
    name: '고급 식료품',
    description: '천연 식재료 및 와인',
    basePrice: 500,
    weight: 1,
    isIllegal: false,
    producingFactions: ['alliance', 'fezzan'],
    demandModifiers: { empire: 1.3 },
  },
  {
    goodsId: 'FUEL_SHIP',
    category: TradeGoodsCategory.FUEL,
    name: '함선 연료',
    description: '핵융합 반응 연료',
    basePrice: 200,
    weight: 5,
    isIllegal: false,
    producingFactions: ['empire', 'alliance', 'fezzan'],
    demandModifiers: {},
  },
  {
    goodsId: 'LUXURY_ART',
    category: TradeGoodsCategory.LUXURY,
    name: '예술품',
    description: '희귀 예술품 및 골동품',
    basePrice: 10000,
    weight: 0.5,
    isIllegal: false,
    producingFactions: ['empire', 'fezzan'],
    demandModifiers: { alliance: 1.2 },
  },
  {
    goodsId: 'MEDICINE_STANDARD',
    category: TradeGoodsCategory.MEDICINE,
    name: '의약품',
    description: '일반 의약품 및 의료 장비',
    basePrice: 300,
    weight: 0.5,
    isIllegal: false,
    producingFactions: ['empire', 'alliance'],
    demandModifiers: {},
  },
  {
    goodsId: 'ELECTRONICS_MILITARY',
    category: TradeGoodsCategory.ELECTRONICS,
    name: '군용 전자장비',
    description: '레이더, 통신, 사격통제 시스템',
    basePrice: 8000,
    weight: 3,
    isIllegal: false,
    producingFactions: ['empire'],
    demandModifiers: { alliance: 1.4 },
  },
  {
    goodsId: 'CONTRABAND_DRUGS',
    category: TradeGoodsCategory.CONTRABAND,
    name: '금제품',
    description: '불법 약물 및 밀수품',
    basePrice: 20000,
    weight: 0.1,
    isIllegal: true,
    producingFactions: ['fezzan'],
    demandModifiers: { empire: 2.0, alliance: 1.8 },
  },
];

const SMUGGLING_RISK_DETECT_CHANCE: Record<SmugglingRisk, number> = {
  [SmugglingRisk.LOW]: 10,
  [SmugglingRisk.MEDIUM]: 30,
  [SmugglingRisk.HIGH]: 55,
  [SmugglingRisk.EXTREME]: 80,
};

// ============================================================
// TradeExtensionService Class
// ============================================================

export class TradeExtensionService extends EventEmitter {
  private static instance: TradeExtensionService;

  // 세션별 데이터
  private restrictions: Map<string, TradeRestriction[]> = new Map();
  private agreements: Map<string, ExtendedTradeAgreement[]> = new Map();
  private smugglingOps: Map<string, SmugglingOperation[]> = new Map();
  private transactions: Map<string, TradeTransaction[]> = new Map();
  private marketConditions: Map<string, MarketCondition[]> = new Map();

  // 정적 데이터
  private tradeGoods: Map<string, TradeGoods> = new Map();

  private constructor() {
    super();
    this.initializeTradeGoods();
    logger.info('[TradeExtensionService] Initialized');
  }

  public static getInstance(): TradeExtensionService {
    if (!TradeExtensionService.instance) {
      TradeExtensionService.instance = new TradeExtensionService();
    }
    return TradeExtensionService.instance;
  }

  private initializeTradeGoods(): void {
    for (const goods of BASE_TRADE_GOODS) {
      this.tradeGoods.set(goods.goodsId, goods);
    }
  }

  // ============================================================
  // 세션 관리
  // ============================================================

  public initializeSession(sessionId: string): void {
    this.restrictions.set(sessionId, []);
    this.agreements.set(sessionId, []);
    this.smugglingOps.set(sessionId, []);
    this.transactions.set(sessionId, []);
    this.marketConditions.set(sessionId, []);

    // 초기 시장 상황 설정
    this.initializeMarketConditions(sessionId);

    logger.info(`[TradeExtensionService] Session ${sessionId} initialized`);
  }

  private initializeMarketConditions(sessionId: string): void {
    // 주요 거점별 시장 상황 초기화
    const locations = ['odin', 'heinessen', 'fezzan', 'iserlohn'];
    const conditions: MarketCondition[] = [];

    for (const location of locations) {
      for (const category of Object.values(TradeGoodsCategory)) {
        conditions.push({
          sessionId,
          locationId: location,
          goods: category,
          supply: 1000,
          demand: 1000,
          currentPrice: this.getBasePriceForCategory(category),
          priceChange: 0,
          trend: 'STABLE',
          lastUpdated: new Date(),
        });
      }
    }

    this.marketConditions.set(sessionId, conditions);
  }

  private getBasePriceForCategory(category: TradeGoodsCategory): number {
    const goods = Array.from(this.tradeGoods.values())
      .find(g => g.category === category);
    return goods?.basePrice || 1000;
  }

  public cleanupSession(sessionId: string): void {
    this.restrictions.delete(sessionId);
    this.agreements.delete(sessionId);
    this.smugglingOps.delete(sessionId);
    this.transactions.delete(sessionId);
    this.marketConditions.delete(sessionId);
    logger.info(`[TradeExtensionService] Session ${sessionId} cleaned up`);
  }

  // ============================================================
  // 무역 품목 관리
  // ============================================================

  /**
   * 품목 정보 조회
   */
  public getTradeGoods(goodsId?: string): TradeGoods | TradeGoods[] {
    if (goodsId) {
      return this.tradeGoods.get(goodsId)!;
    }
    return Array.from(this.tradeGoods.values());
  }

  /**
   * 카테고리별 품목 조회
   */
  public getGoodsByCategory(category: TradeGoodsCategory): TradeGoods[] {
    return Array.from(this.tradeGoods.values())
      .filter(g => g.category === category);
  }

  /**
   * 현재 시장 가격 조회
   */
  public getCurrentPrice(
    sessionId: string,
    locationId: string,
    category: TradeGoodsCategory,
  ): number {
    const conditions = this.marketConditions.get(sessionId) || [];
    const condition = conditions.find(c =>
      c.locationId === locationId && c.goods === category
    );
    return condition?.currentPrice || this.getBasePriceForCategory(category);
  }

  /**
   * 시장 가격 업데이트 (수요/공급 기반)
   */
  public updateMarketPrice(
    sessionId: string,
    locationId: string,
    category: TradeGoodsCategory,
    supplyChange: number,
    demandChange: number,
  ): MarketCondition | undefined {
    const conditions = this.marketConditions.get(sessionId) || [];
    const condition = conditions.find(c =>
      c.locationId === locationId && c.goods === category
    );

    if (!condition) return undefined;

    condition.supply = Math.max(0, condition.supply + supplyChange);
    condition.demand = Math.max(0, condition.demand + demandChange);

    // 가격 조정 (수요/공급 비율)
    const ratio = condition.demand / Math.max(condition.supply, 1);
    const basePrice = this.getBasePriceForCategory(category);
    const newPrice = Math.round(basePrice * ratio);

    const priceChange = ((newPrice - condition.currentPrice) / condition.currentPrice) * 100;
    condition.priceChange = priceChange;
    condition.currentPrice = newPrice;

    // 트렌드 결정
    if (priceChange > 5) condition.trend = 'RISING';
    else if (priceChange < -5) condition.trend = 'FALLING';
    else condition.trend = 'STABLE';

    condition.lastUpdated = new Date();

    return condition;
  }

  // ============================================================
  // 무역 제재/봉쇄
  // ============================================================

  /**
   * 무역 제재 부과
   */
  public imposeRestriction(
    sessionId: string,
    imposingFaction: string,
    request: {
      targetFaction?: string;
      type: TradeRestrictionType;
      affectedGoods: TradeGoodsCategory[];
      severity: number;
      reason: string;
      durationDays?: number;
    },
  ): { success: boolean; restriction?: TradeRestriction; error?: string } {
    // 기존 중복 제재 확인
    const restrictions = this.restrictions.get(sessionId) || [];
    const existing = restrictions.find(r =>
      r.isActive &&
      r.imposingFaction === imposingFaction &&
      r.targetFaction === request.targetFaction &&
      r.type === request.type
    );

    if (existing) {
      return { success: false, error: '동일한 제재가 이미 시행 중입니다.' };
    }

    const restriction: TradeRestriction = {
      restrictionId: `RESTRICT-${uuidv4().slice(0, 8)}`,
      sessionId,
      imposingFaction,
      targetFaction: request.targetFaction,
      type: request.type,
      affectedGoods: request.affectedGoods,
      severity: request.severity,
      reason: request.reason,
      imposedAt: new Date(),
      expiresAt: request.durationDays
        ? new Date(Date.now() + request.durationDays * 24 * 60 * 60 * 1000)
        : undefined,
      isActive: true,
    };

    restrictions.push(restriction);
    this.restrictions.set(sessionId, restrictions);

    this.emit('trade:restrictionImposed', { sessionId, restriction });
    logger.info(`[TradeExtensionService] Restriction imposed: ${request.type} by ${imposingFaction}`);

    return { success: true, restriction };
  }

  /**
   * 무역 제재 해제
   */
  public liftRestriction(
    sessionId: string,
    restrictionId: string,
  ): { success: boolean; error?: string } {
    const restrictions = this.restrictions.get(sessionId) || [];
    const restriction = restrictions.find(r => r.restrictionId === restrictionId);

    if (!restriction) {
      return { success: false, error: '제재를 찾을 수 없습니다.' };
    }

    restriction.isActive = false;

    this.emit('trade:restrictionLifted', { sessionId, restriction });
    logger.info(`[TradeExtensionService] Restriction lifted: ${restrictionId}`);

    return { success: true };
  }

  /**
   * 무역 봉쇄 설정
   */
  public imposeBlockade(
    sessionId: string,
    blockadingFaction: string,
    targetLocation: string,
    reason: string,
  ): { success: boolean; restriction?: TradeRestriction } {
    return this.imposeRestriction(sessionId, blockadingFaction, {
      targetFaction: targetLocation,
      type: TradeRestrictionType.BLOCKADE,
      affectedGoods: Object.values(TradeGoodsCategory),
      severity: 100,
      reason,
    });
  }

  /**
   * 거래 가능 여부 확인
   */
  public canTrade(
    sessionId: string,
    sellerFaction: string,
    buyerFaction: string,
    category: TradeGoodsCategory,
  ): { allowed: boolean; reason?: string; tariffModifier: number } {
    const restrictions = this.restrictions.get(sessionId) || [];
    let tariffModifier = 1.0;

    for (const restriction of restrictions) {
      if (!restriction.isActive) continue;

      // 만료 확인
      if (restriction.expiresAt && restriction.expiresAt < new Date()) {
        restriction.isActive = false;
        continue;
      }

      // 해당 품목 체크
      if (!restriction.affectedGoods.includes(category)) continue;

      // 대상 세력 체크
      const isTargeted = !restriction.targetFaction ||
        restriction.targetFaction === sellerFaction ||
        restriction.targetFaction === buyerFaction;

      if (!isTargeted) continue;

      // 제재 유형별 처리
      switch (restriction.type) {
        case TradeRestrictionType.EMBARGO:
        case TradeRestrictionType.BLOCKADE:
          return {
            allowed: false,
            reason: `${this.getRestrictionTypeName(restriction.type)}: ${restriction.reason}`,
            tariffModifier: 0,
          };

        case TradeRestrictionType.SANCTION:
          tariffModifier *= 2.0;
          break;

        case TradeRestrictionType.TARIFF:
          tariffModifier *= 1.5;
          break;

        case TradeRestrictionType.LICENSE:
          // 별도 허가 확인 로직 필요
          break;
      }
    }

    return { allowed: true, tariffModifier };
  }

  private getRestrictionTypeName(type: TradeRestrictionType): string {
    const names: Record<TradeRestrictionType, string> = {
      [TradeRestrictionType.EMBARGO]: '금수 조치',
      [TradeRestrictionType.SANCTION]: '경제 제재',
      [TradeRestrictionType.BLOCKADE]: '무역 봉쇄',
      [TradeRestrictionType.TARIFF]: '고율 관세',
      [TradeRestrictionType.QUOTA]: '수량 제한',
      [TradeRestrictionType.LICENSE]: '허가 필요',
    };
    return names[type] || '제재';
  }

  // ============================================================
  // 무역 협정
  // ============================================================

  /**
   * 무역 협정 체결
   */
  public signExtendedTradeAgreement(
    sessionId: string,
    parties: string[],
    name: string,
    terms: ExtendedTradeAgreementTerms,
    durationDays?: number,
  ): { success: boolean; agreement?: ExtendedTradeAgreement; error?: string } {
    if (parties.length < 2) {
      return { success: false, error: '최소 2개 세력이 필요합니다.' };
    }

    const agreement: ExtendedTradeAgreement = {
      agreementId: `TAGR-${uuidv4().slice(0, 8)}`,
      sessionId,
      parties,
      name,
      terms,
      signedAt: new Date(),
      expiresAt: durationDays
        ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)
        : undefined,
      isActive: true,
      tradeVolume: 0,
    };

    const agreements = this.agreements.get(sessionId) || [];
    agreements.push(agreement);
    this.agreements.set(sessionId, agreements);

    this.emit('trade:agreementSigned', { sessionId, agreement });
    logger.info(`[TradeExtensionService] Trade agreement signed: ${name}`);

    return { success: true, agreement };
  }

  /**
   * 무역 협정 종료
   */
  public terminateExtendedTradeAgreement(
    sessionId: string,
    agreementId: string,
    terminatingFaction: string,
    reason: string,
  ): { success: boolean; error?: string } {
    const agreements = this.agreements.get(sessionId) || [];
    const agreement = agreements.find(a => a.agreementId === agreementId);

    if (!agreement) {
      return { success: false, error: '협정을 찾을 수 없습니다.' };
    }

    if (!agreement.parties.includes(terminatingFaction)) {
      return { success: false, error: '협정 당사자가 아닙니다.' };
    }

    agreement.isActive = false;

    this.emit('trade:agreementTerminated', { sessionId, agreement, terminatingFaction, reason });
    logger.info(`[TradeExtensionService] Trade agreement terminated: ${agreementId}`);

    return { success: true };
  }

  /**
   * 협정에 따른 관세율 계산
   */
  public getAgreementTariffRate(
    sessionId: string,
    partyA: string,
    partyB: string,
    category: TradeGoodsCategory,
  ): number {
    const agreements = this.agreements.get(sessionId) || [];
    const DEFAULT_TARIFF = 10; // 기본 관세 10%

    for (const agreement of agreements) {
      if (!agreement.isActive) continue;

      // 만료 확인
      if (agreement.expiresAt && agreement.expiresAt < new Date()) {
        agreement.isActive = false;
        continue;
      }

      // 당사자 확인
      if (!agreement.parties.includes(partyA) || !agreement.parties.includes(partyB)) {
        continue;
      }

      // 우선 품목이면 추가 할인
      if (agreement.terms.preferredGoods?.includes(category)) {
        return Math.max(0, agreement.terms.tariffRate - 2);
      }

      return agreement.terms.tariffRate;
    }

    return DEFAULT_TARIFF;
  }

  // ============================================================
  // 밀수 시스템
  // ============================================================

  /**
   * 밀수 작전 계획
   */
  public planSmuggling(
    sessionId: string,
    smugglerId: string,
    originId: string,
    destinationId: string,
    goods: SmuggledGoods[],
  ): { success: boolean; operation?: SmugglingOperation; error?: string } {
    // 밀수품 검증
    for (const item of goods) {
      const goodsInfo = Array.from(this.tradeGoods.values())
        .find(g => g.category === item.category);

      if (!goodsInfo) {
        return { success: false, error: `알 수 없는 품목: ${item.category}` };
      }
    }

    // 위험도 계산
    const risk = this.calculateSmugglingRisk(sessionId, originId, destinationId, goods);
    const detectChance = SMUGGLING_RISK_DETECT_CHANCE[risk];

    // 예상 수익 계산
    const profit = this.calculateSmugglingProfit(sessionId, destinationId, goods);

    const operation: SmugglingOperation = {
      operationId: `SMUG-${uuidv4().slice(0, 8)}`,
      sessionId,
      smugglerId,
      originId,
      destinationId,
      goods,
      risk,
      detectChance,
      profit,
      status: 'PLANNING',
    };

    const operations = this.smugglingOps.get(sessionId) || [];
    operations.push(operation);
    this.smugglingOps.set(sessionId, operations);

    this.emit('trade:smugglingPlanned', { sessionId, operation });
    logger.info(`[TradeExtensionService] Smuggling operation planned: ${operation.operationId}`);

    return { success: true, operation };
  }

  /**
   * 밀수 작전 실행
   */
  public async executeSmuggling(
    sessionId: string,
    operationId: string,
  ): Promise<{
    success: boolean;
    operation?: SmugglingOperation;
    profit?: number;
    intercepted?: boolean;
    error?: string;
  }> {
    const operations = this.smugglingOps.get(sessionId) || [];
    const operation = operations.find(o => o.operationId === operationId);

    if (!operation) {
      return { success: false, error: '작전을 찾을 수 없습니다.' };
    }

    if (operation.status !== 'PLANNING') {
      return { success: false, error: '이미 진행 중이거나 완료된 작전입니다.' };
    }

    operation.status = 'IN_TRANSIT';
    operation.startedAt = new Date();

    // 적발 판정
    const roll = Math.random() * 100;
    const intercepted = roll < operation.detectChance;

    if (intercepted) {
      operation.status = 'INTERCEPTED';
      operation.completedAt = new Date();

      this.emit('trade:smugglingIntercepted', { sessionId, operation });
      logger.warn(`[TradeExtensionService] Smuggling intercepted: ${operationId}`);

      return {
        success: false,
        operation,
        intercepted: true,
        profit: -this.calculateTotalCargoValue(operation.goods),
        error: '밀수품이 적발되었습니다!',
      };
    }

    // 성공
    operation.status = 'COMPLETED';
    operation.completedAt = new Date();

    // 거래 기록
    for (const item of operation.goods) {
      this.recordTransaction(sessionId, {
        sellerId: operation.smugglerId,
        buyerId: operation.destinationId,
        goods: item.category,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        isSmuggling: true,
        location: operation.destinationId,
      });
    }

    this.emit('trade:smugglingCompleted', { sessionId, operation });
    logger.info(`[TradeExtensionService] Smuggling completed: ${operationId}, profit: ${operation.profit}`);

    return {
      success: true,
      operation,
      intercepted: false,
      profit: operation.profit,
    };
  }

  /**
   * 밀수 위험도 계산
   */
  private calculateSmugglingRisk(
    sessionId: string,
    originId: string,
    destinationId: string,
    goods: SmuggledGoods[],
  ): SmugglingRisk {
    let riskScore = 0;

    // 불법 품목 포함 여부
    for (const item of goods) {
      const goodsInfo = Array.from(this.tradeGoods.values())
        .find(g => g.category === item.category);
      if (goodsInfo?.isIllegal) {
        riskScore += 30;
      }
    }

    // 제재/봉쇄 상태 확인
    const restrictions = this.restrictions.get(sessionId) || [];
    for (const restriction of restrictions) {
      if (!restriction.isActive) continue;

      if (restriction.type === TradeRestrictionType.BLOCKADE) {
        riskScore += 40;
      } else if (restriction.type === TradeRestrictionType.EMBARGO) {
        riskScore += 25;
      }
    }

    // 수량에 따른 위험도
    const totalQuantity = goods.reduce((sum, g) => sum + g.quantity, 0);
    if (totalQuantity > 1000) riskScore += 20;
    else if (totalQuantity > 500) riskScore += 10;

    // 위험 등급 결정
    if (riskScore >= 70) return SmugglingRisk.EXTREME;
    if (riskScore >= 50) return SmugglingRisk.HIGH;
    if (riskScore >= 25) return SmugglingRisk.MEDIUM;
    return SmugglingRisk.LOW;
  }

  /**
   * 밀수 수익 계산
   */
  private calculateSmugglingProfit(
    sessionId: string,
    destinationId: string,
    goods: SmuggledGoods[],
  ): number {
    let totalProfit = 0;

    for (const item of goods) {
      const marketPrice = this.getCurrentPrice(sessionId, destinationId, item.category);
      // 밀수는 시장가보다 30% 높게 판매
      const sellPrice = marketPrice * 1.3;
      totalProfit += (sellPrice - item.unitPrice) * item.quantity;
    }

    return Math.round(totalProfit);
  }

  private calculateTotalCargoValue(goods: SmuggledGoods[]): number {
    return goods.reduce((sum, g) => sum + g.unitPrice * g.quantity, 0);
  }

  // ============================================================
  // 거래 기록
  // ============================================================

  /**
   * 거래 기록
   */
  public recordTransaction(
    sessionId: string,
    transaction: Omit<TradeTransaction, 'transactionId' | 'sessionId' | 'totalAmount' | 'tariff' | 'timestamp'>,
  ): TradeTransaction {
    const tariffRate = transaction.isSmuggling
      ? 0
      : this.getAgreementTariffRate(
          sessionId,
          transaction.sellerId,
          transaction.buyerId,
          transaction.goods,
        );

    const totalAmount = transaction.unitPrice * transaction.quantity;
    const tariff = Math.round(totalAmount * (tariffRate / 100));

    const fullTransaction: TradeTransaction = {
      transactionId: `TRX-${uuidv4().slice(0, 8)}`,
      sessionId,
      ...transaction,
      totalAmount,
      tariff,
      timestamp: new Date(),
    };

    const transactions = this.transactions.get(sessionId) || [];
    transactions.push(fullTransaction);
    this.transactions.set(sessionId, transactions);

    // 시장 가격 업데이트
    this.updateMarketPrice(
      sessionId,
      transaction.location,
      transaction.goods,
      transaction.quantity, // 공급 증가
      -transaction.quantity, // 수요 감소
    );

    this.emit('trade:transactionRecorded', { sessionId, transaction: fullTransaction });

    return fullTransaction;
  }

  /**
   * 거래 내역 조회
   */
  public getTransactions(
    sessionId: string,
    filter?: {
      factionId?: string;
      category?: TradeGoodsCategory;
      limit?: number;
    },
  ): TradeTransaction[] {
    let transactions = this.transactions.get(sessionId) || [];

    if (filter?.factionId) {
      transactions = transactions.filter(t =>
        t.sellerId === filter.factionId || t.buyerId === filter.factionId
      );
    }

    if (filter?.category) {
      transactions = transactions.filter(t => t.goods === filter.category);
    }

    // 최신순 정렬
    transactions = transactions.sort((a, b) =>
      b.timestamp.getTime() - a.timestamp.getTime()
    );

    if (filter?.limit) {
      transactions = transactions.slice(0, filter.limit);
    }

    return transactions;
  }

  // ============================================================
  // 조회 API
  // ============================================================

  public getActiveRestrictions(sessionId: string, factionId?: string): TradeRestriction[] {
    const restrictions = this.restrictions.get(sessionId) || [];
    let active = restrictions.filter(r => r.isActive);

    if (factionId) {
      active = active.filter(r =>
        r.imposingFaction === factionId ||
        r.targetFaction === factionId ||
        !r.targetFaction
      );
    }

    return active;
  }

  public getActiveAgreements(sessionId: string, factionId?: string): ExtendedTradeAgreement[] {
    const agreements = this.agreements.get(sessionId) || [];
    let active = agreements.filter(a => a.isActive);

    if (factionId) {
      active = active.filter(a => a.parties.includes(factionId));
    }

    return active;
  }

  public getSmugglingOperations(sessionId: string, smugglerId?: string): SmugglingOperation[] {
    const operations = this.smugglingOps.get(sessionId) || [];

    if (smugglerId) {
      return operations.filter(o => o.smugglerId === smugglerId);
    }

    return operations;
  }

  public getMarketConditions(sessionId: string, locationId?: string): MarketCondition[] {
    const conditions = this.marketConditions.get(sessionId) || [];

    if (locationId) {
      return conditions.filter(c => c.locationId === locationId);
    }

    return conditions;
  }
}

export const tradeExtensionService = TradeExtensionService.getInstance();
export default TradeExtensionService;





