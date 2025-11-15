/**
 * 간단한 NPC AI 엔진
 * PHP GeneralAI를 참고하여 핵심 로직만 구현
 */

import { cityRepository } from '../repositories/city.repository';
import { nationRepository } from '../repositories/nation.repository';
import { GameConst } from '../constants/GameConst';
import { 
  AutorunGeneralPolicy, 
  AIOptions, 
  GeneralActionType 
} from './AutorunGeneralPolicy';
import { 
  AutorunNationPolicy, 
  NationActionType 
} from './AutorunNationPolicy';

/**
 * 역사적 인물 기반 장수 타입 (31가지)
 */
export enum HistoricalArchetype {
  // S급 (4-5개 능력 80+)
  ALL_ROUNDER = '천하패자',        // 조조
  PERFECT_RULER = '천하명군',      // 유비
  PERFECT_GENERAL = '천하명장',    // 관우/조운/제갈량
  
  // A급 (3개 능력 80+)
  EMPEROR = '제왕',                // 손권
  GRAND_COMMANDER = '대도독',      // 주유/육손
  FIVE_TIGERS = '오호장군',        // 관장조마황
  SUPREME_STRATEGIST = '왕좌모사', // 제갈량/사마의
  GHOST_STRATEGIST = '귀모책사',   // 곽가/가후
  
  // B급 (2개 능력 80+)
  BRAVE_WARRIOR = '용맹맹장',      // 여포
  VETERAN_WARRIOR = '백전맹장',    // 서황/장합
  SCHOLAR_WARRIOR = '문무겸장',    // 조인/육항
  WISE_ADVISOR = '명신모사',       // 순욱/진군
  LOYAL_GENERAL = '충신맹장',      // 전위/고순
  RAIDER = '약탈맹장',             // 문추/안량
  STATE_ADMIN = '경세대신',        // 순욱/장소
  
  // C급 (1개 특화)
  PURE_WARRIOR = '순수무인',       // 전위/허저
  PURE_TACTICIAN = '순수모사',     // 서서/법정
  PURE_ADMIN = '순수내정',         // 장굉/비의
  POPULAR = '인기스타',            // 초선
  
  // 특수
  VETERAN_ELDER = '노장',          // 황충
  TYRANT = '암군',                 // 동탁
  TRAITOR = '모반자',              // 여포/맹달
  EUNUCH = '환관',                 // 황호
  RIGHTEOUS = '의사',              // 조운
  SCHOLAR = '명사',                // 관녕
  GALLANT = '호걸',                // 허저
  SWORDMASTER = '검객',            // 왕월
  SIEGE_EXPERT = '공성전문',       // 조인
  CAVALRY_EXPERT = '기병대장',     // 마초
  NAVAL_EXPERT = '수군대독',       // 주유
  BANDIT = '도적출신',             // 장연
  
  // 기타
  AVERAGE = '평범',                // 기본형
}

/**
 * 장수 능력치 정보
 */
export interface GeneralStatsExtended {
  leadership: number;  // 통솔 (l)
  strength: number;    // 무력 (s)
  intel: number;       // 지력 (i)
  politics: number;    // 정치 (p)
  charm: number;       // 매력 (c)
}

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

/**
 * 역사적 인물 기반 장수 타입 분류기
 */
export class GeneralTypeClassifier {
  /**
   * 장수의 능력치를 기반으로 역사적 인물 타입 분류
   */
  static classify(genData: any): HistoricalArchetype {
    const stats: GeneralStatsExtended = {
      leadership: genData.leadership || 50,
      strength: genData.strength || 50,
      intel: genData.intel || 50,
      politics: genData.politics || genData.leadership || 50, // politics 없으면 leadership 사용
      charm: genData.charm || genData.leadership || 50,       // charm 없으면 leadership 사용
    };

    // 80+ 능력치 개수 계산
    const highStats = [
      stats.leadership >= 80 ? 1 : 0,
      stats.strength >= 80 ? 1 : 0,
      stats.intel >= 80 ? 1 : 0,
      stats.politics >= 80 ? 1 : 0,
      stats.charm >= 80 ? 1 : 0,
    ].reduce((a, b) => a + b, 0);

    // S급 (4-5개 능력 80+)
    if (highStats >= 4) {
      return this.classifySRank(stats);
    }

    // A급 (3개 능력 80+)
    if (highStats === 3) {
      return this.classifyARank(stats);
    }

    // B급 (2개 능력 80+)
    if (highStats === 2) {
      return this.classifyBRank(stats);
    }

    // C급 (1개 특화)
    if (highStats === 1) {
      return this.classifyCRank(stats);
    }

    // 특수 케이스
    return this.classifySpecial(stats, genData);
  }

  /**
   * S급 분류 (4-5개 능력 80+)
   */
  private static classifySRank(stats: GeneralStatsExtended): HistoricalArchetype {
    // 천하패자 (조조형): 통솔/지력/정치/매력 높음, 무력 중간
    if (stats.leadership >= 90 && stats.intel >= 85 && stats.politics >= 90 && stats.charm >= 90) {
      return HistoricalArchetype.ALL_ROUNDER;
    }

    // 천하명군 (유비형): 매력 최고, 나머지 고르게
    if (stats.charm >= 95) {
      return HistoricalArchetype.PERFECT_RULER;
    }

    // 천하명장 (관우/조운/제갈량형): 통솔+무력+α 또는 통솔+지력+α
    return HistoricalArchetype.PERFECT_GENERAL;
  }

  /**
   * A급 분류 (3개 능력 80+)
   */
  private static classifyARank(stats: GeneralStatsExtended): HistoricalArchetype {
    // 왕좌모사 (제갈량/사마의형): 통솔+지력+정치
    if (stats.leadership >= 90 && stats.intel >= 95 && stats.politics >= 90) {
      return HistoricalArchetype.SUPREME_STRATEGIST;
    }

    // 대도독 (주유/육손형): 통솔+지력+정치
    if (stats.leadership >= 90 && stats.intel >= 90 && stats.politics >= 80) {
      return HistoricalArchetype.GRAND_COMMANDER;
    }

    // 오호장군 (관장조마황형): 통솔+무력+매력
    if (stats.leadership >= 85 && stats.strength >= 90 && stats.charm >= 80) {
      return HistoricalArchetype.FIVE_TIGERS;
    }

    // 귀모책사 (곽가/가후형): 지력+정치, 무력 낮음
    if (stats.intel >= 90 && stats.politics >= 70 && stats.strength < 40) {
      return HistoricalArchetype.GHOST_STRATEGIST;
    }

    // 제왕형 (손권형): 통솔+정치+매력
    if (stats.leadership >= 80 && stats.politics >= 80 && stats.charm >= 80) {
      return HistoricalArchetype.EMPEROR;
    }

    return HistoricalArchetype.GRAND_COMMANDER;
  }

  /**
   * B급 분류 (2개 능력 80+)
   */
  private static classifyBRank(stats: GeneralStatsExtended): HistoricalArchetype {
    // 용맹맹장 (여포형): 무력 최강, 통솔 중간, 나머지 낮음
    if (stats.strength >= 95 && stats.intel < 40) {
      return HistoricalArchetype.BRAVE_WARRIOR;
    }

    // 명신모사 (순욱/진군형): 지력+정치 높음
    if (stats.intel >= 90 && stats.politics >= 90) {
      return HistoricalArchetype.WISE_ADVISOR;
    }

    // 약탈맹장 (문추/안량형): 통솔+무력, 매력 낮음, 지력 낮음
    if (stats.leadership >= 70 && stats.strength >= 85 && stats.charm < 50 && stats.intel < 60) {
      return HistoricalArchetype.RAIDER;
    }

    // 충신맹장 (전위/고순형): 통솔+무력+매력, 지력 중간 이하
    if (stats.leadership >= 80 && stats.strength >= 90 && stats.intel < 70) {
      return HistoricalArchetype.LOYAL_GENERAL;
    }

    // 문무겸장 (조인형): 무력+지력 또는 통솔+지력
    if ((stats.strength >= 80 && stats.intel >= 80) || (stats.leadership >= 85 && stats.intel >= 80)) {
      return HistoricalArchetype.SCHOLAR_WARRIOR;
    }

    // 경세대신 (순욱/장소형): 통솔+정치
    if (stats.leadership >= 80 && stats.politics >= 90) {
      return HistoricalArchetype.STATE_ADMIN;
    }

    // 백전맹장 (서황/장합형): 통솔+무력 (기본)
    if (stats.leadership >= 80 && stats.strength >= 80) {
      return HistoricalArchetype.VETERAN_WARRIOR;
    }

    return HistoricalArchetype.VETERAN_WARRIOR;
  }

  /**
   * C급 분류 (1개 특화)
   */
  private static classifyCRank(stats: GeneralStatsExtended): HistoricalArchetype {
    const maxStat = Math.max(stats.leadership, stats.strength, stats.intel, stats.politics, stats.charm);

    // 순수무인: 무력만 높음
    if (stats.strength === maxStat && stats.strength >= 85) {
      return HistoricalArchetype.PURE_WARRIOR;
    }

    // 순수모사: 지력만 높음
    if (stats.intel === maxStat && stats.intel >= 85) {
      return HistoricalArchetype.PURE_TACTICIAN;
    }

    // 순수내정: 정치만 높음
    if (stats.politics === maxStat && stats.politics >= 85) {
      return HistoricalArchetype.PURE_ADMIN;
    }

    // 인기스타: 매력만 높음
    if (stats.charm === maxStat && stats.charm >= 85) {
      return HistoricalArchetype.POPULAR;
    }

    return HistoricalArchetype.AVERAGE;
  }

  /**
   * 특수 케이스 분류
   */
  private static classifySpecial(stats: GeneralStatsExtended, genData: any): HistoricalArchetype {
    // 환관: 모든 능력 낮음
    if (stats.leadership < 30 && stats.strength < 30 && stats.intel < 30 && stats.charm < 30) {
      return HistoricalArchetype.EUNUCH;
    }

    // 암군: 통솔 낮음, 정치 낮음, 매력 매우 낮음
    if (stats.leadership < 50 && stats.politics < 50 && stats.charm < 30) {
      return HistoricalArchetype.TYRANT;
    }

    // 기병대장: 통솔+무력 높음 (2개 능력 80+ 이지만 특수 분류)
    if (stats.leadership >= 80 && stats.strength >= 90 && stats.intel < 70) {
      return HistoricalArchetype.CAVALRY_EXPERT;
    }

    // 의사: 무력+매력 중상급
    if (stats.strength >= 85 && stats.charm >= 75) {
      return HistoricalArchetype.RIGHTEOUS;
    }

    // 명사: 지력+매력 중상급
    if (stats.intel >= 80 && stats.charm >= 85 && stats.strength < 60) {
      return HistoricalArchetype.SCHOLAR;
    }

    // 호걸: 무력 중상급, 정치 중급
    if (stats.strength >= 80 && stats.politics >= 50 && stats.politics < 70 && stats.intel < 70) {
      return HistoricalArchetype.GALLANT;
    }

    // 검객: 무력 높음, 지력 낮음
    if (stats.strength >= 85 && stats.intel < 50 && stats.leadership < 70) {
      return HistoricalArchetype.SWORDMASTER;
    }

    // 도적출신: 무력 중상, 통솔 낮음, 매력 낮음
    if (stats.strength >= 65 && stats.leadership < 50 && stats.charm < 50) {
      return HistoricalArchetype.BANDIT;
    }

    return HistoricalArchetype.AVERAGE;
  }
}

export class SimpleAI {
  private general: any;
  private city: any;
  private nation: any;
  private env: any;
  private archetype: HistoricalArchetype;
  private generalPolicy?: AutorunGeneralPolicy;
  private nationPolicy?: AutorunNationPolicy;

  constructor(general: any, city: any, nation: any, env: any) {
    this.general = general;
    this.city = city;
    this.nation = nation;
    this.env = env;
    
    // 장수 타입 분류
    const genData = this.general.data || this.general;
    this.archetype = GeneralTypeClassifier.classify(genData);
  }

  /**
   * Policy 시스템 초기화
   * @param aiOptions AI 옵션 (유저장 위임 설정)
   * @param nationPolicyOverride 국가별 정책 오버라이드
   * @param serverPolicyOverride 서버 정책 오버라이드
   */
  initializePolicies(
    aiOptions: AIOptions,
    nationPolicyOverride: any = null,
    serverPolicyOverride: any = null
  ): void {
    // 장수 정책 초기화
    this.generalPolicy = new AutorunGeneralPolicy(
      this.general,
      aiOptions,
      nationPolicyOverride,
      serverPolicyOverride,
      this.nation,
      this.env
    );

    // 국가 정책 초기화 (수뇌/군주만)
    if (aiOptions.chief || this.general.npcType >= 2) {
      this.nationPolicy = new AutorunNationPolicy(
        this.general,
        aiOptions,
        nationPolicyOverride,
        serverPolicyOverride,
        this.nation,
        this.env
      );
    }
  }

  /**
   * 장수 타입 반환
   */
  getArchetype(): HistoricalArchetype {
    return this.archetype;
  }

  /**
   * 타입별 명령 가중치 모디파이어
   */
  private getArchetypeModifiers(archetype: HistoricalArchetype): Record<string, number> {
    const modifiers = {
      offensive: 1.0,    // 공격 명령 (출병, 급습 등)
      defensive: 1.0,    // 방어 명령 (수비강화, 성벽보수)
      domestic: 1.0,     // 내정 명령 (농지개간, 상업투자)
      military: 1.0,     // 군사 명령 (징병, 훈련)
      strategy: 1.0,     // 계략 명령 (기술연구, 계략)
      training: 1.0,     // 자기계발 (단련, 견문)
      trade: 1.0,        // 거래 명령
      diplomacy: 1.0,    // 외교 명령
    };

    switch (archetype) {
      // === S급 ===
      case HistoricalArchetype.ALL_ROUNDER:
        // 조조형: 모든 것을 다 잘함, 기회주의적
        modifiers.offensive = 1.5;
        modifiers.defensive = 1.3;
        modifiers.domestic = 1.2;
        modifiers.strategy = 1.4;
        break;

      case HistoricalArchetype.PERFECT_RULER:
        // 유비형: 인재 등용, 내정, 방어 중시
        modifiers.offensive = 0.7;
        modifiers.defensive = 1.5;
        modifiers.domestic = 1.5;
        modifiers.diplomacy = 2.0;
        break;

      case HistoricalArchetype.PERFECT_GENERAL:
        // 관우/조운형: 전투 특화, 충성심
        modifiers.offensive = 2.0;
        modifiers.defensive = 1.5;
        modifiers.military = 1.8;
        break;

      // === A급 ===
      case HistoricalArchetype.EMPEROR:
        // 손권형: 균형잡힌 통치
        modifiers.defensive = 1.3;
        modifiers.domestic = 1.4;
        modifiers.diplomacy = 1.5;
        break;

      case HistoricalArchetype.GRAND_COMMANDER:
        // 주유/육손형: 전략적 사고, 대규모 작전
        modifiers.offensive = 1.8;
        modifiers.strategy = 1.7;
        modifiers.military = 1.5;
        break;

      case HistoricalArchetype.FIVE_TIGERS:
        // 오호장군형: 선봉 돌격, 무력 중시
        modifiers.offensive = 2.2;
        modifiers.military = 1.8;
        modifiers.domestic = 0.5;
        break;

      case HistoricalArchetype.SUPREME_STRATEGIST:
        // 제갈량/사마의형: 장기 전략, 기술 발전
        modifiers.offensive = 1.2;
        modifiers.strategy = 2.5;
        modifiers.domestic = 1.5;
        break;

      case HistoricalArchetype.GHOST_STRATEGIST:
        // 곽가/가후형: 계략 특화, 전투 회피
        modifiers.offensive = 0.5;
        modifiers.defensive = 0.8;
        modifiers.strategy = 3.0;
        modifiers.military = 0.3;
        break;

      // === B급 ===
      case HistoricalArchetype.BRAVE_WARRIOR:
        // 여포형: 무조건 싸움, 일기토
        modifiers.offensive = 3.0;
        modifiers.defensive = 0.5;
        modifiers.domestic = 0.2;
        modifiers.strategy = 0.2;
        modifiers.training = 1.5;
        break;

      case HistoricalArchetype.VETERAN_WARRIOR:
        // 서황/장합형: 안정적 전투
        modifiers.offensive = 1.8;
        modifiers.defensive = 1.5;
        modifiers.military = 1.6;
        break;

      case HistoricalArchetype.SCHOLAR_WARRIOR:
        // 조인형: 지략 활용한 전투
        modifiers.offensive = 1.5;
        modifiers.defensive = 1.3;
        modifiers.strategy = 1.6;
        break;

      case HistoricalArchetype.WISE_ADVISOR:
        // 순욱/진군형: 내정+계략
        modifiers.offensive = 0.4;
        modifiers.defensive = 0.8;
        modifiers.domestic = 2.0;
        modifiers.strategy = 1.8;
        break;

      case HistoricalArchetype.LOYAL_GENERAL:
        // 전위/고순형: 방어, 충성
        modifiers.offensive = 1.2;
        modifiers.defensive = 2.5;
        modifiers.military = 1.5;
        break;

      case HistoricalArchetype.RAIDER:
        // 문추/안량형: 급습, 약탈
        modifiers.offensive = 2.5;
        modifiers.defensive = 0.5;
        modifiers.domestic = 0.3;
        break;

      case HistoricalArchetype.STATE_ADMIN:
        // 순욱/장소형: 국가 운영
        modifiers.offensive = 0.5;
        modifiers.defensive = 1.2;
        modifiers.domestic = 2.2;
        modifiers.diplomacy = 1.5;
        break;

      // === C급 ===
      case HistoricalArchetype.PURE_WARRIOR:
        // 전위/허저형: 일기토만
        modifiers.offensive = 2.0;
        modifiers.training = 2.0;
        modifiers.domestic = 0.2;
        modifiers.strategy = 0.2;
        break;

      case HistoricalArchetype.PURE_TACTICIAN:
        // 서서/법정형: 계략만
        modifiers.offensive = 0.5;
        modifiers.strategy = 2.5;
        modifiers.military = 0.3;
        break;

      case HistoricalArchetype.PURE_ADMIN:
        // 장굉/비의형: 내정만
        modifiers.offensive = 0.2;
        modifiers.defensive = 0.5;
        modifiers.domestic = 3.0;
        break;

      case HistoricalArchetype.POPULAR:
        // 초선형: 등용, 외교
        modifiers.offensive = 0.2;
        modifiers.domestic = 0.5;
        modifiers.diplomacy = 3.0;
        break;

      // === 특수 ===
      case HistoricalArchetype.RIGHTEOUS:
        // 조운형: 의협심, 선정
        modifiers.offensive = 1.5;
        modifiers.domestic = 1.5;
        modifiers.military = 1.3;
        break;

      case HistoricalArchetype.GALLANT:
        // 허저형: 도시 방어
        modifiers.offensive = 1.2;
        modifiers.defensive = 2.0;
        modifiers.domestic = 1.2;
        break;

      case HistoricalArchetype.SIEGE_EXPERT:
        // 조인형: 공성/수성
        modifiers.offensive = 1.8;
        modifiers.defensive = 2.2;
        modifiers.military = 1.5;
        break;

      case HistoricalArchetype.CAVALRY_EXPERT:
        // 마초형: 기동전, 기습
        modifiers.offensive = 2.5;
        modifiers.military = 1.8;
        modifiers.defensive = 0.8;
        break;

      case HistoricalArchetype.BANDIT:
        // 장연형: 약탈, 파괴
        modifiers.offensive = 2.0;
        modifiers.defensive = 0.5;
        modifiers.domestic = 0.3;
        break;

      case HistoricalArchetype.TYRANT:
        // 동탁형: 무리한 명령
        modifiers.domestic = 0.5;
        modifiers.military = 0.8;
        break;

      case HistoricalArchetype.EUNUCH:
        // 환관형: 무능
        modifiers.offensive = 0.2;
        modifiers.defensive = 0.2;
        modifiers.domestic = 0.2;
        modifiers.military = 0.2;
        break;

      case HistoricalArchetype.AVERAGE:
      default:
        // 평범: 모든 가중치 1.0 유지
        break;
    }

    return modifiers;
  }

  /**
   * 타입별 우선 커맨드 리스트
   */
  private getPreferredCommands(archetype: HistoricalArchetype): string[] {
    switch (archetype) {
      // === S급 ===
      case HistoricalArchetype.ALL_ROUNDER:
        return ['출병', '기술연구', '상업투자', '선전포고'];
      
      case HistoricalArchetype.PERFECT_RULER:
        return ['주민선정', '정착장려', '포상', '등용'];
      
      case HistoricalArchetype.PERFECT_GENERAL:
        return ['출병', '훈련', '징병', '수비강화'];

      // === A급 ===
      case HistoricalArchetype.EMPEROR:
        return ['발령', '포상', '등용', '외교'];
      
      case HistoricalArchetype.GRAND_COMMANDER:
        return ['출병', '기술연구', '선전포고', '훈련'];
      
      case HistoricalArchetype.FIVE_TIGERS:
        return ['출병', '훈련', '징병', '단련'];
      
      case HistoricalArchetype.SUPREME_STRATEGIST:
        return ['기술연구', '출병', '계략', '상업투자'];
      
      case HistoricalArchetype.GHOST_STRATEGIST:
        return ['계략', '첩보', '외교', '기술연구'];

      // === B급 ===
      case HistoricalArchetype.BRAVE_WARRIOR:
        return ['출병', '단련', '훈련', '급습'];
      
      case HistoricalArchetype.VETERAN_WARRIOR:
        return ['출병', '수비강화', '훈련', '징병'];
      
      case HistoricalArchetype.SCHOLAR_WARRIOR:
        return ['출병', '계략', '수비강화', '기술연구'];
      
      case HistoricalArchetype.WISE_ADVISOR:
        return ['상업투자', '기술연구', '등용', '농지개간'];
      
      case HistoricalArchetype.LOYAL_GENERAL:
        return ['수비강화', '훈련', '출병', '치안강화'];
      
      case HistoricalArchetype.RAIDER:
        return ['급습', '출병', '탈취', '훈련'];
      
      case HistoricalArchetype.STATE_ADMIN:
        return ['발령', '포상', '농지개간', '상업투자'];

      // === C급 ===
      case HistoricalArchetype.PURE_WARRIOR:
        return ['단련', '훈련', '출병'];
      
      case HistoricalArchetype.PURE_TACTICIAN:
        return ['계략', '견문', '기술연구'];
      
      case HistoricalArchetype.PURE_ADMIN:
        return ['농지개간', '상업투자', '주민선정'];
      
      case HistoricalArchetype.POPULAR:
        return ['등용', '외교', '견문'];

      // === 특수 ===
      case HistoricalArchetype.RIGHTEOUS:
        return ['주민선정', '치안강화', '출병'];
      
      case HistoricalArchetype.GALLANT:
        return ['치안강화', '훈련', '수비강화'];
      
      case HistoricalArchetype.SIEGE_EXPERT:
        return ['수비강화', '성벽보수', '출병'];
      
      case HistoricalArchetype.CAVALRY_EXPERT:
        return ['출병', '강행', '징병'];
      
      case HistoricalArchetype.BANDIT:
        return ['탈취', '파괴', '급습'];

      case HistoricalArchetype.AVERAGE:
      default:
        return [];
    }
  }

  /**
   * 다음 명령 결정
   */
  async decideNextCommand(): Promise<AICommandDecision | null> {
    const genData = this.general.data || this.general;
    const stats = this.extractGeneralStats(genData);
    const genType = this.calculateGeneralType(stats);

    // 장수 타입 로그 (디버깅용)
    console.log(`[SimpleAI] 장수 ${genData.name}(${genData.no}) - 타입: ${this.archetype}`);

    const nationData = this.nation?.data || this.nation;
    const npcType = genData.npc || 0;
    const officerLevel = stats.officerLevel;
    const nationID = genData.nation || 0;

    // === 부상 체크 (요양 우선) (PHP GeneralAI 3771줄) ===
    const injury = genData.injury || 0;
    const cureThreshold = this.nationPolicy?.cureThreshold || 10;
    if (injury > cureThreshold) {
      console.log(`[SimpleAI] 부상 ${injury} > ${cureThreshold} - 요양 필요`);
      return {
        command: '요양',
        args: {},
        weight: 100,
        reason: '부상 치료',
      };
    }

    // === 거병 (PHP GeneralAI 3779줄 참고) ===
    // NPC 타입 2-3(일반 NPC), 재야(nation=0)인 경우
    if ((npcType === 2 || npcType === 3) && nationID === 0) {
      const raiseCmd = await this.tryRaiseArmy();
      if (raiseCmd) {
        console.log('[SimpleAI] 거병 시도');
        return raiseCmd;
      }
    }

    // === 방랑군 대장 특수 처리 (PHP GeneralAI 3803줄 참고) ===
    if (npcType >= 2 && officerLevel >= 12 && (!nationData || !nationData.capital)) {
      const relYearMonth = this.getRelativeYearMonth();
      
      // 게임 시작 후 2개월 경과 시 건국 시도
      if (relYearMonth > 1) {
        const foundCmd = await this.tryFoundNation();
        if (foundCmd) {
          console.log('[SimpleAI] 방랑군 건국 시도');
          return foundCmd;
        }
      }

      // 건국 실패 시 방랑군 이동 (일반 이동 커맨드 사용)
      const wanderCmd = await this.tryWanderingMove();
      if (wanderCmd) {
        console.log('[SimpleAI] 방랑군 이동');
        return wanderCmd;
      }
      
      // 방랑군 이동도 실패 시 해산
      if (relYearMonth > 1) {
        const disbandCmd = await this.tryDisband();
        if (disbandCmd) {
          console.log('[SimpleAI] 방랑군 해산');
          return disbandCmd;
        }
      }
    }

    // === 재야 장수 국가 선택 (PHP GeneralAI 3785줄) ===
    if (nationID === 0 && this.generalPolicy?.canPerform(GeneralActionType.국가선택)) {
      const joinCmd = await this.tryJoinNation();
      if (joinCmd) {
        console.log('[SimpleAI] 국가 선택 시도');
        return joinCmd;
      }
    }

    // 국가 자원이 부족하면 30% 확률로 휴식
    if (nationData && nationData.rice < (GameConst.baserice || 50000) && Math.random() < 0.3) {
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

    // === Policy 필터링 (우선순위 1) ===
    let filteredCandidates = candidates;
    if (this.generalPolicy || this.nationPolicy) {
      filteredCandidates = this.applyPolicyFilter(candidates);
      console.log(`[SimpleAI] Policy 필터 적용: ${candidates.length} -> ${filteredCandidates.length} 명령`);
      
      if (filteredCandidates.length === 0) {
        console.log('[SimpleAI] Policy 필터 후 가능한 명령 없음 - 휴식');
        return null;
      }
    }

    // === 가중치 조정 단계 ===
    
    // 1. Policy 우선순위 기반 가중치 조정
    if (this.generalPolicy || this.nationPolicy) {
      this.applyPolicyPriorityWeights(filteredCandidates);
    }

    // 2. 타입별 가중치 조정 (역사적 인물 기반)
    this.applyArchetypeModifiers(filteredCandidates);

    // 3. 우선 커맨드 가중치 증가
    this.boostPreferredCommands(filteredCandidates);

    // 4. 특기 기반 보너스
    this.applySpecialBonus(filteredCandidates);

    // 5. 성격 기반 조정 (personal 필드)
    this.applyPersonalityModifiers(filteredCandidates);

    // 6. 전쟁 상황 조정
    this.adjustForWarStatus(filteredCandidates);

    // 7. 자원 부족 조정
    this.adjustForResourceShortage(filteredCandidates, stats);

    // 실행 가능한 명령만 필터링
    const validCandidates = await this.filterValidCommands(filteredCandidates);
    
    if (validCandidates.length === 0) {
      return null; // 휴식
    }

    // 가중치 기반 선택
    const selected = this.selectCommandByWeight(validCandidates);
    
    if (selected) {
      console.log(`[SimpleAI] 선택된 명령: ${selected.command} (가중치: ${selected.weight.toFixed(2)}, 이유: ${selected.reason})`);
    }
    
    return selected;
  }

  /**
   * 타입별 가중치 조정 적용
   */
  private applyArchetypeModifiers(candidates: AICommandDecision[]): void {
    const modifiers = this.getArchetypeModifiers(this.archetype);

    candidates.forEach(cmd => {
      const commandType = this.categorizeCommand(cmd.command);
      const modifier = modifiers[commandType] || 1.0;
      
      cmd.weight *= modifier;
    });
  }

  /**
   * 명령을 카테고리로 분류
   */
  private categorizeCommand(command: string): string {
    const offensive = ['출병', '급습', '강행', '선전포고'];
    const defensive = ['수비강화', '성벽보수', '치안강화'];
    const domestic = ['농지개간', '상업투자', '주민선정', '정착장려'];
    const military = ['징병', '훈련'];
    const strategy = ['기술연구', '계략', '첩보'];
    const training = ['단련', '견문'];
    const trade = ['군량매매'];
    const diplomacy = ['외교', '등용', '포상'];

    if (offensive.includes(command)) return 'offensive';
    if (defensive.includes(command)) return 'defensive';
    if (domestic.includes(command)) return 'domestic';
    if (military.includes(command)) return 'military';
    if (strategy.includes(command)) return 'strategy';
    if (training.includes(command)) return 'training';
    if (trade.includes(command)) return 'trade';
    if (diplomacy.includes(command)) return 'diplomacy';

    return 'other';
  }

  /**
   * 우선 커맨드 가중치 증가
   */
  private boostPreferredCommands(candidates: AICommandDecision[]): void {
    const preferred = this.getPreferredCommands(this.archetype);
    
    candidates.forEach(cmd => {
      if (preferred.includes(cmd.command)) {
        cmd.weight *= 1.5; // 우선 커맨드는 50% 가중치 추가
      }
    });
  }

  /**
   * Policy 기반 필터링
   * 정책에서 허용하지 않는 행동을 제거
   */
  private applyPolicyFilter(candidates: AICommandDecision[]): AICommandDecision[] {
    return candidates.filter(cmd => {
      const actionType = this.mapCommandToActionType(cmd.command);
      
      if (!actionType) {
        // 매핑되지 않은 명령은 허용 (기본 동작)
        return true;
      }

      // 장수 정책 체크
      if (this.generalPolicy && Object.values(GeneralActionType).includes(actionType as GeneralActionType)) {
        return this.generalPolicy.canPerform(actionType as GeneralActionType);
      }

      // 국가 정책 체크
      if (this.nationPolicy && Object.values(NationActionType).includes(actionType as NationActionType)) {
        return this.nationPolicy.canPerform(actionType as NationActionType);
      }

      return true;
    });
  }

  /**
   * Policy 우선순위 기반 가중치 조정
   */
  private applyPolicyPriorityWeights(candidates: AICommandDecision[]): void {
    candidates.forEach(cmd => {
      const actionType = this.mapCommandToActionType(cmd.command);
      
      if (!actionType) return;

      // 장수 정책 우선순위
      if (this.generalPolicy && Object.values(GeneralActionType).includes(actionType as GeneralActionType)) {
        const priority = this.generalPolicy.priority;
        const index = priority.indexOf(actionType as GeneralActionType);
        
        if (index !== -1) {
          // 우선순위가 높을수록 가중치 증가 (1위: 5.0배, 2위: 4.5배, ...)
          const priorityWeight = Math.max(1.0, 5.0 - (index * 0.5));
          cmd.weight *= priorityWeight;
        }
      }

      // 국가 정책 우선순위
      if (this.nationPolicy && Object.values(NationActionType).includes(actionType as NationActionType)) {
        const priority = this.nationPolicy.priority;
        const index = priority.indexOf(actionType as NationActionType);
        
        if (index !== -1) {
          const priorityWeight = Math.max(1.0, 5.0 - (index * 0.5));
          cmd.weight *= priorityWeight;
        }
      }
    });
  }

  /**
   * 커맨드 이름을 Policy ActionType으로 매핑
   */
  private mapCommandToActionType(command: string): GeneralActionType | NationActionType | null {
    // 장수 행동 매핑
    const generalMapping: Record<string, GeneralActionType> = {
      '농지개간': GeneralActionType.일반내정,
      '상업투자': GeneralActionType.일반내정,
      '치안강화': GeneralActionType.일반내정,
      '수비강화': GeneralActionType.일반내정,
      '성벽보수': GeneralActionType.일반내정,
      '주민선정': GeneralActionType.긴급내정,
      '정착장려': GeneralActionType.긴급내정,
      '전쟁내정': GeneralActionType.전쟁내정,
      '군량매매': GeneralActionType.금쌀구매,
      '징병': GeneralActionType.징병,
      '모병': GeneralActionType.모병,
      '훈련': GeneralActionType.전투준비,
      '출병': GeneralActionType.출병,
      '워프': GeneralActionType.후방워프, // FUTURE: 상황에 따라 전방/후방/내정 구분
      '귀환': GeneralActionType.귀환,
      '거병': GeneralActionType.건국,
      '건국': GeneralActionType.건국,
      '선양': GeneralActionType.선양,
      '해산': GeneralActionType.건국, // 해산도 건국 정책에 포함
      '랜덤임관': GeneralActionType.국가선택,
      '임관': GeneralActionType.국가선택,
      '이동': GeneralActionType.귀환, // 방랑군 이동은 귀환 정책에 포함
    };

    // 국가 행동 매핑
    const nationMapping: Record<string, NationActionType> = {
      '선전포고': NationActionType.선전포고,
      '불가침제의': NationActionType.불가침제의,
      '천도': NationActionType.천도,
      '포상': NationActionType.유저장포상,
    };

    return generalMapping[command] || nationMapping[command] || null;
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
      
      case '출병': {
        const deployResult = await this.shouldDeploy(genData);
        return deployResult.canDeploy;
      }
      
      case '농지개간':
        return this.canDomestic(genData, cityData, 'agri');
      
      case '상업투자':
        return this.canDomestic(genData, cityData, 'comm');
      
      case '치안강화':
        return this.canDomestic(genData, cityData, 'secu');
      
      case '수비강화':
        return this.canDomestic(genData, cityData, 'def');
      
      case '성벽보수':
        return this.canDomestic(genData, cityData, 'wall');
      
      case '주민선정':
      case '정착장려':
        return this.canDomestic(genData, cityData, 'pop') && (cityData?.trust || 0) >= 20;
      
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
  private canDomestic(genData: any, cityData: any, specificKey?: string): boolean {
    // 재야가 아니어야 함
    if (genData.nation === 0) return false;
    
    // 도시를 점령하고 있어야 함
    if (!cityData || cityData.nation !== genData.nation) return false;
    
    // 최소 자금 필요
    if (genData.gold < 100) return false;
    
    // 특정 키가 지정된 경우 해당 개발 용량 체크
    if (specificKey) {
      const current = cityData[specificKey] || 0;
      const max = cityData[`${specificKey}_max`] || 0;
      if (current >= max) return false;
    }
    
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

    // FUTURE: 발령, 천도, 외교 등 추가

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
    const avgGold = 10000; // FUTURE: 실제 평균 계산
    const avgRice = 10000;
    
    if (nationData.gold < avgGold * 1.5 || nationData.rice < avgRice * 1.5) {
      return null;
    }

    // FUTURE: 외교 상태 확인, 약한 국가 찾기
    // 현재는 간단히 null 반환 (선포 안 함)
    return null;
  }

  /**
   * 상대 년/월 계산 (게임 시작 후 경과 월수)
   */
  private getRelativeYearMonth(): number {
    const env = this.env;
    const currentYM = (env.year || 0) * 12 + (env.month || 1);
    const initYM = (env.init_year || env.startyear || 0) * 12 + (env.init_month || 1);
    return currentYM - initYM;
  }

  /**
   * 거병 시도 (PHP GeneralAI do거병 3217줄 참고)
   */
  private async tryRaiseArmy(): Promise<AICommandDecision | null> {
    const genData = this.general.data || this.general;
    
    // makelimit 있으면 거병 불가 (이미 한번 세력 만듦)
    if (genData.makelimit) {
      return null;
    }

    // NPC 타입 3 이상은 거병 불가 (유저장만 가능)
    const npcType = genData.npc || 0;
    if (npcType > 2) {
      return null;
    }

    // Policy 체크 (건국 정책 체크)
    if (this.generalPolicy && !this.generalPolicy.canPerform(GeneralActionType.건국)) {
      return null;
    }

    // 도시 레벨 5-6만 가능 (중형 도시)
    const cityData = this.city?.data || this.city;
    const currentCityLevel = cityData?.level || 0;
    if ((currentCityLevel < 5 || 6 < currentCityLevel) && Math.random() < 0.5) {
      return null;
    }

    // 주변 3칸 이내에 거병 가능한 도시(레벨 5-6, 무주) 있는지 체크
    // FUTURE: searchDistance() 구현 및 도시 점유 상태 조회
    // 현재는 간단히 50% 확률로 체크
    if (Math.random() < 0.5) {
      return null;
    }

    // 능력치 체크: 평균 능력치가 높을수록 거병 확률 낮음
    const leadership = genData.leadership || 50;
    const strength = genData.strength || 50;
    const intel = genData.intel || 50;
    const avgStat = (leadership + strength + intel) / 3;
    const npcMaxStat = 80; // FUTURE: GameConst.defaultStatNPCMax
    const chiefMinStat = 60; // FUTURE: GameConst.chiefStatMin
    const threshold = Math.random() * (npcMaxStat + chiefMinStat) / 2;
    
    if (threshold < avgStat) {
      return null;
    }

    // 게임 초반(3년 이내)일수록 거병 확률 증가
    const env = this.env;
    const relYear = (env.year || 0) - (env.init_year || env.startyear || 0);
    const yearBonus = Math.max(1, Math.min(3, 3 - relYear));
    
    // 최종 확률: 0.75% * yearBonus
    if (Math.random() > 0.0075 * yearBonus) {
      return null;
    }

    return {
      command: '거병',
      args: {},
      weight: 100, // 최우선
      reason: 'NPC 거병',
    };
  }

  /**
   * 건국 시도 (PHP GeneralAI do건국 3302줄 참고)
   */
  private async tryFoundNation(): Promise<AICommandDecision | null> {
    const genData = this.general.data || this.general;
    
    // Policy 체크
    if (this.generalPolicy && !this.generalPolicy.canPerform(GeneralActionType.건국)) {
      return null;
    }

    // 방랑군 대장(officer_level=12)이고 수하가 2명 이상 있어야 함
    const nationData = this.nation?.data || this.nation;
    if (!nationData || (nationData.gennum || 0) < 2) {
      return null;
    }

    // 랜덤 국가 타입/색상 선택
    const availableTypes = ['삼국', '진', '한', '조', '위', '촉', '오', '후한', '황건'];
    const availableColors = [0, 1, 2, 3, 4, 5, 6, 7]; // FUTURE: GetNationColors() 구현 필요
    
    const nationType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
    const colorType = availableColors[Math.floor(Math.random() * availableColors.length)];
    
    // 국가명: ㉿ + 장수명 (첫 글자 제외)
    const generalName = genData.name || '방랑군';
    const nationName = '㉿' + generalName.substring(1);

    return {
      command: '건국',
      args: {
        nationName,
        nationType,
        colorType,
      },
      weight: 100, // 최우선
      reason: '방랑군 건국',
    };
  }

  /**
   * 선양 시도 (PHP GeneralAI do선양 3318줄 참고)
   */
  private async tryAbdicate(): Promise<AICommandDecision | null> {
    const genData = this.general.data || this.general;
    
    // Policy 체크
    if (this.generalPolicy && !this.generalPolicy.canPerform(GeneralActionType.선양)) {
      return null;
    }

    // 군주(officer_level=12)만 가능
    if ((genData.officer_level || 0) < 12) {
      return null;
    }

    // FUTURE: 국가 내 다른 장수 찾기 (npc != 5)
    // const destGeneralID = await this.findRandomGeneralInNation();
    
    return null; // 일단 구현 보류
  }

  /**
   * 방랑군 이동 (PHP GeneralAI do방랑군이동 3127줄 참고)
   * 이동 커맨드를 사용하여 레벨 5-6 도시 중 비어있는 곳으로 이동
   */
  private async tryWanderingMove(): Promise<AICommandDecision | null> {
    const genData = this.general.data || this.general;
    const cityData = this.city?.data || this.city;
    const currentCityID = cityData?.city || genData.city || 0;

    // FUTURE: 완전한 구현을 위해서는 다음이 필요:
    // 1. 같은 도시에 다른 군주(officer_level=12) 있는지 체크
    // 2. 현재 도시가 레벨 5-6인지 체크
    // 3. 주변 4칸 이내 비어있는 레벨 5-6 도시 찾기
    // 4. aux.movingTargetCityID 저장/로드
    // 5. searchDistance() 함수로 최단 경로 계산
    
    // 현재는 간단히 인접 도시로 랜덤 이동
    // FUTURE: cityRepository에서 인접 도시 목록 가져오기
    
    // 임시로 이동 불가 처리
    return null;
  }

  /**
   * 해산 (PHP GeneralAI do해산 3290줄 참고)
   */
  private async tryDisband(): Promise<AICommandDecision | null> {
    // 방랑군 해산 - 모든 수하를 재야로 보내고 군주도 재야가 됨
    return {
      command: '해산',
      args: {},
      weight: 100,
      reason: '방랑군 해산',
    };
  }

  /**
   * 국가 선택 (임관/랜덤임관) (PHP GeneralAI do국가선택 3329줄 참고)
   */
  private async tryJoinNation(): Promise<AICommandDecision | null> {
    const genData = this.general.data || this.general;
    
    // Policy 체크
    if (this.generalPolicy && !this.generalPolicy.canPerform(GeneralActionType.국가선택)) {
      return null;
    }

    // 재야(nation=0)만 가능
    if ((genData.nation || 0) !== 0) {
      return null;
    }

    // 30% 확률로 시도
    if (Math.random() > 0.3) {
      return null;
    }

    // 친화도 999면 임관 안 함
    if (genData.affinity === 999) {
      return null;
    }

    const env = this.env;
    const relYear = (env.year || 0) - (env.startyear || 0);

    // 초기 임관 기간(3년)에는 국가 수에 따라 확률 조정
    if (relYear < 3) {
      // FUTURE: 국가 수 조회
      // 국가가 적으면 임관 시도 확률 낮춤
      if (Math.random() < 0.5) {
        return null;
      }
    } else {
      // 임관 기간 종료 후에는 0.15 확률
      if (Math.random() > 0.15) {
        return null;
      }
    }

    // 랜덤 임관 (임관 커맨드 구현 필요)
    return {
      command: '랜덤임관',
      args: {},
      weight: 10,
      reason: '국가 선택',
    };
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
    const nationID = genData.nation || 0;

    // === 재야는 군사 명령 불가 ===
    if (nationID === 0) {
      return commands;
    }

    // === 자원 체크 (징병/훈련 비용) ===
    const hasMinimumResources = stats.gold >= 500 && stats.rice >= 500;
    const hasGoodResources = stats.gold >= 2000 && stats.rice >= 2000;

    // === 징병 평가 ===
    const needRecruit = stats.crew < 5000;
    const canRecruit = stats.leadership >= 50; // 최소 통솔 50

    if (needRecruit && canRecruit && hasMinimumResources) {
      let weight = stats.leadership / 5;
      let reason = '병사 부족';
      let priority = 'normal';
      
      // 병사 0명: 최고 우선순위 (단련/훈련 불가)
      if (stats.crew <= 0) {
        weight = 100; // 절대 우선순위
        reason = '병사 없음 - 긴급 징병 필수';
        priority = 'critical';
      }
      // 병사 500명 미만: 훈련 불가
      else if (stats.crew < 500) {
        weight = 50; // 매우 높은 우선순위
        reason = '병사 부족 - 훈련 불가';
        priority = 'urgent';
      }
      // 병사 1000명 미만: 전투 불가
      else if (stats.crew < 1000) {
        weight = stats.leadership / 2; // 2배 증가
        reason = '병사 매우 부족 - 전투 불가';
        priority = 'high';
      }
      // 병사 3000명 미만: 전투력 부족
      else if (stats.crew < 3000) {
        weight = stats.leadership / 3; // 1.5배 증가
        reason = '병사 부족 - 전투력 약함';
        priority = 'medium';
      }
      
      commands.push({
        command: '징병',
        args: { crewType: this.selectBestCrewType(genData), amount: 1000 },
        weight,
        reason: `[${priority.toUpperCase()}] ${reason} (병사:${stats.crew})`
      });
    }

    // === 훈련 평가 (병사가 있어야만 가능) ===
    const train = genData.train || 0;
    const atmos = genData.atmos || 0;
    const hasEnoughCrew = stats.crew >= 500; // 훈련 최소 병사 500명
    const canTrain = stats.strength >= 50; // 최소 무력 50
    const needTrain = train < 80 || atmos < 80;

    if (hasEnoughCrew && canTrain && needTrain && hasMinimumResources) {
      let weight = stats.strength / 5;
      
      // 훈련도/사기가 매우 낮으면 가중치 증가
      if (train < 30 || atmos < 30) {
        weight *= 2;
      }
      
      commands.push({
        command: '훈련',
        args: {},
        weight,
        reason: `훈련/사기 향상 필요 (훈련:${train}, 사기:${atmos}, 병사:${stats.crew})`
      });
    } else if (!hasEnoughCrew && needTrain) {
      // 병사가 부족해서 훈련 못함 -> 로그만
      console.log(`[SimpleAI] 훈련 불가 - 병사 부족 (${stats.crew} < 500)`);
    }

    // === 출병 평가 (병사/훈련도/사기 충분해야 함) ===
    const deployResult = await this.shouldDeploy(genData);
    if (deployResult.canDeploy) {
      commands.push({
        command: '출병',
        args: await this.selectDeployTarget(genData),
        weight: stats.strength * 2,
        reason: `출병 가능 (병사:${stats.crew}, 훈련:${train}, 사기:${atmos})`
      });
    } else if (deployResult.reason) {
      // 출병 불가 사유 로그
      console.log(`[SimpleAI] 출병 불가 - ${deployResult.reason}`);
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
  private async shouldDeploy(genData: any): Promise<{ canDeploy: boolean; reason?: string }> {
    const crew = genData.crew || 0;
    const train = genData.train || 0;
    const atmos = genData.atmos || 0;
    const leadership = genData.leadership || 50;

    // === 병사 체크 ===
    if (crew <= 0) {
      return { canDeploy: false, reason: '병사 없음' };
    }

    // 최소 병사 수: (통솔-2) * 100, 최대 3000
    const minCrew = Math.max(500, Math.min((leadership - 2) * 100, 3000));
    if (crew < minCrew) {
      return { canDeploy: false, reason: `병사 부족 (${crew} < ${minCrew})` };
    }

    // === 훈련도 체크 ===
    const minTrain = 70;
    if (train < minTrain) {
      return { canDeploy: false, reason: `훈련도 부족 (${train} < ${minTrain})` };
    }

    // === 사기 체크 ===
    const minAtmos = 70;
    if (atmos < minAtmos) {
      return { canDeploy: false, reason: `사기 부족 (${atmos} < ${minAtmos})` };
    }

    // === 전쟁 상태 확인 ===
    const nationData = this.nation?.data || this.nation;
    if (!nationData || !nationData.war) {
      return { canDeploy: false, reason: '전쟁 중 아님' };
    }

    // === 전방 도시 확인 (인접 적 도시 있는지) ===
    // FUTURE: 실제 도시 연결 정보로 확인
    // 현재는 간단히 가능 처리
    return { canDeploy: true };
  }

  /**
   * 출병 대상 선택
   */
  private async selectDeployTarget(genData: any): Promise<any> {
    // FUTURE: 인접 적 도시 찾기
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

    // === 단련 평가 (병사가 있어야만 가능) ===
    const avgStat = (stats.leadership + stats.strength + stats.intel) / 3;
    const needTrain = avgStat < 80;
    const hasCrew = stats.crew > 0;
    const train = genData.train || 0;
    const atmos = genData.atmos || 0;
    const trainConditionMet = train >= 20 && atmos >= 20; // 단련 최소 조건
    
    if (needTrain) {
      if (!hasCrew) {
        // 병사 없음: 단련 불가
        console.log(`[SimpleAI] 단련 불가 - 병사 없음 (${stats.crew}명), 징병 필요`);
      } else if (!trainConditionMet) {
        // 훈련도/사기 부족: 단련 불가
        console.log(`[SimpleAI] 단련 불가 - 훈련도(${train})/사기(${atmos}) 부족 (최소 20 필요)`);
      } else {
        // 단련 가능
        const targetStat = this.selectTrainingStat(stats);
        let weight = 10;
        
        // 능력치가 매우 낮으면 가중치 증가
        if (avgStat < 60) {
          weight = 15;
        }
        
        commands.push({
          command: '단련',
          args: { targetStat },
          weight,
          reason: `능력치 향상 (평균:${avgStat.toFixed(1)}, 병사:${stats.crew})`
        });
      }
    }

    // === 견문 평가 (경험치 낮을 때) ===
    const experience = genData.experience || 0;
    const needExperience = experience < 5000;
    
    if (needExperience) {
      let weight = 5;
      
      // 경험치가 매우 낮으면 가중치 증가
      if (experience < 1000) {
        weight = 10;
      }
      
      commands.push({
        command: '견문',
        args: {},
        weight,
        reason: `경험치 부족 (${experience})`
      });
    }

    // === 특기 초기화 평가 (특기가 성에 안 차면) ===
    if (this.shouldResetSkill(genData, special, special2)) {
      // 자금이 충분한 경우만 (1000 이상)
      if (stats.gold >= 1000) {
        const isWarSkill = special.includes('전투') || special.includes('맹공') || special.includes('철벽');
        commands.push({
          command: isWarSkill ? '전투특기초기화' : '내정특기초기화',
          args: {},
          weight: 2,
          reason: '특기 재설정'
        });
      }
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

    // FUTURE: 특기 품질 평가 로직
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
    
    if (totalWeight <= 0) return null;
    
    let random = Math.random() * totalWeight;

    for (const cmd of candidates) {
      random -= cmd.weight;
      if (random <= 0) {
        return cmd;
      }
    }

    return candidates[0];
  }

  /**
   * 특기 기반 명령 보너스
   */
  private applySpecialBonus(candidates: AICommandDecision[]): void {
    const genData = this.general.data || this.general;
    const special = genData.special || 'None';
    const special2 = genData.special2 || 'None';

    const specialBonuses: Record<string, Record<string, number>> = {
      // 전투 특기
      '신속': { '출병': 1.5, '강행': 2.0, '급습': 1.8 },
      '맹공': { '출병': 2.0, '훈련': 1.5 },
      '철벽': { '수비강화': 1.8, '성벽보수': 1.5, '치안강화': 1.3 },
      '명사수': { '출병': 1.3, '훈련': 1.2 },
      '기마술': { '출병': 1.4, '징병': 1.2 },
      
      // 내정 특기
      '명정': { '주민선정': 2.0, '정착장려': 1.5 },
      '상술': { '상업투자': 1.8, '군량매매': 1.5 },
      '농업': { '농지개간': 1.8 },
      '징병술': { '징병': 1.8, '훈련': 1.3 },
      '기술': { '기술연구': 2.0 },
    };

    candidates.forEach(cmd => {
      const bonus1 = specialBonuses[special]?.[cmd.command] || 1.0;
      const bonus2 = specialBonuses[special2]?.[cmd.command] || 1.0;
      
      cmd.weight *= bonus1 * bonus2;
    });
  }

  /**
   * 성격(personal) 필드 기반 가중치 조정
   */
  private applyPersonalityModifiers(candidates: AICommandDecision[]): void {
    const genData = this.general.data || this.general;
    const personal = genData.personal || 3; // 기본값 3 (균형형)

    const modifiers: Record<string, number> = {
      offensive: 1.0,
      defensive: 1.0,
      domestic: 1.0,
      training: 1.0,
    };

    switch (personal) {
      case 1: // 맹장형
        modifiers.offensive = 2.0;
        modifiers.defensive = 0.5;
        modifiers.domestic = 0.3;
        break;
      
      case 2: // 수비형
        modifiers.offensive = 0.5;
        modifiers.defensive = 2.0;
        modifiers.domestic = 0.8;
        break;
      
      case 3: // 균형형 (기본)
        // 모든 가중치 1.0 유지
        break;
      
      case 4: // 모사형
        modifiers.offensive = 0.7;
        modifiers.defensive = 0.7;
        modifiers.domestic = 1.5;
        modifiers.training = 1.5;
        break;
      
      case 5: // 충신형
        modifiers.offensive = 0.8;
        modifiers.defensive = 1.2;
        modifiers.domestic = 1.3;
        break;
      
      case 6: // 야심가형
        modifiers.offensive = 1.5;
        modifiers.domestic = 1.2;
        break;
    }

    candidates.forEach(cmd => {
      const commandType = this.categorizeCommand(cmd.command);
      const modifier = modifiers[commandType] || 1.0;
      
      cmd.weight *= modifier;
    });
  }

  /**
   * 전쟁 상황에 따른 행동 조정
   */
  private adjustForWarStatus(candidates: AICommandDecision[]): void {
    const nationData = this.nation?.data || this.nation;
    const isAtWar = (nationData?.war_list?.length || 0) > 0;

    if (isAtWar) {
      console.log(`[SimpleAI] 전쟁 중 - 군사 명령 가중치 증가`);
      
      candidates.forEach(cmd => {
        if (['징병', '훈련', '출병'].includes(cmd.command)) {
          cmd.weight *= 2.0;
        } else if (['농지개간', '상업투자'].includes(cmd.command)) {
          cmd.weight *= 0.3;
        }
      });
    }
  }

  /**
   * 자원 부족 상황에 따른 행동 조정
   */
  private adjustForResourceShortage(candidates: AICommandDecision[], stats: GeneralStats): void {
    const isLowGold = stats.gold < 1000;
    const isLowRice = stats.rice < 1000;

    if (isLowGold || isLowRice) {
      console.log(`[SimpleAI] 자원 부족 (금:${stats.gold}, 양:${stats.rice}) - 내정 우선`);
      
      candidates.forEach(cmd => {
        if (['농지개간', '상업투자', '주민선정'].includes(cmd.command)) {
          cmd.weight *= 2.0;
        } else if (['징병', '출병'].includes(cmd.command)) {
          cmd.weight *= 0.2;
        }
      });
    }
  }
}
