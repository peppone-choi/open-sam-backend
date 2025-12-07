/**
 * FezzanFinancialService
 * 페잔 금융 서비스 시스템
 * 
 * 페잔은 은하계 최대의 금융 중심지입니다.
 * 자금 세탁, 망명자 자산 도피, 익명 계좌 관리 등의 서비스를 제공합니다.
 */

import { logger } from '../../common/logger';

/**
 * 금융 서비스 타입
 */
export type FinancialServiceType =
  | 'MONEY_LAUNDERING'      // 자금 세탁
  | 'ASSET_TRANSFER'        // 자산 이전 (망명자용)
  | 'ANONYMOUS_ACCOUNT'     // 익명 계좌
  | 'LOAN'                  // 대출
  | 'INVESTMENT'            // 투자
  | 'INSURANCE';            // 보험

/**
 * 계좌 타입
 */
export type AccountType =
  | 'STANDARD'      // 일반 계좌
  | 'PREMIUM'       // 프리미엄 (높은 이자, 낮은 수수료)
  | 'ANONYMOUS'     // 익명 계좌
  | 'NUMBERED';     // 번호 계좌 (최고 비밀)

/**
 * 자금 세탁 상태
 */
export type LaunderingStatus =
  | 'PENDING'       // 대기 중
  | 'PROCESSING'    // 처리 중
  | 'COMPLETED'     // 완료
  | 'FLAGGED'       // 의심 거래로 플래그
  | 'SEIZED';       // 압수

/**
 * 페잔 계좌
 */
export interface IFezzanAccount {
  accountId: string;
  sessionId: string;
  
  // 소유자 정보 (익명 계좌는 null)
  ownerId?: string;           // characterId
  ownerFaction?: string;
  
  type: AccountType;
  
  // 잔액
  balance: number;
  frozenBalance: number;      // 동결된 잔액
  
  // 계좌 설정
  interestRate: number;       // 연 이자율 (0.01 = 1%)
  maintenanceFee: number;     // 월 유지비
  
  // 보안
  accessCode?: string;        // 번호 계좌용
  isCompromised: boolean;
  
  // 거래 제한
  dailyLimit?: number;
  monthlyLimit?: number;
  
  createdAt: Date;
  lastActivityAt: Date;
}

/**
 * 자금 세탁 요청
 */
export interface ILaunderingRequest {
  requestId: string;
  sessionId: string;
  accountId: string;
  requesterId: string;        // characterId
  
  // 금액
  originalAmount: number;
  fee: number;                // 수수료
  cleanAmount: number;        // 세탁 후 금액
  
  status: LaunderingStatus;
  
  // 추적
  sourceDescription: string;  // 자금 출처 (가짜)
  layers: number;             // 세탁 레이어 수 (높을수록 안전, 비쌈)
  
  // 리스크
  detectionRisk: number;      // 0-100
  
  createdAt: Date;
  completedAt?: Date;
}

/**
 * 자산 이전 (망명자용)
 */
export interface IAssetTransfer {
  transferId: string;
  sessionId: string;
  
  // 이전자 정보
  fromCharacterId: string;
  fromFaction: string;
  
  // 수령자 정보 (망명 후)
  toAccountId: string;
  toFaction?: string;
  
  // 금액
  originalAmount: number;
  transferFee: number;        // 30-50%
  netAmount: number;
  
  status: 'PENDING' | 'APPROVED' | 'IN_TRANSIT' | 'COMPLETED' | 'BLOCKED';
  
  // 조건
  conditions?: {
    requiresDefection: boolean;  // 실제 망명 필요
    timeLimit?: Date;            // 제한 시간
  };
  
  createdAt: Date;
  completedAt?: Date;
}

/**
 * 페잔 대출
 */
export interface IFezzanLoan {
  loanId: string;
  sessionId: string;
  borrowerId: string;         // characterId 또는 factionId
  borrowerType: 'CHARACTER' | 'FACTION';
  
  // 금액
  principal: number;          // 원금
  interestRate: number;       // 연 이자율
  totalOwed: number;          // 총 상환액
  amountPaid: number;         // 상환한 금액
  
  // 기간
  termMonths: number;
  monthlyPayment: number;
  
  // 담보
  collateral?: {
    type: 'SHIP' | 'TERRITORY' | 'ASSET' | 'NONE';
    description: string;
    value: number;
  };
  
  status: 'ACTIVE' | 'PAID' | 'DEFAULTED' | 'RESTRUCTURED';
  
  // 연체
  missedPayments: number;
  penaltyAccrued: number;
  
  createdAt: Date;
  nextPaymentDue?: Date;
}

/**
 * 페잔 투자 펀드
 */
export interface IFezzanInvestment {
  investmentId: string;
  sessionId: string;
  investorId: string;
  
  // 투자 대상
  targetType: 'FACTION' | 'INDUSTRY' | 'TRADE_ROUTE' | 'TECHNOLOGY';
  targetId: string;
  targetName: string;
  
  // 금액
  amount: number;
  shares: number;
  
  // 수익
  expectedReturn: number;     // 예상 수익률
  actualReturn: number;       // 실제 수익률
  dividendsPaid: number;
  
  // 리스크
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  
  status: 'ACTIVE' | 'MATURED' | 'LIQUIDATED';
  
  createdAt: Date;
  maturesAt?: Date;
}

/**
 * 수수료율
 */
const FEE_RATES = {
  // 자금 세탁 기본 수수료 (레이어당)
  laundering: {
    base: 0.10,         // 10% 기본
    perLayer: 0.05,     // 레이어당 5% 추가
  },
  
  // 자산 이전 수수료
  assetTransfer: {
    min: 0.30,          // 최소 30%
    max: 0.50,          // 최대 50%
  },
  
  // 계좌 유지비 (월)
  accountMaintenance: {
    STANDARD: 100,
    PREMIUM: 500,
    ANONYMOUS: 1000,
    NUMBERED: 5000,
  },
  
  // 대출 이자율 (연)
  loanInterest: {
    secured: 0.08,      // 담보 대출 8%
    unsecured: 0.15,    // 무담보 대출 15%
    emergency: 0.25,    // 긴급 대출 25%
  },
};

/**
 * FezzanFinancialService
 */
export class FezzanFinancialService {
  // In-memory storage
  private static accounts: Map<string, IFezzanAccount[]> = new Map();
  private static laundering: Map<string, ILaunderingRequest[]> = new Map();
  private static transfers: Map<string, IAssetTransfer[]> = new Map();
  private static loans: Map<string, IFezzanLoan[]> = new Map();
  private static investments: Map<string, IFezzanInvestment[]> = new Map();

  // ==================== 계좌 관리 ====================

  /**
   * 계좌 개설
   */
  static openAccount(
    sessionId: string,
    type: AccountType,
    ownerId?: string,
    ownerFaction?: string
  ): { success: boolean; account?: IFezzanAccount; cost: number; error?: string } {
    // 개설 비용
    const openingFee = {
      STANDARD: 1000,
      PREMIUM: 10000,
      ANONYMOUS: 50000,
      NUMBERED: 200000,
    }[type];
    
    // 이자율 설정
    const interestRate = {
      STANDARD: 0.02,     // 2%
      PREMIUM: 0.04,      // 4%
      ANONYMOUS: 0.01,    // 1%
      NUMBERED: 0.03,     // 3%
    }[type];
    
    const account: IFezzanAccount = {
      accountId: type === 'NUMBERED' 
        ? this.generateNumberedAccountId()
        : `ACC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      sessionId,
      ownerId: type === 'ANONYMOUS' ? undefined : ownerId,
      ownerFaction: type === 'ANONYMOUS' ? undefined : ownerFaction,
      type,
      balance: 0,
      frozenBalance: 0,
      interestRate,
      maintenanceFee: FEE_RATES.accountMaintenance[type],
      accessCode: type === 'NUMBERED' ? this.generateAccessCode() : undefined,
      isCompromised: false,
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };
    
    const sessionAccounts = this.accounts.get(sessionId) || [];
    sessionAccounts.push(account);
    this.accounts.set(sessionId, sessionAccounts);
    
    logger.info(`[FezzanFinance] 계좌 개설: ${account.accountId} (${type})`);
    
    return { success: true, account, cost: openingFee };
  }

  /**
   * 번호 계좌 ID 생성
   */
  private static generateNumberedAccountId(): string {
    const chars = '0123456789ABCDEF';
    let id = 'FZN-';
    for (let i = 0; i < 12; i++) {
      if (i > 0 && i % 4 === 0) id += '-';
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
  }

  /**
   * 접근 코드 생성
   */
  private static generateAccessCode(): string {
    const chars = '0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  /**
   * 계좌 조회 (번호 계좌용)
   */
  static getAccountByCode(
    sessionId: string,
    accountId: string,
    accessCode: string
  ): IFezzanAccount | null {
    const accounts = this.accounts.get(sessionId) || [];
    const account = accounts.find(
      a => a.accountId === accountId && a.accessCode === accessCode
    );
    return account || null;
  }

  /**
   * 캐릭터의 계좌 목록
   */
  static getCharacterAccounts(
    sessionId: string,
    characterId: string
  ): IFezzanAccount[] {
    const accounts = this.accounts.get(sessionId) || [];
    return accounts.filter(a => a.ownerId === characterId);
  }

  /**
   * 입금
   */
  static deposit(
    sessionId: string,
    accountId: string,
    amount: number,
    accessCode?: string
  ): { success: boolean; newBalance?: number; error?: string } {
    const accounts = this.accounts.get(sessionId) || [];
    const account = accounts.find(a => a.accountId === accountId);
    
    if (!account) {
      return { success: false, error: '계좌를 찾을 수 없습니다.' };
    }
    
    // 번호 계좌 접근 코드 확인
    if (account.type === 'NUMBERED' && account.accessCode !== accessCode) {
      return { success: false, error: '접근 코드가 일치하지 않습니다.' };
    }
    
    account.balance += amount;
    account.lastActivityAt = new Date();
    
    return { success: true, newBalance: account.balance };
  }

  /**
   * 출금
   */
  static withdraw(
    sessionId: string,
    accountId: string,
    amount: number,
    accessCode?: string
  ): { success: boolean; newBalance?: number; error?: string } {
    const accounts = this.accounts.get(sessionId) || [];
    const account = accounts.find(a => a.accountId === accountId);
    
    if (!account) {
      return { success: false, error: '계좌를 찾을 수 없습니다.' };
    }
    
    if (account.type === 'NUMBERED' && account.accessCode !== accessCode) {
      return { success: false, error: '접근 코드가 일치하지 않습니다.' };
    }
    
    const availableBalance = account.balance - account.frozenBalance;
    if (amount > availableBalance) {
      return { success: false, error: `잔액이 부족합니다. (가용: ${availableBalance})` };
    }
    
    // 일일 한도 확인
    if (account.dailyLimit && amount > account.dailyLimit) {
      return { success: false, error: `일일 한도(${account.dailyLimit})를 초과했습니다.` };
    }
    
    account.balance -= amount;
    account.lastActivityAt = new Date();
    
    return { success: true, newBalance: account.balance };
  }

  // ==================== 자금 세탁 ====================

  /**
   * 자금 세탁 요청
   */
  static async requestLaundering(
    sessionId: string,
    accountId: string,
    requesterId: string,
    amount: number,
    layers: number = 2,
    sourceDescription: string = '무역 수익'
  ): Promise<{ success: boolean; request?: ILaunderingRequest; error?: string }> {
    if (layers < 1 || layers > 5) {
      return { success: false, error: '세탁 레이어는 1-5 사이여야 합니다.' };
    }
    
    // 수수료 계산
    const feeRate = FEE_RATES.laundering.base + FEE_RATES.laundering.perLayer * layers;
    const fee = Math.round(amount * feeRate);
    const cleanAmount = amount - fee;
    
    // 탐지 위험 계산 (레이어가 많을수록 안전)
    const detectionRisk = Math.max(5, 50 - layers * 10);
    
    const request: ILaunderingRequest = {
      requestId: `LAUND-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      sessionId,
      accountId,
      requesterId,
      originalAmount: amount,
      fee,
      cleanAmount,
      status: 'PENDING',
      sourceDescription,
      layers,
      detectionRisk,
      createdAt: new Date(),
    };
    
    const sessionRequests = this.laundering.get(sessionId) || [];
    sessionRequests.push(request);
    this.laundering.set(sessionId, sessionRequests);
    
    logger.info(`[FezzanFinance] 자금 세탁 요청: ${request.requestId} (${amount} -> ${cleanAmount})`);
    
    return { success: true, request };
  }

  /**
   * 자금 세탁 처리
   */
  static async processLaundering(
    sessionId: string,
    requestId: string
  ): Promise<{ success: boolean; cleanAmount?: number; detected?: boolean; error?: string }> {
    const requests = this.laundering.get(sessionId) || [];
    const request = requests.find(r => r.requestId === requestId);
    
    if (!request) {
      return { success: false, error: '요청을 찾을 수 없습니다.' };
    }
    
    if (request.status !== 'PENDING') {
      return { success: false, error: '이미 처리된 요청입니다.' };
    }
    
    request.status = 'PROCESSING';
    
    // 탐지 확률 체크
    const detected = Math.random() * 100 < request.detectionRisk;
    
    if (detected) {
      request.status = 'FLAGGED';
      
      // 50% 확률로 압수
      if (Math.random() < 0.5) {
        request.status = 'SEIZED';
        logger.warn(`[FezzanFinance] 자금 세탁 적발 및 압수: ${requestId}`);
        return { success: false, detected: true, error: '거래가 적발되어 자금이 압수되었습니다.' };
      }
      
      logger.warn(`[FezzanFinance] 자금 세탁 의심 거래 플래그: ${requestId}`);
      return { success: false, detected: true, error: '의심 거래로 플래그되었습니다. 추가 조사가 진행됩니다.' };
    }
    
    // 성공
    request.status = 'COMPLETED';
    request.completedAt = new Date();
    
    // 계좌에 세탁된 금액 입금
    const accounts = this.accounts.get(sessionId) || [];
    const account = accounts.find(a => a.accountId === request.accountId);
    if (account) {
      account.balance += request.cleanAmount;
      account.lastActivityAt = new Date();
    }
    
    logger.info(`[FezzanFinance] 자금 세탁 완료: ${requestId}`);
    
    return { success: true, cleanAmount: request.cleanAmount, detected: false };
  }

  // ==================== 자산 이전 (망명자) ====================

  /**
   * 자산 이전 요청 (망명 준비)
   */
  static async requestAssetTransfer(
    sessionId: string,
    fromCharacterId: string,
    fromFaction: string,
    amount: number,
    toAccountId: string,
    requiresDefection: boolean = true
  ): Promise<{ success: boolean; transfer?: IAssetTransfer; error?: string }> {
    // 수수료 계산 (30-50% 랜덤)
    const feeRate = FEE_RATES.assetTransfer.min + 
      Math.random() * (FEE_RATES.assetTransfer.max - FEE_RATES.assetTransfer.min);
    const fee = Math.round(amount * feeRate);
    const netAmount = amount - fee;
    
    const transfer: IAssetTransfer = {
      transferId: `TRANS-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      sessionId,
      fromCharacterId,
      fromFaction,
      toAccountId,
      originalAmount: amount,
      transferFee: fee,
      netAmount,
      status: 'PENDING',
      conditions: {
        requiresDefection,
        timeLimit: requiresDefection 
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)  // 30일
          : undefined,
      },
      createdAt: new Date(),
    };
    
    const sessionTransfers = this.transfers.get(sessionId) || [];
    sessionTransfers.push(transfer);
    this.transfers.set(sessionId, sessionTransfers);
    
    logger.info(
      `[FezzanFinance] 자산 이전 요청: ${transfer.transferId} (${amount} -> ${netAmount}, 수수료 ${(feeRate * 100).toFixed(0)}%)`
    );
    
    return { success: true, transfer };
  }

  /**
   * 자산 이전 완료 (망명 확인 후)
   */
  static async completeAssetTransfer(
    sessionId: string,
    transferId: string,
    defected: boolean = true
  ): Promise<{ success: boolean; amount?: number; error?: string }> {
    const transfers = this.transfers.get(sessionId) || [];
    const transfer = transfers.find(t => t.transferId === transferId);
    
    if (!transfer) {
      return { success: false, error: '이전 요청을 찾을 수 없습니다.' };
    }
    
    if (transfer.status !== 'PENDING' && transfer.status !== 'APPROVED') {
      return { success: false, error: '이미 처리된 요청입니다.' };
    }
    
    // 망명 조건 확인
    if (transfer.conditions?.requiresDefection && !defected) {
      return { success: false, error: '망명이 완료되어야 자산을 수령할 수 있습니다.' };
    }
    
    // 시간 제한 확인
    if (transfer.conditions?.timeLimit && transfer.conditions.timeLimit < new Date()) {
      transfer.status = 'BLOCKED';
      return { success: false, error: '이전 제한 시간이 만료되었습니다.' };
    }
    
    // 이전 완료
    transfer.status = 'COMPLETED';
    transfer.completedAt = new Date();
    
    // 계좌에 입금
    const accounts = this.accounts.get(sessionId) || [];
    const account = accounts.find(a => a.accountId === transfer.toAccountId);
    if (account) {
      account.balance += transfer.netAmount;
      account.lastActivityAt = new Date();
    }
    
    logger.info(`[FezzanFinance] 자산 이전 완료: ${transferId}`);
    
    return { success: true, amount: transfer.netAmount };
  }

  // ==================== 대출 ====================

  /**
   * 대출 신청
   */
  static async applyForLoan(
    sessionId: string,
    borrowerId: string,
    borrowerType: 'CHARACTER' | 'FACTION',
    amount: number,
    termMonths: number,
    collateral?: IFezzanLoan['collateral']
  ): Promise<{ success: boolean; loan?: IFezzanLoan; error?: string }> {
    // 이자율 결정
    let interestRate: number;
    if (collateral && collateral.type !== 'NONE') {
      interestRate = FEE_RATES.loanInterest.secured;
    } else {
      interestRate = FEE_RATES.loanInterest.unsecured;
    }
    
    // 총 상환액 계산 (단리)
    const totalInterest = amount * interestRate * (termMonths / 12);
    const totalOwed = amount + totalInterest;
    const monthlyPayment = Math.ceil(totalOwed / termMonths);
    
    // 승인 확률 (담보 유무, 금액에 따라)
    let approvalChance = 0.7;  // 기본 70%
    if (collateral && collateral.type !== 'NONE') {
      approvalChance = 0.95;  // 담보 있으면 95%
    }
    if (amount > 1000000) {
      approvalChance -= 0.2;  // 대규모 대출은 어려움
    }
    
    if (Math.random() > approvalChance) {
      return { success: false, error: '대출 심사에 통과하지 못했습니다.' };
    }
    
    const loan: IFezzanLoan = {
      loanId: `LOAN-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      sessionId,
      borrowerId,
      borrowerType,
      principal: amount,
      interestRate,
      totalOwed,
      amountPaid: 0,
      termMonths,
      monthlyPayment,
      collateral,
      status: 'ACTIVE',
      missedPayments: 0,
      penaltyAccrued: 0,
      createdAt: new Date(),
      nextPaymentDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),  // 30일 후
    };
    
    const sessionLoans = this.loans.get(sessionId) || [];
    sessionLoans.push(loan);
    this.loans.set(sessionId, sessionLoans);
    
    logger.info(
      `[FezzanFinance] 대출 승인: ${loan.loanId} (${amount}, ${termMonths}개월, ${(interestRate * 100).toFixed(0)}%)`
    );
    
    return { success: true, loan };
  }

  /**
   * 대출 상환
   */
  static async repayLoan(
    sessionId: string,
    loanId: string,
    amount: number
  ): Promise<{ success: boolean; remainingDebt?: number; error?: string }> {
    const loans = this.loans.get(sessionId) || [];
    const loan = loans.find(l => l.loanId === loanId);
    
    if (!loan) {
      return { success: false, error: '대출을 찾을 수 없습니다.' };
    }
    
    if (loan.status !== 'ACTIVE') {
      return { success: false, error: '이미 상환 완료되었거나 채무불이행 상태입니다.' };
    }
    
    loan.amountPaid += amount;
    
    // 연체금 먼저 상환
    if (loan.penaltyAccrued > 0) {
      const penaltyPayment = Math.min(amount, loan.penaltyAccrued);
      loan.penaltyAccrued -= penaltyPayment;
    }
    
    const remainingDebt = loan.totalOwed - loan.amountPaid + loan.penaltyAccrued;
    
    // 완납 확인
    if (remainingDebt <= 0) {
      loan.status = 'PAID';
      logger.info(`[FezzanFinance] 대출 완납: ${loanId}`);
    } else {
      // 다음 상환일 갱신
      loan.nextPaymentDue = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
    
    return { success: true, remainingDebt: Math.max(0, remainingDebt) };
  }

  /**
   * 대출 연체 처리
   */
  static processLoanDefault(sessionId: string, loanId: string): void {
    const loans = this.loans.get(sessionId) || [];
    const loan = loans.find(l => l.loanId === loanId);
    
    if (!loan || loan.status !== 'ACTIVE') return;
    
    loan.missedPayments++;
    
    // 연체 이자 (월 5%)
    loan.penaltyAccrued += loan.monthlyPayment * 0.05;
    
    // 3회 연체시 채무불이행
    if (loan.missedPayments >= 3) {
      loan.status = 'DEFAULTED';
      logger.warn(`[FezzanFinance] 대출 채무불이행: ${loanId}`);
      
      // 담보 있으면 압류
      if (loan.collateral && loan.collateral.type !== 'NONE') {
        logger.warn(`[FezzanFinance] 담보 압류: ${loan.collateral.description}`);
      }
    }
  }

  // ==================== 투자 ====================

  /**
   * 투자 실행
   */
  static async makeInvestment(
    sessionId: string,
    investorId: string,
    targetType: IFezzanInvestment['targetType'],
    targetId: string,
    targetName: string,
    amount: number,
    riskLevel: IFezzanInvestment['riskLevel']
  ): Promise<{ success: boolean; investment?: IFezzanInvestment; error?: string }> {
    // 예상 수익률 (리스크에 비례)
    const expectedReturn = {
      LOW: 0.05,       // 5%
      MEDIUM: 0.10,    // 10%
      HIGH: 0.20,      // 20%
      VERY_HIGH: 0.40, // 40%
    }[riskLevel];
    
    const investment: IFezzanInvestment = {
      investmentId: `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      sessionId,
      investorId,
      targetType,
      targetId,
      targetName,
      amount,
      shares: Math.floor(amount / 100),  // 100원당 1주
      expectedReturn,
      actualReturn: 0,
      dividendsPaid: 0,
      riskLevel,
      status: 'ACTIVE',
      createdAt: new Date(),
      maturesAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),  // 90일 만기
    };
    
    const sessionInvestments = this.investments.get(sessionId) || [];
    sessionInvestments.push(investment);
    this.investments.set(sessionId, sessionInvestments);
    
    logger.info(
      `[FezzanFinance] 투자 실행: ${investment.investmentId} (${targetName}, ${amount})`
    );
    
    return { success: true, investment };
  }

  /**
   * 투자 수익 계산 및 지급
   */
  static calculateInvestmentReturns(
    sessionId: string
  ): Array<{ investmentId: string; dividend: number }> {
    const investments = this.investments.get(sessionId) || [];
    const returns: Array<{ investmentId: string; dividend: number }> = [];
    
    for (const investment of investments) {
      if (investment.status !== 'ACTIVE') continue;
      
      // 리스크에 따른 실제 수익률 변동
      const variance = {
        LOW: 0.05,
        MEDIUM: 0.15,
        HIGH: 0.30,
        VERY_HIGH: 0.50,
      }[investment.riskLevel];
      
      // -variance ~ +variance 범위에서 변동
      const randomFactor = (Math.random() * 2 - 1) * variance;
      investment.actualReturn = investment.expectedReturn + randomFactor;
      
      // 손실 가능성 (HIGH 이상)
      if (investment.riskLevel === 'VERY_HIGH' && Math.random() < 0.1) {
        investment.actualReturn = -0.5;  // 50% 손실
      }
      
      // 배당금 계산 (분기별)
      const quarterlyReturn = investment.actualReturn / 4;
      const dividend = Math.round(investment.amount * quarterlyReturn);
      
      if (dividend > 0) {
        investment.dividendsPaid += dividend;
        returns.push({ investmentId: investment.investmentId, dividend });
      }
      
      // 만기 확인
      if (investment.maturesAt && investment.maturesAt <= new Date()) {
        investment.status = 'MATURED';
        logger.info(`[FezzanFinance] 투자 만기: ${investment.investmentId}`);
      }
    }
    
    return returns;
  }

  // ==================== 조회 ====================

  /**
   * 캐릭터의 모든 금융 활동 요약
   */
  static getFinancialSummary(
    sessionId: string,
    characterId: string
  ): {
    accounts: IFezzanAccount[];
    totalBalance: number;
    activeLoans: IFezzanLoan[];
    totalDebt: number;
    investments: IFezzanInvestment[];
    totalInvested: number;
  } {
    const accounts = this.getCharacterAccounts(sessionId, characterId);
    const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
    
    const loans = this.loans.get(sessionId) || [];
    const activeLoans = loans.filter(
      l => l.borrowerId === characterId && l.status === 'ACTIVE'
    );
    const totalDebt = activeLoans.reduce(
      (sum, l) => sum + (l.totalOwed - l.amountPaid + l.penaltyAccrued), 0
    );
    
    const investments = this.investments.get(sessionId) || [];
    const characterInvestments = investments.filter(
      i => i.investorId === characterId && i.status === 'ACTIVE'
    );
    const totalInvested = characterInvestments.reduce((sum, i) => sum + i.amount, 0);
    
    return {
      accounts,
      totalBalance,
      activeLoans,
      totalDebt,
      investments: characterInvestments,
      totalInvested,
    };
  }

  /**
   * 수수료율 조회
   */
  static getFeeRates(): typeof FEE_RATES {
    return { ...FEE_RATES };
  }
}

export default FezzanFinancialService;

