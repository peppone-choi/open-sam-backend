import mongoose from 'mongoose';
import { NationalTreasury, INationalTreasury, BudgetCategory, IBudgetAllocation, IExpenseRecord } from '../../models/gin7/NationalTreasury';
import { PlanetSupport, IPlanetSupport } from '../../models/gin7/PlanetSupport';
import { Planet } from '../../models/gin7/Planet';
import { TradeRoute, ITradeRoute } from '../../models/gin7/TradeRoute';
import { Gin7Error } from '../../common/errors/gin7-errors';

/**
 * 무역 세수 결과
 */
export interface ITradeRevenueResult {
  totalRevenue: number;
  byRoute: Array<{
    routeId: string;
    routeName: string;
    tradingVolume: number;
    taxCollected: number;
    isPhezzanControlled: boolean;
  }>;
  phezzanBonus: number;
  corridorTolls: number;
}

/**
 * 세금 징수 결과
 */
export interface ITaxCollectionResult {
  success: boolean;
  totalCollected: number;
  byPlanet: Array<{
    planetId: string;
    planetName: string;
    amount: number;
    compliance: number;
  }>;
  unpaidAmount: number;
  error?: string;
}

/**
 * 예산 배분 요청
 */
export interface IBudgetAllocationRequest {
  category: BudgetCategory;
  amount: number;
  priority?: number;
}

/**
 * 지출 요청
 */
export interface IExpenseRequest {
  category: BudgetCategory;
  amount: number;
  description: string;
  authorizedBy?: string;
  departmentId?: string;
}

/**
 * 지출 결과
 */
export interface IExpenseResult {
  success: boolean;
  expenseId?: string;
  remainingBudget?: number;
  error?: string;
}

/**
 * BudgetService
 * 국가 예산/세금 시스템 관리
 */
export class BudgetService {
  /**
   * 국고 조회
   */
  static async getTreasury(
    sessionId: string,
    factionId: string
  ): Promise<INationalTreasury | null> {
    return NationalTreasury.findOne({ sessionId, factionId });
  }

  /**
   * 국고 생성 (새 세력용)
   */
  static async createTreasury(
    sessionId: string,
    factionId: string,
    factionName: string,
    initialBalance: number = 100000
  ): Promise<INationalTreasury> {
    const treasuryId = `TRE-${factionId}-${Date.now()}`;
    
    const treasury = new NationalTreasury({
      treasuryId,
      sessionId,
      factionId,
      factionName,
      balance: initialBalance,
      reserveFund: Math.floor(initialBalance * 0.1),
      totalBudget: initialBalance
    });

    await treasury.save();
    return treasury;
  }

  /**
   * 세금 징수 (일일 처리)
   */
  static async collectTaxes(
    sessionId: string,
    factionId: string,
    gameDay: number
  ): Promise<ITaxCollectionResult> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. 국고 조회
      const treasury = await NationalTreasury.findOne({
        sessionId,
        factionId
      }).session(session);

      if (!treasury) {
        throw new Gin7Error('TREASURY_NOT_FOUND', 'National treasury not found');
      }

      // 2. 해당 세력의 모든 행성 조회
      const planets = await Planet.find({
        sessionId,
        ownerId: factionId
      }).session(session);

      // 3. 각 행성의 지지율 데이터 조회
      const planetSupports = await PlanetSupport.find({
        sessionId,
        factionId
      }).session(session);

      const supportMap = new Map<string, IPlanetSupport>();
      for (const ps of planetSupports) {
        supportMap.set(ps.planetId, ps);
      }

      // 4. 행성별 세금 징수
      const byPlanet: Array<{
        planetId: string;
        planetName: string;
        amount: number;
        population: number;
        effectiveTaxRate: number;
        compliance: number;
      }> = [];

      let totalCollected = 0;
      let totalUnpaid = 0;
      const effectiveTaxRate = treasury.taxPolicy.baseTaxRate + 
        (treasury.taxPolicy.isEmergencyTax ? treasury.taxPolicy.warTaxRate : 0);

      for (const planet of planets) {
        // 면세 행성 체크
        if (treasury.taxPolicy.taxExemptions.includes(planet.planetId)) {
          continue;
        }

        const support = supportMap.get(planet.planetId);
        const compliance = support?.calculateTaxCompliance() ?? 0.8;
        
        // 세금 계산: 인구 * 세율 * 순응률 * 크레딧 생산량 비율
        const baseTax = Math.floor(
          (planet.population / 1000) * effectiveTaxRate * planet.resourceProduction.credits
        );
        const actualTax = Math.floor(baseTax * compliance);
        const unpaid = baseTax - actualTax;

        totalCollected += actualTax;
        totalUnpaid += unpaid;

        byPlanet.push({
          planetId: planet.planetId,
          planetName: planet.name,
          amount: actualTax,
          population: planet.population,
          effectiveTaxRate,
          compliance
        });

        // 지지율 데이터 업데이트
        if (support) {
          support.lastTaxCollection = actualTax;
          support.taxComplianceRate = compliance;
          await support.save({ session });
        }
      }

      // 5. 교역세 징수
      const tradeTax = await this.collectTradeTax(sessionId, factionId, treasury.taxPolicy.tradeTaxRate);
      totalCollected += tradeTax;

      // 6. 국고 업데이트
      treasury.balance += totalCollected;
      treasury.lastDayIncome = totalCollected;
      treasury.lastMonthIncome += totalCollected;

      // 7. 세금 기록 추가
      treasury.taxHistory.unshift({
        gameDay,
        totalCollected,
        byCategory: {
          income: totalCollected - tradeTax,
          trade: tradeTax,
          property: 0,
          special: 0
        },
        byPlanet,
        unpaidAmount: totalUnpaid
      });

      // 최근 30일 기록만 유지
      if (treasury.taxHistory.length > 30) {
        treasury.taxHistory = treasury.taxHistory.slice(0, 30);
      }

      treasury.lastUpdated = new Date();
      treasury.recalculateCreditRating();
      await treasury.save({ session });

      await session.commitTransaction();

      return {
        success: true,
        totalCollected,
        byPlanet,
        unpaidAmount: totalUnpaid
      };

    } catch (error) {
      await session.abortTransaction();
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        totalCollected: 0,
        byPlanet: [],
        unpaidAmount: 0,
        error: message
      };
    } finally {
      session.endSession();
    }
  }

  /**
   * 교역세 징수
   * TradeRoute 기반 실제 교역량으로 세금 계산
   */
  private static async collectTradeTax(
    sessionId: string,
    factionId: string,
    tradeTaxRate: number
  ): Promise<number> {
    const result = await this.calculateTradeRevenue(sessionId, factionId, tradeTaxRate);
    return result.totalRevenue;
  }

  /**
   * 무역로 기반 세수 계산
   * @param sessionId 세션 ID
   * @param factionId 세력 ID
   * @param baseTaxRate 기본 세율 (기본값: 0.05 = 5%)
   * @returns 세수 결과 (무역로별 상세, 페잔 보너스, 회랑 통행료 포함)
   */
  static async calculateTradeRevenue(
    sessionId: string,
    factionId: string,
    baseTaxRate: number = 0.05
  ): Promise<ITradeRevenueResult> {
    // 페잔 자치령 상수
    const PHEZZAN_FACTION_ID = 'PHEZZAN';
    const PHEZZAN_CORRIDOR_SYSTEMS = ['PHEZZAN', 'PHEZZAN-PRIME', 'PHEZZAN-CORRIDOR'];
    const PHEZZAN_TAX_BONUS = 0.20; // 페잔 세율 +20%
    const CORRIDOR_TOLL_RATE = 0.03; // 회랑 통행료 3%

    const isPhezzan = factionId === PHEZZAN_FACTION_ID;

    // 1. 해당 세력이 통제하는 무역로 목록 조회
    const controlledRoutes = await TradeRoute.find({
      sessionId,
      factionId,
      status: 'ACTIVE'
    });

    // 2. 페잔인 경우, 페잔을 경유하는 타 세력 무역로도 조회 (통행료용)
    let transitRoutes: ITradeRoute[] = [];
    if (isPhezzan) {
      transitRoutes = await TradeRoute.find({
        sessionId,
        factionId: { $ne: PHEZZAN_FACTION_ID },
        status: 'ACTIVE',
        $or: [
          { sourceId: { $in: PHEZZAN_CORRIDOR_SYSTEMS } },
          { targetId: { $in: PHEZZAN_CORRIDOR_SYSTEMS } }
        ]
      });
    }

    const byRoute: ITradeRevenueResult['byRoute'] = [];
    let totalRevenue = 0;
    let phezzanBonus = 0;
    let corridorTolls = 0;

    // 3. 각 무역로의 교역량 계산 및 세율 적용
    for (const route of controlledRoutes) {
      // 최근 거래 기반 교역량 계산
      const tradingVolume = this.calculateRouteTradingVolume(route);
      
      // 기본 세금 계산
      let taxCollected = Math.floor(tradingVolume * baseTaxRate);

      // 페잔 보너스: 페잔이 통제하는 무역로는 세율 +20%
      const routePassesPhezzan = 
        PHEZZAN_CORRIDOR_SYSTEMS.includes(route.sourceId) ||
        PHEZZAN_CORRIDOR_SYSTEMS.includes(route.targetId);
      
      if (isPhezzan && routePassesPhezzan) {
        const bonus = Math.floor(tradingVolume * baseTaxRate * PHEZZAN_TAX_BONUS);
        taxCollected += bonus;
        phezzanBonus += bonus;
      }

      totalRevenue += taxCollected;

      byRoute.push({
        routeId: route.routeId,
        routeName: route.name,
        tradingVolume,
        taxCollected,
        isPhezzanControlled: isPhezzan && routePassesPhezzan
      });
    }

    // 4. 페잔 회랑 통행료 계산 (페잔만 해당)
    if (isPhezzan) {
      for (const route of transitRoutes) {
        const tradingVolume = this.calculateRouteTradingVolume(route);
        const toll = Math.floor(tradingVolume * CORRIDOR_TOLL_RATE);
        corridorTolls += toll;
      }
      totalRevenue += corridorTolls;
    }

    return {
      totalRevenue,
      byRoute,
      phezzanBonus,
      corridorTolls
    };
  }

  /**
   * 무역로의 교역량 계산 (최근 거래 기반)
   */
  private static calculateRouteTradingVolume(route: ITradeRoute): number {
    // 최근 거래가 있으면 실제 거래량 사용
    if (route.transactions && route.transactions.length > 0) {
      // 최근 10개 거래의 평균 거래량
      const recentTransactions = route.transactions.slice(0, 10);
      const totalAmount = recentTransactions.reduce((sum, txn) => sum + txn.totalAmount, 0);
      return Math.floor(totalAmount / Math.max(recentTransactions.length, 1));
    }

    // 거래 기록이 없으면 예상 교역량 계산
    // (아이템 수량 * 기본 가격 기준)
    const baseItemPrices: Record<string, number> = {
      food: 10,
      fuel: 15,
      ammo: 25,
      minerals: 20,
      credits: 1,
      shipParts: 100,
      energy: 12,
      rareMetals: 200,
      components: 80
    };

    let estimatedVolume = 0;
    for (const item of route.items) {
      const price = baseItemPrices[item.itemType] || 10;
      estimatedVolume += item.quantity * price;
    }

    return estimatedVolume;
  }

  /**
   * 예산 배분 설정
   */
  static async allocateBudget(
    sessionId: string,
    factionId: string,
    allocations: IBudgetAllocationRequest[]
  ): Promise<{ success: boolean; error?: string }> {
    const treasury = await NationalTreasury.findOne({ sessionId, factionId });

    if (!treasury) {
      return { success: false, error: 'Treasury not found' };
    }

    // 총 배분액 계산
    const totalAllocation = allocations.reduce((sum, a) => sum + a.amount, 0);
    
    // 가용 예산 체크
    if (totalAllocation > treasury.balance - treasury.frozenFunds) {
      return { success: false, error: 'Insufficient funds for allocation' };
    }

    // 배분 업데이트
    for (const alloc of allocations) {
      const existing = treasury.budgetAllocations.find(
        (a: IBudgetAllocation) => a.category === alloc.category
      );
      
      if (existing) {
        existing.allocated = alloc.amount;
        if (alloc.priority !== undefined) {
          existing.priority = alloc.priority;
        }
      }
    }

    treasury.totalBudget = totalAllocation;
    treasury.lastUpdated = new Date();
    await treasury.save();

    return { success: true };
  }

  /**
   * 지출 처리
   */
  static async processExpense(
    sessionId: string,
    factionId: string,
    expense: IExpenseRequest,
    gameDay: number
  ): Promise<IExpenseResult> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const treasury = await NationalTreasury.findOne({
        sessionId,
        factionId
      }).session(session);

      if (!treasury) {
        throw new Gin7Error('TREASURY_NOT_FOUND', 'Treasury not found');
      }

      // 예산 체크
      const allocation = treasury.budgetAllocations.find(
        (a: IBudgetAllocation) => a.category === expense.category
      );

      if (!allocation) {
        throw new Gin7Error('INVALID_CATEGORY', 'Invalid budget category');
      }

      const availableBudget = allocation.allocated - allocation.spent - allocation.locked;
      if (availableBudget < expense.amount) {
        throw new Gin7Error('INSUFFICIENT_BUDGET', 
          `Insufficient budget. Available: ${availableBudget}, Required: ${expense.amount}`);
      }

      // 실제 잔액 체크
      const availableFunds = treasury.balance - treasury.frozenFunds;
      if (availableFunds < expense.amount) {
        throw new Gin7Error('INSUFFICIENT_FUNDS', 
          `Insufficient funds. Available: ${availableFunds}, Required: ${expense.amount}`);
      }

      // 지출 처리
      const expenseId = `EXP-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      
      allocation.spent += expense.amount;
      treasury.balance -= expense.amount;
      treasury.lastDayExpense += expense.amount;
      treasury.lastMonthExpense += expense.amount;

      // 지출 기록
      const expenseRecord: IExpenseRecord = {
        expenseId,
        timestamp: new Date(),
        gameDay,
        category: expense.category,
        amount: expense.amount,
        description: expense.description,
        authorizedBy: expense.authorizedBy,
        departmentId: expense.departmentId
      };

      treasury.expenseHistory.unshift(expenseRecord);
      
      // 최근 100건 기록만 유지
      if (treasury.expenseHistory.length > 100) {
        treasury.expenseHistory = treasury.expenseHistory.slice(0, 100);
      }

      treasury.lastUpdated = new Date();
      treasury.recalculateCreditRating();
      await treasury.save({ session });

      await session.commitTransaction();

      return {
        success: true,
        expenseId,
        remainingBudget: allocation.allocated - allocation.spent - allocation.locked
      };

    } catch (error) {
      await session.abortTransaction();
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: message
      };
    } finally {
      session.endSession();
    }
  }

  /**
   * 예산 잠금 (건설 등 예약)
   */
  static async lockBudget(
    sessionId: string,
    factionId: string,
    category: BudgetCategory,
    amount: number
  ): Promise<{ success: boolean; error?: string }> {
    const treasury = await NationalTreasury.findOne({ sessionId, factionId });

    if (!treasury) {
      return { success: false, error: 'Treasury not found' };
    }

    const allocation = treasury.budgetAllocations.find(
      (a: IBudgetAllocation) => a.category === category
    );

    if (!allocation) {
      return { success: false, error: 'Invalid category' };
    }

    const available = allocation.allocated - allocation.spent - allocation.locked;
    if (available < amount) {
      return { success: false, error: 'Insufficient budget to lock' };
    }

    allocation.locked += amount;
    treasury.lastUpdated = new Date();
    await treasury.save();

    return { success: true };
  }

  /**
   * 예산 잠금 해제
   */
  static async unlockBudget(
    sessionId: string,
    factionId: string,
    category: BudgetCategory,
    amount: number,
    consume: boolean = true
  ): Promise<{ success: boolean; error?: string }> {
    const treasury = await NationalTreasury.findOne({ sessionId, factionId });

    if (!treasury) {
      return { success: false, error: 'Treasury not found' };
    }

    const allocation = treasury.budgetAllocations.find(
      (a: IBudgetAllocation) => a.category === category
    );

    if (!allocation) {
      return { success: false, error: 'Invalid category' };
    }

    if (allocation.locked < amount) {
      return { success: false, error: 'Unlock amount exceeds locked amount' };
    }

    allocation.locked -= amount;
    
    if (consume) {
      allocation.spent += amount;
      treasury.balance -= amount;
    }

    treasury.lastUpdated = new Date();
    await treasury.save();

    return { success: true };
  }

  /**
   * 세율 변경
   */
  static async setTaxRate(
    sessionId: string,
    factionId: string,
    taxType: 'base' | 'war' | 'luxury' | 'trade',
    rate: number
  ): Promise<{ success: boolean; error?: string }> {
    const treasury = await NationalTreasury.findOne({ sessionId, factionId });

    if (!treasury) {
      return { success: false, error: 'Treasury not found' };
    }

    // 세율 범위 체크
    const maxRates: Record<string, number> = {
      base: 0.5,
      war: 0.3,
      luxury: 0.2,
      trade: 0.15
    };

    if (rate < 0 || rate > maxRates[taxType]) {
      return { 
        success: false, 
        error: `Tax rate must be between 0 and ${maxRates[taxType]}` 
      };
    }

    switch (taxType) {
      case 'base':
        treasury.taxPolicy.baseTaxRate = rate;
        break;
      case 'war':
        treasury.taxPolicy.warTaxRate = rate;
        break;
      case 'luxury':
        treasury.taxPolicy.luxuryTaxRate = rate;
        break;
      case 'trade':
        treasury.taxPolicy.tradeTaxRate = rate;
        break;
    }

    treasury.lastUpdated = new Date();
    await treasury.save();

    return { success: true };
  }

  /**
   * 비상 과세 활성화/비활성화
   */
  static async setEmergencyTax(
    sessionId: string,
    factionId: string,
    enabled: boolean
  ): Promise<{ success: boolean; error?: string }> {
    const treasury = await NationalTreasury.findOne({ sessionId, factionId });

    if (!treasury) {
      return { success: false, error: 'Treasury not found' };
    }

    treasury.taxPolicy.isEmergencyTax = enabled;
    treasury.lastUpdated = new Date();
    await treasury.save();

    return { success: true };
  }

  /**
   * 면세 행성 추가/제거
   */
  static async setTaxExemption(
    sessionId: string,
    factionId: string,
    planetId: string,
    exempt: boolean
  ): Promise<{ success: boolean; error?: string }> {
    const treasury = await NationalTreasury.findOne({ sessionId, factionId });

    if (!treasury) {
      return { success: false, error: 'Treasury not found' };
    }

    if (exempt) {
      if (!treasury.taxPolicy.taxExemptions.includes(planetId)) {
        treasury.taxPolicy.taxExemptions.push(planetId);
      }
    } else {
      treasury.taxPolicy.taxExemptions = treasury.taxPolicy.taxExemptions.filter(
        (id: string) => id !== planetId
      );
    }

    treasury.lastUpdated = new Date();
    await treasury.save();

    return { success: true };
  }

  /**
   * 예산 요약 조회
   */
  static async getBudgetSummary(
    sessionId: string,
    factionId: string
  ): Promise<{
    balance: number;
    totalBudget: number;
    allocations: Array<{
      category: BudgetCategory;
      allocated: number;
      spent: number;
      locked: number;
      available: number;
    }>;
    income: {
      lastDay: number;
      lastMonth: number;
    };
    expenses: {
      lastDay: number;
      lastMonth: number;
    };
    creditRating: string;
    debtAmount: number;
  } | null> {
    const treasury = await NationalTreasury.findOne({ sessionId, factionId });

    if (!treasury) {
      return null;
    }

    const allocations = treasury.budgetAllocations.map((a: IBudgetAllocation) => ({
      category: a.category,
      allocated: a.allocated,
      spent: a.spent,
      locked: a.locked,
      available: Math.max(0, a.allocated - a.spent - a.locked)
    }));

    return {
      balance: treasury.balance,
      totalBudget: treasury.totalBudget,
      allocations,
      income: {
        lastDay: treasury.lastDayIncome,
        lastMonth: treasury.lastMonthIncome
      },
      expenses: {
        lastDay: treasury.lastDayExpense,
        lastMonth: treasury.lastMonthExpense
      },
      creditRating: treasury.creditRating,
      debtAmount: treasury.debtAmount
    };
  }

  /**
   * 월간 예산 리셋 (매월 1일)
   */
  static async resetMonthlyBudget(
    sessionId: string,
    factionId: string
  ): Promise<void> {
    const treasury = await NationalTreasury.findOne({ sessionId, factionId });

    if (!treasury) {
      return;
    }

    // 집행액 리셋
    for (const allocation of treasury.budgetAllocations) {
      allocation.spent = 0;
    }

    // 월간 통계 리셋
    treasury.lastMonthIncome = 0;
    treasury.lastMonthExpense = 0;
    treasury.fiscalYear++;

    treasury.lastUpdated = new Date();
    treasury.recalculateCreditRating();
    await treasury.save();
  }
}

export default BudgetService;

