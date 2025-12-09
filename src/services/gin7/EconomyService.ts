/**
 * EconomyService - 경제 시스템
 * 매뉴얼 300-301행: "経済関連は現在未実装となっております"
 *
 * 국가 운영과 군사비 지불은 각 행성에서 징수하는 세금으로 충당됩니다.
 *
 * 구현 항목:
 * - 세금 징수 (행성별 납입율)
 * - 국가 예산 관리
 * - 군비/민생 배분
 * - 무역 및 관세
 * - 급여 지급
 */

import { EventEmitter } from 'events';
import { Planet, IPlanet } from '../../models/gin7/Planet';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { Fleet, IFleet, SHIP_SPECS, ShipClass } from '../../models/gin7/Fleet';
import { logger } from '../../common/logger';

/**
 * 예산 카테고리
 */
export enum BudgetCategory {
  MILITARY = 'MILITARY',           // 군비
  CIVIL = 'CIVIL',                 // 민생
  RESEARCH = 'RESEARCH',           // 연구
  INTELLIGENCE = 'INTELLIGENCE',   // 첩보
  RESERVE = 'RESERVE',             // 예비비
}

/**
 * 세금 유형
 */
export enum TaxType {
  INCOME_TAX = 'INCOME_TAX',       // 소득세
  PRODUCTION_TAX = 'PRODUCTION_TAX', // 생산세
  TRADE_TAX = 'TRADE_TAX',         // 무역세 (관세)
  SPECIAL_TAX = 'SPECIAL_TAX',     // 특별세
}

/**
 * 국고 상태
 */
export interface NationalTreasury {
  sessionId: string;
  faction: string;
  balance: number;                  // 현재 잔고
  monthlyIncome: number;            // 월 수입
  monthlyExpense: number;           // 월 지출
  budgetAllocation: Record<BudgetCategory, number>; // 예산 배분율 (%)
  taxRate: number;                  // 기본 세율 (%)
  lastUpdated: Date;
}

/**
 * 행성 경제 상태
 */
export interface PlanetEconomy {
  planetId: string;
  sessionId: string;

  // 생산력
  gdp: number;                      // 총생산
  population: number;               // 인구
  industryLevel: number;            // 산업 수준 (0-100)

  // 세금
  taxContribution: number;          // 납입율 (%)
  taxRevenue: number;               // 세금 수입
  
  // 무역
  tradeVolume: number;              // 교역량
  tradeBalance: number;             // 무역 수지

  // 지출
  localExpense: number;             // 지방 지출
  militaryMaintenance: number;      // 군사 유지비

  // 상태
  economicHealth: number;           // 경제 건전성 (0-100)
  publicSatisfaction: number;       // 민심 (0-100)

  lastUpdated: Date;
}

/**
 * 급여 등급
 */
export interface SalaryGrade {
  rank: string;
  baseSalary: number;
  positionBonus: number;
}

/**
 * 무역 계약
 */
export interface TradeAgreement {
  agreementId: string;
  sessionId: string;
  partnerFaction: string;           // 거래 상대 (페잔 등)
  goods: string;                    // 품목
  volume: number;                   // 거래량
  price: number;                    // 가격
  tariffRate: number;               // 관세율
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
}

/**
 * 경제 이벤트
 */
export interface EconomicEvent {
  eventId: string;
  sessionId: string;
  type: 'TAX_COLLECTED' | 'SALARY_PAID' | 'BUDGET_ALLOCATED' | 'TRADE_COMPLETED' | 'DEFICIT_WARNING';
  faction: string;
  amount: number;
  description: string;
  timestamp: Date;
}

// 급여 테이블 (매뉴얼 기반 추정)
const SALARY_TABLE: Record<string, number> = {
  'MARSHAL': 100000,
  'FLEET_ADMIRAL': 80000,
  'ADMIRAL': 60000,
  'VICE_ADMIRAL': 45000,
  'REAR_ADMIRAL': 35000,
  'COMMODORE': 25000,
  'CAPTAIN': 18000,
  'COMMANDER': 14000,
  'LIEUTENANT_COMMANDER': 11000,
  'LIEUTENANT': 8000,
  'LIEUTENANT_JG': 6000,
  'ENSIGN': 4500,
  'WARRANT_OFFICER': 3500,
  'PETTY_OFFICER': 2500,
  'PRIVATE': 1500,
};

/**
 * EconomyService 클래스
 */
export class EconomyService extends EventEmitter {
  private static instance: EconomyService;

  private treasuries: Map<string, Map<string, NationalTreasury>> = new Map(); // sessionId -> faction -> Treasury
  private planetEconomies: Map<string, PlanetEconomy[]> = new Map(); // sessionId -> PlanetEconomy[]
  private tradeAgreements: Map<string, TradeAgreement[]> = new Map(); // sessionId -> TradeAgreement[]
  private economicEvents: Map<string, EconomicEvent[]> = new Map(); // sessionId -> EconomicEvent[]

  private constructor() {
    super();
    logger.info('[EconomyService] Initialized - 매뉴얼 미구현 기능 완성');
  }

  public static getInstance(): EconomyService {
    if (!EconomyService.instance) {
      EconomyService.instance = new EconomyService();
    }
    return EconomyService.instance;
  }

  // ==================== 초기화 ====================

  public initializeSession(sessionId: string): void {
    // 국고 초기화
    const factionTreasuries = new Map<string, NationalTreasury>();

    // 제국 국고
    factionTreasuries.set('empire', {
      sessionId,
      faction: 'empire',
      balance: 10000000, // 초기 1000만
      monthlyIncome: 0,
      monthlyExpense: 0,
      budgetAllocation: {
        [BudgetCategory.MILITARY]: 50,
        [BudgetCategory.CIVIL]: 25,
        [BudgetCategory.RESEARCH]: 10,
        [BudgetCategory.INTELLIGENCE]: 10,
        [BudgetCategory.RESERVE]: 5,
      },
      taxRate: 15,
      lastUpdated: new Date(),
    });

    // 동맹 국고
    factionTreasuries.set('alliance', {
      sessionId,
      faction: 'alliance',
      balance: 8000000, // 초기 800만 (제국보다 적음)
      monthlyIncome: 0,
      monthlyExpense: 0,
      budgetAllocation: {
        [BudgetCategory.MILITARY]: 45,
        [BudgetCategory.CIVIL]: 30,
        [BudgetCategory.RESEARCH]: 10,
        [BudgetCategory.INTELLIGENCE]: 10,
        [BudgetCategory.RESERVE]: 5,
      },
      taxRate: 12,
      lastUpdated: new Date(),
    });

    this.treasuries.set(sessionId, factionTreasuries);
    this.planetEconomies.set(sessionId, []);
    this.tradeAgreements.set(sessionId, []);
    this.economicEvents.set(sessionId, []);

    logger.info(`[EconomyService] Session ${sessionId} initialized`);
  }

  public cleanupSession(sessionId: string): void {
    this.treasuries.delete(sessionId);
    this.planetEconomies.delete(sessionId);
    this.tradeAgreements.delete(sessionId);
    this.economicEvents.delete(sessionId);
    logger.info(`[EconomyService] Session ${sessionId} cleaned up`);
  }

  // ==================== 세금 징수 (納入率変更) ====================

  /**
   * 행성별 납입율 변경
   */
  public async setTaxContribution(
    sessionId: string,
    planetId: string,
    newRate: number,
  ): Promise<{ success: boolean; economy?: PlanetEconomy; error?: string }> {
    if (newRate < 0 || newRate > 100) {
      return { success: false, error: '납입율은 0-100% 사이여야 합니다.' };
    }

    const economies = this.planetEconomies.get(sessionId);
    let economy = economies?.find(e => e.planetId === planetId);

    if (!economy) {
      // 새 경제 데이터 생성
      const planet = await Planet.findOne({ sessionId, planetId });
      if (!planet) {
        return { success: false, error: '행성을 찾을 수 없습니다.' };
      }

      economy = this.createPlanetEconomy(sessionId, planet);
      economies?.push(economy);
    }

    const oldRate = economy.taxContribution;
    economy.taxContribution = newRate;
    economy.lastUpdated = new Date();

    // 민심 영향 (세율 인상 시 민심 하락)
    if (newRate > oldRate) {
      economy.publicSatisfaction = Math.max(0, economy.publicSatisfaction - (newRate - oldRate) * 0.5);
    } else {
      economy.publicSatisfaction = Math.min(100, economy.publicSatisfaction + (oldRate - newRate) * 0.3);
    }

    this.emit('economy:taxRateChanged', { sessionId, planetId, oldRate, newRate });
    logger.info(`[EconomyService] Planet ${planetId} tax contribution changed: ${oldRate}% -> ${newRate}%`);

    return { success: true, economy };
  }

  /**
   * 월간 세금 징수
   */
  public async collectMonthlyTaxes(sessionId: string): Promise<void> {
    const economies = this.planetEconomies.get(sessionId) || [];
    const factionTreasuries = this.treasuries.get(sessionId);
    if (!factionTreasuries) return;

    const factionRevenue: Record<string, number> = { empire: 0, alliance: 0 };

    for (const economy of economies) {
      const planet = await Planet.findOne({ sessionId, planetId: economy.planetId });
      if (!planet) continue;

      // 세금 계산
      const baseTax = economy.gdp * (economy.taxContribution / 100);
      const economicModifier = economy.economicHealth / 100;
      const satisfactionModifier = economy.publicSatisfaction / 100;

      economy.taxRevenue = Math.floor(baseTax * economicModifier * satisfactionModifier);

      // 진영별 수입 합산
      const faction = planet.controllingFaction || 'empire';
      factionRevenue[faction] = (factionRevenue[faction] || 0) + economy.taxRevenue;

      economy.lastUpdated = new Date();
    }

    // 국고에 반영
    for (const [faction, revenue] of Object.entries(factionRevenue)) {
      const treasury = factionTreasuries.get(faction);
      if (treasury) {
        treasury.balance += revenue;
        treasury.monthlyIncome = revenue;
        treasury.lastUpdated = new Date();

        this.recordEconomicEvent(sessionId, {
          type: 'TAX_COLLECTED',
          faction,
          amount: revenue,
          description: `월간 세금 ${revenue.toLocaleString()} 징수`,
        });
      }
    }

    this.emit('economy:taxesCollected', { sessionId, factionRevenue });
    logger.info(`[EconomyService] Monthly taxes collected - Empire: ${factionRevenue.empire}, Alliance: ${factionRevenue.alliance}`);
  }

  // ==================== 급여 지급 ====================

  /**
   * 월간 급여 지급
   */
  public async payMonthlySalaries(sessionId: string): Promise<void> {
    const factionTreasuries = this.treasuries.get(sessionId);
    if (!factionTreasuries) return;

    const factionExpense: Record<string, number> = { empire: 0, alliance: 0 };

    // 모든 캐릭터에게 급여 지급
    const characters = await Gin7Character.find({ sessionId, isAlive: true });

    for (const character of characters) {
      const salary = this.calculateSalary(character);
      const faction = character.faction;

      factionExpense[faction] = (factionExpense[faction] || 0) + salary;

      // 캐릭터 개인 자산에 급여 추가
      character.personalFunds = (character.personalFunds || 0) + salary;
      await character.save();
    }

    // 국고에서 차감
    for (const [faction, expense] of Object.entries(factionExpense)) {
      const treasury = factionTreasuries.get(faction);
      if (treasury) {
        treasury.balance -= expense;
        treasury.monthlyExpense += expense;
        treasury.lastUpdated = new Date();

        // 적자 경고
        if (treasury.balance < 0) {
          this.recordEconomicEvent(sessionId, {
            type: 'DEFICIT_WARNING',
            faction,
            amount: treasury.balance,
            description: `국고 적자 발생! 잔고: ${treasury.balance.toLocaleString()}`,
          });

          this.emit('economy:deficitWarning', { sessionId, faction, balance: treasury.balance });
          logger.warn(`[EconomyService] ${faction} treasury in deficit: ${treasury.balance}`);
        }

        this.recordEconomicEvent(sessionId, {
          type: 'SALARY_PAID',
          faction,
          amount: expense,
          description: `월간 급여 ${expense.toLocaleString()} 지급`,
        });
      }
    }

    this.emit('economy:salariesPaid', { sessionId, factionExpense });
    logger.info(`[EconomyService] Monthly salaries paid - Empire: ${factionExpense.empire}, Alliance: ${factionExpense.alliance}`);
  }

  /**
   * 급여 계산
   */
  private calculateSalary(character: IGin7Character): number {
    const baseSalary = SALARY_TABLE[character.rank] || SALARY_TABLE['PRIVATE'];

    // 직책 보너스
    let positionBonus = 0;
    if (character.currentPosition) {
      // 고위직일수록 보너스 증가
      const positionLevel = (character.currentPosition as any)?.authorityLevel || 0;
      positionBonus = positionLevel * 1000;
    }

    // 작위 보너스 (제국)
    let nobilityBonus = 0;
    if (character.faction === 'empire' && character.nobilityTitle) {
      const nobilityBonuses: Record<string, number> = {
        'DUKE': 50000,
        'MARQUIS': 30000,
        'COUNT': 20000,
        'VISCOUNT': 10000,
        'BARON': 5000,
        'KNIGHT': 2000,
      };
      nobilityBonus = nobilityBonuses[character.nobilityTitle] || 0;
    }

    return baseSalary + positionBonus + nobilityBonus;
  }

  // ==================== 예산 배분 (分配) ====================

  /**
   * 예산 배분율 변경
   */
  public setBudgetAllocation(
    sessionId: string,
    faction: string,
    allocation: Partial<Record<BudgetCategory, number>>,
  ): { success: boolean; treasury?: NationalTreasury; error?: string } {
    const treasury = this.treasuries.get(sessionId)?.get(faction);
    if (!treasury) {
      return { success: false, error: '국고를 찾을 수 없습니다.' };
    }

    // 새 배분율 적용
    const newAllocation = { ...treasury.budgetAllocation, ...allocation };

    // 총합이 100%인지 확인
    const total = Object.values(newAllocation).reduce((sum, val) => sum + val, 0);
    if (total !== 100) {
      return { success: false, error: `예산 배분율 합계가 100%여야 합니다. (현재: ${total}%)` };
    }

    treasury.budgetAllocation = newAllocation;
    treasury.lastUpdated = new Date();

    this.recordEconomicEvent(sessionId, {
      type: 'BUDGET_ALLOCATED',
      faction,
      amount: treasury.balance,
      description: `예산 배분 변경: 군비 ${newAllocation[BudgetCategory.MILITARY]}%, 민생 ${newAllocation[BudgetCategory.CIVIL]}%`,
    });

    this.emit('economy:budgetAllocated', { sessionId, faction, allocation: newAllocation });
    logger.info(`[EconomyService] ${faction} budget allocation changed`);

    return { success: true, treasury };
  }

  /**
   * 특정 행성에 원조금 지급
   */
  public async grantAid(
    sessionId: string,
    faction: string,
    planetId: string,
    amount: number,
  ): Promise<{ success: boolean; error?: string }> {
    const treasury = this.treasuries.get(sessionId)?.get(faction);
    if (!treasury) {
      return { success: false, error: '국고를 찾을 수 없습니다.' };
    }

    if (treasury.balance < amount) {
      return { success: false, error: '국고 잔고가 부족합니다.' };
    }

    const economies = this.planetEconomies.get(sessionId);
    const economy = economies?.find(e => e.planetId === planetId);
    if (!economy) {
      return { success: false, error: '행성 경제 데이터를 찾을 수 없습니다.' };
    }

    // 국고에서 차감
    treasury.balance -= amount;

    // 행성 경제에 반영
    economy.localExpense += amount;
    economy.economicHealth = Math.min(100, economy.economicHealth + (amount / economy.gdp) * 10);
    economy.publicSatisfaction = Math.min(100, economy.publicSatisfaction + 5);
    economy.lastUpdated = new Date();

    this.emit('economy:aidGranted', { sessionId, faction, planetId, amount });
    logger.info(`[EconomyService] ${faction} granted ${amount} aid to planet ${planetId}`);

    return { success: true };
  }

  // ==================== 관세 (関税率変更) ====================

  /**
   * 관세율 변경
   */
  public setTariffRate(
    sessionId: string,
    faction: string,
    goodsType: string,
    newRate: number,
  ): { success: boolean; error?: string } {
    if (newRate < 0 || newRate > 100) {
      return { success: false, error: '관세율은 0-100% 사이여야 합니다.' };
    }

    // TODO: 품목별 관세율 저장 로직
    this.emit('economy:tariffChanged', { sessionId, faction, goodsType, newRate });
    logger.info(`[EconomyService] ${faction} tariff on ${goodsType} changed to ${newRate}%`);

    return { success: true };
  }

  /**
   * 무역 계약 체결
   */
  public createTradeAgreement(
    sessionId: string,
    faction: string,
    partnerFaction: string,
    goods: string,
    volume: number,
    price: number,
    tariffRate: number,
  ): { success: boolean; agreement?: TradeAgreement; error?: string } {
    const agreement: TradeAgreement = {
      agreementId: `TRADE-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      sessionId,
      partnerFaction,
      goods,
      volume,
      price,
      tariffRate,
      startDate: new Date(),
      isActive: true,
    };

    this.tradeAgreements.get(sessionId)?.push(agreement);

    this.emit('economy:tradeAgreementCreated', { sessionId, faction, agreement });
    logger.info(`[EconomyService] Trade agreement created between ${faction} and ${partnerFaction}`);

    return { success: true, agreement };
  }

  // ==================== 군사 유지비 ====================

  /**
   * 함급별 월간 유지비 (크레딧)
   * 밸런싱을 위해 상수로 분리
   */
  private static readonly SHIP_MAINTENANCE_COSTS: Record<ShipClass, number> = {
    flagship: 5000,
    battleship: 3000,
    carrier: 3500,
    cruiser: 1500,
    destroyer: 800,
    frigate: 500,
    corvette: 300,
    transport: 400,
    landing: 350,
    engineering: 600,
  };

  /**
   * 기지 유지비 상수
   */
  private static readonly BASE_MAINTENANCE = {
    FLEET_BASE: 10000,      // 함대당 기본 유지비
    GARRISON_MODIFIER: 0.5, // 주둔군 유지비 감소율
  };

  /**
   * 군사 유지비 계산 및 차감
   * 세력별 함대/부대 수에 따른 유지비를 계산하고 국고에서 차감
   */
  public async processMilitaryMaintenance(sessionId: string): Promise<void> {
    const factionTreasuries = this.treasuries.get(sessionId);
    if (!factionTreasuries) return;

    // 세력별 유지비 계산
    const maintenanceCosts = await this.calculateMilitaryMaintenanceByFaction(sessionId);

    for (const [faction, cost] of Object.entries(maintenanceCosts)) {
      const treasury = factionTreasuries.get(faction);
      if (treasury) {
        // 군비 예산 배분율에 따른 실제 지출 가능 금액 확인
        const militaryBudget = treasury.balance * (treasury.budgetAllocation[BudgetCategory.MILITARY] / 100);
        
        // 유지비가 군비 예산을 초과하면 경고
        if (cost > militaryBudget) {
          this.recordEconomicEvent(sessionId, {
            type: 'DEFICIT_WARNING',
            faction,
            amount: cost - militaryBudget,
            description: `군사 유지비(${cost.toLocaleString()})가 군비 예산(${Math.floor(militaryBudget).toLocaleString()})을 초과합니다.`,
          });
          this.emit('economy:maintenanceOverBudget', { sessionId, faction, cost, budget: militaryBudget });
        }

        // 국고에서 차감
        treasury.balance -= cost;
        treasury.monthlyExpense += cost;
        treasury.lastUpdated = new Date();

        this.emit('economy:maintenancePaid', { sessionId, faction, cost });
        
        logger.info(`[EconomyService] ${faction} military maintenance: ${cost.toLocaleString()} credits`);
      }
    }

    logger.info(`[EconomyService] Military maintenance processed for session ${sessionId}`);
  }

  /**
   * 세력별 군사 유지비 계산
   * @param sessionId 세션 ID
   * @returns 세력별 유지비 맵
   */
  private async calculateMilitaryMaintenanceByFaction(
    sessionId: string,
  ): Promise<Record<string, number>> {
    const maintenanceCosts: Record<string, number> = {};

    // 모든 함대 조회
    const fleets = await Fleet.find({ sessionId });

    for (const fleet of fleets) {
      const faction = fleet.factionId;
      if (!maintenanceCosts[faction]) {
        maintenanceCosts[faction] = 0;
      }

      // 함대 기본 유지비
      maintenanceCosts[faction] += EconomyService.BASE_MAINTENANCE.FLEET_BASE;

      // 함선별 유지비 계산
      for (const unit of fleet.units) {
        const shipClass = unit.shipClass;
        const costPerShip = EconomyService.SHIP_MAINTENANCE_COSTS[shipClass] || 500;
        const shipCount = unit.count;

        // 유지비 = 함급별 비용 × 함선 수
        let unitCost = costPerShip * shipCount;

        // 주둔 상태면 유지비 감소
        if (fleet.status === 'DOCKED' || fleet.dockedAt) {
          unitCost *= EconomyService.BASE_MAINTENANCE.GARRISON_MODIFIER;
        }

        maintenanceCosts[faction] += Math.floor(unitCost);
      }
    }

    return maintenanceCosts;
  }

  /**
   * 특정 함대의 유지비 계산 (UI 표시용)
   * @param sessionId 세션 ID
   * @param fleetId 함대 ID
   * @returns 월간 유지비
   */
  public async getFleetMaintenanceCost(sessionId: string, fleetId: string): Promise<number> {
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) return 0;

    let cost = EconomyService.BASE_MAINTENANCE.FLEET_BASE;

    for (const unit of fleet.units) {
      const costPerShip = EconomyService.SHIP_MAINTENANCE_COSTS[unit.shipClass] || 500;
      cost += costPerShip * unit.count;
    }

    // 주둔 상태 할인
    if (fleet.status === 'DOCKED' || fleet.dockedAt) {
      cost *= EconomyService.BASE_MAINTENANCE.GARRISON_MODIFIER;
    }

    return Math.floor(cost);
  }

  /**
   * 세력 전체 군사 유지비 예상치 (UI 표시용)
   * @param sessionId 세션 ID
   * @param faction 세력 ID
   * @returns 월간 예상 유지비
   */
  public async getFactionMilitaryMaintenanceEstimate(
    sessionId: string,
    faction: string,
  ): Promise<{ totalCost: number; fleetCount: number; shipCount: number }> {
    const fleets = await Fleet.find({ sessionId, factionId: faction });

    let totalCost = 0;
    let shipCount = 0;

    for (const fleet of fleets) {
      totalCost += EconomyService.BASE_MAINTENANCE.FLEET_BASE;

      for (const unit of fleet.units) {
        const costPerShip = EconomyService.SHIP_MAINTENANCE_COSTS[unit.shipClass] || 500;
        let unitCost = costPerShip * unit.count;

        if (fleet.status === 'DOCKED' || fleet.dockedAt) {
          unitCost *= EconomyService.BASE_MAINTENANCE.GARRISON_MODIFIER;
        }

        totalCost += Math.floor(unitCost);
        shipCount += unit.count;
      }
    }

    return {
      totalCost,
      fleetCount: fleets.length,
      shipCount,
    };
  }

  // ==================== 월간 경제 처리 ====================

  /**
   * 월간 경제 처리 (크론잡)
   */
  public async processMonthlyEconomy(sessionId: string): Promise<void> {
    logger.info(`[EconomyService] Processing monthly economy for session ${sessionId}`);

    // 1. 세금 징수
    await this.collectMonthlyTaxes(sessionId);

    // 2. 급여 지급
    await this.payMonthlySalaries(sessionId);

    // 3. 군사 유지비 차감
    await this.processMilitaryMaintenance(sessionId);

    // 4. 무역 수익 정산
    await this.processTradeRevenue(sessionId);

    // 5. 경제 건전성 업데이트
    await this.updateEconomicHealth(sessionId);

    this.emit('economy:monthlyProcessed', { sessionId });
    logger.info(`[EconomyService] Monthly economy processing completed`);
  }

  /**
   * 무역 수익 정산
   */
  private async processTradeRevenue(sessionId: string): Promise<void> {
    const agreements = this.tradeAgreements.get(sessionId) || [];
    const factionTreasuries = this.treasuries.get(sessionId);
    if (!factionTreasuries) return;

    for (const agreement of agreements) {
      if (!agreement.isActive) continue;

      // 관세 수입
      const tariffRevenue = Math.floor(agreement.price * agreement.volume * (agreement.tariffRate / 100));

      // 해당 진영 국고에 추가
      // 페잔과의 무역은 양쪽 모두에게 관세 수입
      for (const [faction, treasury] of factionTreasuries) {
        if (faction !== 'fezzan') {
          treasury.balance += Math.floor(tariffRevenue / 2);
        }
      }

      this.recordEconomicEvent(sessionId, {
        type: 'TRADE_COMPLETED',
        faction: 'both',
        amount: tariffRevenue,
        description: `무역 관세 수입: ${agreement.goods} ${tariffRevenue.toLocaleString()}`,
      });
    }
  }

  /**
   * 경제 건전성 업데이트
   */
  private async updateEconomicHealth(sessionId: string): Promise<void> {
    const economies = this.planetEconomies.get(sessionId) || [];

    for (const economy of economies) {
      // 경제 건전성은 세금, 무역, 민심 등에 영향 받음
      const taxFactor = economy.taxContribution > 50 ? -5 : 2;
      const satisfactionFactor = (economy.publicSatisfaction - 50) / 20;

      economy.economicHealth = Math.max(0, Math.min(100, 
        economy.economicHealth + taxFactor + satisfactionFactor
      ));
      economy.lastUpdated = new Date();
    }
  }

  // ==================== 유틸리티 ====================

  private createPlanetEconomy(sessionId: string, planet: IPlanet): PlanetEconomy {
    return {
      planetId: planet.planetId,
      sessionId,
      gdp: planet.population * 100, // 인구 기반 GDP
      population: planet.population,
      industryLevel: 50,
      taxContribution: 50, // 기본 납입율 50%
      taxRevenue: 0,
      tradeVolume: 0,
      tradeBalance: 0,
      localExpense: 0,
      militaryMaintenance: 0,
      economicHealth: 70,
      publicSatisfaction: 60,
      lastUpdated: new Date(),
    };
  }

  private recordEconomicEvent(
    sessionId: string,
    event: Omit<EconomicEvent, 'eventId' | 'sessionId' | 'timestamp'>,
  ): void {
    const fullEvent: EconomicEvent = {
      eventId: `ECON-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      sessionId,
      ...event,
      timestamp: new Date(),
    };
    this.economicEvents.get(sessionId)?.push(fullEvent);
  }

  // ==================== 조회 ====================

  public getTreasury(sessionId: string, faction: string): NationalTreasury | undefined {
    return this.treasuries.get(sessionId)?.get(faction);
  }

  public getPlanetEconomy(sessionId: string, planetId: string): PlanetEconomy | undefined {
    return this.planetEconomies.get(sessionId)?.find(e => e.planetId === planetId);
  }

  /**
   * 세력별 행성 경제 데이터 조회
   * @param sessionId 세션 ID
   * @param faction 세력 ID (선택, 지정 시 해당 세력 행성만 반환)
   * @returns 행성 경제 데이터 배열
   */
  public async getAllPlanetEconomies(sessionId: string, faction?: string): Promise<PlanetEconomy[]> {
    const economies = this.planetEconomies.get(sessionId) || [];

    // faction 필터링이 필요한 경우
    if (faction) {
      // 해당 세력이 지배하는 행성 ID 목록 조회
      const controlledPlanets = await Planet.find(
        { sessionId, controllingFaction: faction },
        { planetId: 1 },
      ).lean();

      const controlledPlanetIds = new Set(controlledPlanets.map((p) => p.planetId));

      // 해당 세력의 행성 경제 데이터만 반환
      return economies.filter((e) => controlledPlanetIds.has(e.planetId));
    }

    return economies;
  }

  public getEconomicEvents(sessionId: string, limit: number = 50): EconomicEvent[] {
    return (this.economicEvents.get(sessionId) || []).slice(-limit);
  }

  public getTradeAgreements(sessionId: string): TradeAgreement[] {
    return this.tradeAgreements.get(sessionId) || [];
  }
}

export const economyService = EconomyService.getInstance();
export default EconomyService;





