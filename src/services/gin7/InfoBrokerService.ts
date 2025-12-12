/**
 * InfoBrokerService
 * 페잔 정보상 시스템
 * 
 * 페잔은 은하계 최대의 정보 거래 중심지입니다.
 * 첩보 레벨과 관계없이 적국의 정보를 구매할 수 있습니다.
 */

import { logger } from '../../common/logger';

/**
 * 정보 카테고리
 */
export type IntelCategory = 
  | 'FLEET_LOCATION'      // 함대 위치
  | 'FLEET_COMPOSITION'   // 함대 구성
  | 'FLEET_MOVEMENT'      // 함대 이동 예정
  | 'MILITARY_STRENGTH'   // 군사력 총계
  | 'ECONOMIC_DATA'       // 경제 데이터
  | 'POLITICAL_INFO'      // 정치 정보 (파벌, 지지율)
  | 'COMMANDER_PROFILE'   // 지휘관 프로필
  | 'STRATEGIC_PLANS'     // 전략 계획 (매우 고가)
  | 'TECHNOLOGY_LEVEL'    // 기술 수준
  | 'SUPPLY_LINES';       // 보급선 정보

/**
 * 정보 품질
 */
export type IntelQuality = 
  | 'RUMOR'        // 소문 (정확도 30-50%)
  | 'UNVERIFIED'   // 미확인 (정확도 50-70%)
  | 'VERIFIED'     // 확인됨 (정확도 80-95%)
  | 'CLASSIFIED';  // 기밀 (정확도 95-100%)

/**
 * 정보 상품
 */
export interface IIntelProduct {
  productId: string;
  category: IntelCategory;
  quality: IntelQuality;
  
  title: string;
  description: string;
  
  // 대상
  targetFactionId: string;      // 정보 대상 세력
  targetSystemId?: string;      // 특정 항성계
  targetFleetId?: string;       // 특정 함대
  targetCharacterId?: string;   // 특정 인물
  
  // 가격
  basePrice: number;
  currentPrice: number;
  
  // 유효성
  freshness: number;            // 신선도 (0-100, 시간에 따라 감소)
  collectedAt: Date;
  expiresAt?: Date;
  
  // 특성
  isExclusive: boolean;         // 독점 판매 (한 번 팔면 삭제)
  buyerCount: number;           // 구매자 수 (비독점시)
  
  // 실제 정보 (구매 후 공개)
  payload?: Record<string, unknown>;
}

/**
 * 정보 구매 기록
 */
export interface IIntelPurchase {
  purchaseId: string;
  productId: string;
  sessionId: string;
  buyerFactionId: string;
  buyerCharacterId?: string;
  
  price: number;
  purchasedAt: Date;
  
  // 공개된 정보
  revealedData: Record<string, unknown>;
  quality: IntelQuality;
  accuracy: number;             // 실제 정확도 (0-100)
}

/**
 * 정보원 (고급 기능)
 */
export interface IInformant {
  informantId: string;
  sessionId: string;
  buyerCharacterId: string;
  
  name: string;
  specialty: IntelCategory[];
  targetFaction: string;        // 침투한 세력
  
  reliability: number;          // 신뢰도 (0-100)
  exposure: number;             // 노출 위험 (0-100)
  
  // 정보 수집 능력
  gatherRate: number;           // 일일 정보 수집량
  maxQuality: IntelQuality;     // 최대 품질
  
  // 비용
  monthlySalary: number;
  
  isActive: boolean;
  recruitedAt: Date;
  lastReportAt?: Date;
}

/**
 * 카테고리별 기본 가격
 */
const INTEL_BASE_PRICES: Record<IntelCategory, number> = {
  FLEET_LOCATION: 3000,
  FLEET_COMPOSITION: 5000,
  FLEET_MOVEMENT: 8000,
  MILITARY_STRENGTH: 4000,
  ECONOMIC_DATA: 2000,
  POLITICAL_INFO: 3000,
  COMMANDER_PROFILE: 2500,
  STRATEGIC_PLANS: 50000,
  TECHNOLOGY_LEVEL: 6000,
  SUPPLY_LINES: 7000,
};

/**
 * 품질별 가격 배율
 */
const QUALITY_PRICE_MULTIPLIER: Record<IntelQuality, number> = {
  RUMOR: 0.3,
  UNVERIFIED: 0.6,
  VERIFIED: 1.0,
  CLASSIFIED: 3.0,
};

/**
 * 품질별 정확도 범위
 */
const QUALITY_ACCURACY: Record<IntelQuality, { min: number; max: number }> = {
  RUMOR: { min: 30, max: 50 },
  UNVERIFIED: { min: 50, max: 70 },
  VERIFIED: { min: 80, max: 95 },
  CLASSIFIED: { min: 95, max: 100 },
};

/**
 * InfoBrokerService
 */
export class InfoBrokerService {
  // In-memory storage
  private static products: Map<string, IIntelProduct[]> = new Map();
  private static purchases: Map<string, IIntelPurchase[]> = new Map();
  private static informants: Map<string, IInformant[]> = new Map();

  // ==================== 정보 상품 관리 ====================

  /**
   * 이용 가능한 정보 목록 가져오기
   */
  static getAvailableIntel(
    sessionId: string,
    buyerFactionId: string,
    filters?: {
      category?: IntelCategory;
      targetFaction?: string;
      maxPrice?: number;
      minQuality?: IntelQuality;
    }
  ): IIntelProduct[] {
    let products = this.products.get(sessionId) || [];
    
    // 자동 생성 (없으면)
    if (products.length === 0) {
      products = this.generateIntelProducts(sessionId);
      this.products.set(sessionId, products);
    }
    
    // 만료 상품 제거
    const now = new Date();
    products = products.filter(p => !p.expiresAt || p.expiresAt > now);
    
    // 자기 세력 정보는 제외
    products = products.filter(p => p.targetFactionId !== buyerFactionId);
    
    // 필터 적용
    if (filters) {
      if (filters.category) {
        products = products.filter(p => p.category === filters.category);
      }
      if (filters.targetFaction) {
        products = products.filter(p => p.targetFactionId === filters.targetFaction);
      }
      if (filters.maxPrice) {
        products = products.filter(p => p.currentPrice <= filters.maxPrice);
      }
      if (filters.minQuality) {
        const qualityOrder: IntelQuality[] = ['RUMOR', 'UNVERIFIED', 'VERIFIED', 'CLASSIFIED'];
        const minIndex = qualityOrder.indexOf(filters.minQuality);
        products = products.filter(p => qualityOrder.indexOf(p.quality) >= minIndex);
      }
    }
    
    // 신선도 순 정렬
    return products.sort((a, b) => b.freshness - a.freshness);
  }

  /**
   * 정보 상품 자동 생성
   */
  private static generateIntelProducts(sessionId: string): IIntelProduct[] {
    const products: IIntelProduct[] = [];
    const factions = ['EMPIRE', 'ALLIANCE'];
    const categories = Object.keys(INTEL_BASE_PRICES) as IntelCategory[];
    const qualities: IntelQuality[] = ['RUMOR', 'UNVERIFIED', 'VERIFIED', 'CLASSIFIED'];
    
    for (const faction of factions) {
      // 각 카테고리별로 1-3개 상품 생성
      for (const category of categories) {
        const count = 1 + Math.floor(Math.random() * 3);
        
        for (let i = 0; i < count; i++) {
          // 품질 랜덤 선택 (낮은 품질이 더 흔함)
          const qualityRoll = Math.random();
          let quality: IntelQuality;
          if (qualityRoll < 0.4) quality = 'RUMOR';
          else if (qualityRoll < 0.7) quality = 'UNVERIFIED';
          else if (qualityRoll < 0.9) quality = 'VERIFIED';
          else quality = 'CLASSIFIED';
          
          const basePrice = INTEL_BASE_PRICES[category];
          const qualityMultiplier = QUALITY_PRICE_MULTIPLIER[quality];
          const priceVariation = 0.8 + Math.random() * 0.4;  // ±20%
          
          const product = this.createIntelProduct({
            sessionId,
            category,
            quality,
            targetFactionId: faction,
            basePrice: Math.round(basePrice * qualityMultiplier * priceVariation),
            isExclusive: Math.random() < 0.3,  // 30% 확률로 독점
          });
          
          products.push(product);
        }
      }
    }
    
    return products;
  }

  /**
   * 정보 상품 생성
   */
  private static createIntelProduct(options: {
    sessionId: string;
    category: IntelCategory;
    quality: IntelQuality;
    targetFactionId: string;
    basePrice: number;
    isExclusive: boolean;
    targetSystemId?: string;
    targetFleetId?: string;
    targetCharacterId?: string;
  }): IIntelProduct {
    const now = new Date();
    
    // 카테고리별 제목/설명 생성
    const { title, description } = this.generateIntelDescription(
      options.category, 
      options.targetFactionId,
      options.quality
    );
    
    return {
      productId: `INTEL-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      category: options.category,
      quality: options.quality,
      title,
      description,
      targetFactionId: options.targetFactionId,
      targetSystemId: options.targetSystemId,
      targetFleetId: options.targetFleetId,
      targetCharacterId: options.targetCharacterId,
      basePrice: options.basePrice,
      currentPrice: options.basePrice,
      freshness: 100,
      collectedAt: now,
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),  // 7일 후 만료
      isExclusive: options.isExclusive,
      buyerCount: 0,
    };
  }

  /**
   * 정보 제목/설명 생성
   */
  private static generateIntelDescription(
    category: IntelCategory,
    targetFaction: string,
    quality: IntelQuality
  ): { title: string; description: string } {
    const factionName = targetFaction === 'EMPIRE' ? '은하제국' : '자유행성동맹';
    const qualityPrefix = {
      RUMOR: '미확인 소문: ',
      UNVERIFIED: '보고: ',
      VERIFIED: '확인된 정보: ',
      CLASSIFIED: '기밀: ',
    }[quality];
    
    const templates: Record<IntelCategory, { title: string; description: string }> = {
      FLEET_LOCATION: {
        title: `${qualityPrefix}${factionName} 함대 위치`,
        description: `${factionName} 주요 함대의 현재 배치 위치 정보`,
      },
      FLEET_COMPOSITION: {
        title: `${qualityPrefix}${factionName} 함대 구성`,
        description: `${factionName} 함대의 함종별 구성 및 전력 분석`,
      },
      FLEET_MOVEMENT: {
        title: `${qualityPrefix}${factionName} 함대 이동 계획`,
        description: `${factionName} 함대의 예정된 이동 경로 및 목적지`,
      },
      MILITARY_STRENGTH: {
        title: `${qualityPrefix}${factionName} 총 군사력`,
        description: `${factionName}의 전체 군사력 평가 보고서`,
      },
      ECONOMIC_DATA: {
        title: `${qualityPrefix}${factionName} 경제 현황`,
        description: `${factionName}의 국고, 자원 보유량, 생산력 정보`,
      },
      POLITICAL_INFO: {
        title: `${qualityPrefix}${factionName} 정치 동향`,
        description: `${factionName} 내부의 파벌 관계 및 정치적 동향`,
      },
      COMMANDER_PROFILE: {
        title: `${qualityPrefix}${factionName} 지휘관 프로필`,
        description: `${factionName} 주요 지휘관들의 능력치 및 성향 분석`,
      },
      STRATEGIC_PLANS: {
        title: `${qualityPrefix}${factionName} 전략 계획`,
        description: `${factionName}의 장기 전략 및 작전 계획 문서`,
      },
      TECHNOLOGY_LEVEL: {
        title: `${qualityPrefix}${factionName} 기술 수준`,
        description: `${factionName}의 군사/민간 기술 발전 현황`,
      },
      SUPPLY_LINES: {
        title: `${qualityPrefix}${factionName} 보급선`,
        description: `${factionName}의 주요 보급 경로 및 물류 거점`,
      },
    };
    
    return templates[category];
  }

  // ==================== 정보 구매 ====================

  /**
   * 정보 구매
   */
  static async purchaseIntel(
    sessionId: string,
    productId: string,
    buyerFactionId: string,
    buyerCharacterId?: string
  ): Promise<{
    success: boolean;
    purchase?: IIntelPurchase;
    error?: string;
  }> {
    const products = this.products.get(sessionId) || [];
    const product = products.find(p => p.productId === productId);
    
    if (!product) {
      return { success: false, error: '해당 정보를 찾을 수 없습니다.' };
    }
    
    // 자기 세력 정보는 구매 불가
    if (product.targetFactionId === buyerFactionId) {
      return { success: false, error: '자신의 세력 정보는 구매할 수 없습니다.' };
    }
    
    // 만료 확인
    if (product.expiresAt && product.expiresAt < new Date()) {
      return { success: false, error: '해당 정보는 만료되었습니다.' };
    }
    
    // 정확도 계산
    const accuracyRange = QUALITY_ACCURACY[product.quality];
    const accuracy = accuracyRange.min + Math.random() * (accuracyRange.max - accuracyRange.min);
    
    // 실제 정보 생성 (페이로드)
    const revealedData = this.generateIntelPayload(product, accuracy);
    
    // 구매 기록 생성
    const purchase: IIntelPurchase = {
      purchaseId: `PUR-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      productId,
      sessionId,
      buyerFactionId,
      buyerCharacterId,
      price: product.currentPrice,
      purchasedAt: new Date(),
      revealedData,
      quality: product.quality,
      accuracy,
    };
    
    // 구매 기록 저장
    const sessionPurchases = this.purchases.get(sessionId) || [];
    sessionPurchases.push(purchase);
    this.purchases.set(sessionId, sessionPurchases);
    
    // 상품 업데이트
    product.buyerCount++;
    
    // 독점 상품이면 삭제
    if (product.isExclusive) {
      const index = products.indexOf(product);
      if (index > -1) products.splice(index, 1);
    } else {
      // 비독점이면 가격 상승 (수요 반영)
      product.currentPrice = Math.round(product.currentPrice * 1.1);
    }
    
    logger.info(
      `[InfoBroker] 정보 구매: ${purchase.purchaseId} (${buyerFactionId}, ${product.category})`
    );
    
    return { success: true, purchase };
  }

  /**
   * 정보 페이로드 생성
   */
  private static generateIntelPayload(
    product: IIntelProduct,
    accuracy: number
  ): Record<string, unknown> {
    // 실제 게임에서는 실제 데이터를 조회해서 정확도에 따라 변형
    // 여기서는 플레이스홀더 데이터 생성
    
    const payload: Record<string, unknown> = {
      category: product.category,
      targetFaction: product.targetFactionId,
      accuracy: Math.round(accuracy),
      collectedAt: product.collectedAt,
    };
    
    switch (product.category) {
      case 'FLEET_LOCATION':
        payload.fleets = [
          { fleetId: 'fleet-1', location: 'system-A', confidence: accuracy },
          { fleetId: 'fleet-2', location: 'system-B', confidence: accuracy * 0.9 },
        ];
        break;
        
      case 'FLEET_COMPOSITION':
        payload.composition = {
          battleships: Math.floor(1000 * (accuracy / 100)),
          cruisers: Math.floor(2000 * (accuracy / 100)),
          destroyers: Math.floor(3000 * (accuracy / 100)),
          total: Math.floor(6000 * (accuracy / 100)),
        };
        break;
        
      case 'FLEET_MOVEMENT':
        payload.movements = [
          { fleetId: 'fleet-1', destination: 'system-C', eta: '3 days', confidence: accuracy },
        ];
        break;
        
      case 'MILITARY_STRENGTH':
        payload.totalShips = Math.floor(15000 * (accuracy / 100));
        payload.totalTroops = Math.floor(5000000 * (accuracy / 100));
        payload.rating = accuracy > 80 ? 'High' : 'Medium';
        break;
        
      case 'ECONOMIC_DATA':
        payload.treasury = Math.floor(1000000000 * (accuracy / 100));
        payload.gdp = Math.floor(50000000000 * (accuracy / 100));
        payload.resources = { fuel: 'High', materials: 'Medium' };
        break;
        
      case 'POLITICAL_INFO':
        payload.factions = ['Conservative', 'Reform', 'Military'];
        payload.stability = accuracy > 70 ? 'Stable' : 'Unstable';
        break;
        
      case 'COMMANDER_PROFILE':
        payload.commanders = [
          { name: 'Commander A', skill: Math.floor(85 * (accuracy / 100)) },
          { name: 'Commander B', skill: Math.floor(78 * (accuracy / 100)) },
        ];
        break;
        
      case 'STRATEGIC_PLANS':
        payload.objectives = ['Objective Alpha', 'Objective Beta'];
        payload.timeline = accuracy > 90 ? 'Detailed' : 'General';
        break;
        
      case 'TECHNOLOGY_LEVEL':
        payload.military = { weapons: 'Advanced', shields: 'Moderate' };
        payload.civilian = { industry: 'High', research: 'High' };
        break;
        
      case 'SUPPLY_LINES':
        payload.routes = [
          { from: 'system-X', to: 'system-Y', importance: 'Critical' },
        ];
        payload.vulnerabilities = accuracy > 85 ? ['system-Z'] : [];
        break;
    }
    
    return payload;
  }

  // ==================== 정보원 관리 ====================

  /**
   * 정보원 고용
   */
  static async recruitInformant(
    sessionId: string,
    buyerCharacterId: string,
    targetFaction: string,
    specialty: IntelCategory[]
  ): Promise<{
    success: boolean;
    informant?: IInformant;
    cost: number;
    error?: string;
  }> {
    const baseCost = 10000;
    const specialtyCost = specialty.length * 3000;
    const cost = baseCost + specialtyCost;
    
    // 고용 성공 확률 (60%)
    if (Math.random() > 0.6) {
      return { 
        success: false, 
        cost: Math.floor(cost * 0.3),  // 실패해도 조사 비용 발생
        error: '적합한 정보원을 찾지 못했습니다.' 
      };
    }
    
    const informant: IInformant = {
      informantId: `INF-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      sessionId,
      buyerCharacterId,
      name: this.generateInformantName(),
      specialty,
      targetFaction,
      reliability: 40 + Math.floor(Math.random() * 30),  // 40-70
      exposure: Math.floor(Math.random() * 20),          // 0-20
      gatherRate: 0.5 + Math.random() * 0.5,             // 0.5-1.0
      maxQuality: Math.random() < 0.3 ? 'CLASSIFIED' : 'VERIFIED',
      monthlySalary: Math.floor(cost * 0.2),
      isActive: true,
      recruitedAt: new Date(),
    };
    
    const sessionInformants = this.informants.get(sessionId) || [];
    sessionInformants.push(informant);
    this.informants.set(sessionId, sessionInformants);
    
    logger.info(
      `[InfoBroker] 정보원 고용: ${informant.informantId} (${targetFaction})`
    );
    
    return { success: true, informant, cost };
  }

  /**
   * 정보원 보고서 수집
   */
  static collectInformantReports(
    sessionId: string,
    buyerCharacterId: string
  ): IIntelProduct[] {
    const informants = this.informants.get(sessionId) || [];
    const activeInformants = informants.filter(
      i => i.buyerCharacterId === buyerCharacterId && i.isActive
    );
    
    const reports: IIntelProduct[] = [];
    
    for (const informant of activeInformants) {
      // 노출 체크
      if (Math.random() * 100 < informant.exposure) {
        informant.exposure += 10;
        if (informant.exposure >= 100) {
          informant.isActive = false;
          logger.warn(`[InfoBroker] 정보원 적발: ${informant.informantId}`);
          continue;
        }
      }
      
      // 정보 수집 확률
      if (Math.random() < informant.gatherRate) {
        // 랜덤 카테고리 선택 (전문 분야 우선)
        const category = informant.specialty[Math.floor(Math.random() * informant.specialty.length)];
        
        // 품질 결정 (신뢰도 기반)
        let quality: IntelQuality;
        const qualityRoll = Math.random() * informant.reliability;
        if (qualityRoll < 20) quality = 'RUMOR';
        else if (qualityRoll < 40) quality = 'UNVERIFIED';
        else if (qualityRoll < 60 || informant.maxQuality === 'VERIFIED') quality = 'VERIFIED';
        else quality = 'CLASSIFIED';
        
        const product = this.createIntelProduct({
          sessionId,
          category,
          quality,
          targetFactionId: informant.targetFaction,
          basePrice: 0,  // 정보원 보고서는 무료
          isExclusive: true,
        });
        
        reports.push(product);
        
        informant.lastReportAt = new Date();
        informant.exposure += 5;  // 활동할수록 노출 위험 증가
      }
    }
    
    return reports;
  }

  /**
   * 정보원 목록 조회
   */
  static getInformants(sessionId: string, buyerCharacterId: string): IInformant[] {
    const informants = this.informants.get(sessionId) || [];
    return informants.filter(i => i.buyerCharacterId === buyerCharacterId);
  }

  /**
   * 정보원 해고
   */
  static dismissInformant(sessionId: string, informantId: string): boolean {
    const informants = this.informants.get(sessionId) || [];
    const informant = informants.find(i => i.informantId === informantId);
    
    if (!informant) return false;
    
    informant.isActive = false;
    logger.info(`[InfoBroker] 정보원 해고: ${informantId}`);
    
    return true;
  }

  /**
   * 정보원 이름 생성
   */
  private static generateInformantName(): string {
    const codenames = [
      'Raven', 'Ghost', 'Shadow', 'Phoenix', 'Viper',
      'Specter', 'Cipher', 'Wraith', 'Echo', 'Nebula',
    ];
    const numbers = ['007', '13', '42', '99', '101', '303', '777'];
    return `${codenames[Math.floor(Math.random() * codenames.length)]}-${numbers[Math.floor(Math.random() * numbers.length)]}`;
  }

  // ==================== 조회 ====================

  /**
   * 구매 기록 조회
   */
  static getPurchaseHistory(
    sessionId: string,
    buyerFactionId: string
  ): IIntelPurchase[] {
    const purchases = this.purchases.get(sessionId) || [];
    return purchases
      .filter(p => p.buyerFactionId === buyerFactionId)
      .sort((a, b) => b.purchasedAt.getTime() - a.purchasedAt.getTime());
  }

  /**
   * 가격표 조회
   */
  static getPriceList(): Record<IntelCategory, number> {
    return { ...INTEL_BASE_PRICES };
  }

  /**
   * 상품 신선도 업데이트 (주기적 호출)
   */
  static updateFreshness(sessionId: string): void {
    const products = this.products.get(sessionId) || [];
    const now = new Date();
    
    for (const product of products) {
      const age = (now.getTime() - product.collectedAt.getTime()) / (1000 * 60 * 60);  // hours
      product.freshness = Math.max(0, 100 - age * 2);  // 시간당 2% 감소
      
      // 신선도에 따라 가격 조정
      if (product.freshness < 50) {
        product.currentPrice = Math.round(product.basePrice * (product.freshness / 100));
      }
    }
  }
}

export default InfoBrokerService;















