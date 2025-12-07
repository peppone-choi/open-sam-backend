import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * 예산 카테고리 타입
 */
export type BudgetCategory = 
  | 'defense'          // 국방비 - 함대/군사 유지
  | 'administration'   // 행정비 - 관료/시설 운영
  | 'construction'     // 건설비 - 시설 건설/업그레이드
  | 'research'         // 연구비 - 기술 개발
  | 'welfare'          // 복지비 - 민심 관리
  | 'intelligence'     // 정보비 - 첩보 활동
  | 'diplomacy'        // 외교비 - 외교 활동
  | 'reserve';         // 예비비

/**
 * 예산 항목
 */
export interface IBudgetAllocation {
  category: BudgetCategory;
  allocated: number;        // 배정액
  spent: number;            // 집행액
  locked: number;           // 예약된 금액 (건설 중 등)
  priority: number;         // 우선순위 (1-10)
  autoAdjust: boolean;      // 자동 조정 여부
}

/**
 * 세금 정책
 */
export interface ITaxPolicy {
  baseTaxRate: number;          // 기본 세율 (0-0.5)
  warTaxRate: number;           // 전시 추가세 (0-0.3)
  luxuryTaxRate: number;        // 사치세 (0-0.2)
  tradeTaxRate: number;         // 교역세 (0-0.15)
  isEmergencyTax: boolean;      // 비상 과세 여부
  taxExemptions: string[];      // 면세 행성 ID 목록
}

/**
 * 세금 징수 기록
 */
export interface ITaxRecord {
  gameDay: number;
  totalCollected: number;
  byCategory: {
    income: number;           // 소득세
    trade: number;            // 교역세
    property: number;         // 재산세
    special: number;          // 특별세
  };
  byPlanet: Array<{
    planetId: string;
    planetName: string;
    amount: number;
    population: number;
    effectiveTaxRate: number;
  }>;
  unpaidAmount: number;       // 미납액
}

/**
 * 지출 기록
 */
export interface IExpenseRecord {
  expenseId: string;
  timestamp: Date;
  gameDay: number;
  category: BudgetCategory;
  amount: number;
  description: string;
  authorizedBy?: string;      // 승인자 캐릭터 ID
  departmentId?: string;      // 담당 부서
}

/**
 * 국고 인터페이스
 */
export interface INationalTreasury extends Document {
  treasuryId: string;
  sessionId: string;
  factionId: string;
  factionName: string;
  
  // 잔액 정보
  balance: number;            // 현재 잔액
  reserveFund: number;        // 예비금 (긴급 상황용)
  frozenFunds: number;        // 동결 자금 (분쟁 중 등)
  
  // 세금 정책
  taxPolicy: ITaxPolicy;
  
  // 예산 배분
  budgetAllocations: IBudgetAllocation[];
  totalBudget: number;        // 총 예산
  fiscalYear: number;         // 회계연도 (게임 내 년도)
  
  // 재정 통계
  lastDayIncome: number;
  lastDayExpense: number;
  lastMonthIncome: number;
  lastMonthExpense: number;
  
  // 기록
  taxHistory: ITaxRecord[];
  expenseHistory: IExpenseRecord[];
  
  // 재정 상태
  creditRating: 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC' | 'D';
  debtAmount: number;         // 부채 총액
  interestRate: number;       // 이자율
  
  // 메타데이터
  lastUpdated: Date;
  data: Record<string, unknown>;
}

const BudgetAllocationSchema = new Schema<IBudgetAllocation>({
  category: {
    type: String,
    enum: ['defense', 'administration', 'construction', 'research', 'welfare', 'intelligence', 'diplomacy', 'reserve'],
    required: true
  },
  allocated: { type: Number, default: 0, min: 0 },
  spent: { type: Number, default: 0, min: 0 },
  locked: { type: Number, default: 0, min: 0 },
  priority: { type: Number, default: 5, min: 1, max: 10 },
  autoAdjust: { type: Boolean, default: false }
}, { _id: false });

const TaxPolicySchema = new Schema<ITaxPolicy>({
  baseTaxRate: { type: Number, default: 0.1, min: 0, max: 0.5 },
  warTaxRate: { type: Number, default: 0, min: 0, max: 0.3 },
  luxuryTaxRate: { type: Number, default: 0.05, min: 0, max: 0.2 },
  tradeTaxRate: { type: Number, default: 0.05, min: 0, max: 0.15 },
  isEmergencyTax: { type: Boolean, default: false },
  taxExemptions: { type: [String], default: [] }
}, { _id: false });

const TaxRecordSchema = new Schema<ITaxRecord>({
  gameDay: { type: Number, required: true },
  totalCollected: { type: Number, required: true },
  byCategory: {
    income: { type: Number, default: 0 },
    trade: { type: Number, default: 0 },
    property: { type: Number, default: 0 },
    special: { type: Number, default: 0 }
  },
  byPlanet: [{
    planetId: { type: String, required: true },
    planetName: { type: String, required: true },
    amount: { type: Number, required: true },
    population: { type: Number, required: true },
    effectiveTaxRate: { type: Number, required: true }
  }],
  unpaidAmount: { type: Number, default: 0 }
}, { _id: false });

const ExpenseRecordSchema = new Schema<IExpenseRecord>({
  expenseId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  gameDay: { type: Number, required: true },
  category: {
    type: String,
    enum: ['defense', 'administration', 'construction', 'research', 'welfare', 'intelligence', 'diplomacy', 'reserve'],
    required: true
  },
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  authorizedBy: String,
  departmentId: String
}, { _id: false });

const NationalTreasurySchema = new Schema<INationalTreasury>({
  treasuryId: { type: String, required: true },
  sessionId: { type: String, required: true },
  factionId: { type: String, required: true },
  factionName: { type: String, required: true },
  
  balance: { type: Number, default: 100000, min: 0 },
  reserveFund: { type: Number, default: 10000, min: 0 },
  frozenFunds: { type: Number, default: 0, min: 0 },
  
  taxPolicy: { type: TaxPolicySchema, default: () => ({}) },
  
  budgetAllocations: { type: [BudgetAllocationSchema], default: () => getDefaultBudgetAllocations() },
  totalBudget: { type: Number, default: 100000 },
  fiscalYear: { type: Number, default: 796 },
  
  lastDayIncome: { type: Number, default: 0 },
  lastDayExpense: { type: Number, default: 0 },
  lastMonthIncome: { type: Number, default: 0 },
  lastMonthExpense: { type: Number, default: 0 },
  
  taxHistory: { type: [TaxRecordSchema], default: [] },
  expenseHistory: { type: [ExpenseRecordSchema], default: [] },
  
  creditRating: {
    type: String,
    enum: ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'D'],
    default: 'A'
  },
  debtAmount: { type: Number, default: 0, min: 0 },
  interestRate: { type: Number, default: 0.05 },
  
  lastUpdated: { type: Date, default: Date.now },
  data: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

// 기본 예산 배분
function getDefaultBudgetAllocations(): IBudgetAllocation[] {
  return [
    { category: 'defense', allocated: 30000, spent: 0, locked: 0, priority: 9, autoAdjust: false },
    { category: 'administration', allocated: 20000, spent: 0, locked: 0, priority: 8, autoAdjust: true },
    { category: 'construction', allocated: 15000, spent: 0, locked: 0, priority: 6, autoAdjust: true },
    { category: 'research', allocated: 10000, spent: 0, locked: 0, priority: 5, autoAdjust: true },
    { category: 'welfare', allocated: 10000, spent: 0, locked: 0, priority: 7, autoAdjust: true },
    { category: 'intelligence', allocated: 5000, spent: 0, locked: 0, priority: 4, autoAdjust: false },
    { category: 'diplomacy', allocated: 5000, spent: 0, locked: 0, priority: 3, autoAdjust: true },
    { category: 'reserve', allocated: 5000, spent: 0, locked: 0, priority: 10, autoAdjust: false }
  ];
}

// Indexes
NationalTreasurySchema.index({ treasuryId: 1, sessionId: 1 }, { unique: true });
NationalTreasurySchema.index({ sessionId: 1, factionId: 1 }, { unique: true });
NationalTreasurySchema.index({ sessionId: 1, creditRating: 1 });

// Methods
NationalTreasurySchema.methods.getAvailableBudget = function(category: BudgetCategory): number {
  const allocation = this.budgetAllocations.find((a: IBudgetAllocation) => a.category === category);
  if (!allocation) return 0;
  return Math.max(0, allocation.allocated - allocation.spent - allocation.locked);
};

NationalTreasurySchema.methods.getTotalAvailableFunds = function(): number {
  return this.balance - this.frozenFunds;
};

NationalTreasurySchema.methods.getEffectiveTaxRate = function(): number {
  const policy = this.taxPolicy;
  let rate = policy.baseTaxRate;
  if (policy.isEmergencyTax) {
    rate += policy.warTaxRate;
  }
  return Math.min(rate, 0.5);  // 최대 50%
};

NationalTreasurySchema.methods.canAfford = function(amount: number, category: BudgetCategory): boolean {
  const availableBudget = this.getAvailableBudget(category);
  const availableFunds = this.getTotalAvailableFunds();
  return availableBudget >= amount && availableFunds >= amount;
};

// 신용 등급 계산
NationalTreasurySchema.methods.recalculateCreditRating = function(): void {
  const debtRatio = this.debtAmount / Math.max(this.balance + this.lastMonthIncome, 1);
  const incomeRatio = this.lastMonthIncome / Math.max(this.lastMonthExpense, 1);
  
  let score = 100;
  
  // 부채 비율에 따른 감점
  if (debtRatio > 0.5) score -= 30;
  else if (debtRatio > 0.3) score -= 20;
  else if (debtRatio > 0.1) score -= 10;
  
  // 수입/지출 비율에 따른 감점
  if (incomeRatio < 0.5) score -= 30;
  else if (incomeRatio < 0.8) score -= 20;
  else if (incomeRatio < 1.0) score -= 10;
  
  // 잔액에 따른 감점
  if (this.balance < 10000) score -= 20;
  else if (this.balance < 50000) score -= 10;
  
  // 등급 결정
  if (score >= 90) this.creditRating = 'AAA';
  else if (score >= 80) this.creditRating = 'AA';
  else if (score >= 70) this.creditRating = 'A';
  else if (score >= 60) this.creditRating = 'BBB';
  else if (score >= 50) this.creditRating = 'BB';
  else if (score >= 40) this.creditRating = 'B';
  else if (score >= 20) this.creditRating = 'CCC';
  else this.creditRating = 'D';
};

export const NationalTreasury: Model<INationalTreasury> = 
  mongoose.models.NationalTreasury || mongoose.model<INationalTreasury>('NationalTreasury', NationalTreasurySchema);

