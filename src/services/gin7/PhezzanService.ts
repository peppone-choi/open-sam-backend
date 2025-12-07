import mongoose from 'mongoose';
import { Warehouse, ResourceType } from '../../models/gin7/Warehouse';
import { MarketPrice, BASE_PRICES } from '../../models/gin7/MarketPrice';
import { TradeRoute } from '../../models/gin7/TradeRoute';
import { Character } from '../../models/gin7/Character';
import { Gin7Error } from '../../common/errors/gin7-errors';

/**
 * Currency types in the LOGH universe
 */
export type Currency = 
  | 'imperialMark'     // 제국 마르크
  | 'allianceDinar'    // 동맹 디나르
  | 'phezzanCredit'    // 페잔 크레딧
  | 'universalCredit'; // 범용 크레딧 (게임 내 기준 통화)

/**
 * Exchange rate entry
 */
export interface IExchangeRate {
  from: Currency;
  to: Currency;
  rate: number;      // How many 'to' you get for 1 'from'
  fee: number;       // Transaction fee percentage
  lastUpdated: Date;
}

/**
 * Loan entry
 */
export interface ILoan {
  loanId: string;
  sessionId: string;
  borrowerId: string;     // Character ID
  factionId: string;
  principal: number;      // Original loan amount
  interestRate: number;   // Annual rate (0.05 = 5%)
  balance: number;        // Current balance
  monthlyPayment: number;
  totalPayments: number;
  paymentsMade: number;
  startDate: Date;
  dueDate: Date;
  status: 'ACTIVE' | 'PAID' | 'DEFAULTED';
  collateral?: {
    type: 'PLANET' | 'FLEET' | 'PROPERTY';
    id: string;
  };
}

/**
 * Investment entry
 */
export interface IInvestment {
  investmentId: string;
  sessionId: string;
  investorId: string;     // Character ID
  type: 'BOND' | 'STOCK' | 'COMMODITY' | 'VENTURE';
  name: string;
  principal: number;
  currentValue: number;
  returnRate: number;     // Expected annual return
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  maturityDate?: Date;
  status: 'ACTIVE' | 'MATURED' | 'SOLD';
  createdAt: Date;
}

/**
 * PhezzanService
 * Handles Phezzan special trade functions, currency exchange, and financial services
 */
export class PhezzanService {
  // Phezzan location ID (constant for the system)
  static readonly PHEZZAN_SYSTEM_ID = 'PHEZZAN';
  static readonly PHEZZAN_PLANET_ID = 'PHEZZAN-PRIME';

  // Base exchange rates (to universal credits)
  private static baseRates: Record<Currency, number> = {
    imperialMark: 1.0,
    allianceDinar: 0.95,
    phezzanCredit: 1.1,
    universalCredit: 1.0
  };

  // Current exchange rates (affected by events)
  private static currentRates: Map<string, Record<Currency, number>> = new Map();

  // Loans storage (in production, use DB)
  private static loans: Map<string, ILoan[]> = new Map();

  // Investments storage
  private static investments: Map<string, IInvestment[]> = new Map();

  /**
   * Get exchange rates for a session
   */
  static getExchangeRates(sessionId: string): IExchangeRate[] {
    const rates = this.currentRates.get(sessionId) || this.baseRates;
    const result: IExchangeRate[] = [];

    const currencies: Currency[] = ['imperialMark', 'allianceDinar', 'phezzanCredit', 'universalCredit'];

    for (const from of currencies) {
      for (const to of currencies) {
        if (from === to) continue;
        
        const fromRate = rates[from];
        const toRate = rates[to];
        const exchangeRate = fromRate / toRate;
        
        // Fee varies by currency pair
        let fee = 0.02;  // 2% default
        if (from === 'phezzanCredit' || to === 'phezzanCredit') {
          fee = 0.01;  // 1% for Phezzan credit
        }
        if ((from === 'imperialMark' && to === 'allianceDinar') ||
            (from === 'allianceDinar' && to === 'imperialMark')) {
          fee = 0.03;  // 3% for Empire-Alliance direct exchange
        }

        result.push({
          from,
          to,
          rate: exchangeRate,
          fee,
          lastUpdated: new Date()
        });
      }
    }

    return result;
  }

  /**
   * Exchange currency
   */
  static async exchangeCurrency(
    sessionId: string,
    characterId: string,
    fromCurrency: Currency,
    toCurrency: Currency,
    amount: number
  ): Promise<{
    success: boolean;
    fromAmount: number;
    toAmount: number;
    fee: number;
    rate: number;
    error?: string;
  }> {
    if (amount <= 0) {
      return {
        success: false,
        fromAmount: 0,
        toAmount: 0,
        fee: 0,
        rate: 0,
        error: 'Amount must be positive'
      };
    }

    if (fromCurrency === toCurrency) {
      return {
        success: false,
        fromAmount: 0,
        toAmount: 0,
        fee: 0,
        rate: 0,
        error: 'Cannot exchange same currency'
      };
    }

    const rates = this.getExchangeRates(sessionId);
    const rateEntry = rates.find(r => r.from === fromCurrency && r.to === toCurrency);

    if (!rateEntry) {
      return {
        success: false,
        fromAmount: 0,
        toAmount: 0,
        fee: 0,
        rate: 0,
        error: 'Exchange rate not found'
      };
    }

    // Calculate exchange
    const grossAmount = amount * rateEntry.rate;
    const fee = grossAmount * rateEntry.fee;
    const netAmount = Math.floor(grossAmount - fee);

    // In a real implementation, deduct from character's currency account
    // and add the new currency

    return {
      success: true,
      fromAmount: amount,
      toAmount: netAmount,
      fee: Math.ceil(fee),
      rate: rateEntry.rate
    };
  }

  /**
   * Update exchange rates based on economic conditions
   */
  static updateExchangeRates(
    sessionId: string,
    modifiers: Partial<Record<Currency, number>>
  ): void {
    const currentRates = { ...this.baseRates };
    
    for (const [currency, modifier] of Object.entries(modifiers)) {
      if (currency in currentRates) {
        currentRates[currency as Currency] *= (1 + modifier);
      }
    }

    this.currentRates.set(sessionId, currentRates);
  }

  // ==================== Transit Trade ====================

  /**
   * Check if transit trade is possible between factions
   */
  static canTransitTrade(
    sourceFaction: string,
    targetFaction: string,
    warStatus: { empireFfa: boolean; allianceFfa: boolean }
  ): { allowed: boolean; reason?: string } {
    // Phezzan allows trade between warring factions (neutral zone)
    // but with restrictions during active warfare

    if (sourceFaction === targetFaction) {
      return { allowed: true };
    }

    // Empire <-> Alliance trade during war requires Phezzan intermediary
    if (warStatus.empireFfa && (
      (sourceFaction === 'EMPIRE' && targetFaction === 'ALLIANCE') ||
      (sourceFaction === 'ALLIANCE' && targetFaction === 'EMPIRE')
    )) {
      return {
        allowed: true,
        reason: '페잔 중계 무역으로만 가능 (전쟁 중)'
      };
    }

    return { allowed: true };
  }

  /**
   * Calculate transit trade fee through Phezzan
   */
  static calculateTransitFee(
    cargoValue: number,
    sourceFaction: string,
    targetFaction: string
  ): number {
    let baseFee = 0.05;  // 5% base transit fee

    // Higher fee for cross-faction trade
    if (sourceFaction !== targetFaction) {
      baseFee = 0.08;  // 8%
    }

    // War premium
    // (In real implementation, check war status)
    
    return Math.ceil(cargoValue * baseFee);
  }

  // ==================== Loans ====================

  /**
   * Apply for a loan
   */
  static async applyForLoan(
    sessionId: string,
    characterId: string,
    factionId: string,
    amount: number,
    termMonths: number,
    collateral?: { type: 'PLANET' | 'FLEET' | 'PROPERTY'; id: string }
  ): Promise<{ success: boolean; loan?: ILoan; error?: string }> {
    // Validate amount
    if (amount < 1000) {
      return { success: false, error: 'Minimum loan amount is 1000 credits' };
    }

    if (amount > 1000000) {
      return { success: false, error: 'Maximum loan amount is 1,000,000 credits' };
    }

    // Calculate interest rate based on collateral and amount
    let interestRate = 0.12;  // 12% base annual rate

    if (collateral) {
      interestRate = 0.08;  // 8% with collateral
    }

    if (amount > 100000) {
      interestRate += 0.02;  // +2% for large loans
    }

    // Check for existing active loans
    const sessionLoans = this.loans.get(sessionId) || [];
    const existingLoans = sessionLoans.filter(
      l => l.borrowerId === characterId && l.status === 'ACTIVE'
    );

    if (existingLoans.length >= 3) {
      return { success: false, error: 'Maximum 3 active loans allowed' };
    }

    // Calculate monthly payment
    const monthlyRate = interestRate / 12;
    const monthlyPayment = Math.ceil(
      amount * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
      (Math.pow(1 + monthlyRate, termMonths) - 1)
    );

    const startDate = new Date();
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + termMonths);

    const loan: ILoan = {
      loanId: `LOAN-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      sessionId,
      borrowerId: characterId,
      factionId,
      principal: amount,
      interestRate,
      balance: amount,
      monthlyPayment,
      totalPayments: termMonths,
      paymentsMade: 0,
      startDate,
      dueDate,
      status: 'ACTIVE',
      collateral
    };

    sessionLoans.push(loan);
    this.loans.set(sessionId, sessionLoans);

    // In real implementation, add credits to character's warehouse

    return { success: true, loan };
  }

  /**
   * Make loan payment
   */
  static async makeLoanPayment(
    sessionId: string,
    loanId: string,
    amount: number
  ): Promise<{ success: boolean; remainingBalance: number; error?: string }> {
    const sessionLoans = this.loans.get(sessionId) || [];
    const loan = sessionLoans.find(l => l.loanId === loanId);

    if (!loan) {
      return { success: false, remainingBalance: 0, error: 'Loan not found' };
    }

    if (loan.status !== 'ACTIVE') {
      return { success: false, remainingBalance: loan.balance, error: 'Loan is not active' };
    }

    if (amount <= 0) {
      return { success: false, remainingBalance: loan.balance, error: 'Payment amount must be positive' };
    }

    // Apply payment
    loan.balance = Math.max(0, loan.balance - amount);
    loan.paymentsMade++;

    // Check if loan is paid off
    if (loan.balance <= 0) {
      loan.status = 'PAID';
      loan.balance = 0;
    }

    return { success: true, remainingBalance: loan.balance };
  }

  /**
   * Get loans for a character
   */
  static getCharacterLoans(
    sessionId: string,
    characterId: string
  ): ILoan[] {
    const sessionLoans = this.loans.get(sessionId) || [];
    return sessionLoans.filter(l => l.borrowerId === characterId);
  }

  /**
   * Process loan defaults (call periodically)
   */
  static async processLoanDefaults(sessionId: string): Promise<ILoan[]> {
    const now = new Date();
    const sessionLoans = this.loans.get(sessionId) || [];
    const defaultedLoans: ILoan[] = [];

    for (const loan of sessionLoans) {
      if (loan.status === 'ACTIVE' && loan.dueDate < now && loan.balance > 0) {
        loan.status = 'DEFAULTED';
        defaultedLoans.push(loan);
        
        // In real implementation:
        // - Seize collateral
        // - Apply reputation penalty
        // - Notify faction
      }
    }

    return defaultedLoans;
  }

  // ==================== Investments ====================

  /**
   * Make an investment
   */
  static async invest(
    sessionId: string,
    characterId: string,
    type: 'BOND' | 'STOCK' | 'COMMODITY' | 'VENTURE',
    amount: number,
    name?: string
  ): Promise<{ success: boolean; investment?: IInvestment; error?: string }> {
    if (amount < 100) {
      return { success: false, error: 'Minimum investment is 100 credits' };
    }

    // Determine return rate and risk based on type
    let returnRate: number;
    let risk: 'LOW' | 'MEDIUM' | 'HIGH';
    let maturityMonths: number | undefined;

    switch (type) {
      case 'BOND':
        returnRate = 0.04 + Math.random() * 0.02;  // 4-6%
        risk = 'LOW';
        maturityMonths = 12;
        break;
      case 'STOCK':
        returnRate = 0.08 + Math.random() * 0.08;  // 8-16%
        risk = 'MEDIUM';
        maturityMonths = undefined;  // No maturity
        break;
      case 'COMMODITY':
        returnRate = -0.1 + Math.random() * 0.3;  // -10% to +20%
        risk = 'MEDIUM';
        maturityMonths = 6;
        break;
      case 'VENTURE':
        returnRate = -0.3 + Math.random() * 0.8;  // -30% to +50%
        risk = 'HIGH';
        maturityMonths = 24;
        break;
    }

    const maturityDate = maturityMonths ? 
      new Date(Date.now() + maturityMonths * 30 * 24 * 60 * 60 * 1000) : 
      undefined;

    const investment: IInvestment = {
      investmentId: `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      sessionId,
      investorId: characterId,
      type,
      name: name || `${type} Investment`,
      principal: amount,
      currentValue: amount,
      returnRate,
      risk,
      maturityDate,
      status: 'ACTIVE',
      createdAt: new Date()
    };

    const sessionInvestments = this.investments.get(sessionId) || [];
    sessionInvestments.push(investment);
    this.investments.set(sessionId, sessionInvestments);

    return { success: true, investment };
  }

  /**
   * Update investment values (call daily)
   */
  static async updateInvestmentValues(sessionId: string): Promise<void> {
    const sessionInvestments = this.investments.get(sessionId) || [];
    const now = new Date();

    for (const investment of sessionInvestments) {
      if (investment.status !== 'ACTIVE') continue;

      // Calculate daily return (annual rate / 365)
      const dailyRate = investment.returnRate / 365;
      
      // Add some volatility
      const volatility = investment.risk === 'HIGH' ? 0.02 : 
                        investment.risk === 'MEDIUM' ? 0.01 : 0.005;
      const randomFactor = 1 + (Math.random() - 0.5) * volatility * 2;
      
      // Update value
      investment.currentValue = Math.round(
        investment.currentValue * (1 + dailyRate) * randomFactor
      );

      // Check maturity
      if (investment.maturityDate && investment.maturityDate <= now) {
        investment.status = 'MATURED';
      }
    }
  }

  /**
   * Sell/liquidate an investment
   */
  static async sellInvestment(
    sessionId: string,
    investmentId: string
  ): Promise<{ success: boolean; value: number; profit: number; error?: string }> {
    const sessionInvestments = this.investments.get(sessionId) || [];
    const investment = sessionInvestments.find(i => i.investmentId === investmentId);

    if (!investment) {
      return { success: false, value: 0, profit: 0, error: 'Investment not found' };
    }

    if (investment.status === 'SOLD') {
      return { success: false, value: 0, profit: 0, error: 'Investment already sold' };
    }

    const profit = investment.currentValue - investment.principal;
    investment.status = 'SOLD';

    // In real implementation, add credits to character's warehouse

    return {
      success: true,
      value: investment.currentValue,
      profit
    };
  }

  /**
   * Get investments for a character
   */
  static getCharacterInvestments(
    sessionId: string,
    characterId: string
  ): IInvestment[] {
    const sessionInvestments = this.investments.get(sessionId) || [];
    return sessionInvestments.filter(i => i.investorId === characterId);
  }

  /**
   * Get Phezzan market summary
   */
  static async getPhezzanMarketSummary(sessionId: string): Promise<{
    exchangeRates: IExchangeRate[];
    activeLoans: number;
    totalLoanValue: number;
    activeInvestments: number;
    totalInvestmentValue: number;
    transitTradeFee: number;
  }> {
    const sessionLoans = this.loans.get(sessionId) || [];
    const sessionInvestments = this.investments.get(sessionId) || [];

    const activeLoans = sessionLoans.filter(l => l.status === 'ACTIVE');
    const activeInvestments = sessionInvestments.filter(i => i.status === 'ACTIVE');

    return {
      exchangeRates: this.getExchangeRates(sessionId),
      activeLoans: activeLoans.length,
      totalLoanValue: activeLoans.reduce((sum, l) => sum + l.balance, 0),
      activeInvestments: activeInvestments.length,
      totalInvestmentValue: activeInvestments.reduce((sum, i) => sum + i.currentValue, 0),
      transitTradeFee: 0.05  // 5% base
    };
  }
}

export default PhezzanService;

