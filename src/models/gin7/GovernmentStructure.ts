import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * 정부 유형
 */
export type GovernmentType = 
  | 'empire'              // 제국 (황제-재상-상서 체계)
  | 'alliance'            // 동맹 (평의회-선거 체계)
  | 'kingdom'             // 왕국 (왕-귀족 체계)
  | 'republic';           // 공화국 (대통령-내각 체계)

/**
 * 직책 타입
 */
export type PositionType = 
  // 제국 직책
  | 'emperor'             // 황제
  | 'prime_minister'      // 재상/국무총리
  | 'marshal'             // 원수
  | 'finance_secretary'   // 재무상서
  | 'military_secretary'  // 군무상서
  | 'interior_secretary'  // 내무상서
  | 'foreign_secretary'   // 외무상서
  | 'intelligence_chief'  // 정보국장
  // 동맹 직책
  | 'council_chair'       // 평의회 의장
  | 'fleet_commander'     // 함대사령관
  | 'defense_chair'       // 국방위원장
  | 'economy_chair'       // 경제위원장
  | 'justice_chair'       // 사법위원장
  // 귀족 작위
  | 'duke'                // 공작
  | 'marquis'             // 후작
  | 'count'               // 백작
  | 'viscount'            // 자작
  | 'baron';              // 남작

/**
 * 권한 타입
 */
export type AuthorityType = 
  | 'all'                 // 모든 권한
  | 'military'            // 군사권
  | 'finance'             // 재정권
  | 'personnel'           // 인사권
  | 'diplomacy'           // 외교권
  | 'intelligence'        // 정보권
  | 'justice'             // 사법권
  | 'legislation'         // 입법권
  | 'veto';               // 거부권

/**
 * 직책 보유자
 */
export interface IPositionHolder {
  positionId: string;
  positionType: PositionType;
  positionName: string;           // 표시 이름
  holderId?: string;              // 캐릭터 ID
  holderName?: string;            // 캐릭터 이름
  appointedAt?: Date;
  appointedBy?: string;           // 임명자 캐릭터 ID
  term?: number;                  // 임기 (일 단위, 0 = 무기한)
  termExpiresAt?: Date;
  authorities: AuthorityType[];   // 부여된 권한
  delegatedTo?: string[];         // 위임된 직책 ID
  salary: number;                 // 급여
  isVacant: boolean;
}

/**
 * 작위/영지
 */
export interface INobilityTitle {
  titleId: string;
  titleType: PositionType;        // duke, marquis, count 등
  titleName: string;              // "하이네센 공작" 등
  holderId?: string;
  holderName?: string;
  grantedAt?: Date;
  grantedBy?: string;
  fiefdoms: string[];             // 영지 행성 ID 목록
  annualIncome: number;           // 연간 수입
  privileges: string[];           // 특권 목록
  isHereditary: boolean;          // 세습 여부
  heirId?: string;                // 후계자 ID
  successionDispute?: boolean;    // 상속 분쟁 중
}

/**
 * 선거 정보
 */
export interface IElection {
  electionId: string;
  electionType: 'council_chair' | 'position_vote' | 'policy_vote' | 'impeachment';
  title: string;
  description?: string;
  candidates: Array<{
    characterId: string;
    characterName: string;
    platform?: string;            // 공약
    votes: number;
  }>;
  status: 'registration' | 'voting' | 'counting' | 'completed' | 'cancelled';
  registrationStart: Date;
  registrationEnd: Date;
  votingStart: Date;
  votingEnd: Date;
  winnerId?: string;
  winnerName?: string;
  totalVotes: number;
  quorum: number;                 // 정족수
  votedBy: string[];              // 투표한 캐릭터 ID 목록
}

/**
 * 탄핵 절차
 */
export interface IImpeachment {
  impeachmentId: string;
  targetId: string;               // 탄핵 대상 캐릭터 ID
  targetName: string;
  targetPosition: PositionType;
  charges: string[];              // 탄핵 사유
  initiatedBy: string;
  initiatedAt: Date;
  supportVotes: number;
  opposeVotes: number;
  votedBy: string[];
  status: 'initiated' | 'voting' | 'passed' | 'rejected';
  requiredMajority: number;       // 통과 요건 (%)
  deadline: Date;
}

/**
 * 칙령/법령
 */
export interface IDecree {
  decreeId: string;
  decreeType: 'imperial' | 'council' | 'emergency';
  title: string;
  content: string;
  issuedBy: string;
  issuedByName: string;
  issuedAt: Date;
  effectiveFrom: Date;
  expiresAt?: Date;
  effects: Array<{
    effectType: string;
    target: string;               // 'all' | planetId | factionId
    value: number;
    description: string;
  }>;
  isActive: boolean;
  revokedAt?: Date;
  revokedBy?: string;
}

/**
 * 정부 구조 인터페이스
 */
export interface IGovernmentStructure extends Document {
  governmentId: string;
  sessionId: string;
  factionId: string;
  factionName: string;
  
  // 정부 유형
  governmentType: GovernmentType;
  governmentName: string;         // "은하제국", "자유행성동맹" 등
  
  // 직책
  positions: IPositionHolder[];
  
  // 귀족/작위 (제국용)
  nobilityTitles: INobilityTitle[];
  
  // 선거 (동맹용)
  elections: IElection[];
  currentElection?: IElection;
  electionCycle: number;          // 선거 주기 (일)
  nextElectionDate?: Date;
  
  // 탄핵
  impeachments: IImpeachment[];
  
  // 칙령/법령
  decrees: IDecree[];
  
  // 설정
  config: {
    allowElection: boolean;
    allowImpeachment: boolean;
    allowNobility: boolean;
    minRankForVote: string;       // 투표 자격 최소 계급
    impeachmentThreshold: number; // 탄핵 통과 요건 (%)
    termLength: number;           // 기본 임기 (일)
  };
  
  // 메타데이터
  foundedAt: Date;
  lastUpdated: Date;
  data: Record<string, unknown>;
}

const PositionHolderSchema = new Schema<IPositionHolder>({
  positionId: { type: String, required: true },
  positionType: {
    type: String,
    enum: [
      'emperor', 'prime_minister', 'marshal', 
      'finance_secretary', 'military_secretary', 'interior_secretary',
      'foreign_secretary', 'intelligence_chief',
      'council_chair', 'fleet_commander', 
      'defense_chair', 'economy_chair', 'justice_chair',
      'duke', 'marquis', 'count', 'viscount', 'baron'
    ],
    required: true
  },
  positionName: { type: String, required: true },
  holderId: String,
  holderName: String,
  appointedAt: Date,
  appointedBy: String,
  term: { type: Number, default: 0 },
  termExpiresAt: Date,
  authorities: {
    type: [String],
    enum: ['all', 'military', 'finance', 'personnel', 'diplomacy', 'intelligence', 'justice', 'legislation', 'veto'],
    default: []
  },
  delegatedTo: { type: [String], default: [] },
  salary: { type: Number, default: 0 },
  isVacant: { type: Boolean, default: true }
}, { _id: false });

const NobilityTitleSchema = new Schema<INobilityTitle>({
  titleId: { type: String, required: true },
  titleType: {
    type: String,
    enum: ['duke', 'marquis', 'count', 'viscount', 'baron'],
    required: true
  },
  titleName: { type: String, required: true },
  holderId: String,
  holderName: String,
  grantedAt: Date,
  grantedBy: String,
  fiefdoms: { type: [String], default: [] },
  annualIncome: { type: Number, default: 0 },
  privileges: { type: [String], default: [] },
  isHereditary: { type: Boolean, default: true },
  heirId: String,
  successionDispute: { type: Boolean, default: false }
}, { _id: false });

const ElectionSchema = new Schema<IElection>({
  electionId: { type: String, required: true },
  electionType: {
    type: String,
    enum: ['council_chair', 'position_vote', 'policy_vote', 'impeachment'],
    required: true
  },
  title: { type: String, required: true },
  description: String,
  candidates: [{
    characterId: { type: String, required: true },
    characterName: { type: String, required: true },
    platform: String,
    votes: { type: Number, default: 0 }
  }],
  status: {
    type: String,
    enum: ['registration', 'voting', 'counting', 'completed', 'cancelled'],
    default: 'registration'
  },
  registrationStart: { type: Date, required: true },
  registrationEnd: { type: Date, required: true },
  votingStart: { type: Date, required: true },
  votingEnd: { type: Date, required: true },
  winnerId: String,
  winnerName: String,
  totalVotes: { type: Number, default: 0 },
  quorum: { type: Number, default: 0 },
  votedBy: { type: [String], default: [] }
}, { _id: false });

const ImpeachmentSchema = new Schema<IImpeachment>({
  impeachmentId: { type: String, required: true },
  targetId: { type: String, required: true },
  targetName: { type: String, required: true },
  targetPosition: { type: String, required: true },
  charges: { type: [String], required: true },
  initiatedBy: { type: String, required: true },
  initiatedAt: { type: Date, default: Date.now },
  supportVotes: { type: Number, default: 1 },
  opposeVotes: { type: Number, default: 0 },
  votedBy: { type: [String], default: [] },
  status: {
    type: String,
    enum: ['initiated', 'voting', 'passed', 'rejected'],
    default: 'initiated'
  },
  requiredMajority: { type: Number, default: 66 },
  deadline: { type: Date, required: true }
}, { _id: false });

const DecreeSchema = new Schema<IDecree>({
  decreeId: { type: String, required: true },
  decreeType: {
    type: String,
    enum: ['imperial', 'council', 'emergency'],
    required: true
  },
  title: { type: String, required: true },
  content: { type: String, required: true },
  issuedBy: { type: String, required: true },
  issuedByName: { type: String, required: true },
  issuedAt: { type: Date, default: Date.now },
  effectiveFrom: { type: Date, default: Date.now },
  expiresAt: Date,
  effects: [{
    effectType: { type: String, required: true },
    target: { type: String, default: 'all' },
    value: { type: Number, default: 0 },
    description: { type: String, required: true }
  }],
  isActive: { type: Boolean, default: true },
  revokedAt: Date,
  revokedBy: String
}, { _id: false });

const GovernmentStructureSchema = new Schema<IGovernmentStructure>({
  governmentId: { type: String, required: true },
  sessionId: { type: String, required: true },
  factionId: { type: String, required: true },
  factionName: { type: String, required: true },
  
  governmentType: {
    type: String,
    enum: ['empire', 'alliance', 'kingdom', 'republic'],
    required: true
  },
  governmentName: { type: String, required: true },
  
  positions: { type: [PositionHolderSchema], default: [] },
  nobilityTitles: { type: [NobilityTitleSchema], default: [] },
  elections: { type: [ElectionSchema], default: [] },
  currentElection: ElectionSchema,
  electionCycle: { type: Number, default: 365 },
  nextElectionDate: Date,
  
  impeachments: { type: [ImpeachmentSchema], default: [] },
  decrees: { type: [DecreeSchema], default: [] },
  
  config: {
    allowElection: { type: Boolean, default: false },
    allowImpeachment: { type: Boolean, default: true },
    allowNobility: { type: Boolean, default: false },
    minRankForVote: { type: String, default: 'lieutenant' },
    impeachmentThreshold: { type: Number, default: 66 },
    termLength: { type: Number, default: 365 }
  },
  
  foundedAt: { type: Date, default: Date.now },
  lastUpdated: { type: Date, default: Date.now },
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

// Indexes
GovernmentStructureSchema.index({ governmentId: 1, sessionId: 1 }, { unique: true });
GovernmentStructureSchema.index({ sessionId: 1, factionId: 1 }, { unique: true });
GovernmentStructureSchema.index({ sessionId: 1, governmentType: 1 });

// Methods

/**
 * 직책에 사람 임명
 */
GovernmentStructureSchema.methods.appointToPosition = function(
  positionId: string,
  characterId: string,
  characterName: string,
  appointedBy: string
): boolean {
  const position = this.positions.find((p: IPositionHolder) => p.positionId === positionId);
  if (!position) return false;

  position.holderId = characterId;
  position.holderName = characterName;
  position.appointedAt = new Date();
  position.appointedBy = appointedBy;
  position.isVacant = false;

  if (position.term > 0) {
    position.termExpiresAt = new Date(Date.now() + position.term * 24 * 60 * 60 * 1000);
  }

  return true;
};

/**
 * 직책에서 해임
 */
GovernmentStructureSchema.methods.removeFromPosition = function(
  positionId: string
): boolean {
  const position = this.positions.find((p: IPositionHolder) => p.positionId === positionId);
  if (!position) return false;

  position.holderId = undefined;
  position.holderName = undefined;
  position.appointedAt = undefined;
  position.appointedBy = undefined;
  position.termExpiresAt = undefined;
  position.isVacant = true;

  return true;
};

/**
 * 캐릭터의 권한 확인
 */
GovernmentStructureSchema.methods.hasAuthority = function(
  characterId: string,
  authority: AuthorityType
): boolean {
  // 해당 캐릭터가 가진 직책들 확인
  for (const position of this.positions) {
    if (position.holderId !== characterId) continue;
    if (position.authorities.includes('all')) return true;
    if (position.authorities.includes(authority)) return true;
  }
  return false;
};

/**
 * 기본 제국 직책 구조 생성
 */
export function createEmpirePositions(): IPositionHolder[] {
  return [
    {
      positionId: 'emperor',
      positionType: 'emperor',
      positionName: '황제',
      authorities: ['all'],
      salary: 100000,
      isVacant: true,
      term: 0
    },
    {
      positionId: 'prime_minister',
      positionType: 'prime_minister',
      positionName: '재상/국무총리',
      authorities: ['personnel', 'finance', 'legislation'],
      salary: 50000,
      isVacant: true,
      term: 0
    },
    {
      positionId: 'marshal',
      positionType: 'marshal',
      positionName: '원수',
      authorities: ['military'],
      salary: 50000,
      isVacant: true,
      term: 0
    },
    {
      positionId: 'finance_secretary',
      positionType: 'finance_secretary',
      positionName: '재무상서',
      authorities: ['finance'],
      salary: 30000,
      isVacant: true,
      term: 0
    },
    {
      positionId: 'military_secretary',
      positionType: 'military_secretary',
      positionName: '군무상서',
      authorities: ['personnel'],
      salary: 30000,
      isVacant: true,
      term: 0
    },
    {
      positionId: 'interior_secretary',
      positionType: 'interior_secretary',
      positionName: '내무상서',
      authorities: ['justice', 'intelligence'],
      salary: 30000,
      isVacant: true,
      term: 0
    },
    {
      positionId: 'foreign_secretary',
      positionType: 'foreign_secretary',
      positionName: '외무상서',
      authorities: ['diplomacy'],
      salary: 30000,
      isVacant: true,
      term: 0
    },
    {
      positionId: 'intelligence_chief',
      positionType: 'intelligence_chief',
      positionName: '정보국장',
      authorities: ['intelligence'],
      salary: 25000,
      isVacant: true,
      term: 0
    }
  ];
}

/**
 * 기본 동맹 직책 구조 생성
 */
export function createAlliancePositions(termLength: number = 365): IPositionHolder[] {
  return [
    {
      positionId: 'council_chair',
      positionType: 'council_chair',
      positionName: '최고평의회 의장',
      authorities: ['legislation', 'veto'],
      salary: 50000,
      isVacant: true,
      term: termLength
    },
    {
      positionId: 'fleet_commander',
      positionType: 'fleet_commander',
      positionName: '우주함대총사령관',
      authorities: ['military'],
      salary: 40000,
      isVacant: true,
      term: 0
    },
    {
      positionId: 'defense_chair',
      positionType: 'defense_chair',
      positionName: '국방위원장',
      authorities: ['military', 'personnel'],
      salary: 35000,
      isVacant: true,
      term: termLength
    },
    {
      positionId: 'economy_chair',
      positionType: 'economy_chair',
      positionName: '경제위원장',
      authorities: ['finance'],
      salary: 35000,
      isVacant: true,
      term: termLength
    },
    {
      positionId: 'justice_chair',
      positionType: 'justice_chair',
      positionName: '사법위원장',
      authorities: ['justice'],
      salary: 35000,
      isVacant: true,
      term: termLength
    }
  ];
}

export const GovernmentStructure: Model<IGovernmentStructure> = 
  mongoose.models.GovernmentStructure || 
  mongoose.model<IGovernmentStructure>('GovernmentStructure', GovernmentStructureSchema);

