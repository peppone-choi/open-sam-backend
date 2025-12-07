/**
 * PassPermitService
 * 페잔 회랑 통행권 관리 시스템
 * 
 * 페잔 자치령은 제국과 동맹 사이의 중립 지대로,
 * 양측 세력이 페잔 회랑을 통과하려면 통행권이 필요합니다.
 */

import { logger } from '../../common/logger';
import { ObjectId } from 'mongodb';

/**
 * 통행권 상태
 */
export type PermitStatus = 
  | 'GRANTED'      // 허가됨
  | 'DENIED'       // 거부됨
  | 'REVOKED'      // 취소됨
  | 'EXPIRED'      // 만료됨
  | 'SUSPENDED';   // 일시 중지

/**
 * 통행권 타입
 */
export type PermitType = 
  | 'SINGLE'       // 단일 통과
  | 'TEMPORARY'    // 임시 (30일)
  | 'ANNUAL'       // 연간
  | 'PERMANENT'    // 영구
  | 'MILITARY';    // 군사 통행권 (고비용)

/**
 * 페잔과의 외교 관계
 */
export type FezzanRelation = 
  | 'HOSTILE'      // 적대 (통행 불가)
  | 'UNFRIENDLY'   // 비우호적 (높은 비용)
  | 'NEUTRAL'      // 중립 (일반 비용)
  | 'FRIENDLY'     // 우호적 (할인)
  | 'ALLIED';      // 동맹 (무료)

/**
 * 통행권 인터페이스
 */
export interface IPassPermit {
  permitId: string;
  sessionId: string;
  factionId: string;          // 신청 세력 (EMPIRE | ALLIANCE)
  fleetId?: string;           // 특정 함대용 통행권
  characterId?: string;       // 신청자
  
  type: PermitType;
  status: PermitStatus;
  
  // 기간
  issuedAt: Date;
  expiresAt?: Date;
  usedAt?: Date;
  
  // 비용
  cost: number;
  isPaid: boolean;
  
  // 조건
  maxFleetSize?: number;      // 최대 함대 규모 (함선 수)
  restrictedCargo?: string[]; // 금지 화물
  route?: string[];           // 허용 경로
  
  // 위반 기록
  violations: IViolation[];
}

/**
 * 통행권 위반 기록
 */
export interface IViolation {
  violationId: string;
  permitId: string;
  type: 'OVERSTAY' | 'WRONG_ROUTE' | 'CONTRABAND' | 'FLEET_SIZE' | 'UNAUTHORIZED';
  description: string;
  penalty: number;
  detectedAt: Date;
  resolved: boolean;
}

/**
 * 페잔 외교 상태
 */
export interface IFezzanDiplomacy {
  sessionId: string;
  factionId: string;
  relation: FezzanRelation;
  relationScore: number;      // -100 ~ 100
  
  // 통계
  totalPermits: number;
  activePermits: number;
  violations: number;
  totalTradeVolume: number;
  
  // 제재 상태
  sanctions: ISanction[];
  
  updatedAt: Date;
}

/**
 * 제재 정보
 */
export interface ISanction {
  sanctionId: string;
  type: 'ECONOMIC' | 'DIPLOMATIC' | 'MILITARY' | 'INFORMATION';
  description: string;
  severity: 'LIGHT' | 'MODERATE' | 'SEVERE';
  effects: {
    tradeCostMultiplier?: number;    // 무역 비용 배율
    permitCostMultiplier?: number;   // 통행권 비용 배율
    intelAccessDenied?: boolean;     // 정보 접근 차단
    blackMarketBanned?: boolean;     // 암시장 이용 금지
  };
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
}

/**
 * 통행권 가격표
 */
const PERMIT_PRICES: Record<PermitType, number> = {
  SINGLE: 1000,
  TEMPORARY: 5000,
  ANNUAL: 30000,
  PERMANENT: 100000,
  MILITARY: 50000,
};

/**
 * 관계별 가격 배율
 */
const RELATION_PRICE_MULTIPLIER: Record<FezzanRelation, number> = {
  HOSTILE: Infinity,  // 구매 불가
  UNFRIENDLY: 2.0,
  NEUTRAL: 1.0,
  FRIENDLY: 0.7,
  ALLIED: 0.0,        // 무료
};

/**
 * 관계 점수 임계값
 */
const RELATION_THRESHOLDS = {
  HOSTILE: -75,
  UNFRIENDLY: -25,
  NEUTRAL: 25,
  FRIENDLY: 75,
  // 75 이상이면 ALLIED
};

/**
 * PassPermitService
 */
export class PassPermitService {
  // In-memory storage
  private static permits: Map<string, IPassPermit[]> = new Map();
  private static diplomacy: Map<string, IFezzanDiplomacy> = new Map();

  // ==================== 외교 관계 ====================

  /**
   * 세력의 페잔 외교 상태 가져오기
   */
  static getDiplomacy(sessionId: string, factionId: string): IFezzanDiplomacy {
    const key = `${sessionId}-${factionId}`;
    let diplomacy = this.diplomacy.get(key);
    
    if (!diplomacy) {
      diplomacy = this.initializeDiplomacy(sessionId, factionId);
      this.diplomacy.set(key, diplomacy);
    }
    
    return diplomacy;
  }

  /**
   * 외교 상태 초기화
   */
  private static initializeDiplomacy(sessionId: string, factionId: string): IFezzanDiplomacy {
    return {
      sessionId,
      factionId,
      relation: 'NEUTRAL',
      relationScore: 0,
      totalPermits: 0,
      activePermits: 0,
      violations: 0,
      totalTradeVolume: 0,
      sanctions: [],
      updatedAt: new Date(),
    };
  }

  /**
   * 관계 점수로 관계 상태 계산
   */
  private static calculateRelation(score: number): FezzanRelation {
    if (score <= RELATION_THRESHOLDS.HOSTILE) return 'HOSTILE';
    if (score <= RELATION_THRESHOLDS.UNFRIENDLY) return 'UNFRIENDLY';
    if (score <= RELATION_THRESHOLDS.NEUTRAL) return 'NEUTRAL';
    if (score <= RELATION_THRESHOLDS.FRIENDLY) return 'FRIENDLY';
    return 'ALLIED';
  }

  /**
   * 관계 점수 변경
   */
  static updateRelationScore(
    sessionId: string,
    factionId: string,
    delta: number,
    reason: string
  ): IFezzanDiplomacy {
    const diplomacy = this.getDiplomacy(sessionId, factionId);
    
    const oldScore = diplomacy.relationScore;
    diplomacy.relationScore = Math.max(-100, Math.min(100, diplomacy.relationScore + delta));
    diplomacy.relation = this.calculateRelation(diplomacy.relationScore);
    diplomacy.updatedAt = new Date();
    
    logger.info(
      `[PassPermit] ${factionId} 관계 변경: ${oldScore} -> ${diplomacy.relationScore} (${reason})`
    );
    
    return diplomacy;
  }

  // ==================== 통행권 관리 ====================

  /**
   * 통행권 가격 계산
   */
  static calculatePermitCost(
    sessionId: string,
    factionId: string,
    permitType: PermitType,
    fleetSize?: number
  ): { cost: number; canPurchase: boolean; reason?: string } {
    const diplomacy = this.getDiplomacy(sessionId, factionId);
    
    // 적대 상태면 구매 불가
    if (diplomacy.relation === 'HOSTILE') {
      return { 
        cost: 0, 
        canPurchase: false, 
        reason: '페잔과 적대 관계로 통행권 발급이 불가합니다.' 
      };
    }
    
    // 활성 제재 확인
    const activeSanctions = diplomacy.sanctions.filter(s => s.isActive);
    for (const sanction of activeSanctions) {
      if (sanction.effects.permitCostMultiplier === Infinity) {
        return {
          cost: 0,
          canPurchase: false,
          reason: `제재(${sanction.description})로 인해 통행권 발급이 금지되었습니다.`
        };
      }
    }
    
    // 기본 가격
    let cost = PERMIT_PRICES[permitType];
    
    // 관계 배율 적용
    const relationMultiplier = RELATION_PRICE_MULTIPLIER[diplomacy.relation];
    cost *= relationMultiplier;
    
    // 제재 배율 적용
    for (const sanction of activeSanctions) {
      if (sanction.effects.permitCostMultiplier) {
        cost *= sanction.effects.permitCostMultiplier;
      }
    }
    
    // 함대 규모에 따른 추가 비용 (군사 통행권)
    if (permitType === 'MILITARY' && fleetSize) {
      cost += fleetSize * 100;  // 함선당 100 추가
    }
    
    return { cost: Math.round(cost), canPurchase: true };
  }

  /**
   * 통행권 구매
   */
  static async purchasePermit(
    sessionId: string,
    factionId: string,
    permitType: PermitType,
    options?: {
      fleetId?: string;
      characterId?: string;
      maxFleetSize?: number;
      route?: string[];
    }
  ): Promise<{ success: boolean; permit?: IPassPermit; cost?: number; error?: string }> {
    const { cost, canPurchase, reason } = this.calculatePermitCost(
      sessionId, factionId, permitType, options?.maxFleetSize
    );
    
    if (!canPurchase) {
      return { success: false, error: reason };
    }
    
    // 만료일 계산
    let expiresAt: Date | undefined;
    const now = new Date();
    
    switch (permitType) {
      case 'SINGLE':
        expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);  // 7일
        break;
      case 'TEMPORARY':
        expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30일
        break;
      case 'ANNUAL':
        expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 365일
        break;
      case 'MILITARY':
        expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14일
        break;
      // PERMANENT는 만료 없음
    }
    
    const permit: IPassPermit = {
      permitId: `PERMIT-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      sessionId,
      factionId,
      fleetId: options?.fleetId,
      characterId: options?.characterId,
      type: permitType,
      status: 'GRANTED',
      issuedAt: now,
      expiresAt,
      cost,
      isPaid: true,
      maxFleetSize: options?.maxFleetSize,
      route: options?.route,
      violations: [],
    };
    
    // 저장
    const sessionPermits = this.permits.get(sessionId) || [];
    sessionPermits.push(permit);
    this.permits.set(sessionId, sessionPermits);
    
    // 외교 상태 업데이트
    const diplomacy = this.getDiplomacy(sessionId, factionId);
    diplomacy.totalPermits++;
    diplomacy.activePermits++;
    
    // 관계 약간 개선 (통행권 구매는 긍정적 행위)
    this.updateRelationScore(sessionId, factionId, 1, '통행권 구매');
    
    logger.info(`[PassPermit] 통행권 발급: ${permit.permitId} (${factionId}, ${permitType})`);
    
    return { success: true, permit, cost };
  }

  /**
   * 통행권 유효성 검증
   */
  static validatePermit(
    sessionId: string,
    factionId: string,
    fleetId?: string,
    fleetSize?: number
  ): { valid: boolean; permit?: IPassPermit; reason?: string } {
    const sessionPermits = this.permits.get(sessionId) || [];
    const now = new Date();
    
    // 해당 세력의 유효한 통행권 찾기
    const validPermits = sessionPermits.filter(p => 
      p.factionId === factionId &&
      p.status === 'GRANTED' &&
      (!p.expiresAt || p.expiresAt > now) &&
      (!p.fleetId || p.fleetId === fleetId)  // 특정 함대용이면 함대 ID 일치 확인
    );
    
    if (validPermits.length === 0) {
      return { valid: false, reason: '유효한 통행권이 없습니다.' };
    }
    
    // 가장 적합한 통행권 선택
    let bestPermit: IPassPermit | undefined;
    
    // 1. 영구 통행권 우선
    bestPermit = validPermits.find(p => p.type === 'PERMANENT');
    
    // 2. 연간 통행권
    if (!bestPermit) {
      bestPermit = validPermits.find(p => p.type === 'ANNUAL');
    }
    
    // 3. 군사 통행권 (함대 이동시)
    if (!bestPermit && fleetId) {
      bestPermit = validPermits.find(p => p.type === 'MILITARY');
    }
    
    // 4. 임시 통행권
    if (!bestPermit) {
      bestPermit = validPermits.find(p => p.type === 'TEMPORARY');
    }
    
    // 5. 단일 통행권
    if (!bestPermit) {
      bestPermit = validPermits.find(p => p.type === 'SINGLE');
    }
    
    if (!bestPermit) {
      return { valid: false, reason: '적합한 통행권을 찾을 수 없습니다.' };
    }
    
    // 함대 규모 제한 확인
    if (bestPermit.maxFleetSize && fleetSize && fleetSize > bestPermit.maxFleetSize) {
      return { 
        valid: false, 
        permit: bestPermit,
        reason: `함대 규모(${fleetSize})가 통행권 제한(${bestPermit.maxFleetSize})을 초과합니다.` 
      };
    }
    
    return { valid: true, permit: bestPermit };
  }

  /**
   * 통행권 사용 기록
   */
  static usePermit(sessionId: string, permitId: string): boolean {
    const sessionPermits = this.permits.get(sessionId) || [];
    const permit = sessionPermits.find(p => p.permitId === permitId);
    
    if (!permit) return false;
    
    permit.usedAt = new Date();
    
    // 단일 통행권은 사용 후 만료
    if (permit.type === 'SINGLE') {
      permit.status = 'EXPIRED';
      
      const diplomacy = this.getDiplomacy(sessionId, permit.factionId);
      diplomacy.activePermits--;
    }
    
    return true;
  }

  /**
   * 무단 통과 처리 (위반)
   */
  static processUnauthorizedCrossing(
    sessionId: string,
    factionId: string,
    fleetId?: string
  ): IViolation {
    const violation: IViolation = {
      violationId: `VIOL-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      permitId: '',
      type: 'UNAUTHORIZED',
      description: '통행권 없이 페잔 회랑을 통과 시도',
      penalty: 10000,
      detectedAt: new Date(),
      resolved: false,
    };
    
    // 관계 악화
    this.updateRelationScore(sessionId, factionId, -15, '무단 통과 시도');
    
    // 외교 상태 업데이트
    const diplomacy = this.getDiplomacy(sessionId, factionId);
    diplomacy.violations++;
    
    // 반복 위반시 제재 부과
    if (diplomacy.violations >= 3) {
      this.imposeSanction(sessionId, factionId, {
        type: 'DIPLOMATIC',
        description: '반복적인 무단 통과로 인한 외교 제재',
        severity: 'MODERATE',
        effects: {
          permitCostMultiplier: 2.0,
          tradeCostMultiplier: 1.5,
        },
        durationDays: 30,
      });
    }
    
    logger.warn(`[PassPermit] 무단 통과 감지: ${factionId} (위반 ${diplomacy.violations}회)`);
    
    return violation;
  }

  // ==================== 제재 관리 ====================

  /**
   * 제재 부과
   */
  static imposeSanction(
    sessionId: string,
    factionId: string,
    options: {
      type: ISanction['type'];
      description: string;
      severity: ISanction['severity'];
      effects: ISanction['effects'];
      durationDays?: number;
    }
  ): ISanction {
    const now = new Date();
    
    const sanction: ISanction = {
      sanctionId: `SANC-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type: options.type,
      description: options.description,
      severity: options.severity,
      effects: options.effects,
      startDate: now,
      endDate: options.durationDays 
        ? new Date(now.getTime() + options.durationDays * 24 * 60 * 60 * 1000)
        : undefined,
      isActive: true,
    };
    
    const diplomacy = this.getDiplomacy(sessionId, factionId);
    diplomacy.sanctions.push(sanction);
    
    logger.info(`[PassPermit] 제재 부과: ${sanction.sanctionId} (${factionId}, ${options.type})`);
    
    return sanction;
  }

  /**
   * 제재 해제
   */
  static liftSanction(
    sessionId: string,
    factionId: string,
    sanctionId: string
  ): boolean {
    const diplomacy = this.getDiplomacy(sessionId, factionId);
    const sanction = diplomacy.sanctions.find(s => s.sanctionId === sanctionId);
    
    if (!sanction) return false;
    
    sanction.isActive = false;
    sanction.endDate = new Date();
    
    logger.info(`[PassPermit] 제재 해제: ${sanctionId} (${factionId})`);
    
    return true;
  }

  /**
   * 만료된 제재 정리
   */
  static cleanupExpiredSanctions(sessionId: string): void {
    const now = new Date();
    
    for (const [key, diplomacy] of this.diplomacy) {
      if (!key.startsWith(sessionId)) continue;
      
      for (const sanction of diplomacy.sanctions) {
        if (sanction.isActive && sanction.endDate && sanction.endDate <= now) {
          sanction.isActive = false;
          logger.info(`[PassPermit] 제재 만료: ${sanction.sanctionId}`);
        }
      }
    }
  }

  // ==================== 조회 ====================

  /**
   * 세력의 모든 통행권 가져오기
   */
  static getFactionPermits(sessionId: string, factionId: string): IPassPermit[] {
    const sessionPermits = this.permits.get(sessionId) || [];
    return sessionPermits.filter(p => p.factionId === factionId);
  }

  /**
   * 활성 통행권만 가져오기
   */
  static getActivePermits(sessionId: string, factionId: string): IPassPermit[] {
    const now = new Date();
    return this.getFactionPermits(sessionId, factionId).filter(p => 
      p.status === 'GRANTED' && (!p.expiresAt || p.expiresAt > now)
    );
  }

  /**
   * 활성 제재 목록
   */
  static getActiveSanctions(sessionId: string, factionId: string): ISanction[] {
    const diplomacy = this.getDiplomacy(sessionId, factionId);
    return diplomacy.sanctions.filter(s => s.isActive);
  }

  /**
   * 통행권 가격표 가져오기
   */
  static getPermitPrices(): Record<PermitType, number> {
    return { ...PERMIT_PRICES };
  }
}

export default PassPermitService;








