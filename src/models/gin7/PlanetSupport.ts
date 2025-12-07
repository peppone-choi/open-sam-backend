import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * 폭동 상태 타입
 */
export type RiotStatus = 
  | 'none'              // 정상
  | 'unrest'            // 불안 (경고 상태)
  | 'protest'           // 시위 (생산성 감소)
  | 'riot'              // 폭동 (시설 파괴 위험)
  | 'rebellion'         // 반란 (점령 위험)
  | 'suppressed';       // 진압됨 (회복 중)

/**
 * 지지율 영향 요소
 */
export interface ISupportFactor {
  factorType: string;
  value: number;          // -100 ~ +100
  description: string;
  expiresAt?: Date;       // 일시적 효과의 만료 시간
}

/**
 * 치안 영향 요소
 */
export interface ISecurityFactor {
  factorType: string;
  value: number;          // -100 ~ +100
  description: string;
}

/**
 * 폭동 기록
 */
export interface IRiotRecord {
  riotId: string;
  startedAt: Date;
  endedAt?: Date;
  peakSeverity: RiotStatus;
  damageAmount: number;
  casualties: number;
  suppressionMethod?: 'military' | 'negotiation' | 'concession';
  resolutionNote?: string;
}

/**
 * 행성 지지율/치안 인터페이스
 */
export interface IPlanetSupport extends Document {
  supportId: string;
  sessionId: string;
  planetId: string;
  planetName: string;
  factionId: string;
  
  // 지지율 (0-100)
  supportRate: number;              // 현재 지지율
  baseSupportRate: number;          // 기본 지지율 (역사적)
  supportTrend: number;             // 변화 추세 (-10 ~ +10)
  
  // 치안 (0-100)
  securityLevel: number;            // 현재 치안 수준
  policeStrength: number;           // 경찰력
  militaryPresence: number;         // 군대 주둔 효과
  
  // 폭동 상태
  riotStatus: RiotStatus;
  riotSeverity: number;             // 0-100 (폭동 심각도)
  riotDuration: number;             // 폭동 지속 일수
  
  // 영향 요소
  supportFactors: ISupportFactor[];
  securityFactors: ISecurityFactor[];
  
  // 생산성 패널티
  productionPenalty: number;        // 0-1 (1 = 정상, 0 = 완전 중단)
  tradePenalty: number;             // 교역 패널티
  
  // 통계
  lastTaxCollection: number;        // 마지막 세금 징수액
  taxComplianceRate: number;        // 납세 순응률 (0-1)
  
  // 역사 기록
  riotHistory: IRiotRecord[];
  supportHistory: Array<{
    gameDay: number;
    supportRate: number;
    securityLevel: number;
  }>;
  
  // 메타데이터
  lastUpdated: Date;
  data: Record<string, unknown>;
}

const SupportFactorSchema = new Schema<ISupportFactor>({
  factorType: { type: String, required: true },
  value: { type: Number, required: true, min: -100, max: 100 },
  description: { type: String, required: true },
  expiresAt: Date
}, { _id: false });

const SecurityFactorSchema = new Schema<ISecurityFactor>({
  factorType: { type: String, required: true },
  value: { type: Number, required: true, min: -100, max: 100 },
  description: { type: String, required: true }
}, { _id: false });

const RiotRecordSchema = new Schema<IRiotRecord>({
  riotId: { type: String, required: true },
  startedAt: { type: Date, required: true },
  endedAt: Date,
  peakSeverity: {
    type: String,
    enum: ['none', 'unrest', 'protest', 'riot', 'rebellion', 'suppressed'],
    required: true
  },
  damageAmount: { type: Number, default: 0 },
  casualties: { type: Number, default: 0 },
  suppressionMethod: {
    type: String,
    enum: ['military', 'negotiation', 'concession']
  },
  resolutionNote: String
}, { _id: false });

const PlanetSupportSchema = new Schema<IPlanetSupport>({
  supportId: { type: String, required: true },
  sessionId: { type: String, required: true },
  planetId: { type: String, required: true },
  planetName: { type: String, required: true },
  factionId: { type: String, required: true },
  
  supportRate: { type: Number, default: 60, min: 0, max: 100 },
  baseSupportRate: { type: Number, default: 60, min: 0, max: 100 },
  supportTrend: { type: Number, default: 0, min: -10, max: 10 },
  
  securityLevel: { type: Number, default: 50, min: 0, max: 100 },
  policeStrength: { type: Number, default: 50 },
  militaryPresence: { type: Number, default: 0 },
  
  riotStatus: {
    type: String,
    enum: ['none', 'unrest', 'protest', 'riot', 'rebellion', 'suppressed'],
    default: 'none'
  },
  riotSeverity: { type: Number, default: 0, min: 0, max: 100 },
  riotDuration: { type: Number, default: 0 },
  
  supportFactors: { type: [SupportFactorSchema], default: [] },
  securityFactors: { type: [SecurityFactorSchema], default: [] },
  
  productionPenalty: { type: Number, default: 1, min: 0, max: 1 },
  tradePenalty: { type: Number, default: 1, min: 0, max: 1 },
  
  lastTaxCollection: { type: Number, default: 0 },
  taxComplianceRate: { type: Number, default: 0.9, min: 0, max: 1 },
  
  riotHistory: { type: [RiotRecordSchema], default: [] },
  supportHistory: { type: [{
    gameDay: { type: Number, required: true },
    supportRate: { type: Number, required: true },
    securityLevel: { type: Number, required: true }
  }], default: [] },
  
  lastUpdated: { type: Date, default: Date.now },
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

// Indexes
PlanetSupportSchema.index({ supportId: 1, sessionId: 1 }, { unique: true });
PlanetSupportSchema.index({ sessionId: 1, planetId: 1 }, { unique: true });
PlanetSupportSchema.index({ sessionId: 1, factionId: 1 });
PlanetSupportSchema.index({ sessionId: 1, riotStatus: 1 });
PlanetSupportSchema.index({ sessionId: 1, supportRate: 1 });

// Methods

/**
 * 지지율 계산
 * 각종 요소를 반영하여 최종 지지율 계산
 */
PlanetSupportSchema.methods.calculateEffectiveSupportRate = function(): number {
  let support = this.baseSupportRate;
  
  // 지지율 요소 적용
  const now = new Date();
  for (const factor of this.supportFactors) {
    // 만료된 요소 제외
    if (factor.expiresAt && factor.expiresAt < now) continue;
    support += factor.value;
  }
  
  // 범위 제한
  return Math.max(0, Math.min(100, support));
};

/**
 * 치안 수준 계산
 */
PlanetSupportSchema.methods.calculateEffectiveSecurityLevel = function(): number {
  let security = this.policeStrength;
  
  // 군대 주둔 효과 (최대 30 추가)
  security += Math.min(30, this.militaryPresence * 0.3);
  
  // 치안 요소 적용
  for (const factor of this.securityFactors) {
    security += factor.value;
  }
  
  // 범위 제한
  return Math.max(0, Math.min(100, security));
};

/**
 * 폭동 위험도 계산
 */
PlanetSupportSchema.methods.calculateRiotRisk = function(): number {
  const support = this.calculateEffectiveSupportRate();
  const security = this.calculateEffectiveSecurityLevel();
  
  // 지지율이 낮고 치안이 낮을수록 폭동 위험 증가
  const supportRisk = Math.max(0, (50 - support) * 2);  // 지지율 50 이하면 위험 증가
  const securityMitigation = security * 0.5;            // 치안이 위험 완화
  
  const risk = Math.max(0, supportRisk - securityMitigation);
  return Math.min(100, risk);
};

/**
 * 납세 순응률 계산
 */
PlanetSupportSchema.methods.calculateTaxCompliance = function(): number {
  const support = this.calculateEffectiveSupportRate();
  const security = this.calculateEffectiveSecurityLevel();
  
  // 기본 순응률 (지지율 기반)
  let compliance = support / 100;
  
  // 치안이 높으면 강제 징수 가능
  compliance = Math.min(1, compliance + (security / 100) * 0.3);
  
  // 폭동 중이면 순응률 감소
  if (this.riotStatus === 'protest') compliance *= 0.7;
  else if (this.riotStatus === 'riot') compliance *= 0.4;
  else if (this.riotStatus === 'rebellion') compliance *= 0.1;
  
  return compliance;
};

/**
 * 생산성 패널티 계산
 */
PlanetSupportSchema.methods.updateProductionPenalty = function(): void {
  switch (this.riotStatus) {
    case 'none':
    case 'suppressed':
      this.productionPenalty = 1;
      break;
    case 'unrest':
      this.productionPenalty = 0.9;
      break;
    case 'protest':
      this.productionPenalty = 0.7;
      this.tradePenalty = 0.8;
      break;
    case 'riot':
      this.productionPenalty = 0.4;
      this.tradePenalty = 0.5;
      break;
    case 'rebellion':
      this.productionPenalty = 0.1;
      this.tradePenalty = 0.1;
      break;
  }
};

/**
 * 폭동 상태 업데이트
 */
PlanetSupportSchema.methods.updateRiotStatus = function(): void {
  const riotRisk = this.calculateRiotRisk();
  const security = this.calculateEffectiveSecurityLevel();
  
  // 현재 폭동 상태에 따른 처리
  if (this.riotStatus === 'none') {
    // 폭동 발생 체크
    if (riotRisk > 70) {
      this.riotStatus = 'unrest';
      this.riotSeverity = 20;
      this.riotDuration = 1;
    }
  } else if (this.riotStatus === 'suppressed') {
    // 회복 중
    this.riotSeverity = Math.max(0, this.riotSeverity - 10);
    if (this.riotSeverity <= 0) {
      this.riotStatus = 'none';
      this.riotDuration = 0;
    }
  } else {
    // 기존 폭동 상태
    this.riotDuration++;
    
    // 치안이 높으면 진정, 낮으면 악화
    if (security > 70) {
      this.riotSeverity = Math.max(0, this.riotSeverity - 15);
    } else if (security < 30) {
      this.riotSeverity = Math.min(100, this.riotSeverity + 10);
    }
    
    // 심각도에 따른 상태 변경
    if (this.riotSeverity <= 10) {
      this.riotStatus = 'suppressed';
    } else if (this.riotSeverity <= 30) {
      this.riotStatus = 'unrest';
    } else if (this.riotSeverity <= 50) {
      this.riotStatus = 'protest';
    } else if (this.riotSeverity <= 80) {
      this.riotStatus = 'riot';
    } else {
      this.riotStatus = 'rebellion';
    }
  }
  
  this.updateProductionPenalty();
};

export const PlanetSupport: Model<IPlanetSupport> = 
  mongoose.models.PlanetSupport || mongoose.model<IPlanetSupport>('PlanetSupport', PlanetSupportSchema);

