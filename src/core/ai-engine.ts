import { IGeneral } from '../models/general.model';
import { ICity } from '../models/city.model';
import { INation } from '../models/nation.model';

/**
 * AI 내부 커맨드명을 실제 게임 커맨드명으로 변환
 * 
 * AI는 간단한 이름(agriculture, commerce 등)을 사용하지만,
 * 게임 시스템은 CommandRegistry에 등록된 대문자 스네이크 케이스를 사용
 * 예: InvestCommerceCommand → INVEST_COMMERCE
 */
function mapAICommandToGameCommand(aiCommand: string): string {
  const commandMap: Record<string, string> = {
    // 내정 (Domestic)
    'agriculture': 'CULTIVATE_LAND',        // 농지개간
    'commerce': 'INVEST_COMMERCE',          // 상업투자
    'security': 'REINFORCE_SECURITY',       // 치안강화
    'defense': 'REINFORCE_DEFENSE',         // 수비강화
    'wall': 'REPAIR_WALL',                  // 성벽보수
    'settlement': 'ENCOURAGE_SETTLEMENT',   // 정착장려 (인구)
    'trust': 'SELECT_CITIZEN',              // 선정 (민심)
    'tech': 'RESEARCH_TECH',                // 기술연구
    
    // 군사 (Military)
    'recruit': 'CONSCRIPT',                 // 징병
    'train': 'TRAIN',                       // 훈련
    'morale': 'BOOST_MORALE',               // 사기진작
    
    // 특수 (Special)
    'cure': 'REST_CURE',                    // 요양
    'raise_army': 'RAISE_ARMY',             // 거병
    'found_nation': 'FOUND_NATION',         // 건국
    'move': 'MOVE'                          // 이동
  };
  
  return commandMap[aiCommand] || aiCommand;
}

// AI 난이도 레벨
export enum AIDifficulty {
  EASY = 'easy',
  NORMAL = 'normal',
  HARD = 'hard',
  EXPERT = 'expert'
}

// 장수 타입 분류 (비트 플래그)
export enum GeneralType {
  WARRIOR = 1,        // 무장 (무력 특화)
  STRATEGIST = 2,     // 지장 (지력 특화)
  COMMANDER = 4,      // 통솔장 (통솔 특화)
  POLITICIAN = 8,     // 정치가 (정치 특화)
  CHARMER = 16        // 매력가 (매력 특화)
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
  trust: number;           // 민심
  population: number;      // 인구
  agriculture: number;     // 농업
  commerce: number;        // 상업
  security: number;        // 치안
  defense: number;         // 수비
  wall: number;            // 성벽
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
    targetDevelopmentRate: 0.3
  },
  [AIDifficulty.NORMAL]: {
    minNationGold: 5000,
    minNationRice: 5000,
    minWarGold: 8000,
    minWarRice: 8000,
    minWarLeadership: 70,
    minWarCrew: 1000,
    properWarTrainAtmos: 70,
    targetDevelopmentRate: 0.4
  },
  [AIDifficulty.HARD]: {
    minNationGold: 8000,
    minNationRice: 8000,
    minWarGold: 12000,
    minWarRice: 12000,
    minWarLeadership: 80,
    minWarCrew: 1500,
    properWarTrainAtmos: 80,
    targetDevelopmentRate: 0.5
  },
  [AIDifficulty.EXPERT]: {
    minNationGold: 12000,
    minNationRice: 12000,
    minWarGold: 18000,
    minWarRice: 18000,
    minWarLeadership: 85,
    minWarCrew: 2000,
    properWarTrainAtmos: 90,
    targetDevelopmentRate: 0.6
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
        'found_nation',
        'raise_army',
        'recruit',
        'train',
        'morale',
        'agriculture',
        'commerce',
        'trust',
        'settlement',
        'security',
        'defense',
        'wall',
        'tech',
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
    
    // 1. 요양 (부상이 심한 경우 최우선)
    const injury = general.data?.injury || 0;
    const cureThreshold = this.policy.minWarLeadership || 60; // 임시 threshold
    if (injury > cureThreshold) {
      return {
        command: mapAICommandToGameCommand('cure'),
        args: {},
        reason: 'high_injury',
        priority: 100
      };
    }
    
    // 2. 거병/건국 (재야 장수일 때)
    const npcType = general.npc || general.data?.npc || 0;
    const nationId = general.nation || general.data?.nation || 0;
    const officerLevel = general.data?.officer_level || 0;
    const gold = general.data?.gold || general.gold || 0;
    const rice = general.data?.rice || general.rice || 0;
    const leadership = general.data?.leadership || general.leadership || 50;
    const charm = general.data?.charm || general.charm || 50;
    
    // 재야 상태 (nation = 0)
    if (nationId === 0) {
      // 도시에 있고, 충분한 자원과 능력치가 있으면 거병
      if (city && city.nation === 0 && leadership >= 60 && charm >= 50 && gold >= 5000 && rice >= 5000) {
        return {
          command: 'RAISE_ARMY',
          args: {},
          reason: 'neutral_raise_army',
          priority: 95
        };
      }
      
      // 군주급 NPC면 건국 (도시 소유 등 조건 완화)
      if (npcType >= 2 && officerLevel === 12 && leadership >= 70) {
        return {
          command: 'FOUND_NATION',
          args: {
            nationName: `${general.name || general.data?.name}의 나라`,
            nationType: 'general',
            colorType: 0
          },
          reason: 'wandering_lord_found',
          priority: 98
        };
      }
    }
    
    // 3. 군주인 경우 국가 커맨드 우선 검토
    if (officerLevel === 12 || officerLevel === '군주') {
      const nationCommand = await this.decideNationCommand(general, nation, env);
      if (nationCommand) {
        return nationCommand;
      }
    }
    
    // 4. 우선순위에 따라 행동 결정
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
  /**
   * 장수 타입 분류
   * PHP GeneralAI::calcGenType 기반으로 확장
   * 
   * 타입: 통솔, 무력, 지력, 정치, 매력 (비트 플래그)
   * 예: 통솔무력형 = COMMANDER | WARRIOR
   */
  private calculateGeneralType(general: any): number {
    const leadership = general.data?.leadership || general.leadership || 50;
    const strength = Math.max(1, general.data?.strength || general.strength || 50);
    const intel = Math.max(1, general.data?.intel || general.intel || 50);
    const politics = general.data?.politics || general.politics || 50;
    const charm = general.data?.charm || general.charm || 50;
    
    let genType = 0;
    
    // 1. 무장 vs 지장 (기본 분류)
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
    
    // 2. 통솔장 (군사 지휘관)
    if (leadership >= this.policy.minWarLeadership) {
      genType |= GeneralType.COMMANDER;
    }
    
    // 3. 정치가 (민심/외교 전문)
    if (politics >= 70) {
      genType |= GeneralType.POLITICIAN;
    }
    
    // 4. 매력가 (인구/등용 전문)
    if (charm >= 70) {
      genType |= GeneralType.CHARMER;
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
    // city가 없으면 기본값 반환
    if (!city || !city.city) {
      return {
        cityId: 0,
        score: 0,
        developmentRate: 0,
        population: 0,
        agriculture: 0,
        commerce: 0,
        security: 0,
        defense: 0,
        wall: 0,
        trust: 0,
        isFront: false,
        isSupply: false,
        priority: 0
      };
    }
    
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
      trust: rates.trust,
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
    nation: any,
    env: any
  ): CommandDecision | null {
    const evaluation = this.evaluateCity(city);
    const rates = this.calculateCityDevelopmentRates(city);
    
    // 장수 타입에 따른 능력치
    const isCommander = this.generalType & GeneralType.COMMANDER;
    const isWarrior = this.generalType & GeneralType.WARRIOR;
    const isStrategist = this.generalType & GeneralType.STRATEGIST;
    const isPolitician = this.generalType & GeneralType.POLITICIAN;
    const isCharmer = this.generalType & GeneralType.CHARMER;
    
    // 자원 확인
    const gold = general.data?.gold || general.gold || 0;
    const rice = general.data?.rice || general.rice || 0;
    const develCost = env.develcost || 24;
    
    // 개발이 필요한 항목 찾기
    const developmentNeeds: Array<{ command: string; rate: number; priority: number }> = [];
    
    // 민심 개발 (모든 타입 가능, 통솔장/정치가는 우선순위 높음) - 주민선정
    if (rates.trust < 0.98 && gold >= develCost * 3) {
      const priorityBonus = (isCommander || isPolitician) ? 1.5 : 1.0;
      developmentNeeds.push({
        command: 'trust',
        rate: rates.trust,
        priority: Math.max(0, (1 - rates.trust / 2 - 0.2)) * 100 * priorityBonus
      });
    }
    
    // 인구 개발 (모든 타입 가능, 통솔장/매력가는 우선순위 높음) - 정착장려
    if (rates.pop < this.policy.targetDevelopmentRate && rice >= develCost * 2) {
      const priorityBonus = (isCommander || isCharmer) ? 1.5 : 1.0;
      developmentNeeds.push({
        command: 'settlement',
        rate: rates.pop,
        priority: (1 - rates.pop) * 90 * priorityBonus
      });
    }
    
    // 기술 연구 (모든 타입 가능, 지장은 우선순위 높음) - 국가 기술력이 뒤처져 있을 때
    if (nation && env) {
      const tech = nation.tech || nation.data?.tech || 0;
      const startYear = env.startyear || env.year || 0;
      const currentYear = env.year || startYear;
      const relYear = currentYear - startYear;
      const techLimit = relYear * 50;
      
      // 기술이 연도 대비 뒤처져 있으면 연구
      if (tech < techLimit) {
        const priorityBonus = isStrategist ? 1.5 : 1.0;
        developmentNeeds.push({
          command: 'tech',
          rate: tech / Math.max(1, techLimit),
          priority: (1 - tech / Math.max(1, techLimit)) * 85 * priorityBonus
        });
      }
    }
    
    // 농업/상업 (모든 타입 가능, 지장은 우선순위 높음)
    if (rates.agri < this.policy.targetDevelopmentRate && gold >= develCost) {
      const priorityBonus = isStrategist ? 1.5 : 1.0;
      developmentNeeds.push({
        command: 'agriculture',
        rate: rates.agri,
        priority: (1 - rates.agri) * 80 * priorityBonus
      });
    }
    if (rates.comm < this.policy.targetDevelopmentRate && gold >= develCost) {
      const priorityBonus = isPolitician ? 1.5 : 1.0;
      developmentNeeds.push({
        command: 'commerce',
        rate: rates.comm,
        priority: (1 - rates.comm) * 80 * priorityBonus
      });
    }
    
    // 치안/방어/성벽 (모든 타입 가능, 무장은 우선순위 높음)
    if (rates.secu < this.policy.targetDevelopmentRate && gold >= develCost) {
      const priorityBonus = isPolitician ? 1.5 : 1.0;
      developmentNeeds.push({
        command: 'security',
        rate: rates.secu,
        priority: (1 - rates.secu) * 75 * priorityBonus
      });
    }
    if (rates.def < this.policy.targetDevelopmentRate && gold >= develCost) {
      const priorityBonus = isWarrior ? 1.5 : 1.0;
      developmentNeeds.push({
        command: 'defense',
        rate: rates.def,
        priority: (1 - rates.def) * 75 * priorityBonus
      });
    }
    if (rates.wall < this.policy.targetDevelopmentRate && gold >= develCost) {
      const priorityBonus = isWarrior ? 1.5 : 1.0;
      developmentNeeds.push({
        command: 'wall',
        rate: rates.wall,
        priority: (1 - rates.wall) * 70 * priorityBonus
      });
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
        const gameCommand = mapAICommandToGameCommand(need.command);
        return {
          command: gameCommand,
          args: { cityId: city.city },
          reason: `develop_${need.command}`,
          priority: need.priority
        };
      }
    }
    
    const gameCommand = mapAICommandToGameCommand(developmentNeeds[0].command);
    return {
      command: gameCommand,
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
    const crew = general.data?.crew || general.crew || 0;
    const train = general.data?.train || general.train || 0;
    const atmos = general.data?.atmos || general.atmos || 0;
    const leadership = general.data?.leadership || general.leadership || 50;
    const gold = general.data?.gold || general.gold || 0;
    const rice = general.data?.rice || general.rice || 0;
    
    // 통솔이 매우 낮으면 (30 미만) 군사 행동 불가
    if (leadership < 30) {
      return null;
    }
    
    // 병력이 부족하면 징병 (통솔 40 이상, 자원 충분)
    if (crew < this.policy.minWarCrew && leadership >= 40) {
      const cityData = city.data || city;
      const popRatio = (cityData.pop || 0) / Math.max(cityData.pop_max || 1, 1);
      const recruitCost = 1000; // 대략적 비용
      
      if (popRatio >= this.policy.safeRecruitPopRatio && gold >= recruitCost && rice >= 10) {
        return {
          command: mapAICommandToGameCommand('recruit'),
          args: { crewType: 0, amount: Math.min(1000, Math.floor(leadership * 100)) },
          reason: 'need_crew',
          priority: 90
        };
      }
    }
    
    // 병사가 있으면 훈련도/사기 체크
    if (crew > 0) {
      // 훈련도가 부족하면 훈련 (통솔 40 이상, 자원 충분)
      if (train < this.policy.properWarTrainAtmos && leadership >= 40 && gold >= 10) {
        return {
          command: mapAICommandToGameCommand('train'),
          args: {},
          reason: 'need_training',
          priority: 85
        };
      }
      
      // 사기가 부족하면 사기진작 (통솔 40 이상, 자원 충분)
      if (atmos < this.policy.properWarTrainAtmos && leadership >= 40 && gold >= 50 && rice >= 50) {
        return {
          command: mapAICommandToGameCommand('morale'),
          args: {},
          reason: 'need_morale',
          priority: 85
        };
      }
    }
    
    // 전쟁 상태이고 조건이 충족되면 공격 (통솔장만 가능)
    if ((this.generalType & GeneralType.COMMANDER) && this.diplomacyState >= DiplomacyState.WAR) {
      // 실제로는 인접 적 도시 찾기 필요
      // 여기서는 간단히 공격 가능 여부만 반환
      if (crew >= this.policy.minWarCrew &&
          Math.max(train, atmos) >= this.policy.properWarTrainAtmos) {
        return {
          command: 'attack',
          args: { fromCityId: city.city || city.data?.city },
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
      case 'found_nation':
        return this.evaluateFoundNation(general, city, nation, env);
      
      case 'raise_army':
        return this.evaluateRaiseArmy(general, city, nation, env);
      
      case 'recruit':
      case 'train':
      case 'morale':
        return this.selectBestMilitaryCommand(general, city, nation, env);
      
      case 'agriculture':
      case 'commerce':
      case 'security':
      case 'defense':
      case 'wall':
      case 'trust':
      case 'settlement':
      case 'tech':
        return this.selectBestDomesticCommand(general, city, nation, env);
      
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
   * 거병 평가
   */
  private evaluateRaiseArmy(
    general: any,
    city: any,
    nation: any,
    env: any
  ): CommandDecision | null {
    const nationId = general.data?.nation || general.nation || 0;
    const gold = general.data?.gold || general.gold || 0;
    const rice = general.data?.rice || general.rice || 0;
    const leadership = general.data?.leadership || general.leadership || 50;
    const charm = general.data?.charm || general.charm || 50;
    
    // 재야이고, 무주 도시에 있고, 자원과 능력치가 충분하면 거병
    if (nationId === 0 && city && city.nation === 0) {
      if (leadership >= 60 && charm >= 50 && gold >= 5000 && rice >= 5000) {
        return {
          command: 'RAISE_ARMY',
          args: {},
          reason: 'neutral_raise_army',
          priority: 95
        };
      }
    }
    
    return null;
  }
  
  /**
   * 건국 평가
   */
  private evaluateFoundNation(
    general: any,
    city: any,
    nation: any,
    env: any
  ): CommandDecision | null {
    const npcType = general.npc || general.data?.npc || 0;
    const nationId = general.data?.nation || general.nation || 0;
    const officerLevel = general.data?.officer_level || 0;
    const leadership = general.data?.leadership || general.leadership || 50;
    const gold = general.data?.gold || general.gold || 0;
    
    // 재야이고, 군주급이고, 높은 능력치
    if (nationId === 0 && (officerLevel === 12 || npcType >= 2) && leadership >= 70 && gold >= 10000) {
      return {
        command: 'FOUND_NATION',
        args: {
          nationName: `${general.name || general.data?.name}의 나라`,
          nationType: 'general',
          colorType: 0
        },
        reason: 'wandering_lord_found',
        priority: 98
      };
    }
    
    return null;
  }
  
  /**
   * 국가 커맨드 결정 (군주 전용)
   */
  private async decideNationCommand(
    general: any,
    nation: any,
    env: any
  ): Promise<CommandDecision | null> {
    // 세율 조정 (TODO: set_tax_rate 명령 구현 필요)
    // const taxRate = this.decideTaxRate(nation, env);
    // if (taxRate !== nation.rate) {
    //   return {
    //     command: 'set_tax_rate',
    //     args: { rate: taxRate },
    //     reason: 'adjust_tax_rate',
    //     priority: 50
    //   };
    // }
    
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
