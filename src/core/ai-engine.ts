import { IGeneral } from '../models/general.model';
import { ICity } from '../models/city.model';
import { INation } from '../models/nation.model';

// AI 난이도 레벨
export enum AIDifficulty {
  EASY = 'easy',
  NORMAL = 'normal',
  HARD = 'hard',
  EXPERT = 'expert'
}

// 장수 타입 분류
export enum GeneralType {
  WARRIOR = 1,        // 무장
  STRATEGIST = 2,     // 지장
  COMMANDER = 4       // 통솔장
}

// 외교 상태
export enum DiplomacyState {
  PEACE = 0,          // 평화
  WAR_DECLARED = 1,   // 선포
  RECRUITING = 2,     // 징병
  WAR_IMMINENT = 3,   // 직전
  WAR = 4             // 전쟁
}

// 커맨드 우선순위
export interface CommandPriority {
  category: 'domestic' | 'military' | 'diplomacy' | 'special';
  command: string;
  priority: number;
  weight: number;
}

// AI 정책 설정
export interface AIPolicyConfig {
  difficulty: AIDifficulty;
  
  // 자원 임계값
  minNationGold: number;
  minNationRice: number;
  minWarGold: number;
  minWarRice: number;
  minDevelopGold: number;
  minDevelopRice: number;
  
  // 군사 설정
  minWarLeadership: number;
  minWarCrew: number;
  properWarTrainAtmos: number;
  safeRecruitPopRatio: number;
  
  // 내정 설정
  targetDevelopmentRate: number;
  minCityPopulation: number;
  
  // 행동 우선순위
  actionPriorities: string[];
  
  // 자원 행동 설정
  minResourceActionAmount: number;
  maxResourceActionAmount: number;
}

// 도시 평가 결과
export interface CityEvaluation {
  cityId: number;
  score: number;
  developmentRate: number;
  population: number;
  agriculture: number;
  commerce: number;
  security: number;
  defense: number;
  wall: number;
  isFront: boolean;
  isSupply: boolean;
  priority: number;
}

// 커맨드 결정 결과
export interface CommandDecision {
  command: string;
  args: Record<string, any>;
  reason: string;
  priority: number;
}

// 난이도별 기본 정책
const DEFAULT_POLICIES: Record<AIDifficulty, Partial<AIPolicyConfig>> = {
  [AIDifficulty.EASY]: {
    minNationGold: 3000,
    minNationRice: 3000,
    minWarGold: 5000,
    minWarRice: 5000,
    minWarLeadership: 60,
    minWarCrew: 500,
    properWarTrainAtmos: 50,
    targetDevelopmentRate: 0.7
  },
  [AIDifficulty.NORMAL]: {
    minNationGold: 5000,
    minNationRice: 5000,
    minWarGold: 8000,
    minWarRice: 8000,
    minWarLeadership: 70,
    minWarCrew: 1000,
    properWarTrainAtmos: 70,
    targetDevelopmentRate: 0.8
  },
  [AIDifficulty.HARD]: {
    minNationGold: 8000,
    minNationRice: 8000,
    minWarGold: 12000,
    minWarRice: 12000,
    minWarLeadership: 80,
    minWarCrew: 1500,
    properWarTrainAtmos: 80,
    targetDevelopmentRate: 0.9
  },
  [AIDifficulty.EXPERT]: {
    minNationGold: 12000,
    minNationRice: 12000,
    minWarGold: 18000,
    minWarRice: 18000,
    minWarLeadership: 85,
    minWarCrew: 2000,
    properWarTrainAtmos: 90,
    targetDevelopmentRate: 0.95
  }
};

/**
 * AI 엔진 - NPC 장수와 국가의 자동 행동 결정
 */
export class AIEngine {
  private policy: AIPolicyConfig;
  private rng: () => number;
  
  // 캐시된 데이터
  private generalType: number = 0;
  private diplomacyState: DiplomacyState = DiplomacyState.PEACE;
  private cityEvaluations: Map<number, CityEvaluation> = new Map();
  
  constructor(
    difficulty: AIDifficulty = AIDifficulty.NORMAL,
    customPolicy?: Partial<AIPolicyConfig>,
    seed?: number
  ) {
    // 난이도별 기본 정책 + 커스텀 정책 병합
    this.policy = {
      difficulty,
      minResourceActionAmount: 100,
      maxResourceActionAmount: 50000,
      safeRecruitPopRatio: 0.6,
      minCityPopulation: 5000,
      actionPriorities: [
        'recruit',
        'train',
        'agriculture',
        'commerce',
        'security',
        'defense',
        'wall',
        'attack',
        'move'
      ],
      ...DEFAULT_POLICIES[difficulty],
      ...customPolicy
    } as AIPolicyConfig;
    
    // 간단한 PRNG (시드 기반)
    let s = seed ?? Math.floor(Math.random() * 1000000);
    this.rng = () => {
      s = Math.sin(s) * 10000;
      return s - Math.floor(s);
    };
  }
  
  /**
   * 장수의 다음 커맨드를 결정
   */
  async decideNextCommand(
    general: any,
    city: any,
    nation: any,
    env: any,
    cities?: any[]
  ): Promise<CommandDecision | null> {
    // 장수 타입 계산
    this.generalType = this.calculateGeneralType(general);
    
    // 외교 상태 계산
    this.diplomacyState = await this.calculateDiplomacyState(nation, env);
    
    // 도시 상태가 주어진 경우 평가
    if (cities) {
      await this.evaluateCities(cities, nation);
    }
    
    // 군주인 경우 국가 커맨드 우선 검토
    if (general.data?.officer_level === 12 || general.data?.officer_level === '군주') {
      const nationCommand = await this.decideNationCommand(general, nation, env);
      if (nationCommand) {
        return nationCommand;
      }
    }
    
    // 우선순위에 따라 행동 결정
    for (const actionName of this.policy.actionPriorities) {
      const decision = await this.evaluateAction(
        actionName,
        general,
        city,
        nation,
        env
      );
      
      if (decision) {
        return decision;
      }
    }
    
    // 기본 행동: 중립
    return {
      command: 'neutral',
      args: {},
      reason: 'no_action_available',
      priority: 0
    };
  }
  
  /**
   * 장수 타입 계산 (무장/지장/통솔장)
   */
  private calculateGeneralType(general: any): number {
    const leadership = general.data?.leadership || general.leadership || 50;
    const strength = Math.max(1, general.data?.strength || general.strength || 50);
    const intel = Math.max(1, general.data?.intel || general.intel || 50);
    
    let genType = 0;
    
    // 무장 vs 지장
    if (strength >= intel) {
      genType = GeneralType.WARRIOR;
      // 무지장 (둘 다 높음)
      if (intel >= strength * 0.8 && this.rng() < intel / strength / 2) {
        genType |= GeneralType.STRATEGIST;
      }
    } else {
      genType = GeneralType.STRATEGIST;
      // 지무장 (둘 다 높음)
      if (strength >= intel * 0.8 && this.rng() < strength / intel / 2) {
        genType |= GeneralType.WARRIOR;
      }
    }
    
    // 통솔장
    if (leadership >= this.policy.minWarLeadership) {
      genType |= GeneralType.COMMANDER;
    }
    
    return genType;
  }
  
  /**
   * 외교 상태 계산
   */
  private async calculateDiplomacyState(
    nation: any,
    env: any
  ): Promise<DiplomacyState> {
    // 실제 구현에서는 DB에서 외교 관계를 조회
    // 여기서는 간단히 임시 구현
    
    const yearMonth = (env.year * 12 + env.month);
    const startYearMonth = (env.startyear * 12 + 5);
    
    // 게임 초기에는 평화
    if (yearMonth <= startYearMonth + 24) {
      return DiplomacyState.PEACE;
    }
    
    // nation의 war 상태나 diplomacy 테이블 확인 필요
    // 임시로 평화 반환
    return DiplomacyState.PEACE;
  }
  
  /**
   * 도시 평가
   */
  evaluateCity(city: any): CityEvaluation {
    // 캐시 확인
    if (this.cityEvaluations.has(city.city)) {
      return this.cityEvaluations.get(city.city)!;
    }
    
    // 개발도 계산
    const rates = this.calculateCityDevelopmentRates(city);
    
    // 종합 점수 계산
    const avgDevelopmentRate = (
      rates.pop + rates.agri + rates.comm +
      rates.secu + rates.def + rates.wall
    ) / 6;
    
    // 전략적 중요도
    const isFront = city.front > 0;
    const isSupply = city.supply > 0;
    
    let priority = avgDevelopmentRate * 100;
    
    // 전방 도시는 우선순위 증가
    if (isFront) {
      priority += 50;
    }
    
    // 보급 도시는 우선순위 증가
    if (isSupply) {
      priority += 30;
    }
    
    const evaluation: CityEvaluation = {
      cityId: city.city,
      score: priority,
      developmentRate: avgDevelopmentRate,
      population: city.pop / city.pop_max,
      agriculture: rates.agri,
      commerce: rates.comm,
      security: rates.secu,
      defense: rates.def,
      wall: rates.wall,
      isFront,
      isSupply,
      priority
    };
    
    this.cityEvaluations.set(city.city, evaluation);
    return evaluation;
  }
  
  /**
   * 도시 개발도 계산
   */
  private calculateCityDevelopmentRates(city: any) {
    return {
      trust: city.trust / 100,
      pop: city.pop / Math.max(1, city.pop_max),
      agri: city.agri / Math.max(1, city.agri_max),
      comm: city.comm / Math.max(1, city.comm_max),
      secu: city.secu / Math.max(1, city.secu_max),
      def: city.def / Math.max(1, city.def_max),
      wall: city.wall / Math.max(1, city.wall_max)
    };
  }
  
  /**
   * 여러 도시 평가
   */
  private async evaluateCities(cities: any[], nation: any): Promise<void> {
    for (const city of cities) {
      if (city.nation === nation.nation) {
        this.evaluateCity(city);
      }
    }
  }
  
  /**
   * 공격 여부 판단
   */
  shouldAttack(
    general: any,
    targetCity: any,
    ownCity: any,
    nation: any
  ): boolean {
    // 전쟁 상태가 아니면 공격 불가
    if (this.diplomacyState < DiplomacyState.WAR_IMMINENT) {
      return false;
    }
    
    // 통솔장이 아니면 공격 불가
    if (!(this.generalType & GeneralType.COMMANDER)) {
      return false;
    }
    
    // 병력 확인
    const crew = general.data?.crew || 0;
    if (crew < this.policy.minWarCrew) {
      return false;
    }
    
    // 훈련도/사기 확인
    const train = general.data?.train || 0;
    const atmos = general.data?.atmos || 0;
    if (Math.max(train, atmos) < this.policy.properWarTrainAtmos) {
      return false;
    }
    
    // 자원 확인
    const gold = general.data?.gold || 0;
    const rice = general.data?.rice || 0;
    if (gold < this.policy.minWarGold || rice < this.policy.minWarRice) {
      return false;
    }
    
    // 난이도별 공격 확률
    const attackProb = {
      [AIDifficulty.EASY]: 0.3,
      [AIDifficulty.NORMAL]: 0.5,
      [AIDifficulty.HARD]: 0.7,
      [AIDifficulty.EXPERT]: 0.9
    }[this.policy.difficulty];
    
    return this.rng() < attackProb;
  }
  
  /**
   * 최적의 내정 커맨드 선택
   */
  selectBestDomesticCommand(
    general: any,
    city: any,
    nation: any
  ): CommandDecision | null {
    const evaluation = this.evaluateCity(city);
    const rates = this.calculateCityDevelopmentRates(city);
    
    // 장수 타입에 따른 능력치
    const isWarrior = this.generalType & GeneralType.WARRIOR;
    const isStrategist = this.generalType & GeneralType.STRATEGIST;
    
    // 개발이 필요한 항목 찾기
    const developmentNeeds: Array<{ command: string; rate: number; priority: number }> = [];
    
    // 인구 개발 (모든 장수)
    if (rates.pop < this.policy.targetDevelopmentRate) {
      developmentNeeds.push({
        command: 'recruit',
        rate: rates.pop,
        priority: (1 - rates.pop) * 100
      });
    }
    
    // 농업/상업 (지장)
    if (isStrategist) {
      if (rates.agri < this.policy.targetDevelopmentRate) {
        developmentNeeds.push({
          command: 'agriculture',
          rate: rates.agri,
          priority: (1 - rates.agri) * 80
        });
      }
      if (rates.comm < this.policy.targetDevelopmentRate) {
        developmentNeeds.push({
          command: 'commerce',
          rate: rates.comm,
          priority: (1 - rates.comm) * 80
        });
      }
    }
    
    // 치안/방어/성벽 (무장)
    if (isWarrior) {
      if (rates.secu < this.policy.targetDevelopmentRate) {
        developmentNeeds.push({
          command: 'security',
          rate: rates.secu,
          priority: (1 - rates.secu) * 70
        });
      }
      if (rates.def < this.policy.targetDevelopmentRate) {
        developmentNeeds.push({
          command: 'defense',
          rate: rates.def,
          priority: (1 - rates.def) * 70
        });
      }
      if (rates.wall < this.policy.targetDevelopmentRate) {
        developmentNeeds.push({
          command: 'wall',
          rate: rates.wall,
          priority: (1 - rates.wall) * 60
        });
      }
    }
    
    if (developmentNeeds.length === 0) {
      return null;
    }
    
    // 우선순위 정렬
    developmentNeeds.sort((a, b) => b.priority - a.priority);
    
    // 가장 필요한 것 선택 (확률적)
    const totalPriority = developmentNeeds.reduce((sum, item) => sum + item.priority, 0);
    let rand = this.rng() * totalPriority;
    
    for (const need of developmentNeeds) {
      rand -= need.priority;
      if (rand <= 0) {
        return {
          command: need.command,
          args: { cityId: city.city },
          reason: `develop_${need.command}`,
          priority: need.priority
        };
      }
    }
    
    return {
      command: developmentNeeds[0].command,
      args: { cityId: city.city },
      reason: `develop_${developmentNeeds[0].command}`,
      priority: developmentNeeds[0].priority
    };
  }
  
  /**
   * 최적의 군사 커맨드 선택
   */
  selectBestMilitaryCommand(
    general: any,
    city: any,
    nation: any,
    env: any
  ): CommandDecision | null {
    // 통솔장이 아니면 군사 행동 불가
    if (!(this.generalType & GeneralType.COMMANDER)) {
      return null;
    }
    
    const crew = general.data?.crew || 0;
    const train = general.data?.train || 0;
    const atmos = general.data?.atmos || 0;
    
    // 병력이 부족하면 징병
    if (crew < this.policy.minWarCrew) {
      const popRatio = city.pop / city.pop_max;
      if (popRatio >= this.policy.safeRecruitPopRatio) {
        return {
          command: 'recruit',
          args: { cityId: city.city },
          reason: 'need_crew',
          priority: 90
        };
      }
    }
    
    // 훈련도가 부족하면 훈련
    if (crew >= this.policy.minWarCrew && train < this.policy.properWarTrainAtmos) {
      return {
        command: 'train',
        args: { cityId: city.city },
        reason: 'need_training',
        priority: 80
      };
    }
    
    // 전쟁 상태이고 조건이 충족되면 공격
    if (this.diplomacyState >= DiplomacyState.WAR) {
      // 실제로는 인접 적 도시 찾기 필요
      // 여기서는 간단히 공격 가능 여부만 반환
      if (crew >= this.policy.minWarCrew &&
          Math.max(train, atmos) >= this.policy.properWarTrainAtmos) {
        return {
          command: 'attack',
          args: { fromCityId: city.city },
          reason: 'ready_for_war',
          priority: 100
        };
      }
    }
    
    return null;
  }
  
  /**
   * 개별 행동 평가
   */
  private async evaluateAction(
    actionName: string,
    general: any,
    city: any,
    nation: any,
    env: any
  ): Promise<CommandDecision | null> {
    switch (actionName) {
      case 'recruit':
      case 'train':
        return this.selectBestMilitaryCommand(general, city, nation, env);
      
      case 'agriculture':
      case 'commerce':
      case 'security':
      case 'defense':
      case 'wall':
        return this.selectBestDomesticCommand(general, city, nation);
      
      case 'attack':
        if (this.shouldAttack(general, null, city, nation)) {
          return this.selectBestMilitaryCommand(general, city, nation, env);
        }
        return null;
      
      default:
        return null;
    }
  }
  
  /**
   * 국가 커맨드 결정 (군주 전용)
   */
  private async decideNationCommand(
    general: any,
    nation: any,
    env: any
  ): Promise<CommandDecision | null> {
    // 세율 조정
    const taxRate = this.decideTaxRate(nation, env);
    if (taxRate !== nation.rate) {
      return {
        command: 'set_tax_rate',
        args: { rate: taxRate },
        reason: 'adjust_tax_rate',
        priority: 50
      };
    }
    
    // 선전포고 검토
    if (this.diplomacyState === DiplomacyState.PEACE) {
      const shouldDeclareWar = await this.shouldDeclareWar(nation, env);
      if (shouldDeclareWar) {
        return {
          command: 'declare_war',
          args: { targetNationId: shouldDeclareWar },
          reason: 'ready_for_war',
          priority: 70
        };
      }
    }
    
    return null;
  }
  
  /**
   * 세율 결정
   */
  private decideTaxRate(nation: any, env: any): number {
    // 개발도에 따라 세율 조정
    const avgDevRate = this.getAverageNationDevelopmentRate();
    
    if (avgDevRate > 0.95) return 25;
    if (avgDevRate > 0.70) return 20;
    if (avgDevRate > 0.50) return 15;
    return 10;
  }
  
  /**
   * 국가 평균 개발도
   */
  private getAverageNationDevelopmentRate(): number {
    if (this.cityEvaluations.size === 0) {
      return 0.5;
    }
    
    let totalRate = 0;
    for (const evaluation of this.cityEvaluations.values()) {
      totalRate += evaluation.developmentRate;
    }
    
    return totalRate / this.cityEvaluations.size;
  }
  
  /**
   * 선전포고 여부 결정
   */
  private async shouldDeclareWar(nation: any, env: any): Promise<number | null> {
    // 게임 초기에는 선포 안함
    const gameYear = env.year - env.startyear;
    if (gameYear < 2) {
      return null;
    }
    
    // 개발도 확인
    const avgDevRate = this.getAverageNationDevelopmentRate();
    if (avgDevRate < 0.7) {
      return null;
    }
    
    // 자원 확인
    if (nation.gold < this.policy.minNationGold * 2 ||
        nation.rice < this.policy.minNationRice * 2) {
      return null;
    }
    
    // 난이도별 선포 확률
    const declareProb = {
      [AIDifficulty.EASY]: 0.1,
      [AIDifficulty.NORMAL]: 0.2,
      [AIDifficulty.HARD]: 0.3,
      [AIDifficulty.EXPERT]: 0.5
    }[this.policy.difficulty];
    
    if (this.rng() < declareProb) {
      // 실제로는 인접 국가 목록에서 선택
      // 여기서는 임시로 null 반환
      return null;
    }
    
    return null;
  }
  
  /**
   * 정책 업데이트
   */
  updatePolicy(updates: Partial<AIPolicyConfig>): void {
    this.policy = { ...this.policy, ...updates };
  }
  
  /**
   * 현재 정책 조회
   */
  getPolicy(): Readonly<AIPolicyConfig> {
    return Object.freeze({ ...this.policy });
  }
  
  /**
   * 캐시 초기화
   */
  clearCache(): void {
    this.cityEvaluations.clear();
    this.generalType = 0;
    this.diplomacyState = DiplomacyState.PEACE;
  }
}

/**
 * 난이도별 AI 엔진 팩토리
 */
export class AIEngineFactory {
  static create(difficulty: AIDifficulty, seed?: number): AIEngine {
    return new AIEngine(difficulty, {}, seed);
  }
  
  static createEasy(seed?: number): AIEngine {
    return new AIEngine(AIDifficulty.EASY, {}, seed);
  }
  
  static createNormal(seed?: number): AIEngine {
    return new AIEngine(AIDifficulty.NORMAL, {}, seed);
  }
  
  static createHard(seed?: number): AIEngine {
    return new AIEngine(AIDifficulty.HARD, {}, seed);
  }
  
  static createExpert(seed?: number): AIEngine {
    return new AIEngine(AIDifficulty.EXPERT, {}, seed);
  }
  
  static createCustom(
    difficulty: AIDifficulty,
    customPolicy: Partial<AIPolicyConfig>,
    seed?: number
  ): AIEngine {
    return new AIEngine(difficulty, customPolicy, seed);
  }
}
