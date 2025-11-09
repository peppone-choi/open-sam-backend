/**
 * 간단한 NPC AI 엔진
 * PHP GeneralAI를 참고하여 핵심 로직만 구현
 */

import { cityRepository } from '../repositories/city.repository';
import { nationRepository } from '../repositories/nation.repository';
import { GameConst } from '../constants/GameConst';

export interface AICommandDecision {
  command: string;
  args: any;
  weight: number;
  reason: string;
}

export interface GeneralStats {
  leadership: number;
  strength: number;
  intel: number;
  gold: number;
  rice: number;
  crew: number;
  officerLevel: number;
}

export interface CityStats {
  pop: number;
  popMax: number;
  agri: number;
  agriMax: number;
  comm: number;
  commMax: number;
  secu: number;
  secuMax: number;
  def: number;
  defMax: number;
  wall: number;
  wallMax: number;
}

export class SimpleAI {
  private general: any;
  private city: any;
  private nation: any;
  private env: any;

  constructor(general: any, city: any, nation: any, env: any) {
    this.general = general;
    this.city = city;
    this.nation = nation;
    this.env = env;
  }

  /**
   * 다음 명령 결정
   */
  async decideNextCommand(): Promise<AICommandDecision | null> {
    const genData = this.general.data || this.general;
    const stats = this.extractGeneralStats(genData);
    const genType = this.calculateGeneralType(stats);

    // 국가 자원이 부족하면 30% 확률로 휴식
    const nationData = this.nation?.data || this.nation;
    if (nationData.rice < (GameConst.baserice || 50000) && Math.random() < 0.3) {
      return null;
    }

    const candidates: AICommandDecision[] = [];

    // 1. 군주 전용 명령
    if (stats.officerLevel >= 12) {
      const nationCommands = await this.evaluateNationCommands(stats, genType);
      candidates.push(...nationCommands);
    }

    // 2. 내정 명령
    const domesticCommands = await this.evaluateDomesticCommands(stats, genType);
    candidates.push(...domesticCommands);

    // 3. 군사 명령
    const militaryCommands = await this.evaluateMilitaryCommands(stats, genType);
    candidates.push(...militaryCommands);

    // 4. 자기계발 명령
    const selfImprovementCommands = this.evaluateSelfImprovementCommands(stats);
    candidates.push(...selfImprovementCommands);

    // 5. 거래 명령
    const tradeCommands = this.evaluateTradeCommands(stats);
    candidates.push(...tradeCommands);

    if (candidates.length === 0) {
      return null; // 휴식
    }

    // 실행 가능한 명령만 필터링
    const validCandidates = await this.filterValidCommands(candidates);
    
    if (validCandidates.length === 0) {
      return null; // 휴식
    }

    // 가중치 기반 선택
    return this.selectCommandByWeight(validCandidates);
  }

  /**
   * 실행 가능한 명령만 필터링
   */
  private async filterValidCommands(
    candidates: AICommandDecision[]
  ): Promise<AICommandDecision[]> {
    const validCommands: AICommandDecision[] = [];

    for (const candidate of candidates) {
      if (await this.canExecuteCommand(candidate)) {
        validCommands.push(candidate);
      }
    }

    return validCommands;
  }

  /**
   * 명령 실행 가능 여부 체크
   */
  private async canExecuteCommand(decision: AICommandDecision): Promise<boolean> {
    const genData = this.general.data || this.general;
    const cityData = this.city?.data || this.city;
    const nationData = this.nation?.data || this.nation;

    // 기본 조건들 체크
    switch (decision.command) {
      case '징병':
        return this.canConscript(genData, cityData);
      
      case '훈련':
        return this.canTrain(genData);
      
      case '출병':
        return await this.shouldDeploy(genData);
      
      case '농지개간':
      case '상업투자':
      case '치안강화':
      case '수비강화':
      case '성벽보수':
        return this.canDomestic(genData, cityData);
      
      case '주민선정':
      case '정착장려':
        return this.canDomestic(genData, cityData) && (cityData?.trust || 0) >= 20;
      
      case '기술연구':
        return this.canResearchTech(genData, nationData);
      
      case '군량매매':
        return this.canTrade(genData, decision.args);
      
      case '단련':
      case '견문':
        return true; // 항상 가능
      
      case '전투특기초기화':
      case '내정특기초기화':
        return genData.gold >= 1000;
      
      case '포상':
        return genData.officer_level >= 12 && genData.gold >= 1000 && (nationData?.gold || 0) >= 5000;
      
      case '선전포고':
        return genData.officer_level >= 12 && decision.args?.targetNationId != null;
      
      default:
        return true; // 알 수 없는 명령은 일단 허용
    }
  }

  /**
   * 기술연구 가능 여부
   */
  private canResearchTech(genData: any, nationData: any): boolean {
    // 재야가 아니어야 함
    if (genData.nation === 0) return false;
    
    // 국가가 있어야 함
    if (!nationData) return false;
    
    // 지력 60 이상
    if (genData.intel < 60) return false;
    
    // 자금 필요
    if (genData.gold < 1000) return false;
    
    return true;
  }

  /**
   * 징병 가능 여부
   */
  private canConscript(genData: any, cityData: any): boolean {
    // 재야가 아니어야 함
    if (genData.nation === 0) return false;
    
    // 도시를 점령하고 있어야 함
    if (!cityData || cityData.nation !== genData.nation) return false;
    
    // 최소 인구 필요
    if (cityData.pop < 200) return false;
    
    // 민심 20 이상
    if (cityData.trust < 20) return false;
    
    // 자금/군량 필요
    if (genData.gold < 500 || genData.rice < 500) return false;
    
    return true;
  }

  /**
   * 훈련 가능 여부
   */
  private canTrain(genData: any): boolean {
    // 병사 필요
    if (genData.crew < 100) return false;
    
    // 자금/군량 필요
    if (genData.gold < 100 || genData.rice < 100) return false;
    
    return true;
  }

  /**
   * 내정 가능 여부
   */
  private canDomestic(genData: any, cityData: any): boolean {
    // 재야가 아니어야 함
    if (genData.nation === 0) return false;
    
    // 도시를 점령하고 있어야 함
    if (!cityData || cityData.nation !== genData.nation) return false;
    
    // 최소 자금 필요
    if (genData.gold < 100) return false;
    
    return true;
  }

  /**
   * 거래 가능 여부
   */
  private canTrade(genData: any, args: any): boolean {
    if (args.mode === 'buy') {
      // 구매: 자금 필요
      return genData.gold >= 1000;
    } else {
      // 판매: 군량 필요
      return genData.rice >= 1000;
    }
  }

  /**
   * 장수 능력치 추출
   */
  private extractGeneralStats(genData: any): GeneralStats {
    return {
      leadership: genData.leadership || 50,
      strength: genData.strength || 50,
      intel: genData.intel || 50,
      gold: genData.gold || 0,
      rice: genData.rice || 0,
      crew: genData.crew || 0,
      officerLevel: genData.officer_level || 1
    };
  }

  /**
   * 장수 타입 계산 (통솔장/무장/지장)
   */
  private calculateGeneralType(stats: GeneralStats): number {
    const TYPE_COMMANDER = 1; // 통솔장
    const TYPE_WARRIOR = 2;   // 무장
    const TYPE_STRATEGIST = 4; // 지장

    let type = 0;

    if (stats.leadership >= 70) type |= TYPE_COMMANDER;
    if (stats.strength >= 70) type |= TYPE_WARRIOR;
    if (stats.intel >= 70) type |= TYPE_STRATEGIST;

    // 타입이 없으면 가장 높은 능력치로 결정
    if (type === 0) {
      const max = Math.max(stats.leadership, stats.strength, stats.intel);
      if (max === stats.leadership) type = TYPE_COMMANDER;
      else if (max === stats.strength) type = TYPE_WARRIOR;
      else type = TYPE_STRATEGIST;
    }

    return type;
  }

  /**
   * 도시 개발률 계산
   */
  private calculateDevelopmentRates(city: any): Record<string, number> {
    const cityData = city?.data || city || {};
    return {
      pop: (cityData.pop || 0) / Math.max(cityData.pop_max || 10000, 1),
      agri: (cityData.agri || 0) / Math.max(cityData.agri_max || 10000, 1),
      comm: (cityData.comm || 0) / Math.max(cityData.comm_max || 10000, 1),
      secu: (cityData.secu || 0) / Math.max(cityData.secu_max || 10000, 1),
      def: (cityData.def || 0) / Math.max(cityData.def_max || 10000, 1),
      wall: (cityData.wall || 0) / Math.max(cityData.wall_max || 10000, 1),
      trust: (cityData.trust || 50) / 100
    };
  }

  /**
   * 국가 명령 평가 (군주 전용)
   */
  private async evaluateNationCommands(
    stats: GeneralStats,
    genType: number
  ): Promise<AICommandDecision[]> {
    const commands: AICommandDecision[] = [];
    const nationData = this.nation?.data || this.nation;

    // 포상
    if (stats.gold >= 10000 && nationData.gold >= 5000) {
      commands.push({
        command: '포상',
        args: {},
        weight: 5,
        reason: '국가 자금 충분, 장수 사기 증진'
      });
    }

    // 선전포고 (평화 시, 자원 충분, 기술 발전)
    const canDeclareWar = await this.shouldDeclareWar(nationData);
    if (canDeclareWar) {
      commands.push({
        command: '선전포고',
        args: { targetNationId: canDeclareWar },
        weight: 15,
        reason: '전쟁 준비 완료'
      });
    }

    // TODO: 발령, 천도, 외교 등 추가

    return commands;
  }

  /**
   * 선전포고 가능 여부 및 대상 결정
   */
  private async shouldDeclareWar(nationData: any): Promise<number | null> {
    // 방랑군이나 재야는 선전포고 불가
    if (!nationData || nationData.level === 0) return null;

    // 수도가 없으면 불가
    if (!nationData.capital) return null;

    // 자원 충분 여부 (평균 자원의 1.5배 이상)
    const avgGold = 10000; // TODO: 실제 평균 계산
    const avgRice = 10000;
    
    if (nationData.gold < avgGold * 1.5 || nationData.rice < avgRice * 1.5) {
      return null;
    }

    // TODO: 외교 상태 확인, 약한 국가 찾기
    // 현재는 간단히 null 반환 (선포 안 함)
    return null;
  }

  /**
   * 기술연구 평가
   */
  private async evaluateTechResearch(stats: GeneralStats): Promise<number> {
    const nationData = this.nation?.data || this.nation;
    if (!nationData) return 0;

    const currentTech = nationData.tech || 0;
    const year = this.env.year || 200;
    const startYear = this.env.startyear || 184;

    // 기술 레벨 제한 체크 (년도에 따라 최대 기술 제한)
    const maxTechByYear = Math.floor((year - startYear) / 5) * 1000;
    
    // 현재 기술이 연도 제한보다 낮으면 연구 필요
    if (currentTech < maxTechByYear) {
      const nextTech = (currentTech % 1000) + 1;
      
      // 한 등급 이상 뒤처져 있으면 가중치 증가
      if (currentTech + 1000 <= maxTechByYear) {
        return stats.intel / (nextTech / 2000);
      } else {
        return stats.intel;
      }
    }

    return 0;
  }

  /**
   * 내정 명령 평가
   */
  private async evaluateDomesticCommands(
    stats: GeneralStats,
    genType: number
  ): Promise<AICommandDecision[]> {
    const commands: AICommandDecision[] = [];
    const develRate = this.calculateDevelopmentRates(this.city);
    const isSpringSummer = (this.env.month || 1) <= 6;

    const TYPE_COMMANDER = 1;
    const TYPE_WARRIOR = 2;
    const TYPE_STRATEGIST = 4;

    // 통솔장: 주민 관련
    if (genType & TYPE_COMMANDER) {
      if (develRate.trust < 0.98) {
        const weight = stats.leadership / Math.max(develRate.trust / 2 - 0.2, 0.001) * 2;
        commands.push({
          command: '주민선정',
          args: {},
          weight: weight,
          reason: `민심 부족 (${(develRate.trust * 100).toFixed(1)}%)`
        });
      }

      if (develRate.pop < 0.8) {
        const weight = stats.leadership / Math.max(develRate.pop, 0.001);
        commands.push({
          command: '정착장려',
          args: {},
          weight: weight,
          reason: `인구 부족 (${(develRate.pop * 100).toFixed(1)}%)`
        });
      }
    }

    // 무장: 방어 관련
    if (genType & TYPE_WARRIOR) {
      if (develRate.def < 1) {
        const weight = stats.strength / Math.max(develRate.def, 0.001);
        commands.push({
          command: '수비강화',
          args: {},
          weight: weight,
          reason: `수비 부족 (${(develRate.def * 100).toFixed(1)}%)`
        });
      }

      if (develRate.wall < 1) {
        const weight = stats.strength / Math.max(develRate.wall, 0.001);
        commands.push({
          command: '성벽보수',
          args: {},
          weight: weight,
          reason: `성벽 부족 (${(develRate.wall * 100).toFixed(1)}%)`
        });
      }

      if (develRate.secu < 0.9) {
        const weight = stats.strength / Math.max(develRate.secu / 0.8, 0.001);
        commands.push({
          command: '치안강화',
          args: {},
          weight: weight,
          reason: `치안 부족 (${(develRate.secu * 100).toFixed(1)}%)`
        });
      }
    }

    // 지장: 경제/기술
    if (genType & TYPE_STRATEGIST) {
      // 기술연구 (기술이 뒤처진 경우)
      const techWeight = await this.evaluateTechResearch(stats);
      if (techWeight > 0) {
        commands.push({
          command: '기술연구',
          args: {},
          weight: techWeight,
          reason: '기술 발전 필요'
        });
      }

      // 농지개간 (봄/여름 가중치 증가)
      if (develRate.agri < 1) {
        const seasonBonus = isSpringSummer ? 1.2 : 0.8;
        const weight = seasonBonus * stats.intel / Math.max(develRate.agri, 0.001);
        commands.push({
          command: '농지개간',
          args: {},
          weight: weight,
          reason: `농업 부족 (${(develRate.agri * 100).toFixed(1)}%), ${isSpringSummer ? '봄/여름' : '가을/겨울'}`
        });
      }

      // 상업투자 (가을/겨울 가중치 증가)
      if (develRate.comm < 1) {
        const seasonBonus = isSpringSummer ? 0.8 : 1.2;
        const weight = seasonBonus * stats.intel / Math.max(develRate.comm, 0.001);
        commands.push({
          command: '상업투자',
          args: {},
          weight: weight,
          reason: `상업 부족 (${(develRate.comm * 100).toFixed(1)}%), ${isSpringSummer ? '봄/여름' : '가을/겨울'}`
        });
      }
    }

    return commands;
  }

  /**
   * 군사 명령 평가
   */
  private async evaluateMilitaryCommands(
    stats: GeneralStats,
    genType: number
  ): Promise<AICommandDecision[]> {
    const commands: AICommandDecision[] = [];
    const genData = this.general.data || this.general;

    // 자원이 충분한 경우만
    if (stats.gold < 1000 || stats.rice < 1000) {
      return commands;
    }

    // 징병
    if (stats.crew < 5000 && stats.leadership >= 60) {
      commands.push({
        command: '징병',
        args: { crewType: this.selectBestCrewType(genData), amount: 1000 },
        weight: stats.leadership / 5,
        reason: '병사 부족'
      });
    }

    // 훈련 (전쟁 준비)
    const train = genData.train || 0;
    const atmos = genData.atmos || 0;
    
    if (stats.crew >= 500 && stats.strength >= 60) {
      if (train < 80 || atmos < 80) {
        commands.push({
          command: '훈련',
          args: {},
          weight: stats.strength / 5,
          reason: `훈련/사기 부족 (훈련:${train}, 사기:${atmos})`
        });
      }
    }

    // 출병 (전쟁 중, 전방 도시, 준비 완료)
    if (await this.shouldDeploy(genData)) {
      commands.push({
        command: '출병',
        args: await this.selectDeployTarget(genData),
        weight: stats.strength * 2,
        reason: '전쟁 중, 출병 가능'
      });
    }

    return commands;
  }

  /**
   * 최적 병종 선택
   */
  private selectBestCrewType(genData: any): number {
    const strength = genData.strength || 50;
    const intel = genData.intel || 50;

    // 무력이 높으면 기병(4), 지력이 높으면 노병(3), 평범하면 창병(1)
    if (strength >= 80) return 4; // 기병
    if (intel >= 80) return 3;    // 노병
    if (strength >= 60) return 2; // 극병
    return 1; // 창병
  }

  /**
   * 출병 가능 여부
   */
  private async shouldDeploy(genData: any): Promise<boolean> {
    // 훈련과 사기가 충분해야 함
    const train = genData.train || 0;
    const atmos = genData.atmos || 0;
    const minTrainAtmos = 70;

    if (train < minTrainAtmos || atmos < minTrainAtmos) {
      return false;
    }

    // 병사가 충분해야 함
    const crew = genData.crew || 0;
    const leadership = genData.leadership || 50;
    const minCrew = Math.min((leadership - 2) * 100, 3000);

    if (crew < minCrew) {
      return false;
    }

    // TODO: 전쟁 상태 및 전방 도시 확인
    // 현재는 간단히 false 반환
    return false;
  }

  /**
   * 출병 대상 선택
   */
  private async selectDeployTarget(genData: any): Promise<any> {
    // TODO: 인접 적 도시 찾기
    return { destCityID: 1 };
  }

  /**
   * 자기계발 명령 평가
   */
  private evaluateSelfImprovementCommands(stats: GeneralStats): AICommandDecision[] {
    const commands: AICommandDecision[] = [];
    const genData = this.general.data || this.general;

    // 특기에 따른 자기계발
    const special = genData.special || 'None';
    const special2 = genData.special2 || 'None';

    // 단련 (능력치가 낮을 때)
    const avgStat = (stats.leadership + stats.strength + stats.intel) / 3;
    if (avgStat < 80) {
      const targetStat = this.selectTrainingStat(stats);
      commands.push({
        command: '단련',
        args: { targetStat },
        weight: 10,
        reason: `능력치 향상 필요 (평균:${avgStat.toFixed(1)})`
      });
    }

    // 견문 (경험치 낮을 때)
    const experience = genData.experience || 0;
    if (experience < 5000) {
      commands.push({
        command: '견문',
        args: {},
        weight: 5,
        reason: '경험치 획득 필요'
      });
    }

    // 특기 초기화 (특기가 성에 안 차면)
    if (this.shouldResetSkill(genData, special, special2)) {
      commands.push({
        command: special.includes('전투') ? '전투특기초기화' : '내정특기초기화',
        args: {},
        weight: 2,
        reason: '특기 재설정'
      });
    }

    return commands;
  }

  /**
   * 훈련 대상 능력치 선택
   */
  private selectTrainingStat(stats: GeneralStats): string {
    const { leadership, strength, intel } = stats;
    const min = Math.min(leadership, strength, intel);

    if (leadership === min) return 'leadership';
    if (strength === min) return 'strength';
    return 'intel';
  }

  /**
   * 특기 초기화 필요 여부
   */
  private shouldResetSkill(genData: any, special: string, special2: string): boolean {
    // 특기가 None이면 재설정 불필요
    if (special === 'None' && special2 === 'None') return false;

    // TODO: 특기 품질 평가 로직
    // 현재는 간단히 false 반환
    return false;
  }

  /**
   * 거래 명령 평가
   */
  private evaluateTradeCommands(stats: GeneralStats): AICommandDecision[] {
    const commands: AICommandDecision[] = [];

    // 군량 구매 (자금 많고 군량 부족)
    if (stats.gold >= 10000 && stats.rice < 5000) {
      commands.push({
        command: '군량매매',
        args: { mode: 'buy', amount: 1000 },
        weight: 8,
        reason: '군량 부족'
      });
    }

    // 군량 판매 (군량 많고 자금 부족)
    if (stats.rice >= 10000 && stats.gold < 5000) {
      commands.push({
        command: '군량매매',
        args: { mode: 'sell', amount: 1000 },
        weight: 8,
        reason: '자금 부족'
      });
    }

    return commands;
  }

  /**
   * 가중치 기반 명령 선택
   */
  private selectCommandByWeight(candidates: AICommandDecision[]): AICommandDecision | null {
    if (candidates.length === 0) return null;

    const totalWeight = candidates.reduce((sum, cmd) => sum + cmd.weight, 0);
    let random = Math.random() * totalWeight;

    for (const cmd of candidates) {
      random -= cmd.weight;
      if (random <= 0) {
        return cmd;
      }
    }

    return candidates[0];
  }
}
