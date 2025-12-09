/**
 * EconomyExtension - 경제 시스템 확장
 * 자원 획득/소모, 무역, GDP, 경제 건전성 관리
 *
 * 기능:
 * - 자원 획득/소모 계산
 * - 무역 경로 생성 및 관리
 * - 시장 가격 조회
 * - GDP 계산
 * - 경제 건전성 평가
 */

import { EventEmitter } from 'events';
import { Planet } from '../../models/gin7/Planet';
import { Gin7GameSession } from '../../models/gin7/GameSession';
import { logger } from '../../common/logger';

// ============================================================
// Types & Enums
// ============================================================

/**
 * 경제 자원 유형 (LogisticsService의 ResourceType과 구분)
 */
export enum EcoResourceType {
  CREDITS = 'CREDITS',           // 자금
  FUEL = 'FUEL',                 // 연료
  AMMUNITION = 'AMMUNITION',     // 탄약
  SUPPLIES = 'SUPPLIES',         // 보급품
  MATERIALS = 'MATERIALS',       // 건설 자재
  RARE_MINERALS = 'RARE_MINERALS', // 희귀 광물
  FOOD = 'FOOD',                 // 식량
  LUXURY = 'LUXURY',             // 사치품
}

/**
 * 자원 획득 소스
 */
export enum ResourceSource {
  TAX = 'TAX',                   // 세금
  PRODUCTION = 'PRODUCTION',     // 생산
  TRADE = 'TRADE',               // 무역
  CONQUEST = 'CONQUEST',         // 점령
  AID = 'AID',                   // 원조
  FEZZAN = 'FEZZAN',             // 페잔 거래
}

/**
 * 무역 경로 상태
 */
export enum TradeRouteStatus {
  ACTIVE = 'ACTIVE',             // 활성
  SUSPENDED = 'SUSPENDED',       // 일시 중단
  BLOCKADED = 'BLOCKADED',       // 봉쇄됨
  TERMINATED = 'TERMINATED',     // 종료
}

/**
 * 경제 건전성 등급
 */
export enum EconomicHealthGrade {
  EXCELLENT = 'EXCELLENT',       // 우수 (80-100)
  GOOD = 'GOOD',                 // 양호 (60-79)
  FAIR = 'FAIR',                 // 보통 (40-59)
  POOR = 'POOR',                 // 불량 (20-39)
  CRITICAL = 'CRITICAL',         // 위기 (0-19)
}

/**
 * 자원 상태
 */
export interface ResourceState {
  type: EcoResourceType;
  amount: number;
  maxCapacity: number;
  dailyProduction: number;
  dailyConsumption: number;
  netChange: number;
}

/**
 * 경제 무역 경로 (FezzanNeutralityService의 TradeRoute와 구분)
 */
export interface EcoTradeRoute {
  routeId: string;
  sessionId: string;
  sourcePlanetId: string;
  destinationPlanetId: string;
  resourceType: EcoResourceType;
  volume: number;                // 거래량
  price: number;                 // 단가
  tariffRate: number;            // 관세율
  status: TradeRouteStatus;
  createdAt: Date;
  lastTradeAt?: Date;
  totalTrades: number;
  totalValue: number;
}

/**
 * 시장 가격 정보
 */
export interface MarketPrice {
  resourceType: EcoResourceType;
  basePrice: number;
  currentPrice: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
  volatility: number;            // 변동성 (0-100)
  lastUpdated: Date;
}

/**
 * GDP 통계
 */
export interface GDPStats {
  sessionId: string;
  factionId: string;
  totalGDP: number;
  gdpPerCapita: number;
  gdpGrowthRate: number;
  sectorBreakdown: {
    primary: number;             // 1차 산업 (농업, 광업)
    secondary: number;           // 2차 산업 (제조)
    tertiary: number;            // 3차 산업 (서비스)
    military: number;            // 군수 산업
  };
  ranking: number;
  calculatedAt: Date;
}

/**
 * 경제 건전성 리포트
 */
export interface EconomicHealthReport {
  sessionId: string;
  factionId: string;
  grade: EconomicHealthGrade;
  score: number;
  factors: {
    treasuryBalance: { score: number; weight: number };
    gdpGrowth: { score: number; weight: number };
    inflation: { score: number; weight: number };
    unemployment: { score: number; weight: number };
    tradeBalance: { score: number; weight: number };
    debtRatio: { score: number; weight: number };
  };
  recommendations: string[];
  generatedAt: Date;
}

// ============================================================
// 기본 가격 및 상수
// ============================================================

const BASE_PRICES: Record<EcoResourceType, number> = {
  [EcoResourceType.CREDITS]: 1,
  [EcoResourceType.FUEL]: 100,
  [EcoResourceType.AMMUNITION]: 150,
  [EcoResourceType.SUPPLIES]: 80,
  [EcoResourceType.MATERIALS]: 200,
  [EcoResourceType.RARE_MINERALS]: 500,
  [EcoResourceType.FOOD]: 50,
  [EcoResourceType.LUXURY]: 1000,
};

const RESOURCE_NAMES: Record<EcoResourceType, string> = {
  [EcoResourceType.CREDITS]: '자금',
  [EcoResourceType.FUEL]: '연료',
  [EcoResourceType.AMMUNITION]: '탄약',
  [EcoResourceType.SUPPLIES]: '보급품',
  [EcoResourceType.MATERIALS]: '건설 자재',
  [EcoResourceType.RARE_MINERALS]: '희귀 광물',
  [EcoResourceType.FOOD]: '식량',
  [EcoResourceType.LUXURY]: '사치품',
};

// ============================================================
// EconomyExtension Class
// ============================================================

export class EconomyExtension extends EventEmitter {
  private static instance: EconomyExtension;

  // 세션별 무역 경로
  private tradeRoutes: Map<string, EcoTradeRoute[]> = new Map();
  
  // 세션별 시장 가격
  private marketPrices: Map<string, Map<EcoResourceType, MarketPrice>> = new Map();

  private constructor() {
    super();
    logger.info('[EconomyExtension] Initialized');
  }

  public static getInstance(): EconomyExtension {
    if (!EconomyExtension.instance) {
      EconomyExtension.instance = new EconomyExtension();
    }
    return EconomyExtension.instance;
  }

  // ============================================================
  // 자원 획득 계산
  // ============================================================

  /**
   * 자원 획득 계산
   */
  public async calculateResourceGain(
    sessionId: string,
    factionId: string,
    resourceType: EcoResourceType,
  ): Promise<{
    total: number;
    breakdown: Array<{ source: ResourceSource; amount: number }>;
  }> {
    const breakdown: Array<{ source: ResourceSource; amount: number }> = [];
    let total = 0;

    try {
      // 1. 세금 수입
      const taxRevenue = await this.calculateTaxRevenue(sessionId, factionId, resourceType);
      if (taxRevenue > 0) {
        breakdown.push({ source: ResourceSource.TAX, amount: taxRevenue });
        total += taxRevenue;
      }

      // 2. 생산 수입
      const productionIncome = await this.calculateProductionIncome(sessionId, factionId, resourceType);
      if (productionIncome > 0) {
        breakdown.push({ source: ResourceSource.PRODUCTION, amount: productionIncome });
        total += productionIncome;
      }

      // 3. 무역 수입
      const tradeIncome = await this.calculateTradeIncome(sessionId, factionId, resourceType);
      if (tradeIncome > 0) {
        breakdown.push({ source: ResourceSource.TRADE, amount: tradeIncome });
        total += tradeIncome;
      }

      this.emit('resource:gained', {
        sessionId,
        factionId,
        resourceType,
        total,
        breakdown,
      });

      logger.debug(`[EconomyExtension] Resource gain for ${factionId}: ${resourceType} = ${total}`);

      return { total, breakdown };
    } catch (error) {
      logger.error('[EconomyExtension] calculateResourceGain error:', error);
      return { total: 0, breakdown: [] };
    }
  }

  /**
   * 세금 수입 계산
   */
  private async calculateTaxRevenue(
    sessionId: string,
    factionId: string,
    resourceType: EcoResourceType,
  ): Promise<number> {
    if (resourceType !== EcoResourceType.CREDITS) return 0;

    try {
      const planets = await Planet.find({ sessionId, ownerId: factionId }).lean();
      
      return planets.reduce((sum, planet) => {
        const population = planet.population || 0;
        const taxRate = 0.15; // 기본 세율 15%
        const economicLevel = ((planet as any).industryLevel || 50) / 100;
        
        return sum + Math.floor(population * 100 * taxRate * economicLevel);
      }, 0);
    } catch (error) {
      logger.error('[EconomyExtension] calculateTaxRevenue error:', error);
      return 0;
    }
  }

  /**
   * 생산 수입 계산
   */
  private async calculateProductionIncome(
    sessionId: string,
    factionId: string,
    resourceType: EcoResourceType,
  ): Promise<number> {
    try {
      const planets = await Planet.find({ sessionId, ownerId: factionId }).lean();
      
      // 자원 유형에 따른 생산량 계산
      const productionRates: Partial<Record<EcoResourceType, (p: any) => number>> = {
        [EcoResourceType.FUEL]: (p) => (p.resources?.fuel || 0) * (p.industryLevel || 50) / 100,
        [EcoResourceType.MATERIALS]: (p) => (p.resources?.materials || 0) * (p.industryLevel || 50) / 100,
        [EcoResourceType.FOOD]: (p) => (p.resources?.food || 0) * (p.agricultureLevel || 50) / 100,
        [EcoResourceType.SUPPLIES]: (p) => (p.population || 0) * 0.1 * (p.industryLevel || 50) / 100,
      };

      const calculator = productionRates[resourceType];
      if (!calculator) return 0;

      return planets.reduce((sum, planet) => sum + Math.floor(calculator(planet)), 0);
    } catch (error) {
      logger.error('[EconomyExtension] calculateProductionIncome error:', error);
      return 0;
    }
  }

  /**
   * 무역 수입 계산
   */
  private async calculateTradeIncome(
    sessionId: string,
    factionId: string,
    resourceType: EcoResourceType,
  ): Promise<number> {
    const routes = this.tradeRoutes.get(sessionId) || [];
    const activeRoutes = routes.filter(
      (r) => r.status === TradeRouteStatus.ACTIVE && r.resourceType === resourceType,
    );

    return activeRoutes.reduce((sum, route) => {
      // 수입 무역 (목적지가 우리 행성)
      // 간략화: 무역 가치의 일부를 수입으로 계산
      return sum + Math.floor(route.volume * route.price * 0.1);
    }, 0);
  }

  // ============================================================
  // 자원 소모 계산
  // ============================================================

  /**
   * 자원 소모 계산
   */
  public async calculateResourceConsumption(
    sessionId: string,
    factionId: string,
    resourceType: EcoResourceType,
  ): Promise<{
    total: number;
    breakdown: Array<{ category: string; amount: number }>;
  }> {
    const breakdown: Array<{ category: string; amount: number }> = [];
    let total = 0;

    try {
      // 1. 군사 유지비
      const militaryCost = await this.calculateMilitaryCost(sessionId, factionId, resourceType);
      if (militaryCost > 0) {
        breakdown.push({ category: '군사 유지비', amount: militaryCost });
        total += militaryCost;
      }

      // 2. 행정 비용
      const adminCost = await this.calculateAdminCost(sessionId, factionId, resourceType);
      if (adminCost > 0) {
        breakdown.push({ category: '행정 비용', amount: adminCost });
        total += adminCost;
      }

      // 3. 민생 비용
      const civilCost = await this.calculateCivilCost(sessionId, factionId, resourceType);
      if (civilCost > 0) {
        breakdown.push({ category: '민생 비용', amount: civilCost });
        total += civilCost;
      }

      this.emit('resource:consumed', {
        sessionId,
        factionId,
        resourceType,
        total,
        breakdown,
      });

      logger.debug(`[EconomyExtension] Resource consumption for ${factionId}: ${resourceType} = ${total}`);

      return { total, breakdown };
    } catch (error) {
      logger.error('[EconomyExtension] calculateResourceConsumption error:', error);
      return { total: 0, breakdown: [] };
    }
  }

  /**
   * 군사 유지비 계산
   */
  private async calculateMilitaryCost(
    _sessionId: string,
    _factionId: string,
    resourceType: EcoResourceType,
  ): Promise<number> {
    // 간략화된 계산
    const baseCosts: Partial<Record<EcoResourceType, number>> = {
      [EcoResourceType.CREDITS]: 500000,
      [EcoResourceType.FUEL]: 10000,
      [EcoResourceType.AMMUNITION]: 5000,
      [EcoResourceType.SUPPLIES]: 3000,
    };
    return baseCosts[resourceType] || 0;
  }

  /**
   * 행정 비용 계산
   */
  private async calculateAdminCost(
    sessionId: string,
    factionId: string,
    resourceType: EcoResourceType,
  ): Promise<number> {
    if (resourceType !== EcoResourceType.CREDITS) return 0;
    
    try {
      const planets = await Planet.countDocuments({ sessionId, ownerId: factionId });
      return planets * 10000; // 행성당 10000 행정비
    } catch (error) {
      return 0;
    }
  }

  /**
   * 민생 비용 계산
   */
  private async calculateCivilCost(
    sessionId: string,
    factionId: string,
    resourceType: EcoResourceType,
  ): Promise<number> {
    if (resourceType !== EcoResourceType.CREDITS && resourceType !== EcoResourceType.FOOD) return 0;

    try {
      const planets = await Planet.find({ sessionId, ownerId: factionId }).lean();
      const totalPopulation = planets.reduce((sum, p) => sum + (p.population || 0), 0);

      if (resourceType === EcoResourceType.FOOD) {
        return totalPopulation * 0.5; // 인구당 0.5 식량
      }
      return totalPopulation * 10; // 인구당 10 자금
    } catch (error) {
      return 0;
    }
  }

  // ============================================================
  // 무역 경로 관리
  // ============================================================

  /**
   * 무역 경로 생성
   */
  public async createTradeRoute(
    sessionId: string,
    sourcePlanetId: string,
    destinationPlanetId: string,
    resourceType: EcoResourceType,
    volume: number,
    price?: number,
  ): Promise<{
    success: boolean;
    route?: EcoTradeRoute;
    error?: string;
  }> {
    try {
      // 행성 존재 확인
      const sourcePlanet = await Planet.findOne({ sessionId, planetId: sourcePlanetId });
      const destPlanet = await Planet.findOne({ sessionId, planetId: destinationPlanetId });

      if (!sourcePlanet || !destPlanet) {
        return { success: false, error: '행성을 찾을 수 없습니다.' };
      }

      // 가격 결정
      const marketPrice = this.getMarketPrice(sessionId, resourceType);
      const finalPrice = price ?? marketPrice?.currentPrice ?? BASE_PRICES[resourceType];

      // 무역 경로 생성
      const route: EcoTradeRoute = {
        routeId: `TRADE-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        sessionId,
        sourcePlanetId,
        destinationPlanetId,
        resourceType,
        volume,
        price: finalPrice,
        tariffRate: 10, // 기본 관세 10%
        status: TradeRouteStatus.ACTIVE,
        createdAt: new Date(),
        totalTrades: 0,
        totalValue: 0,
      };

      // 저장
      if (!this.tradeRoutes.has(sessionId)) {
        this.tradeRoutes.set(sessionId, []);
      }
      this.tradeRoutes.get(sessionId)!.push(route);

      this.emit('trade:routeCreated', { sessionId, route });
      logger.info(`[EconomyExtension] Trade route created: ${sourcePlanetId} -> ${destinationPlanetId}`);

      return { success: true, route };
    } catch (error) {
      logger.error('[EconomyExtension] createTradeRoute error:', error);
      return { success: false, error: '무역 경로 생성 중 오류 발생' };
    }
  }

  /**
   * 무역 경로 조회
   */
  public getTradeRoutes(sessionId: string, _factionId?: string): EcoTradeRoute[] {
    const routes = this.tradeRoutes.get(sessionId) || [];
    // factionId 필터링은 행성 소유권 기반으로 해야 하지만 간략화
    return routes;
  }

  /**
   * 무역 경로 상태 변경
   */
  public updateTradeRouteStatus(
    sessionId: string,
    routeId: string,
    status: TradeRouteStatus,
  ): boolean {
    const routes = this.tradeRoutes.get(sessionId);
    if (!routes) return false;

    const route = routes.find((r) => r.routeId === routeId);
    if (!route) return false;

    route.status = status;
    this.emit('trade:routeStatusChanged', { sessionId, routeId, status });
    logger.info(`[EconomyExtension] Trade route ${routeId} status: ${status}`);

    return true;
  }

  // ============================================================
  // 시장 가격
  // ============================================================

  /**
   * 시장 가격 초기화
   */
  public initializeMarketPrices(sessionId: string): void {
    const prices = new Map<EcoResourceType, MarketPrice>();

    for (const [type, basePrice] of Object.entries(BASE_PRICES)) {
      prices.set(type as EcoResourceType, {
        resourceType: type as EcoResourceType,
        basePrice,
        currentPrice: basePrice,
        trend: 'STABLE',
        volatility: 10,
        lastUpdated: new Date(),
      });
    }

    this.marketPrices.set(sessionId, prices);
    logger.info(`[EconomyExtension] Market prices initialized for session: ${sessionId}`);
  }

  /**
   * 시장 가격 조회
   */
  public getMarketPrices(sessionId: string): MarketPrice[] {
    const prices = this.marketPrices.get(sessionId);
    if (!prices) {
      this.initializeMarketPrices(sessionId);
      return this.getMarketPrices(sessionId);
    }
    return Array.from(prices.values());
  }

  /**
   * 특정 자원 시장 가격 조회
   */
  public getMarketPrice(sessionId: string, resourceType: EcoResourceType): MarketPrice | undefined {
    return this.marketPrices.get(sessionId)?.get(resourceType);
  }

  /**
   * 시장 가격 업데이트 (수요/공급 기반)
   */
  public updateMarketPrices(sessionId: string): void {
    const prices = this.marketPrices.get(sessionId);
    if (!prices) return;

    for (const [, price] of Array.from(prices)) {
      // 무작위 변동 (-5% ~ +5%)
      const change = (Math.random() - 0.5) * 0.1 * price.volatility;
      const newPrice = Math.max(
        price.basePrice * 0.5,
        Math.min(price.basePrice * 2, price.currentPrice * (1 + change)),
      );

      price.currentPrice = Math.round(newPrice);
      price.trend = change > 0.02 ? 'UP' : change < -0.02 ? 'DOWN' : 'STABLE';
      price.lastUpdated = new Date();
    }

    this.emit('market:pricesUpdated', { sessionId });
  }

  // ============================================================
  // GDP 계산
  // ============================================================

  /**
   * GDP 계산
   */
  public async calculateGDP(sessionId: string, factionId: string): Promise<GDPStats> {
    try {
      const planets = await Planet.find({ sessionId, ownerId: factionId }).lean();
      const totalPopulation = planets.reduce((sum, p) => sum + (p.population || 0), 0);

      // GDP 구성요소 계산
      const primaryGDP = planets.reduce(
        (sum, p: any) => sum + (p.resources?.food || 0) * 50 + (p.resources?.materials || 0) * 100,
        0,
      );
      const secondaryGDP = planets.reduce(
        (sum, p: any) => sum + (p.industryLevel || 50) * (p.population || 0) * 2,
        0,
      );
      const tertiaryGDP = planets.reduce(
        (sum, p) => sum + (p.population || 0) * 150,
        0,
      );
      const militaryGDP = planets.reduce(
        (sum, p: any) => sum + (p.militaryBase ? 50000 : 0),
        0,
      );

      const totalGDP = primaryGDP + secondaryGDP + tertiaryGDP + militaryGDP;
      const gdpPerCapita = totalPopulation > 0 ? totalGDP / totalPopulation : 0;

      // 성장률 계산 (간략화: 이전 데이터 없이 추정)
      const gdpGrowthRate = Math.random() * 5 - 1; // -1% ~ 4%

      // 순위 계산
      const allFactions = await this.getAllFactionGDPs(sessionId);
      const ranking = allFactions
        .sort((a, b) => b.gdp - a.gdp)
        .findIndex((f) => f.factionId === factionId) + 1;

      const stats: GDPStats = {
        sessionId,
        factionId,
        totalGDP,
        gdpPerCapita: Math.round(gdpPerCapita),
        gdpGrowthRate: Math.round(gdpGrowthRate * 100) / 100,
        sectorBreakdown: {
          primary: primaryGDP,
          secondary: secondaryGDP,
          tertiary: tertiaryGDP,
          military: militaryGDP,
        },
        ranking,
        calculatedAt: new Date(),
      };

      this.emit('economy:gdpCalculated', stats);
      logger.debug(`[EconomyExtension] GDP for ${factionId}: ${totalGDP}`);

      return stats;
    } catch (error) {
      logger.error('[EconomyExtension] calculateGDP error:', error);
      return {
        sessionId,
        factionId,
        totalGDP: 0,
        gdpPerCapita: 0,
        gdpGrowthRate: 0,
        sectorBreakdown: { primary: 0, secondary: 0, tertiary: 0, military: 0 },
        ranking: 99,
        calculatedAt: new Date(),
      };
    }
  }

  /**
   * 모든 진영 GDP 조회
   */
  private async getAllFactionGDPs(
    sessionId: string,
  ): Promise<Array<{ factionId: string; gdp: number }>> {
    const factions = ['EMPIRE', 'ALLIANCE', 'FEZZAN'];
    const results: Array<{ factionId: string; gdp: number }> = [];

    for (const factionId of factions) {
      const planets = await Planet.find({ sessionId, ownerId: factionId }).lean();
      const gdp = planets.reduce((sum, p: any) => {
        const pop = p.population || 0;
        const industry = p.industryLevel || 50;
        return sum + pop * industry * 3;
      }, 0);
      results.push({ factionId, gdp });
    }

    return results;
  }

  // ============================================================
  // 경제 건전성 평가
  // ============================================================

  /**
   * 경제 건전성 평가
   */
  public async getEconomicHealth(
    sessionId: string,
    factionId: string,
  ): Promise<EconomicHealthReport> {
    try {
      const gdpStats = await this.calculateGDP(sessionId, factionId);
      
      // 각 요소별 점수 계산 (0-100)
      const factors: EconomicHealthReport['factors'] = {
        treasuryBalance: {
          score: await this.evaluateTreasuryScore(sessionId, factionId),
          weight: 0.25,
        },
        gdpGrowth: {
          score: Math.min(100, Math.max(0, 50 + gdpStats.gdpGrowthRate * 10)),
          weight: 0.2,
        },
        inflation: {
          score: 70, // 간략화: 기본 70점
          weight: 0.15,
        },
        unemployment: {
          score: 75, // 간략화: 기본 75점
          weight: 0.15,
        },
        tradeBalance: {
          score: await this.evaluateTradeBalanceScore(sessionId, factionId),
          weight: 0.15,
        },
        debtRatio: {
          score: 80, // 간략화: 기본 80점
          weight: 0.1,
        },
      };

      // 가중 평균 점수 계산
      const totalWeight = Object.values(factors).reduce((sum, f) => sum + f.weight, 0);
      const score = Object.values(factors).reduce(
        (sum, f) => sum + f.score * f.weight,
        0,
      ) / totalWeight;

      // 등급 결정
      const grade = this.determineHealthGrade(score);

      // 권장사항 생성
      const recommendations = this.generateRecommendations(factors, grade);

      const report: EconomicHealthReport = {
        sessionId,
        factionId,
        grade,
        score: Math.round(score),
        factors,
        recommendations,
        generatedAt: new Date(),
      };

      this.emit('economy:healthReportGenerated', report);
      logger.info(`[EconomyExtension] Economic health for ${factionId}: ${grade} (${Math.round(score)})`);

      return report;
    } catch (error) {
      logger.error('[EconomyExtension] getEconomicHealth error:', error);
      return {
        sessionId,
        factionId,
        grade: EconomicHealthGrade.FAIR,
        score: 50,
        factors: {
          treasuryBalance: { score: 50, weight: 0.25 },
          gdpGrowth: { score: 50, weight: 0.2 },
          inflation: { score: 50, weight: 0.15 },
          unemployment: { score: 50, weight: 0.15 },
          tradeBalance: { score: 50, weight: 0.15 },
          debtRatio: { score: 50, weight: 0.1 },
        },
        recommendations: [],
        generatedAt: new Date(),
      };
    }
  }

  /**
   * 국고 점수 평가
   */
  private async evaluateTreasuryScore(sessionId: string, factionId: string): Promise<number> {
    try {
      const session = await Gin7GameSession.findOne({ sessionId }).lean();
      const treasury = (session?.data as any)?.factions?.[factionId]?.treasury || 0;
      
      // 국고 1000만 이상이면 100점, 0 이하면 0점
      return Math.min(100, Math.max(0, treasury / 100000));
    } catch (error) {
      return 50;
    }
  }

  /**
   * 무역수지 점수 평가
   */
  private async evaluateTradeBalanceScore(sessionId: string, _factionId: string): Promise<number> {
    const routes = this.tradeRoutes.get(sessionId) || [];
    const activeRoutes = routes.filter((r) => r.status === TradeRouteStatus.ACTIVE);
    
    // 활성 무역 경로 수에 따른 점수
    return Math.min(100, 50 + activeRoutes.length * 10);
  }

  /**
   * 등급 결정
   */
  private determineHealthGrade(score: number): EconomicHealthGrade {
    if (score >= 80) return EconomicHealthGrade.EXCELLENT;
    if (score >= 60) return EconomicHealthGrade.GOOD;
    if (score >= 40) return EconomicHealthGrade.FAIR;
    if (score >= 20) return EconomicHealthGrade.POOR;
    return EconomicHealthGrade.CRITICAL;
  }

  /**
   * 권장사항 생성
   */
  private generateRecommendations(
    factors: EconomicHealthReport['factors'],
    grade: EconomicHealthGrade,
  ): string[] {
    const recommendations: string[] = [];

    if (factors.treasuryBalance.score < 50) {
      recommendations.push('국고 잔고가 부족합니다. 세율 조정이나 지출 절감을 고려하세요.');
    }
    if (factors.gdpGrowth.score < 50) {
      recommendations.push('경제 성장률이 낮습니다. 행성 개발에 투자하세요.');
    }
    if (factors.tradeBalance.score < 50) {
      recommendations.push('무역 수지가 불균형합니다. 새로운 무역 경로를 개척하세요.');
    }

    if (grade === EconomicHealthGrade.CRITICAL) {
      recommendations.unshift('⚠️ 경제가 위기 상태입니다. 즉각적인 조치가 필요합니다.');
    }

    return recommendations;
  }

  // ============================================================
  // 유틸리티
  // ============================================================

  /**
   * 자원 이름 반환
   */
  public getResourceName(resourceType: EcoResourceType): string {
    return RESOURCE_NAMES[resourceType] || resourceType;
  }

  /**
   * 기본 가격 반환
   */
  public getBasePrice(resourceType: EcoResourceType): number {
    return BASE_PRICES[resourceType] || 0;
  }

  // ============================================================
  // 정리
  // ============================================================

  public cleanup(sessionId: string): void {
    this.tradeRoutes.delete(sessionId);
    this.marketPrices.delete(sessionId);
    logger.info(`[EconomyExtension] Cleaned up session: ${sessionId}`);
  }
}

export const economyExtension = EconomyExtension.getInstance();
export default EconomyExtension;
