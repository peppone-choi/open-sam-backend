/**
 * FezzanNeutralityService - 페잔 중립/무역/정보중개 시스템
 * 매뉴얼 기반 구현
 *
 * 기능:
 * - 중립 지위 관리 (Neutrality Logic)
 * - 무역 허브 (Trade Hub)
 * - 정보 중개 (Information Broker)
 * - 통행 허가 (Permit System)
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { Fleet, IFleet } from '../../models/gin7/Fleet';
import { Planet, IPlanet } from '../../models/gin7/Planet';
import { logger } from '../../common/logger';

// ============================================================
// Types
// ============================================================

export enum FezzanNeutralityStatus {
  NEUTRAL = 'NEUTRAL',           // 중립 상태
  ALIGNED_EMPIRE = 'ALIGNED_EMPIRE',   // 제국 편향
  ALIGNED_ALLIANCE = 'ALIGNED_ALLIANCE', // 동맹 편향
  OCCUPIED = 'OCCUPIED',         // 점령됨
}

export enum FezzanPermitType {
  TRANSIT = 'TRANSIT',           // 통행 허가
  TRADE = 'TRADE',               // 무역 허가
  RESIDENCE = 'RESIDENCE',       // 거주 허가
  DIPLOMATIC = 'DIPLOMATIC',     // 외교 허가
}

export interface FezzanPermit {
  permitId: string;
  type: FezzanPermitType;
  factionId: string;
  characterId?: string;          // 개인 허가인 경우
  fleetId?: string;              // 함대 허가인 경우
  grantedAt: Date;
  expiresAt?: Date;
  fee: number;
  isActive: boolean;
}

export interface TradeRoute {
  routeId: string;
  sourceFactionId: string;
  sourceSystemId: string;
  volume: number;                // 무역량
  tariffRate: number;            // 관세율
  isActive: boolean;
  establishedAt: Date;
}

export interface IntelligenceListing {
  listingId: string;
  category: 'MILITARY' | 'POLITICAL' | 'ECONOMIC' | 'PERSONAL';
  targetFactionId: string;
  description: string;
  price: number;
  quality: number;               // 정보 품질 (1-100)
  soldAt?: Date;
  buyerId?: string;
}

// ============================================================
// FezzanNeutralityService Class
// ============================================================

export class FezzanNeutralityService extends EventEmitter {
  private static instance: FezzanNeutralityService;
  
  // 세션별 페잔 상태
  private fezzanStatus: Map<string, FezzanNeutralityStatus> = new Map();
  
  // 허가 캐시
  private permits: Map<string, FezzanPermit[]> = new Map();
  
  // 무역 경로
  private tradeRoutes: Map<string, TradeRoute[]> = new Map();
  
  // 정보 목록
  private intelligenceListings: Map<string, IntelligenceListing[]> = new Map();

  private constructor() {
    super();
    logger.info('[FezzanNeutralityService] Initialized');
  }

  public static getInstance(): FezzanNeutralityService {
    if (!FezzanNeutralityService.instance) {
      FezzanNeutralityService.instance = new FezzanNeutralityService();
    }
    return FezzanNeutralityService.instance;
  }

  // ============================================================
  // 중립 관리 (Neutrality Logic)
  // ============================================================

  /**
   * 페잔 상태 초기화
   */
  public initializeFezzan(sessionId: string): void {
    this.fezzanStatus.set(sessionId, FezzanNeutralityStatus.NEUTRAL);
    this.permits.set(sessionId, []);
    this.tradeRoutes.set(sessionId, []);
    this.intelligenceListings.set(sessionId, []);
    
    logger.info(`[FezzanNeutralityService] Initialized Fezzan for session ${sessionId}`);
  }

  /**
   * 페잔 상태 조회
   */
  public getFezzanNeutralityStatus(sessionId: string): FezzanNeutralityStatus {
    return this.fezzanStatus.get(sessionId) || FezzanNeutralityStatus.NEUTRAL;
  }

  /**
   * 페잔 점령 처리
   */
  public async occupyFezzan(
    sessionId: string,
    occupyingFactionId: string,
  ): Promise<{ success: boolean; penalties: string[] }> {
    const currentStatus = this.getFezzanNeutralityStatus(sessionId);
    
    if (currentStatus === FezzanNeutralityStatus.OCCUPIED) {
      return { success: false, penalties: ['이미 점령된 상태입니다.'] };
    }

    this.fezzanStatus.set(sessionId, FezzanNeutralityStatus.OCCUPIED);
    
    // 점령 패널티 적용
    const penalties: string[] = [];
    
    // 1. 모든 무역 경로 중단
    const routes = this.tradeRoutes.get(sessionId) || [];
    for (const route of routes) {
      route.isActive = false;
    }
    penalties.push('모든 무역 경로 중단');
    
    // 2. 모든 허가 취소
    const permitList = this.permits.get(sessionId) || [];
    for (const permit of permitList) {
      permit.isActive = false;
    }
    penalties.push('모든 통행/무역 허가 취소');
    
    // 3. 국제 여론 악화 (제국/동맹 양측)
    penalties.push('국제 여론 악화: 점령 세력 신뢰도 -30');
    
    this.emit('fezzan:occupied', {
      sessionId,
      occupyingFactionId,
      penalties,
    });

    logger.info(`[FezzanNeutralityService] Fezzan occupied by ${occupyingFactionId}`);

    return { success: true, penalties };
  }

  /**
   * 페잔 해방
   */
  public async liberateFezzan(sessionId: string): Promise<{ success: boolean }> {
    this.fezzanStatus.set(sessionId, FezzanNeutralityStatus.NEUTRAL);
    
    this.emit('fezzan:liberated', { sessionId });
    
    return { success: true };
  }

  // ============================================================
  // 허가 시스템 (Permit System)
  // ============================================================

  /**
   * 허가 요청
   */
  public async requestPermit(
    sessionId: string,
    request: {
      type: FezzanPermitType;
      factionId: string;
      characterId?: string;
      fleetId?: string;
      duration?: number;         // 일 단위
    },
  ): Promise<{ success: boolean; permit?: FezzanPermit; fee: number; error?: string }> {
    const status = this.getFezzanNeutralityStatus(sessionId);
    
    if (status === FezzanNeutralityStatus.OCCUPIED) {
      return { success: false, fee: 0, error: '페잔이 점령 상태입니다.' };
    }

    // 수수료 계산
    const fee = this.calculatePermitFee(request.type, request.duration);
    
    // 허가 생성
    const permit: FezzanPermit = {
      permitId: `PERMIT-${uuidv4().slice(0, 8)}`,
      type: request.type,
      factionId: request.factionId,
      characterId: request.characterId,
      fleetId: request.fleetId,
      grantedAt: new Date(),
      expiresAt: request.duration 
        ? new Date(Date.now() + request.duration * 24 * 60 * 60 * 1000) 
        : undefined,
      fee,
      isActive: true,
    };

    const permitList = this.permits.get(sessionId) || [];
    permitList.push(permit);
    this.permits.set(sessionId, permitList);

    this.emit('permit:granted', {
      sessionId,
      permit,
    });

    return { success: true, permit, fee };
  }

  /**
   * 허가 취소
   */
  public async revokePermit(
    sessionId: string,
    permitId: string,
  ): Promise<{ success: boolean }> {
    const permitList = this.permits.get(sessionId) || [];
    const permit = permitList.find(p => p.permitId === permitId);
    
    if (!permit) {
      return { success: false };
    }

    permit.isActive = false;

    this.emit('permit:revoked', {
      sessionId,
      permitId,
    });

    return { success: true };
  }

  /**
   * 허가 확인
   */
  public hasPermit(
    sessionId: string,
    factionId: string,
    type: FezzanPermitType,
    entityId?: string,
  ): boolean {
    const permitList = this.permits.get(sessionId) || [];
    
    return permitList.some(p => 
      p.isActive &&
      p.factionId === factionId &&
      p.type === type &&
      (!p.expiresAt || p.expiresAt > new Date()) &&
      (!entityId || p.characterId === entityId || p.fleetId === entityId)
    );
  }

  /**
   * 허가 수수료 계산
   */
  private calculatePermitFee(type: FezzanPermitType, duration?: number): number {
    const baseFees: Record<FezzanPermitType, number> = {
      [FezzanPermitType.TRANSIT]: 1000,
      [FezzanPermitType.TRADE]: 5000,
      [FezzanPermitType.RESIDENCE]: 3000,
      [FezzanPermitType.DIPLOMATIC]: 10000,
    };
    
    const base = baseFees[type] || 1000;
    const durationMultiplier = duration ? Math.sqrt(duration) : 1;
    
    return Math.floor(base * durationMultiplier);
  }

  // ============================================================
  // 무역 허브 (Trade Hub)
  // ============================================================

  /**
   * 무역 경로 개설
   */
  public async establishTradeRoute(
    sessionId: string,
    request: {
      sourceFactionId: string;
      sourceSystemId: string;
      initialVolume: number;
    },
  ): Promise<{ success: boolean; route?: TradeRoute; error?: string }> {
    const status = this.getFezzanNeutralityStatus(sessionId);
    
    if (status === FezzanNeutralityStatus.OCCUPIED) {
      return { success: false, error: '페잔이 점령 상태입니다.' };
    }

    // 무역 허가 확인
    if (!this.hasPermit(sessionId, request.sourceFactionId, FezzanPermitType.TRADE)) {
      return { success: false, error: '무역 허가가 필요합니다.' };
    }

    const route: TradeRoute = {
      routeId: `ROUTE-${uuidv4().slice(0, 8)}`,
      sourceFactionId: request.sourceFactionId,
      sourceSystemId: request.sourceSystemId,
      volume: request.initialVolume,
      tariffRate: 0.05,          // 5% 기본 관세
      isActive: true,
      establishedAt: new Date(),
    };

    const routes = this.tradeRoutes.get(sessionId) || [];
    routes.push(route);
    this.tradeRoutes.set(sessionId, routes);

    this.emit('trade:routeEstablished', {
      sessionId,
      route,
    });

    return { success: true, route };
  }

  /**
   * 무역 거래 수행
   */
  public async executeTrade(
    sessionId: string,
    request: {
      routeId: string;
      goods: { type: string; quantity: number; unitPrice: number }[];
    },
  ): Promise<{ 
    success: boolean; 
    totalValue: number; 
    tariff: number; 
    netValue: number;
    error?: string;
  }> {
    const routes = this.tradeRoutes.get(sessionId) || [];
    const route = routes.find(r => r.routeId === request.routeId && r.isActive);
    
    if (!route) {
      return { success: false, totalValue: 0, tariff: 0, netValue: 0, error: '유효한 무역 경로가 없습니다.' };
    }

    // 총 거래 금액 계산
    const totalValue = request.goods.reduce(
      (sum, g) => sum + g.quantity * g.unitPrice, 
      0
    );
    
    // 관세 계산
    const tariff = Math.floor(totalValue * route.tariffRate);
    const netValue = totalValue - tariff;

    // 무역량 업데이트
    route.volume += totalValue;

    this.emit('trade:executed', {
      sessionId,
      routeId: route.routeId,
      totalValue,
      tariff,
      netValue,
    });

    return { success: true, totalValue, tariff, netValue };
  }

  /**
   * 무역 경로 조회
   */
  public getTradeRoutes(sessionId: string, factionId?: string): TradeRoute[] {
    const routes = this.tradeRoutes.get(sessionId) || [];
    
    if (factionId) {
      return routes.filter(r => r.sourceFactionId === factionId && r.isActive);
    }
    
    return routes.filter(r => r.isActive);
  }

  // ============================================================
  // 정보 중개 (Information Broker)
  // ============================================================

  /**
   * 정보 등록
   */
  public async listIntelligence(
    sessionId: string,
    info: {
      category: IntelligenceListing['category'];
      targetFactionId: string;
      description: string;
      price: number;
      quality: number;
    },
  ): Promise<{ success: boolean; listing?: IntelligenceListing }> {
    const listing: IntelligenceListing = {
      listingId: `INTEL-${uuidv4().slice(0, 8)}`,
      category: info.category,
      targetFactionId: info.targetFactionId,
      description: info.description,
      price: info.price,
      quality: info.quality,
    };

    const listings = this.intelligenceListings.get(sessionId) || [];
    listings.push(listing);
    this.intelligenceListings.set(sessionId, listings);

    this.emit('intel:listed', {
      sessionId,
      listing,
    });

    return { success: true, listing };
  }

  /**
   * 정보 구매
   */
  public async purchaseIntelligence(
    sessionId: string,
    listingId: string,
    buyerId: string,
  ): Promise<{ 
    success: boolean; 
    listing?: IntelligenceListing;
    error?: string;
  }> {
    const listings = this.intelligenceListings.get(sessionId) || [];
    const listing = listings.find(l => l.listingId === listingId && !l.soldAt);
    
    if (!listing) {
      return { success: false, error: '해당 정보를 찾을 수 없습니다.' };
    }

    listing.soldAt = new Date();
    listing.buyerId = buyerId;

    this.emit('intel:purchased', {
      sessionId,
      listingId,
      buyerId,
      price: listing.price,
    });

    return { success: true, listing };
  }

  /**
   * 정보 목록 조회
   */
  public getIntelligenceListings(
    sessionId: string,
    category?: IntelligenceListing['category'],
  ): IntelligenceListing[] {
    const listings = this.intelligenceListings.get(sessionId) || [];
    
    return listings.filter(l => 
      !l.soldAt && (!category || l.category === category)
    );
  }

  // ============================================================
  // 외교 관계
  // ============================================================

  /**
   * 페잔과의 외교 행동
   */
  public async conductDiplomacy(
    sessionId: string,
    request: {
      factionId: string;
      characterId: string;
      action: 'NEGOTIATE' | 'BRIBE' | 'THREATEN' | 'ALLIANCE_PROPOSAL';
      offer?: number;            // 제안 금액
    },
  ): Promise<{
    success: boolean;
    relationChange: number;
    outcome: string;
  }> {
    const status = this.getFezzanNeutralityStatus(sessionId);
    
    if (status === FezzanNeutralityStatus.OCCUPIED) {
      return { success: false, relationChange: 0, outcome: '페잔이 점령 상태입니다.' };
    }

    let relationChange = 0;
    let outcome = '';

    switch (request.action) {
      case 'NEGOTIATE':
        relationChange = 5;
        outcome = '협상 성공. 관계 개선.';
        break;
      case 'BRIBE':
        const bribeSuccess = (request.offer || 0) >= 10000;
        relationChange = bribeSuccess ? 15 : -5;
        outcome = bribeSuccess 
          ? '뇌물 수락. 관계 대폭 개선.' 
          : '뇌물 거절. 관계 악화.';
        break;
      case 'THREATEN':
        relationChange = -20;
        outcome = '위협으로 인한 관계 악화.';
        break;
      case 'ALLIANCE_PROPOSAL':
        // 동맹 제안은 복잡한 조건 필요
        relationChange = 0;
        outcome = '동맹 제안은 심의 중입니다.';
        break;
    }

    this.emit('diplomacy:conducted', {
      sessionId,
      factionId: request.factionId,
      action: request.action,
      relationChange,
      outcome,
    });

    return { success: true, relationChange, outcome };
  }

  // ============================================================
  // 정리
  // ============================================================

  /**
   * 세션 정리
   */
  public cleanupSession(sessionId: string): void {
    this.fezzanStatus.delete(sessionId);
    this.permits.delete(sessionId);
    this.tradeRoutes.delete(sessionId);
    this.intelligenceListings.delete(sessionId);
    
    logger.info(`[FezzanNeutralityService] Cleaned up session ${sessionId}`);
  }
}

export const fezzanNeutralityService = FezzanNeutralityService.getInstance();
export default FezzanNeutralityService;





