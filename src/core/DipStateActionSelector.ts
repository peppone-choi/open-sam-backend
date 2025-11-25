/**
 * DipStateActionSelector - 외교 상태 기반 장수 행동 선택기
 * 
 * PHP GeneralAI.php의 chooseGeneralTurn() 및 dipState 기반 액션 선택 로직 포팅
 * 
 * dipState 레벨:
 * - d평화 (0): 평화 시 - 내정 개발, 거래, 느린 징병
 * - d선포 (1): 선포 시 - 긴급 징병, 기본 훈련
 * - d징병 (2): 징병 시 - 최대 징병, 훈련 우선
 * - d직전 (3): 직전 시 - 전투 준비, 전방 배치
 * - d전쟁 (4): 전쟁 시 - 공격, 방어, 후퇴 로직
 */

import { AICommandDecision, GeneralStats } from './SimpleAI';
import { GeneralActionType } from './AutorunGeneralPolicy';

/**
 * 외교 상태 상수 (PHP GeneralAI와 동일)
 */
export enum DipState {
  d평화 = 0,
  d선포 = 1,
  d징병 = 2,
  d직전 = 3,
  d전쟁 = 4,
}

/**
 * 장수 타입 비트 플래그 (PHP GeneralAI와 동일)
 */
export enum GenType {
  t무장 = 1,
  t지장 = 2,
  t통솔장 = 4,
}

/**
 * 도시 개발 비율
 */
export interface DevelRate {
  trust: number;   // 민심 (0.0 ~ 1.0)
  pop: number;     // 인구 비율
  agri: number;    // 농업 비율
  comm: number;    // 상업 비율
  secu: number;    // 치안 비율
  def: number;     // 수비 비율
  wall: number;    // 성벽 비율
}

/**
 * 액션 후보와 가중치 쌍
 */
export interface WeightedAction {
  command: string;
  args: any;
  weight: number;
  reason: string;
}

/**
 * 정책 설정
 */
export interface PolicyConfig {
  minWarCrew: number;           // 최소 출병 병력
  properWarTrainAtmos: number;  // 적정 훈련도/사기
  minNPCRecruitCityPopulation: number;  // 최소 징병 가능 인구
  safeRecruitCityPopulationRatio: number; // 안전 징병 인구 비율
  minNPCWarLeadership: number;  // 최소 출병 통솔
  minimumResourceActionAmount: number;  // 최소 자원 행동량
  cureThreshold: number;        // 요양 기준 부상치
}

/**
 * 환경 설정
 */
export interface EnvConfig {
  month: number;
  year: number;
  startyear: number;
  develcost: number;
  baserice: number;
}

/**
 * 외교 상태 기반 액션 선택기
 */
export class DipStateActionSelector {
  private dipState: DipState;
  private genType: number;
  private general: any;
  private city: any;
  private nation: any;
  private env: EnvConfig;
  private policy: PolicyConfig;
  
  // 능력치
  private leadership: number;
  private strength: number;
  private intel: number;
  private fullLeadership: number;
  private fullStrength: number;
  private fullIntel: number;
  
  // 유틸 - 난수 생성 (0.0 ~ 1.0)
  private rng: () => number;
  
  constructor(
    general: any,
    city: any,
    nation: any,
    env: EnvConfig,
    policy: PolicyConfig,
    dipState: DipState,
    seed?: number
  ) {
    this.general = general;
    this.city = city;
    this.nation = nation;
    this.env = env;
    this.policy = policy;
    this.dipState = dipState;
    
    // 간단한 PRNG (calcGenType 전에 초기화 필요)
    let s = seed ?? Math.floor(Math.random() * 1000000);
    this.rng = () => {
      s = Math.sin(s) * 10000;
      return s - Math.floor(s);
    };
    
    const genData = general.data || general;
    this.leadership = genData.leadership || 50;
    this.strength = genData.strength || 50;
    this.intel = genData.intel || 50;
    this.fullLeadership = genData.leadership || 50;
    this.fullStrength = genData.strength || 50;
    this.fullIntel = genData.intel || 50;
    
    this.genType = this.calcGenType();
  }
  
  /**
   * 장수 타입 계산 (PHP calcGenType 포팅)
   */
  private calcGenType(): number {
    const strength = Math.max(1, this.fullStrength);
    const intel = Math.max(1, this.fullIntel);
    const leadership = this.fullLeadership;
    
    let genType: number = 0;
    
    // 무장 vs 지장
    if (strength >= intel) {
      genType = GenType.t무장;
      // 무지장 (둘 다 높음)
      if (intel >= strength * 0.8 && this.rng() < intel / strength / 2) {
        genType |= GenType.t지장;
      }
    } else {
      genType = GenType.t지장;
      // 지무장 (둘 다 높음)
      if (strength >= intel * 0.8 && this.rng() < strength / intel / 2) {
        genType |= GenType.t무장;
      }
    }
    
    // 통솔장
    if (leadership >= this.policy.minNPCWarLeadership) {
      genType |= GenType.t통솔장;
    }
    
    return genType;
  }
  
  /**
   * 도시 개발 비율 계산
   */
  private calcCityDevelRate(city: any): DevelRate {
    const cityData = city?.data || city || {};
    
    return {
      trust: (cityData.trust || 50) / 100,
      pop: (cityData.pop || 0) / Math.max(cityData.pop_max || 10000, 1),
      agri: (cityData.agri || 0) / Math.max(cityData.agri_max || 10000, 1),
      comm: (cityData.comm || 0) / Math.max(cityData.comm_max || 10000, 1),
      secu: (cityData.secu || 0) / Math.max(cityData.secu_max || 10000, 1),
      def: (cityData.def || 0) / Math.max(cityData.def_max || 10000, 1),
      wall: (cityData.wall || 0) / Math.max(cityData.wall_max || 10000, 1),
    };
  }
  
  /**
   * 가중치 기반 랜덤 선택
   */
  private choiceUsingWeightPair(cmdList: WeightedAction[]): AICommandDecision | null {
    if (cmdList.length === 0) return null;
    
    const totalWeight = cmdList.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight <= 0) return cmdList[0];
    
    let random = this.rng() * totalWeight;
    
    for (const item of cmdList) {
      random -= item.weight;
      if (random <= 0) {
        return {
          command: item.command,
          args: item.args,
          weight: item.weight,
          reason: item.reason,
        };
      }
    }
    
    return {
      command: cmdList[0].command,
      args: cmdList[0].args,
      weight: cmdList[0].weight,
      reason: cmdList[0].reason,
    };
  }
  
  /**
   * 유틸: 값 범위 제한
   */
  private valueFit(value: number, min: number = 0.001, max?: number): number {
    if (value < min) return min;
    if (max !== undefined && value > max) return max;
    return value;
  }

  // ================================================================
  // === 평화 시 (dipState = 0) ===
  // ================================================================
  
  /**
   * 평화 시: 일반 내정 (PHP do일반내정 포팅)
   * - 모든 개발 항목에 대해 가중치 기반 선택
   * - 계절 보정 적용 (봄/여름 농업, 가을/겨울 상업)
   */
  public pickGeneralActionPeace(): AICommandDecision | null {
    const develRate = this.calcCityDevelRate(this.city);
    const isSpringSummer = this.env.month <= 6;
    const cmdList: WeightedAction[] = [];
    
    const nationRice = this.nation?.rice || this.nation?.data?.rice || 0;
    
    // 국가 자원 부족 시 30% 확률로 휴식
    if (nationRice < (this.env.baserice || 50000) && this.rng() < 0.3) {
      return null;
    }
    
    // === 통솔장: 민심/인구 ===
    if (this.genType & GenType.t통솔장) {
      // 주민선정 (민심 98% 미만)
      if (develRate.trust < 0.98) {
        const weight = this.leadership / this.valueFit(develRate.trust / 2 - 0.2) * 2;
        cmdList.push({
          command: '주민선정',
          args: {},
          weight,
          reason: `[평화] 민심 부족 (${(develRate.trust * 100).toFixed(1)}%)`,
        });
      }
      
      // 정착장려 (인구 80% 미만)
      if (develRate.pop < 0.8) {
        const weight = this.leadership / this.valueFit(develRate.pop);
        cmdList.push({
          command: '정착장려',
          args: {},
          weight,
          reason: `[평화] 인구 부족 (${(develRate.pop * 100).toFixed(1)}%)`,
        });
      } else if (develRate.pop < 0.99) {
        // 인구 80~99%: 낮은 가중치
        const weight = this.leadership / this.valueFit(develRate.pop / 4);
        cmdList.push({
          command: '정착장려',
          args: {},
          weight,
          reason: `[평화] 인구 보충 (${(develRate.pop * 100).toFixed(1)}%)`,
        });
      }
    }
    
    // === 무장: 수비/성벽/치안 ===
    if (this.genType & GenType.t무장) {
      // 수비강화 (100% 미만)
      if (develRate.def < 1) {
        const weight = this.strength / this.valueFit(develRate.def);
        cmdList.push({
          command: '수비강화',
          args: {},
          weight,
          reason: `[평화] 수비 부족 (${(develRate.def * 100).toFixed(1)}%)`,
        });
      }
      
      // 성벽보수 (100% 미만)
      if (develRate.wall < 1) {
        const weight = this.strength / this.valueFit(develRate.wall);
        cmdList.push({
          command: '성벽보수',
          args: {},
          weight,
          reason: `[평화] 성벽 부족 (${(develRate.wall * 100).toFixed(1)}%)`,
        });
      }
      
      // 치안강화 (90% 미만)
      if (develRate.secu < 0.9) {
        const weight = this.strength / this.valueFit(develRate.secu / 0.8, 0.001, 1);
        cmdList.push({
          command: '치안강화',
          args: {},
          weight,
          reason: `[평화] 치안 부족 (${(develRate.secu * 100).toFixed(1)}%)`,
        });
      } else if (develRate.secu < 1) {
        // 치안 90~100%: 낮은 가중치
        const weight = this.strength / 2 / this.valueFit(develRate.secu);
        cmdList.push({
          command: '치안강화',
          args: {},
          weight,
          reason: `[평화] 치안 보충 (${(develRate.secu * 100).toFixed(1)}%)`,
        });
      }
    }
    
    // === 지장: 기술/농업/상업 ===
    if (this.genType & GenType.t지장) {
      // 기술연구 (기술 한도 체크)
      const nationTech = this.nation?.tech || this.nation?.data?.tech || 0;
      if (!this.techLimit(nationTech)) {
        const nextTech = (nationTech % 1000) + 1;
        // 한 등급 이상 뒤처져 있으면 더 열심히
        const techBehind = !this.techLimit(nationTech + 1000);
        const weight = techBehind
          ? this.intel / (nextTech / 2000)
          : this.intel;
        cmdList.push({
          command: '기술연구',
          args: {},
          weight,
          reason: `[평화] 기술 연구 필요 (현재: ${nationTech}, 뒤처짐: ${techBehind})`,
        });
      }
      
      // 농지개간 (100% 미만) - 봄/여름 보정
      if (develRate.agri < 1) {
        const seasonBonus = isSpringSummer ? 1.2 : 0.8;
        const weight = seasonBonus * this.intel / this.valueFit(develRate.agri, 0.001, 1);
        cmdList.push({
          command: '농지개간',
          args: {},
          weight,
          reason: `[평화] 농업 부족 (${(develRate.agri * 100).toFixed(1)}%), ${isSpringSummer ? '봄/여름' : '가을/겨울'}`,
        });
      }
      
      // 상업투자 (100% 미만) - 가을/겨울 보정
      if (develRate.comm < 1) {
        const seasonBonus = isSpringSummer ? 0.8 : 1.2;
        const weight = seasonBonus * this.intel / this.valueFit(develRate.comm, 0.001, 1);
        cmdList.push({
          command: '상업투자',
          args: {},
          weight,
          reason: `[평화] 상업 부족 (${(develRate.comm * 100).toFixed(1)}%), ${isSpringSummer ? '봄/여름' : '가을/겨울'}`,
        });
      }
    }
    
    return this.choiceUsingWeightPair(cmdList);
  }

  // ================================================================
  // === 선포/징병 시 (dipState = 1, 2) ===
  // ================================================================
  
  /**
   * 선포/징병 시: 긴급 내정 (PHP do긴급내정 포팅)
   * - 민심 70% 미만 -> 주민선정 (통솔 비례)
   * - 인구 최소치 미만 -> 정착장려 (통솔 비례)
   */
  public pickGeneralActionDeclared(): AICommandDecision | null {
    // 평화 시에는 긴급 내정 안 함
    if (this.dipState === DipState.d평화) {
      return null;
    }
    
    const cityData = this.city?.data || this.city || {};
    const trust = cityData.trust || 50;
    const pop = cityData.pop || 0;
    
    // 민심 70 미만: 주민선정 (통솔/60 확률)
    if (trust < 70 && this.rng() < this.leadership / 60) {
      return {
        command: '주민선정',
        args: {},
        weight: 90,
        reason: `[선포/징병] 긴급 민심 회복 (민심: ${trust})`,
      };
    }
    
    // 인구 최소치 미만: 정착장려 (통솔/120 확률)
    if (pop < this.policy.minNPCRecruitCityPopulation && this.rng() < this.leadership / 120) {
      return {
        command: '정착장려',
        args: {},
        weight: 85,
        reason: `[선포/징병] 긴급 인구 확보 (인구: ${pop})`,
      };
    }
    
    return null;
  }
  
  /**
   * 징병 시: 징병 로직 (PHP do징병 포팅)
   * - 통솔장만 가능
   * - 병력 < minWarCrew 경우에만
   * - 도시 인구 조건 체크
   */
  public pickGeneralActionRecruit(): AICommandDecision | null {
    // 평화/선포 시에는 징병 안 함
    if (this.dipState === DipState.d평화 || this.dipState === DipState.d선포) {
      return null;
    }
    
    // 통솔장만 징병 가능
    if (!(this.genType & GenType.t통솔장)) {
      return null;
    }
    
    const genData = this.general.data || this.general;
    const crew = genData.crew || 0;
    
    // 이미 충분한 병력이 있으면 징병 안 함
    if (crew >= this.policy.minWarCrew) {
      return null;
    }
    
    const cityData = this.city?.data || this.city || {};
    const pop = cityData.pop || 0;
    const popMax = cityData.pop_max || 10000;
    const popRatio = pop / popMax;
    
    // 인구 조건 체크 (한계징병 불가 시)
    const remainPop = pop - this.policy.minNPCRecruitCityPopulation - this.fullLeadership * 100;
    if (remainPop <= 0) {
      return null;
    }
    
    // 인구 비율 낮으면 확률적으로 스킵
    const maxPop = popMax - this.policy.minNPCRecruitCityPopulation;
    if (popRatio < this.policy.safeRecruitCityPopulationRatio && this.rng() < remainPop / maxPop) {
      return null;
    }
    
    // 자원 체크 (훈련/사기 비용 예비)
    const gold = genData.gold || 0;
    const rice = genData.rice || 0;
    const reserveGold = this.fullLeadership * 3;
    const reserveRice = this.fullLeadership * 4;
    
    if (gold - reserveGold <= 0 || rice - reserveRice <= 0) {
      return null;
    }
    
    // 병종 선택 (간단히 통솔 기반)
    const crewType = this.selectBestCrewType();
    const amount = this.fullLeadership * 100;
    
    return {
      command: '징병',
      args: { crewType, amount },
      weight: 80,
      reason: `[징병/직전] 병력 확보 필요 (현재: ${crew}, 목표: ${this.policy.minWarCrew})`,
    };
  }

  // ================================================================
  // === 직전 시 (dipState = 3) ===
  // ================================================================
  
  /**
   * 직전 시: 전투 준비 (PHP do전투준비 포팅)
   * - 훈련도 < properWarTrainAtmos -> 훈련
   * - 사기 < properWarTrainAtmos -> 사기진작
   */
  public pickGeneralActionPreWar(): AICommandDecision | null {
    // 평화/선포 시에는 전투 준비 안 함
    if (this.dipState === DipState.d평화 || this.dipState === DipState.d선포) {
      return null;
    }
    
    const cmdList: WeightedAction[] = [];
    const genData = this.general.data || this.general;
    const train = genData.train || 0;
    const atmos = genData.atmos || 0;
    
    const maxTrainByCommand = 100; // PHP GameConst.$maxTrainByCommand
    const maxAtmosByCommand = 100; // PHP GameConst.$maxAtmosByCommand
    
    // 훈련도 부족
    if (train < this.policy.properWarTrainAtmos) {
      const weight = maxTrainByCommand / this.valueFit(train, 1);
      cmdList.push({
        command: '훈련',
        args: {},
        weight,
        reason: `[직전] 훈련도 부족 (${train} < ${this.policy.properWarTrainAtmos})`,
      });
    }
    
    // 사기 부족
    if (atmos < this.policy.properWarTrainAtmos) {
      const weight = maxAtmosByCommand / this.valueFit(atmos, 1);
      cmdList.push({
        command: '사기진작',
        args: {},
        weight,
        reason: `[직전] 사기 부족 (${atmos} < ${this.policy.properWarTrainAtmos})`,
      });
    }
    
    return this.choiceUsingWeightPair(cmdList);
  }

  // ================================================================
  // === 전쟁 시 (dipState = 4) ===
  // ================================================================
  
  /**
   * 전쟁 시: 출병 (PHP do출병 포팅)
   * - 훈련도/사기/병력 조건 충족
   * - 전방 도시에서만 출병 가능
   */
  public pickGeneralActionWar(): AICommandDecision | null {
    if (this.dipState !== DipState.d전쟁) {
      return null;
    }
    
    const genData = this.general.data || this.general;
    const nationRice = this.nation?.rice || this.nation?.data?.rice || 0;
    const npcType = genData.npc || 0;
    
    // NPC면 군량 부족 시 70% 확률로 출병 안 함
    if (nationRice < (this.env.baserice || 50000) && npcType >= 2 && this.rng() < 0.7) {
      return null;
    }
    
    const train = genData.train || 0;
    const atmos = genData.atmos || 0;
    const crew = genData.crew || 0;
    
    // 훈련도 체크
    const minTrain = Math.min(100, this.policy.properWarTrainAtmos);
    if (train < minTrain) {
      return null;
    }
    
    // 사기 체크
    const minAtmos = Math.min(100, this.policy.properWarTrainAtmos);
    if (atmos < minAtmos) {
      return null;
    }
    
    // 병력 체크
    const minCrew = Math.min((this.fullLeadership - 2) * 100, this.policy.minWarCrew);
    if (crew < minCrew) {
      return null;
    }
    
    // 도시 전방 상태 체크
    const cityData = this.city?.data || this.city || {};
    const front = cityData.front || 0;
    
    // front === 0: 후방 도시, front === 1: 전방 경계 (출병 불가)
    if (front === 0 || front === 1) {
      return null;
    }
    
    // 출병 가능! (실제 목적지는 상위에서 결정)
    return {
      command: '출병',
      args: { destCityID: null }, // 목적지는 상위에서 결정
      weight: 100,
      reason: `[전쟁] 출병 조건 충족 (병력:${crew}, 훈련:${train}, 사기:${atmos})`,
    };
  }
  
  /**
   * 전쟁 시: 내정 (PHP do전쟁내정 포팅)
   * - 50% 이하 개발만 수행
   * - 전방 도시는 낮은 가중치
   */
  public pickGeneralActionWarDomestic(): AICommandDecision | null {
    if (this.dipState === DipState.d평화) {
      return null;
    }
    
    const nationRice = this.nation?.rice || this.nation?.data?.rice || 0;
    
    // 군량 부족 시 30% 확률로 스킵
    if (nationRice < (this.env.baserice || 50000) && this.rng() < 0.3) {
      return null;
    }
    
    // 30% 확률로 스킵 (전쟁 중에는 내정 덜 함)
    if (this.rng() < 0.3) {
      return null;
    }
    
    const develRate = this.calcCityDevelRate(this.city);
    const isSpringSummer = this.env.month <= 6;
    const cityData = this.city?.data || this.city || {};
    const front = cityData.front || 0;
    const isFrontCity = front === 1 || front === 3;
    
    const cmdList: WeightedAction[] = [];
    
    // === 통솔장: 민심/인구 ===
    if (this.genType & GenType.t통솔장) {
      // 주민선정 (민심 98% 미만)
      if (develRate.trust < 0.98) {
        const weight = this.leadership / this.valueFit(develRate.trust / 2 - 0.2) * 2;
        cmdList.push({
          command: '주민선정',
          args: {},
          weight,
          reason: `[전쟁내정] 민심 부족 (${(develRate.trust * 100).toFixed(1)}%)`,
        });
      }
      
      // 정착장려 (인구 80% 미만)
      if (develRate.pop < 0.8) {
        // 전방 도시는 가중치 유지, 후방은 절반
        const frontBonus = isFrontCity ? 1 : 0.5;
        const weight = this.leadership / this.valueFit(develRate.pop) * frontBonus;
        cmdList.push({
          command: '정착장려',
          args: {},
          weight,
          reason: `[전쟁내정] 인구 부족 (${(develRate.pop * 100).toFixed(1)}%), ${isFrontCity ? '전방' : '후방'}`,
        });
      }
    }
    
    // === 무장: 수비/성벽/치안 (50% 미만만) ===
    if (this.genType & GenType.t무장) {
      if (develRate.def < 0.5) {
        const weight = this.strength / this.valueFit(develRate.def) / 2;
        cmdList.push({
          command: '수비강화',
          args: {},
          weight,
          reason: `[전쟁내정] 수비 부족 (${(develRate.def * 100).toFixed(1)}%)`,
        });
      }
      
      if (develRate.wall < 0.5) {
        const weight = this.strength / this.valueFit(develRate.wall) / 2;
        cmdList.push({
          command: '성벽보수',
          args: {},
          weight,
          reason: `[전쟁내정] 성벽 부족 (${(develRate.wall * 100).toFixed(1)}%)`,
        });
      }
      
      if (develRate.secu < 0.5) {
        const weight = this.strength / this.valueFit(develRate.secu / 0.8, 0.001, 1) / 4;
        cmdList.push({
          command: '치안강화',
          args: {},
          weight,
          reason: `[전쟁내정] 치안 부족 (${(develRate.secu * 100).toFixed(1)}%)`,
        });
      }
    }
    
    // === 지장: 기술/농업/상업 (50% 미만만) ===
    if (this.genType & GenType.t지장) {
      // 기술연구 (전쟁 중 더 열심히)
      const nationTech = this.nation?.tech || this.nation?.data?.tech || 0;
      if (!this.techLimit(nationTech)) {
        const nextTech = (nationTech % 1000) + 1;
        const techBehind = !this.techLimit(nationTech + 1000);
        const weight = techBehind
          ? this.intel / (nextTech / 3000) // 전쟁 중 더 높은 가중치
          : this.intel;
        cmdList.push({
          command: '기술연구',
          args: {},
          weight,
          reason: `[전쟁내정] 기술 연구 필요 (현재: ${nationTech})`,
        });
      }
      
      // 농지개간 (50% 미만)
      if (develRate.agri < 0.5) {
        const seasonBonus = isSpringSummer ? 1.2 : 0.8;
        const frontBonus = isFrontCity ? 0.25 : 0.5;
        const weight = seasonBonus * this.intel * frontBonus / this.valueFit(develRate.agri, 0.001, 1);
        cmdList.push({
          command: '농지개간',
          args: {},
          weight,
          reason: `[전쟁내정] 농업 부족 (${(develRate.agri * 100).toFixed(1)}%)`,
        });
      }
      
      // 상업투자 (50% 미만)
      if (develRate.comm < 0.5) {
        const seasonBonus = isSpringSummer ? 0.8 : 1.2;
        const frontBonus = isFrontCity ? 0.25 : 0.5;
        const weight = seasonBonus * this.intel * frontBonus / this.valueFit(develRate.comm, 0.001, 1);
        cmdList.push({
          command: '상업투자',
          args: {},
          weight,
          reason: `[전쟁내정] 상업 부족 (${(develRate.comm * 100).toFixed(1)}%)`,
        });
      }
    }
    
    return this.choiceUsingWeightPair(cmdList);
  }

  // ================================================================
  // === 공통 유틸리티 ===
  // ================================================================
  
  /**
   * 기술 한도 체크 (PHP TechLimit 포팅)
   * @returns true면 한도에 도달해서 더 연구 못함
   */
  private techLimit(tech: number): boolean {
    const startYear = this.env.startyear || 184;
    const year = this.env.year || 200;
    const relYear = year - startYear;
    
    // 연도당 1000 기술 한도 (대략적 근사)
    const maxTech = Math.floor(relYear / 5) * 1000 + 1000;
    return tech >= maxTech;
  }
  
  /**
   * 병종 선택 (간단화)
   */
  private selectBestCrewType(): number {
    if (this.fullStrength >= 80) return 4;  // 기병
    if (this.fullIntel >= 80) return 3;     // 노병
    if (this.fullStrength >= 60) return 2;  // 극병
    return 1; // 창병
  }
  
  // ================================================================
  // === 메인 선택 로직 ===
  // ================================================================
  
  /**
   * dipState에 따른 메인 액션 선택
   * PHP chooseGeneralTurn의 priority 루프를 간소화
   */
  public selectAction(priority: GeneralActionType[]): AICommandDecision | null {
    const genData = this.general.data || this.general;
    
    // 1. 부상 체크 (최우선)
    const injury = genData.injury || 0;
    if (injury > this.policy.cureThreshold) {
      return {
        command: '요양',
        args: {},
        weight: 100,
        reason: `부상 치료 필요 (부상: ${injury} > ${this.policy.cureThreshold})`,
      };
    }
    
    // 2. 우선순위 순서대로 액션 시도
    for (const actionType of priority) {
      const result = this.tryAction(actionType);
      if (result) {
        return result;
      }
    }
    
    // 3. 기본 행동: 휴식
    return null;
  }
  
  /**
   * 특정 액션 타입에 대한 처리
   */
  private tryAction(actionType: GeneralActionType): AICommandDecision | null {
    switch (actionType) {
      // 내정
      case GeneralActionType.일반내정:
        if (this.dipState === DipState.d평화) {
          return this.pickGeneralActionPeace();
        }
        return null;
      
      case GeneralActionType.긴급내정:
        return this.pickGeneralActionDeclared();
      
      case GeneralActionType.전쟁내정:
        return this.pickGeneralActionWarDomestic();
      
      // 징병/훈련
      case GeneralActionType.징병:
      case GeneralActionType.모병:
        return this.pickGeneralActionRecruit();
      
      case GeneralActionType.전투준비:
        return this.pickGeneralActionPreWar();
      
      // 출병
      case GeneralActionType.출병:
        return this.pickGeneralActionWar();
      
      // 기타 (추후 구현)
      case GeneralActionType.금쌀구매:
        return this.pickGoldRiceTrade();
      
      case GeneralActionType.후방워프:
      case GeneralActionType.전방워프:
      case GeneralActionType.내정워프:
        // 워프 로직은 복잡하므로 별도 구현 필요
        return null;
      
      default:
        return null;
    }
  }
  
  /**
   * 금/쌀 거래 (PHP do금쌀구매 간소화)
   */
  private pickGoldRiceTrade(): AICommandDecision | null {
    const genData = this.general.data || this.general;
    const gold = genData.gold || 0;
    const rice = genData.rice || 0;
    
    const baseCost = this.env.develcost * 12 * 2;
    
    // 자원이 너무 적으면 스킵
    if (gold + rice < baseCost) {
      return null;
    }
    
    // 금이 쌀의 2배 이상 -> 쌀 구매
    if (gold > rice * 2) {
      const amount = Math.min(Math.floor((gold - rice) / 2), 10000);
      if (amount >= this.policy.minimumResourceActionAmount) {
        return {
          command: '군량매매',
          args: { buyRice: true, amount },
          weight: 20,
          reason: `[자원균형] 쌀 구매 (금:${gold}, 쌀:${rice})`,
        };
      }
    }
    
    // 쌀이 금의 2배 이상 -> 쌀 판매
    if (rice > gold * 2) {
      const amount = Math.min(Math.floor((rice - gold) / 2), 10000);
      if (amount >= this.policy.minimumResourceActionAmount) {
        return {
          command: '군량매매',
          args: { buyRice: false, amount },
          weight: 20,
          reason: `[자원균형] 쌀 판매 (금:${gold}, 쌀:${rice})`,
        };
      }
    }
    
    return null;
  }
}

// ================================================================
// === Export 헬퍼 함수 ===
// ================================================================

/**
 * 외교 상태 계산 (PHP calcDiplomacyState 간소화)
 */
export function calculateDipState(nation: any, warTargets: any[]): DipState {
  if (!nation || nation.nation === 0) {
    return DipState.d평화;
  }
  
  // 전쟁 중인 국가가 있는지 확인
  const hasActiveWar = warTargets.some((target: any) => target.state === 0);
  if (hasActiveWar) {
    return DipState.d전쟁;
  }
  
  // 선포된 국가가 있는지 확인 (state가 1이거나 특정 조건)
  const hasDeclared = warTargets.some((target: any) => target.state === 1);
  if (hasDeclared) {
    // 남은 개월 수에 따라 상태 결정
    const minMonths = Math.min(...warTargets.filter((t: any) => t.state === 1).map((t: any) => t.remainMonth || 3));
    if (minMonths <= 0) {
      return DipState.d전쟁;
    } else if (minMonths <= 1) {
      return DipState.d직전;
    } else if (minMonths <= 2) {
      return DipState.d징병;
    }
    return DipState.d선포;
  }
  
  return DipState.d평화;
}

/**
 * 빠른 액션 선택 헬퍼
 */
export function quickSelectAction(
  general: any,
  city: any,
  nation: any,
  env: any,
  dipState: DipState,
  priority: GeneralActionType[]
): AICommandDecision | null {
  const policy: PolicyConfig = {
    minWarCrew: 3000,
    properWarTrainAtmos: 80,
    minNPCRecruitCityPopulation: 5000,
    safeRecruitCityPopulationRatio: 0.6,
    minNPCWarLeadership: 60,
    minimumResourceActionAmount: 100,
    cureThreshold: 10,
  };
  
  const selector = new DipStateActionSelector(
    general, city, nation, env, policy, dipState
  );
  
  return selector.selectAction(priority);
}
