/**
 * 간단한 NPC AI 엔진
 * PHP GeneralAI를 참고하여 핵심 로직만 구현
 * 
 * 난수 일관성: PHP와 동일하게 seed 기반 RandUtil 사용
 * - seed = hash(hiddenSeed, 'GeneralAI', year, month, generalID)
 * - 같은 연도/월/장수에서 동일한 난수 시퀀스 생성
 */

import { cityRepository } from '../repositories/city.repository';
import { nationRepository } from '../repositories/nation.repository';
import { generalRepository } from '../repositories/general.repository';
import { GameConst } from '../constants/GameConst';
import { RandUtil } from '../utils/RandUtil';
import { 
  AutorunGeneralPolicy, 
  AIOptions, 
  GeneralActionType,
  DEFAULT_GENERAL_PRIORITY,
} from './AutorunGeneralPolicy';
import { 
  AutorunNationPolicy, 
  NationActionType 
} from './AutorunNationPolicy';
import {
  DipStateActionSelector,
  DipState,
  GenType,
  PolicyConfig,
  EnvConfig,
  calculateDipState,
} from './DipStateActionSelector';
import { searchDistanceAsync } from '../func/searchDistance';
import { CityConst } from '../const/CityConst';
import {
  TroopDispatcher,
  CityInfo,
  GeneralInfo,
  DispatchResult,
} from './TroopDispatch';

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
  private sessionId: string;
  
  // dipState 기반 선택기
  private dipState: DipState = DipState.d평화;
  private dipStateSelector?: DipStateActionSelector;
  
  // seed 기반 난수 생성기 (PHP RandUtil 포팅)
  // PHP: new RandUtil(new LiteHashDRBG(Util::simpleSerialize(hiddenSeed, 'GeneralAI', year, month, generalID)))
  private rng: RandUtil;

  constructor(general: any, city: any, nation: any, env: any, sessionId: string = 'sangokushi_default') {
    this.general = general;
    this.city = city;
    this.nation = nation;
    this.env = env;
    this.sessionId = sessionId;
    
    // seed 기반 난수 생성기 초기화 (PHP GeneralAI.__construct 153-159줄)
    const genData = this.general.data || this.general;
    const seed = this.generateSeed(genData);
    this.rng = new RandUtil(seed);
    
    // 장수 타입 분류
    this.archetype = GeneralTypeClassifier.classify(genData);
    
    // 외교 상태 초기화
    this.initializeDipState();
  }
  
  /**
   * PHP Util::simpleSerialize() 방식의 seed 생성
   * seed = hash(hiddenSeed, 'GeneralAI', year, month, generalID)
   * 
   * 같은 연도/월/장수에서 항상 동일한 난수 시퀀스 생성
   */
  private generateSeed(genData: any): string {
    // PHP UniqueConst::$hiddenSeed와 동일한 역할 - 서버 고유 시드
    const hiddenSeed = (GameConst as any).hiddenSeed || this.sessionId || 'default_hidden_seed';
    const year = this.env?.year || 200;
    const month = this.env?.month || 1;
    const generalID = genData.no || genData.id || 0;
    
    // PHP simpleSerialize와 동일한 문자열 조합
    return `${hiddenSeed}|GeneralAI|${year}|${month}|${generalID}`;
  }
  
  /**
   * 외교 상태 초기화
   * PHP calcDiplomacyState 로직 포팅:
   * - 게임 초반 체크 (2년 5개월)
   * - 전쟁 대상 분류 (state=0:전쟁중, state=1:선포됨)
   * - term 기준: >8→선포, >5→징병, ≤5→직전
   * - attackable 체크 (전선 도시 여부)
   */
  private initializeDipState(): void {
    const nationData = this.nation?.data || this.nation;
    
    // 전쟁 대상 목록 구성
    const warTargets: any[] = [];
    
    // war_list 또는 warList 사용
    const warList = nationData?.war_list || nationData?.warList || [];
    if (Array.isArray(warList) && warList.length > 0) {
      warList.forEach((target: any) => {
        warTargets.push({
          state: target.state ?? 0,
          remainMonth: target.remainMonth ?? target.remain_month ?? target.term ?? 0,
        });
      });
    }
    
    // 환경 설정 구성 (PHP yearMonth 계산용)
    const envConfig = this.env ? {
      year: this.env.year,
      month: this.env.month,
      startyear: this.env.startyear || this.env.init_year,
    } : undefined;
    
    // attackable 체크: 전선 도시(front > 0 && supply = 1) 있는지
    // FUTURE: 실제 도시 정보로 체크 필요
    const cityData = this.city?.data || this.city;
    const attackable = cityData?.front > 0 || undefined;
    
    this.dipState = calculateDipState(nationData, warTargets, envConfig, attackable);
    console.log(`[SimpleAI] 외교 상태 초기화: ${DipState[this.dipState]} (${this.dipState}), attackable: ${attackable ?? 'unknown'}`);
  }
  
  /**
   * 현재 외교 상태 반환
   */
  getDipState(): DipState {
    return this.dipState;
  }
  
  /**
   * 외교 상태 수동 설정 (테스트/오버라이드용)
   */
  setDipState(state: DipState): void {
    this.dipState = state;
    console.log(`[SimpleAI] 외교 상태 변경: ${DipState[this.dipState]} (${this.dipState})`);
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

    // === 선양 체크 (PHP GeneralAI 3745-3751줄) ===
    // 군주(officer_level=12)이고 선양 정책이 허용된 경우
    if (officerLevel >= 12 && this.generalPolicy?.canPerform(GeneralActionType.선양)) {
      const abdicateCmd = await this.tryAbdicate();
      if (abdicateCmd) {
        console.log('[SimpleAI] 선양 시도');
        return abdicateCmd;
      }
    }

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
    if (nationData && nationData.rice < (GameConst.baserice || 50000) && this.rng.nextBool(0.3)) {
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
    console.log(`[SimpleAI] 내정 후보: ${domesticCommands.length}개`);
    candidates.push(...domesticCommands);

    // 3. 군사 명령
    const militaryCommands = await this.evaluateMilitaryCommands(stats, genType);
    console.log(`[SimpleAI] 군사 후보: ${militaryCommands.length}개`);
    candidates.push(...militaryCommands);

    // 4. 자기계발 명령
    const selfImprovementCommands = this.evaluateSelfImprovementCommands(stats);
    console.log(`[SimpleAI] 자기계발 후보: ${selfImprovementCommands.length}개`);
    candidates.push(...selfImprovementCommands);

    // 5. 거래 명령
    const tradeCommands = this.evaluateTradeCommands(stats);
    candidates.push(...tradeCommands);

    console.log(`[SimpleAI] 총 후보: ${candidates.length}개`);
    
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
        // 캐시 구조 호환: trust는 최상위 또는 data 안에 있을 수 있음
        const trustVal = this.city?.trust ?? this.city?.data?.trust ?? 50;
        return this.canDomestic(genData, cityData, 'pop') && trustVal >= 20;
      
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
  private canConscript(genData: any, _cityData: any): boolean {
    // 재야가 아니어야 함
    if (genData.nation === 0) return false;
    
    // 도시를 점령하고 있어야 함
    // nation은 도시 최상위에 있음 (this.city.nation)
    const cityNation = this.city?.nation ?? (this.city?.data?.nation);
    if (!this.city || cityNation !== genData.nation) return false;
    
    // 캐시 구조 호환: 최상위와 data 양쪽에서 값을 찾아야 함
    const getCityVal = (key: string, defaultVal: number = 0) => {
      return this.city?.[key] ?? this.city?.data?.[key] ?? defaultVal;
    };
    
    // 최소 인구 필요 (200 -> 100으로 완화)
    const pop = getCityVal('pop');
    if (pop < 100) return false;
    
    // 민심 20 이상 (20 -> 15로 완화)
    const trust = getCityVal('trust', 50);
    if (trust < 15) return false;
    
    // 자금/군량 필요 (병사 0명이면 조건 완화)
    const crew = genData.crew || 0;
    const minGold = crew === 0 ? 300 : 500;
    const minRice = crew === 0 ? 300 : 500;
    
    if (genData.gold < minGold || genData.rice < minRice) return false;
    
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
    if (genData.nation === 0) {
      return false;
    }
    
    // 도시를 점령하고 있어야 함 - cityData는 이미 data이거나 전체 객체
    if (!cityData) {
      return false;
    }
    
    // nation은 도시 최상위에 있음 (this.city.nation), cityData는 this.city.data일 수 있음
    // 따라서 this.city에서 직접 nation을 가져와야 함
    const cityNation = this.city?.nation ?? (this.city?.data?.nation);
    
    if (cityNation !== genData.nation) {
      return false;
    }
    
    // 최소 자금 필요
    if (genData.gold < 100) {
      return false;
    }
    
    // 특정 키가 지정된 경우 해당 개발 용량 체크
    // cityData는 .data일 수 있고 전체 객체일 수 있음, this.city에서도 확인
    if (specificKey) {
      const current = cityData[specificKey] ?? this.city?.[specificKey] ?? 0;
      const max = cityData[`${specificKey}_max`] ?? this.city?.[`${specificKey}_max`] ?? 0;
      if (current >= max) {
        return false;
      }
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
   * 
   * gold/rice는 국가 자금을 사용 (징병/훈련 등은 국가 자금 소모)
   */
  private extractGeneralStats(genData: any): GeneralStats {
    // 국가 자금 가져오기 (징병/훈련 등은 국가 자금 사용)
    const nationData = this.nation?.data || this.nation;
    const nationGold = nationData?.gold || 0;
    const nationRice = nationData?.rice || 0;
    
    return {
      leadership: genData.leadership || 50,
      strength: genData.strength || 50,
      intel: genData.intel || 50,
      gold: nationGold,  // 국가 자금 사용
      rice: nationRice,  // 국가 군량 사용
      crew: genData.crew || 0,
      officerLevel: genData.officer_level || 1
    };
  }

  /**
   * 장수 타입 계산 (통솔장/무장/지장)
   * 
   * PHP GeneralAI::calcGenType() 로직 포팅:
   * - 무력 vs 지력 비교로 기본 타입 결정
   * - 80% 이상이면 확률적으로 복합 타입 추가 (무지장/지무장)
   * - 통솔이 minNPCWarLeadership 이상이면 통솔장 추가
   * 
   * 상수: t무장=1, t지장=2, t통솔장=4 (GenType enum 사용)
   */
  private calculateGeneralType(stats: GeneralStats): number {
    // Util::valueFit() - 최소값 1 보장
    const strength = Math.max(stats.strength, 1);
    const intel = Math.max(stats.intel, 1);
    const leadership = stats.leadership;

    let genType = 0;

    // 1. 무장 vs 지장 기본 분류 (PHP 182-196줄)
    if (strength >= intel) {
      // 무장
      genType = GenType.t무장;  // 1
      
      // 무지장: 지력이 무력의 80% 이상이면 확률적으로 지장 추가
      if (intel >= strength * 0.8) {
        // 확률: intel/strength/2 (최대 50%) - PHP rng->nextBool() 동일
        const probability = intel / strength / 2;
        if (this.rng.nextBool(probability)) {
          genType |= GenType.t지장;
        }
      }
    } else {
      // 지장
      genType = GenType.t지장;  // 2
      
      // 지무장: 무력이 지력의 80% 이상이면 확률적으로 무장 추가
      if (strength >= intel * 0.8) {
        // 확률: strength/intel/2 (최대 50%) - PHP rng->nextBool() 동일
        const probability = strength / intel / 2;
        if (this.rng.nextBool(probability)) {
          genType |= GenType.t무장;
        }
      }
    }

    // 2. 통솔장 추가 (PHP 199-202줄)
    // nationPolicy에서 minNPCWarLeadership 값 가져옴 (기본값 60)
    const minNPCWarLeadership = this.nationPolicy?.minNPCWarLeadership || 60;
    if (leadership >= minNPCWarLeadership) {
      genType |= GenType.t통솔장;  // 4
    }

    return genType;
  }

  /**
   * 도시 개발률 계산
   * 주의: 캐시된 도시 데이터는 trust, pop 등이 최상위에 있고, data 안에는 없을 수 있음
   */
  private calculateDevelopmentRates(city: any): Record<string, number> {
    // 최상위와 data 양쪽에서 값을 찾아야 함 (캐시 구조 호환)
    const getVal = (key: string, defaultVal: number = 0) => {
      return city?.[key] ?? city?.data?.[key] ?? defaultVal;
    };
    
    return {
      pop: getVal('pop') / Math.max(getVal('pop_max', 10000), 1),
      agri: getVal('agri') / Math.max(getVal('agri_max', 10000), 1),
      comm: getVal('comm') / Math.max(getVal('comm_max', 10000), 1),
      secu: getVal('secu') / Math.max(getVal('secu_max', 10000), 1),
      def: getVal('def') / Math.max(getVal('def_max', 10000), 1),
      wall: getVal('wall') / Math.max(getVal('wall_max', 10000), 1),
      trust: getVal('trust', 50) / 100
    };
  }

  /**
   * 국가 명령 평가 (수뇌/군주)
   * 
   * PHP availableChiefCommand 기반:
   * - 휴식: 휴식
   * - 인사: 발령, 포상, 몰수, 부대탈퇴지시
   * - 외교: 물자원조, 불가침제의, 선전포고, 종전제의, 불가침파기제의
   * - 특수: 초토화, 천도, 증축, 감축
   * - 전략: 필사즉생, 백성동원, 수몰, 허보, 의병모집, 이호경식, 급습, 피장파장
   * - 기타: 국기변경, 국호변경
   */
  private async evaluateNationCommands(
    stats: GeneralStats,
    genType: number
  ): Promise<AICommandDecision[]> {
    const commands: AICommandDecision[] = [];
    const nationData = this.nation?.data || this.nation;
    const cityData = this.city?.data || this.city;

    if (!nationData) {
      console.log('[SimpleAI] 국가 명령 평가 - 국가 데이터 없음');
      return commands;
    }

    const nationGold = nationData.gold || 0;
    const nationRice = nationData.rice || 0;
    const isAtWar = nationData.war || (nationData.diplomatic_state === 'war');
    const officerLevel = stats.officerLevel || 0;

    // ========================================
    // 1. 휴식 (항상 가능)
    // ========================================
    commands.push({
      command: '휴식',
      args: {},
      weight: 1,
      reason: '기본 명령'
    });

    // ========================================
    // 2. 인사 명령
    // ========================================

    // 포상 - 자금 충분할 때
    if (nationGold >= 5000) {
      commands.push({
        command: '포상',
        args: {},
        weight: 5,
        reason: '국가 자금 충분, 장수 사기 증진'
      });
    }

    // 발령 - 항상 가능 (수뇌만)
    if (officerLevel >= 5) {
      commands.push({
        command: '발령',
        args: {},
        weight: 3,
        reason: '장수 관직 임명/해임'
      });
    }

    // 몰수 - 항상 가능
    commands.push({
      command: '몰수',
      args: {},
      weight: 2,
      reason: '장수 자원 몰수'
    });

    // 부대탈퇴지시
    commands.push({
      command: '부대탈퇴지시',
      args: {},
      weight: 1,
      reason: '부대원 탈퇴 지시'
    });

    // ========================================
    // 3. 외교 명령
    // ========================================

    // 물자원조 - 자원 충분할 때 동맹국에
    if (nationGold >= 10000 || nationRice >= 10000) {
      commands.push({
        command: '물자원조',
        args: {},
        weight: 3,
        reason: '동맹국 지원'
      });
    }

    // 불가침제의 - 평화 시
    if (!isAtWar) {
      commands.push({
        command: '불가침제의',
        args: {},
        weight: 4,
        reason: '평화 유지'
      });
    }

    // 선전포고 - 조건 충족 시
    const canDeclareWar = await this.shouldDeclareWar(nationData);
    if (canDeclareWar) {
      commands.push({
        command: '선전포고',
        args: { targetNationId: canDeclareWar },
        weight: 15,
        reason: '전쟁 준비 완료'
      });
    }

    // 종전제의 - 전쟁 중일 때
    if (isAtWar) {
      commands.push({
        command: '종전제의',
        args: {},
        weight: 3,
        reason: '전쟁 종료 요청'
      });
    }

    // 불가침파기제의
    commands.push({
      command: '불가침파기제의',
      args: {},
      weight: 1,
      reason: '불가침 조약 파기'
    });

    // ========================================
    // 4. 특수 명령
    // ========================================

    // 초토화 - 전쟁 중이고 상황이 불리할 때
    if (isAtWar) {
      commands.push({
        command: '초토화',
        args: {},
        weight: 2,
        reason: '적군 보급 차단'
      });
    }

    // 천도 - 수도 이전 (큰 결정)
    if (nationGold >= 50000) {
      commands.push({
        command: '천도',
        args: {},
        weight: 1,
        reason: '수도 이전'
      });
    }

    // 증축 - 도시 레벨 업
    if (nationGold >= 10000) {
      commands.push({
        command: '증축',
        args: {},
        weight: 4,
        reason: '도시 레벨 향상'
      });
    }

    // 감축 - 도시 레벨 다운
    commands.push({
      command: '감축',
      args: {},
      weight: 1,
      reason: '도시 레벨 축소'
    });

    // ========================================
    // 5. 전략 명령
    // ========================================

    // 필사즉생 - 전쟁 중 위급할 때
    if (isAtWar) {
      commands.push({
        command: '필사즉생',
        args: {},
        weight: 2,
        reason: '위급 상황 돌파'
      });
    }

    // 백성동원 - 인구 충분할 때
    if (cityData && (cityData.pop || 0) >= 50000) {
      commands.push({
        command: '백성동원',
        args: {},
        weight: 5,
        reason: '병력 확보'
      });
    }

    // 수몰 - 물이 있는 도시에서
    if (isAtWar) {
      commands.push({
        command: '수몰',
        args: {},
        weight: 2,
        reason: '수공 작전'
      });
    }

    // 허보 - 정보전
    commands.push({
      command: '허보',
      args: {},
      weight: 3,
      reason: '거짓 정보 유포'
    });

    // 의병모집
    if (isAtWar) {
      commands.push({
        command: '의병모집',
        args: {},
        weight: 4,
        reason: '의병 소집'
      });
    }

    // 이호경식 - 이간계
    commands.push({
      command: '이호경식',
      args: {},
      weight: 2,
      reason: '적국 분열 유도'
    });

    // 급습 - 기습 공격
    if (isAtWar) {
      commands.push({
        command: '급습',
        args: {},
        weight: 6,
        reason: '기습 공격'
      });
    }

    // 피장파장 - 동시 피해
    if (isAtWar) {
      commands.push({
        command: '피장파장',
        args: {},
        weight: 2,
        reason: '상호 피해'
      });
    }

    // ========================================
    // 6. 기타 명령 (AI는 잘 안씀)
    // ========================================
    // 국기변경, 국호변경은 AI가 사용하지 않음

    // ========================================
    // 7. 부대 발령 명령 평가 (기존 로직)
    // ========================================
    const dispatchCommands = await this.evaluateTroopDispatchCommands();
    commands.push(...dispatchCommands);

    console.log(`[SimpleAI] 국가 명령 후보 생성: ${commands.length}개 (전쟁중: ${isAtWar}, 자금: ${nationGold})`);
    
    return commands;
  }

  /**
   * 부대 발령 명령 평가
   * 
   * PHP GeneralAI의 do부대전방발령, do부대후방발령, do부대구출발령 로직
   * TroopDispatch.ts의 TroopDispatcher 클래스 사용
   */
  private async evaluateTroopDispatchCommands(): Promise<AICommandDecision[]> {
    const commands: AICommandDecision[] = [];
    const nationData = this.nation?.data || this.nation;
    const genData = this.general.data || this.general;

    // 수뇌가 아니면 발령 불가
    const officerLevel = genData.officer_level || 0;
    if (officerLevel < 5) {
      return commands;
    }

    // 수도가 없으면 발령 불가
    if (!nationData?.capital) {
      return commands;
    }

    // nationPolicy 확인
    if (!this.nationPolicy) {
      return commands;
    }

    try {
      // 도시 목록 조회
      const sessionId = this.env?.session_id;
      if (!sessionId) {
        return commands;
      }

      const nationID = nationData.nation;
      const { cityRepository } = await import('../repositories/city.repository');
      const { generalRepository } = await import('../repositories/general.repository');
      
      const cities = await cityRepository.findByNation(sessionId, nationID);
      const generals = await generalRepository.findByNation(sessionId, nationID);

      if (!cities || cities.length === 0) {
        return commands;
      }

      // CityInfo, GeneralInfo 변환
      const cityInfos: CityInfo[] = cities.map((c: any) => ({
        city: c.city,
        name: c.name,
        nation: c.nation,
        pop: c.pop || 0,
        pop_max: c.pop_max || 10000,
        supply: c.supply || 0,
        front: c.front || 0,
        level: c.level || 1,
      }));

      const generalInfos: GeneralInfo[] = (generals || []).map((g: any) => ({
        no: g.no,
        name: g.name,
        nation: g.nation,
        city: g.city,
        npc: g.npc || 0,
        officer_level: g.officer_level || 0,
        troop: g.troop || 0,
        crew: g.crew || 0,
        train: g.train || 0,
        atmos: g.atmos || 0,
        leadership: g.leadership || 50,
        aux: g.aux || {},
        turnTime: g.turntime || '',
      }));

      // 전방 도시 체크
      const frontCities = cityInfos.filter(c => c.front > 0);
      if (frontCities.length === 0) {
        return commands;
      }

      // TroopDispatcher 생성
      const dispatcher = new TroopDispatcher(
        nationData,
        this.env,
        this.nationPolicy,
        this.rng.nextInt(0, 999999)  // seed 기반 난수
      );
      dispatcher.setCities(cityInfos);
      dispatcher.setGenerals(generalInfos);

      // 전쟁 경로 계산 (도시별 거리 맵, 최대 20칸까지)
      const warRoute: Record<number, Record<number, number>> = {};
      for (const city of cityInfos) {
        const distances = await searchDistanceAsync(sessionId, city.city, 20, true);
        if (distances) {
          warRoute[city.city] = distances;
        }
      }
      dispatcher.setWarRoute(warRoute);

      // 수뇌 턴 시간 계산
      const turnterm = this.env?.turnterm || 10;
      const chiefTurnTime = this.cutTurnTime(genData.turntime || '', turnterm);

      // 1. 구출 발령 (최우선)
      if (this.nationPolicy.can부대구출발령) {
        const rescueResult = dispatcher.doTroopRescue();
        if (rescueResult) {
          commands.push({
            command: rescueResult.command,
            args: rescueResult.args,
            weight: 90,
            reason: rescueResult.reason,
          });
        }
      }

      // 2. 전방 발령
      if (this.nationPolicy.can부대전방발령) {
        const frontResult = dispatcher.doTroopFrontDispatch(chiefTurnTime);
        if (frontResult) {
          commands.push({
            command: frontResult.command,
            args: frontResult.args,
            weight: 80,
            reason: frontResult.reason,
          });
        }
      }

      // 3. 후방 발령
      if (this.nationPolicy.can부대후방발령) {
        const rearResult = dispatcher.doTroopRearDispatch(chiefTurnTime);
        if (rearResult) {
          commands.push({
            command: rearResult.command,
            args: rearResult.args,
            weight: 60,
            reason: rearResult.reason,
          });
        }
      }

    } catch (error) {
      console.error('[SimpleAI] 부대 발령 평가 중 오류:', error);
    }

    return commands;
  }

  /**
   * 턴 시간을 turnterm 기준 정수로 변환 (PHP cutTurn 함수)
   */
  private cutTurnTime(turnTimeStr: string, turnterm: number): number {
    if (!turnTimeStr) return 0;
    const d = new Date(turnTimeStr);
    
    // 유효하지 않은 날짜면 0 반환
    if (isNaN(d.getTime())) {
      console.warn(`[SimpleAI] cutTurnTime: 유효하지 않은 날짜 문자열 - ${turnTimeStr}`);
      return 0;
    }
    
    // turnterm이 0 이하면 기본값 10 사용
    const safeTurnterm = turnterm > 0 ? turnterm : 10;
    return Math.floor(d.getTime() / (safeTurnterm * 60 * 1000));
  }

  /**
   * 선전포고 가능 여부 및 대상 결정
   */
  private async shouldDeclareWar(nationData: any): Promise<number | null> {
    // 방랑군이나 재야는 선전포고 불가
    if (!nationData || nationData.level === 0) return null;

    // 수도가 없으면 불가
    if (!nationData.capital) return null;

    const nationGold = nationData.gold || 0;
    const nationRice = nationData.rice || 0;
    const nationId = nationData.nation || 0;

    // 자원 충분 여부 (최소 5000 이상)
    if (nationGold < 5000 || nationRice < 5000) {
      return null;
    }

    // 이미 전쟁 중이면 추가 선포 안 함
    const warList = nationData.war_list || nationData.warList || [];
    if (Array.isArray(warList) && warList.length >= 2) {
      return null; // 이미 2개국 이상과 전쟁 중
    }

    // 인접한 적 국가 찾기
    try {
      const sessionId = this.env?.session_id;
      if (!sessionId) return null;

      const { cityRepository } = await import('../repositories/city.repository');
      const { nationRepository } = await import('../repositories/nation.repository');
      
      // 우리 국가의 도시들
      const ourCities = await cityRepository.findByNation(sessionId, nationId);
      if (!ourCities || ourCities.length === 0) return null;

      // 인접한 다른 국가 도시 찾기
      const adjacentNations = new Set<number>();
      
      for (const city of ourCities) {
        // neighbors 필드 또는 connect 필드에서 인접 도시 가져오기
        const cityData = (city as any).data || city;
        const neighbors = cityData.neighbors || (city as any).neighbors || (city as any).connect || [];
        
        for (const neighborId of neighbors) {
          // neighborId가 숫자가 아니면 파싱
          const nId = typeof neighborId === 'number' ? neighborId : parseInt(String(neighborId), 10);
          if (isNaN(nId)) continue;
          
          const neighborCity = await cityRepository.findByCityNum(sessionId, nId) as any;
          const neighborNation = neighborCity?.nation ?? neighborCity?.data?.nation ?? 0;
          
          if (neighborNation && neighborNation !== nationId && neighborNation !== 0) {
            adjacentNations.add(neighborNation);
          }
        }
      }

      if (adjacentNations.size === 0) return null;

      // 가장 약한 국가 선택 (장수 수 기준)
      let targetNationId: number | null = null;
      let minGenCount = Infinity;

      for (const adjNationId of adjacentNations) {
        // 이미 전쟁 중인 국가 제외
        if (warList.includes(adjNationId)) continue;

        const adjNation = await nationRepository.findByNationNum(sessionId, adjNationId);
        if (!adjNation) continue;

        const genCount = adjNation.gennum || 0;
        if (genCount < minGenCount) {
          minGenCount = genCount;
          targetNationId = adjNationId;
        }
      }

      // 상대 국가의 장수 수가 우리의 1.5배 이상이면 선포 안 함
      const ourGenCount = nationData.gennum || 1;
      if (minGenCount > ourGenCount * 1.5) {
        return null;
      }

      console.log(`[SimpleAI] 선전포고 대상 발견: 국가 ${targetNationId} (장수 ${minGenCount}명)`);
      return targetNationId;
    } catch (error) {
      console.error('[SimpleAI] 선전포고 대상 탐색 실패:', error);
      return null;
    }
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
   * 거병 시도 (PHP GeneralAI do거병 3217-3289줄 참고)
   * 재야 NPC가 새 세력을 만들기 위해 거병
   */
  private async tryRaiseArmy(): Promise<AICommandDecision | null> {
    const genData = this.general.data || this.general;
    
    // makelimit 있으면 거병 불가 (이미 한번 세력 만듦)
    if (genData.makelimit) {
      return null;
    }

    // NPC 타입 4 이상은 거병 불가 (NPC 2-3만 가능, 4는 50% 확률)
    const npcType = genData.npc || 0;
    if (npcType > 3) {
      return null;
    }
    if (npcType === 3 && this.rng.nextBool(0.5)) {
      return null;
    }

    // Policy 체크 (건국 정책 체크)
    if (this.generalPolicy && !this.generalPolicy.canPerform(GeneralActionType.건국)) {
      return null;
    }

    // 도시 레벨 4-7 가능 (중형~대형 도시) - PHP 3231-3234줄 수정
    // 원본 PHP는 5-6이었으나 거병 활성화를 위해 범위 확장
    const cityData = this.city?.data || this.city;
    const currentCityLevel = cityData?.level || cityData?.levelId || 0;
    if ((currentCityLevel < 4 || 7 < currentCityLevel) && this.rng.nextBool(0.5)) {
      return null;
    }

    // 주변 3칸 이내에 거병 가능한 도시(레벨 4-7, 무주) 있는지 체크 - PHP 3236-3266줄 수정
    const currentCityID = cityData?.city || genData.city || 0;
    const occupiedCities = await this.getOccupiedCities();
    
    let availableNearCity = false;
    try {
      const distanceMap = await searchDistanceAsync(this.sessionId, currentCityID, 3, false);
      
      for (const [targetCityIDStr, dist] of Object.entries(distanceMap)) {
        const targetCityID = parseInt(targetCityIDStr, 10);
        
        // 이미 점령된 도시면 스킵
        if (occupiedCities.has(targetCityID)) {
          continue;
        }
        
        // 도시 레벨 체크 (4-7 가능) - 범위 확장
        const cityConst = CityConst.byID(targetCityID);
        const cityLevel = cityConst?.levelId || 0;
        if (cityLevel < 4 || 7 < cityLevel) {
          continue;
        }
        
        // 거리 3이면 50% 확률로 스킵
        if (dist === 3 && this.rng.nextBool(0.5)) {
          continue;
        }
        
        availableNearCity = true;
        break;
      }
    } catch (error) {
      console.warn('[SimpleAI] tryRaiseArmy: searchDistance failed, fallback to probability', error);
      // 폴백: 70% 확률로 가능하다고 판단 (50%에서 상향)
      availableNearCity = this.rng.nextBool(0.7);
    }
    
    if (!availableNearCity) {
      return null;
    }

    // 능력치 체크: 평균 능력치가 높을수록 거병 확률 증가 - PHP 3268-3274줄
    const leadership = genData.leadership || 50;
    const strength = genData.strength || 50;
    const intel = genData.intel || 50;
    const avgStat = (leadership + strength + intel) / 3;
    const npcMaxStat = GameConst.defaultStatNPCMax || 80;
    const chiefMinStat = GameConst.chiefStatMin || 60;
    const threshold = this.rng.next() * (npcMaxStat + chiefMinStat) / 2;
    
    if (threshold >= avgStat) {
      return null;
    }

    // 게임 초반(3년 이내)일수록 거병 확률 증가 - PHP 3276-3280줄
    const env = this.env;
    const relYear = (env.year || 0) - (env.init_year || env.startyear || 0);
    const yearBonus = Math.max(1, Math.min(5, 5 - relYear));
    
    // 최종 확률: 15% * yearBonus (최대 75%)
    // 원본 PHP는 5%였으나 NPC 활성화를 위해 상향
    const raiseChance = 0.15 * yearBonus;
    if (!this.rng.nextBool(raiseChance)) {
      return null;
    }
    
    console.log(`[SimpleAI] 🏴 거병 확률 통과: ${(raiseChance * 100).toFixed(1)}%`);

    console.log(`[SimpleAI] 거병 조건 충족 - ${genData.name || genData.no}`);
    return {
      command: '거병',
      args: {},
      weight: 100, // 최우선
      reason: `NPC 거병 (능력:${avgStat.toFixed(0)}, 연차:${relYear})`,
    };
  }
  
  /**
   * 점령된 도시 목록 조회 (방랑군 대장 + 국가 도시)
   * @returns Set<cityID> - 점령된 도시 ID 집합 (값: 1=국가점령, 2=방랑군대장)
   */
  private async getOccupiedCities(): Promise<Map<number, number>> {
    const occupiedCities = new Map<number, number>();
    
    try {
      // 방랑군 대장(officer_level=12, nation=0)이 있는 도시
      const lordGenerals = await generalRepository.findByFilter({
        session_id: this.sessionId,
        'data.officer_level': 12,
        'data.nation': 0
      });
      
      for (const gen of lordGenerals) {
        const cityID = gen.data?.city || gen.city;
        if (cityID) {
          occupiedCities.set(cityID, 2);
        }
      }
      
      // 국가 소유 도시
      const cities = await cityRepository.findByFilter({
        session_id: this.sessionId,
        'data.nation': { $ne: 0 }
      });
      
      for (const city of cities) {
        const cityID = city.data?.city || city.city;
        if (cityID) {
          occupiedCities.set(cityID, 1);
        }
      }
    } catch (error) {
      console.warn('[SimpleAI] getOccupiedCities failed:', error);
    }
    
    return occupiedCities;
  }

  /**
   * 건국 시도 (PHP GeneralAI do건국 3302-3319줄 참고)
   * 방랑군 대장이 도시를 점령하고 국가를 세움
   */
  private async tryFoundNation(): Promise<AICommandDecision | null> {
    const genData = this.general.data || this.general;
    
    // Policy 체크
    if (this.generalPolicy && !this.generalPolicy.canPerform(GeneralActionType.건국)) {
      return null;
    }

    // 방랑군 대장(officer_level=12)만 건국 가능
    const officerLevel = genData.officer_level || 0;
    if (officerLevel < 12) {
      return null;
    }

    // 현재 도시가 건국 가능한 도시(레벨 4-7)인지 확인
    // 원본 PHP는 5-6이었으나 건국 활성화를 위해 범위 확장
    const cityData = this.city?.data || this.city;
    const cityLevel = cityData?.level || cityData?.levelId || 0;
    if (cityLevel < 4 || 7 < cityLevel) {
      return null;
    }

    // 현재 도시가 비어있는지 확인 (다른 국가 소유 아님)
    const cityNation = cityData?.nation || 0;
    if (cityNation !== 0) {
      return null;
    }

    // 같은 도시에 다른 방랑군 대장이 있는지 확인
    const currentCityID = cityData?.city || genData.city || 0;
    const occupiedCities = await this.getOccupiedCities();
    const occupyType = occupiedCities.get(currentCityID);
    
    // 이미 다른 방랑군 대장이 점령 중이면 건국 불가
    if (occupyType === 2) {
      // 자기 자신인지 확인
      const lordGenerals = await generalRepository.findByFilter({
        session_id: this.sessionId,
        'data.officer_level': 12,
        'data.city': currentCityID,
        'data.nation': 0
      });
      
      const selfIsLord = lordGenerals.some(g => 
        (g.data?.no || g.no) === (genData.no || genData.data?.no)
      );
      
      if (!selfIsLord) {
        return null;
      }
    }

    // 랜덤 국가 타입/색상 선택 - PHP 3304-3305줄
    const availableTypes = GameConst.availableNationType || ['왕', '공', '후', '백'];
    const availableColors = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    
    const nationType = this.rng.choice(availableTypes) as string;
    const colorType = this.rng.choice(availableColors) as number;
    
    // 국가명: ㉿ + 장수명 (첫 글자 제외) - PHP 3307줄
    const generalName = genData.name || '방랑군';
    const nationName = '㉿' + generalName.substring(1);

    console.log(`[SimpleAI] 건국 시도 - ${genData.name || genData.no}, 도시: ${currentCityID}, 국명: ${nationName}`);
    return {
      command: '건국',
      args: {
        nationName,
        nationType,
        colorType,
      },
      weight: 100, // 최우선
      reason: `방랑군 건국 (${nationName}, ${nationType})`,
    };
  }

  /**
   * 선양 시도 (PHP GeneralAI do선양 3320-3333줄 참고)
   * 군주가 다른 장수에게 왕위를 물려줌
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
    
    // 국가 소속이어야 함
    const nationID = genData.nation || 0;
    if (nationID === 0) {
      return null;
    }

    // 국가 내 다른 장수 찾기 (npc != 5, 즉 방랑군 소속이 아닌 장수)
    try {
      const nationGenerals = await generalRepository.findByFilter({
        session_id: this.sessionId,
        'data.nation': nationID,
        'data.npc': { $ne: 5 }
      });
      
      // 자신 제외
      const candidates = nationGenerals.filter(g => {
        const gNo = g.data?.no || g.no;
        const selfNo = genData.no || genData.data?.no;
        return gNo !== selfNo;
      });
      
      if (candidates.length === 0) {
        return null;
      }
      
      // 랜덤 선택
      const selectedGeneral = this.rng.choice(candidates) as any;
      if (!selectedGeneral) {
        return null;
      }
      const destGeneralID = selectedGeneral.data?.no || selectedGeneral.no;
      
      console.log(`[SimpleAI] 선양 시도 - ${genData.name || genData.no} -> ${selectedGeneral.data?.name || destGeneralID}`);
      return {
        command: '선양',
        args: {
          destGeneralID,
        },
        weight: 100,
        reason: `선양 (후계자: ${selectedGeneral.data?.name || destGeneralID})`,
      };
    } catch (error) {
      console.warn('[SimpleAI] tryAbdicate: failed to find candidates:', error);
      return null;
    }
  }

  /**
   * 방랑군 이동 (PHP GeneralAI do방랑군이동 3127-3216줄 참고)
   * 방랑군 대장이 건국 가능한 도시(레벨 5-6)로 이동
   */
  private async tryWanderingMove(): Promise<AICommandDecision | null> {
    const genData = this.general.data || this.general;
    const cityData = this.city?.data || this.city;
    const currentCityID = cityData?.city || genData.city || 0;

    // 같은 도시에 다른 군주(officer_level=12) 있는지 체크 - PHP 3131-3140줄
    const occupiedCities = await this.getOccupiedCities();
    
    // 현재 도시에 다른 방랑군 대장이 1명 이하면 (즉 자기만 있거나 없으면)
    const dupLordCount = await this.countLordsInCity(currentCityID);
    
    if (dupLordCount <= 1) {
      // 현재 도시가 레벨 5-6인지 체크 - 이미 건국 가능한 도시면 이동 불필요
      const cityLevel = cityData?.level || cityData?.levelId || 0;
      if (cityLevel >= 5 && cityLevel <= 6) {
        return null; // 이미 좋은 위치에 있음
      }
    }

    // 저장된 이동 목표 도시 확인 (aux.movingTargetCityID)
    let movingTargetCityID = genData.aux?.movingTargetCityID || null;
    
    // 목표 도시가 현재 도시면 초기화
    if (movingTargetCityID === currentCityID) {
      movingTargetCityID = null;
    }
    
    // 목표 도시가 이미 점령되었으면 초기화
    if (movingTargetCityID && occupiedCities.has(movingTargetCityID)) {
      movingTargetCityID = null;
    }

    // 새 목표 도시 선정 - PHP 3163-3182줄
    if (!movingTargetCityID) {
      const candidateCities: Array<[number, number]> = [];
      
      try {
        const distanceMap = await searchDistanceAsync(this.sessionId, currentCityID, 4, false);
        
        for (const [testCityIDStr, dist] of Object.entries(distanceMap)) {
          const testCityID = parseInt(testCityIDStr, 10);
          
          // 이미 점령된 도시면 스킵
          if (occupiedCities.has(testCityID)) {
            continue;
          }
          
          // 도시 레벨 체크 (5-6만 가능)
          const cityConst = CityConst.byID(testCityID);
          const cityLevel = cityConst?.levelId || 0;
          if (cityLevel < 5 || 6 < cityLevel) {
            continue;
          }
          
          // 가중치: 거리가 가까울수록 높음 (1/2^dist)
          candidateCities.push([testCityID, 1 / Math.pow(2, dist)]);
        }
      } catch (error) {
        console.warn('[SimpleAI] tryWanderingMove: searchDistance failed:', error);
      }
      
      if (candidateCities.length === 0) {
        return null; // 갈 곳이 없음
      }
      
      // 가중치 기반 랜덤 선택
      movingTargetCityID = this.choiceUsingWeightPair(candidateCities);
      
      if (!movingTargetCityID) {
        return null; // 선택 실패
      }
      
      // 목표 저장 (FUTURE: aux 필드에 저장)
      console.log(`[SimpleAI] 방랑군 새 목표 설정: ${currentCityID} -> ${movingTargetCityID}`);
    }

    // 목표 도시가 현재 도시면 인재탐색 (건국 대기)
    if (movingTargetCityID === currentCityID) {
      return {
        command: '인재탐색',
        args: {},
        weight: 50,
        reason: '방랑군 인재탐색 (건국 대기)',
      };
    }

    // 다음 이동 경로 계산 - PHP 3188-3205줄
    try {
      const distMap = await searchDistanceAsync(this.sessionId, movingTargetCityID, 99, true);
      const targetDistance = distMap[currentCityID] || 99;
      
      // 현재 도시의 인접 도시 중 목표에 가까운 도시 선택
      const cityConst = CityConst.byID(currentCityID);
      const neighbors = cityConst?.neighbors || [];
      
      const nextCandidates: Array<[number, number]> = [];
      
      for (const nearCityID of neighbors) {
        const cityConstNear = CityConst.byID(nearCityID);
        const cityLevel = cityConstNear?.levelId || 0;
        
        // 바로 옆 도시가 레벨 5-6이고 비어있으면 우선 이동
        if (cityLevel >= 5 && cityLevel <= 6 && !occupiedCities.has(nearCityID)) {
          nextCandidates.push([nearCityID, 10]); // 높은 가중치
        }
        
        // 목표 방향으로 가는 경로면 추가
        const nearDist = distMap[nearCityID] || 99;
        if (nearDist + 1 === targetDistance) {
          nextCandidates.push([nearCityID, 1]);
        }
      }
      
      if (nextCandidates.length === 0) {
        return null;
      }
      
      const destCityID = this.choiceUsingWeightPair(nextCandidates);
      
      if (!destCityID) {
        return null; // 선택 실패
      }
      
      console.log(`[SimpleAI] 방랑군 이동: ${currentCityID} -> ${destCityID} (목표: ${movingTargetCityID})`);
      return {
        command: '이동',
        args: { destCityID },
        weight: 80,
        reason: `방랑군 이동 (${currentCityID} -> ${destCityID}, 목표: ${movingTargetCityID})`,
      };
    } catch (error) {
      console.warn('[SimpleAI] tryWanderingMove: path calculation failed:', error);
      return null;
    }
  }
  
  /**
   * 특정 도시의 방랑군 대장 수 조회
   */
  private async countLordsInCity(cityID: number): Promise<number> {
    try {
      const lords = await generalRepository.findByFilter({
        session_id: this.sessionId,
        'data.officer_level': 12,
        'data.city': cityID,
        'data.nation': 0
      });
      return lords.length;
    } catch (error) {
      return 0;
    }
  }
  
  /**
   * 가중치 기반 랜덤 선택 (PHP rng->choiceUsingWeightPair 포팅)
   */
  private choiceUsingWeightPair<T>(pairs: Array<[T, number]>): T | null {
    // 빈 배열 체크
    if (!pairs || pairs.length === 0) {
      console.warn('[SimpleAI] choiceUsingWeightPair: 빈 배열 입력');
      return null;
    }
    
    const totalWeight = pairs.reduce((sum, [, weight]) => sum + weight, 0);
    
    // 가중치 합이 0 이하면 첫 번째 항목 반환
    if (totalWeight <= 0) {
      return pairs[0][0];
    }
    
    let random = this.rng.next() * totalWeight;
    
    for (const [item, weight] of pairs) {
      random -= weight;
      if (random <= 0) {
        return item;
      }
    }
    
    return pairs[0][0];
  }

  /**
   * 해산 (PHP GeneralAI do해산 3290-3301줄 참고)
   * 방랑군 대장이 세력을 해산하고 모든 수하를 재야로 보냄
   */
  private async tryDisband(): Promise<AICommandDecision | null> {
    const genData = this.general.data || this.general;
    
    // aux.movingTargetCityID 초기화 (PHP 3297줄)
    // FUTURE: genData.aux.movingTargetCityID = null; 저장 필요
    
    console.log(`[SimpleAI] 방랑군 해산 - ${genData.name || genData.no}`);
    return {
      command: '해산',
      args: {},
      weight: 100,
      reason: '방랑군 해산',
    };
  }

  /**
   * 국가 선택 (임관/랜덤임관) (PHP GeneralAI do국가선택 3334-3402줄 참고)
   * 재야 장수가 국가에 임관
   */
  private async tryJoinNation(): Promise<AICommandDecision | null> {
    const genData = this.general.data || this.general;
    const npcType = genData.npc || 0;
    
    // Policy 체크
    if (this.generalPolicy && !this.generalPolicy.canPerform(GeneralActionType.국가선택)) {
      return null;
    }

    // 재야(nation=0)만 가능
    if ((genData.nation || 0) !== 0) {
      return null;
    }

    // 오랑캐(npc=9)는 바로 오랑캐 군주 국가에 임관 - PHP 3343-3356줄
    if (npcType === 9) {
      try {
        const barbarianRulers = await generalRepository.findByFilter({
          session_id: this.sessionId,
          'data.officer_level': 12,
          'data.npc': 9,
          'data.nation': { $ne: 0 }
        });
        
        if (barbarianRulers.length > 0) {
          const ruler = this.rng.choice(barbarianRulers as any[]);
          const destNationID = ruler.data?.nation || ruler.nation;
          
          console.log(`[SimpleAI] 오랑캐 임관 - ${genData.name || genData.no} -> 국가 ${destNationID}`);
          return {
            command: '임관',
            args: { destNationID },
            weight: 100,
            reason: `오랑캐 임관 (국가: ${destNationID})`,
          };
        }
      } catch (error) {
        console.warn('[SimpleAI] tryJoinNation: barbarian ruler search failed:', error);
      }
    }

    // 30% 확률로 시도 - PHP 3358줄
    if (!this.rng.nextBool(0.3)) {
      return null;
    }

    // 친화도 999면 임관 안 함 (일생 재야) - PHP 3359-3361줄
    if (genData.affinity === 999) {
      return null;
    }

    const env = this.env;
    const relYear = (env.year || 0) - (env.startyear || 0);

    // 초기 임관 기간(3년)에는 국가 수에 따라 확률 조정 - PHP 3363-3379줄
    if (relYear < 3) {
      try {
        const nations = await nationRepository.findByFilter({
          session_id: this.sessionId
        });
        const nationCnt = nations.length;
        
        // 정원 미달 국가 수
        const notFullNationCnt = nations.filter(n => 
          (n.data?.gennum || n.gennum || 0) < (GameConst.initialNationGenLimit || 30)
        ).length;
        
        if (nationCnt === 0 || notFullNationCnt === 0) {
          return null;
        }
        
        // 국가가 적을수록 임관 확률 낮음
        const skipProb = Math.pow(1 / (nationCnt + 1) / Math.pow(notFullNationCnt, 3), 0.25);
        if (this.rng.nextBool(skipProb)) {
          return null;
        }
      } catch (error) {
        console.warn('[SimpleAI] tryJoinNation: nation count failed, using fallback:', error);
        if (this.rng.nextBool(0.5)) {
          return null;
        }
      }
    } else {
      // 임관 기간 종료 후에는 0.15 확률 (0.3 * 0.5) - PHP 3375-3378줄
      if (!this.rng.nextBool(0.5)) {
        return null;
      }
    }

    // 랜덤 임관 - PHP 3381-3387줄
    console.log(`[SimpleAI] 랜덤 임관 시도 - ${genData.name || genData.no}`);
    return {
      command: '랜덤임관',
      args: {},
      weight: 10,
      reason: `국가 선택 (연차: ${relYear})`,
    };
  }
  
  /**
   * NPC 사망 대비 (PHP GeneralAI doNPC사망대비 3403-3435줄 참고)
   * 사망 직전 NPC가 자원을 국가에 헌납하거나 자기계발
   */
  async tryDeathPreparation(): Promise<AICommandDecision | null> {
    const genData = this.general.data || this.general;
    
    // Policy 체크
    if (this.generalPolicy && !this.generalPolicy.canPerform(GeneralActionType.NPC사망대비)) {
      return null;
    }

    // killturn이 5 이상이면 아직 여유 있음 - PHP 3407-3409줄
    const killturn = genData.killturn || 30;
    if (killturn > 5) {
      return null;
    }

    const nationID = genData.nation || 0;

    // 재야면 인재탐색 또는 견문 - PHP 3411-3417줄
    if (nationID === 0) {
      // 50% 확률로 인재탐색, 아니면 견문
      if (this.rng.nextBool(0.5)) {
        return {
          command: '인재탐색',
          args: {},
          weight: 50,
          reason: `NPC 사망 대비 - 인재탐색 (killturn: ${killturn})`,
        };
      }
      return {
        command: '견문',
        args: {},
        weight: 50,
        reason: `NPC 사망 대비 - 견문 (killturn: ${killturn})`,
      };
    }

    // 자원이 없으면 물자조달 - PHP 3419-3421줄
    const gold = genData.gold || 0;
    const rice = genData.rice || 0;
    
    if (gold + rice === 0) {
      return {
        command: '물자조달',
        args: {},
        weight: 80,
        reason: `NPC 사망 대비 - 물자조달 (killturn: ${killturn})`,
      };
    }

    // 자원 헌납 (금이 많으면 금, 아니면 쌀) - PHP 3423-3433줄
    const maxAmount = GameConst.maxResourceActionAmount || 10000;
    
    if (gold >= rice) {
      console.log(`[SimpleAI] NPC 사망 대비 - 금 헌납 ${gold} (killturn: ${killturn})`);
      return {
        command: '헌납',
        args: {
          isGold: true,
          amount: Math.min(gold, maxAmount),
        },
        weight: 100,
        reason: `NPC 사망 대비 - 금 헌납 (killturn: ${killturn})`,
      };
    } else {
      console.log(`[SimpleAI] NPC 사망 대비 - 쌀 헌납 ${rice} (killturn: ${killturn})`);
      return {
        command: '헌납',
        args: {
          isGold: false,
          amount: Math.min(rice, maxAmount),
        },
        weight: 100,
        reason: `NPC 사망 대비 - 쌀 헌납 (killturn: ${killturn})`,
      };
    }
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
    const genData = this.general.data || this.general;
    const nationID = genData.nation || 0;
    
    // === 재야는 내정 불가 ===
    if (nationID === 0) {
      return commands;
    }
    
    const develRate = this.calculateDevelopmentRates(this.city);
    const isSpringSummer = (this.env.month || 1) <= 6;

    // GenType 상수 사용 (PHP와 동일: t무장=1, t지장=2, t통솔장=4)
    // 주의: 이전 코드의 TYPE_COMMANDER=1, TYPE_WARRIOR=2, TYPE_STRATEGIST=4와 다름!
    
    console.log(`[SimpleAI] 내정 평가 - genType: ${genType}, 개발률: 민심${(develRate.trust*100).toFixed(0)}% 인구${(develRate.pop*100).toFixed(0)}% 농${(develRate.agri*100).toFixed(0)}% 상${(develRate.comm*100).toFixed(0)}%`);

    // 통솔장: 주민 관련 (GenType.t통솔장 = 4)
    if (genType & GenType.t통솔장) {
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

    // 무장: 방어 관련 (GenType.t무장 = 1)
    if (genType & GenType.t무장) {
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

    // 지장: 경제/기술 (GenType.t지장 = 2)
    if (genType & GenType.t지장) {
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
        console.log(`[SimpleAI] 농지개간 후보 추가: 가중치 ${weight.toFixed(1)}`);
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
        console.log(`[SimpleAI] 상업투자 후보 추가: 가중치 ${weight.toFixed(1)}`);
        commands.push({
          command: '상업투자',
          args: {},
          weight: weight,
          reason: `상업 부족 (${(develRate.comm * 100).toFixed(1)}%), ${isSpringSummer ? '봄/여름' : '가을/겨울'}`
        });
      }
    }

    console.log(`[SimpleAI] 내정 명령 ${commands.length}개 생성`);
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

    // === 자원 체크 (징병/훈련 비용) - 완화됨 ===
    const hasMinimumResources = stats.gold >= 200 && stats.rice >= 200;
    const hasLowResources = stats.gold >= 100 && stats.rice >= 100; // 최소 자원 (긴급 징병용)
    const hasGoodResources = stats.gold >= 1000 && stats.rice >= 1000;

    // === 징병 평가 ===
    const needRecruit = stats.crew < 5000;
    const canRecruit = stats.leadership >= 50; // 최소 통솔 50

    if (needRecruit && canRecruit) {
      let weight = stats.leadership / 5;
      let reason = '병사 부족';
      let priority = 'normal';
      let requiresResources = hasMinimumResources;
      
      // 병사 0명: 최고 우선순위 (단련/훈련 불가) - 자원 조건 완화
      if (stats.crew <= 0) {
        weight = 100; // 절대 우선순위
        reason = '병사 없음 - 긴급 징병 필수';
        priority = 'critical';
        requiresResources = hasLowResources; // 최소 자원만 있으면 징병
      }
      // 병사 500명 미만: 훈련 불가
      else if (stats.crew < 500) {
        weight = 50; // 매우 높은 우선순위
        reason = '병사 부족 - 훈련 불가';
        priority = 'urgent';
        requiresResources = hasMinimumResources;
      }
      // 병사 1000명 미만: 전투 불가
      else if (stats.crew < 1000) {
        weight = stats.leadership / 2; // 2배 증가
        reason = '병사 매우 부족 - 전투 불가';
        priority = 'high';
        requiresResources = hasMinimumResources;
      }
      // 병사 3000명 미만: 전투력 부족
      else if (stats.crew < 3000) {
        weight = stats.leadership / 3; // 1.5배 증가
        reason = '병사 부족 - 전투력 약함';
        priority = 'medium';
        requiresResources = hasMinimumResources;
      }
      
      // 자원 조건 통과 시에만 징병 후보 추가
      if (requiresResources) {
        // PHP와 동일: 징병량 = 통솔 * 100 (최소값 강제 없음)
        // PHP: $crew = $this->fullLeadership * 100
        const maxRecruitByLeadership = stats.leadership * 100;
        
        // 자원에 따른 실제 징병량 (금과 쌀 중 적은 것 기준)
        const maxRecruitByResources = Math.min(stats.gold, stats.rice);
        
        // 최종 징병량: 통솔 제한과 자원 제한 중 작은 값 (최소 100명은 징병)
        const recruitAmount = Math.max(100, Math.min(maxRecruitByLeadership, maxRecruitByResources));
        
        commands.push({
          command: '징병',
          args: { crewType: this.selectBestCrewType(genData), amount: recruitAmount },
          weight,
          reason: `[${priority.toUpperCase()}] ${reason} (병사:${stats.crew}, 징병량:${recruitAmount}, 금:${stats.gold}, 양:${stats.rice})`
        });
      } else {
        console.log(`[SimpleAI] 징병 불가 - 자원 부족 (금:${stats.gold} < 200 또는 양:${stats.rice} < 200)`);
      }
    }

    // === 훈련 평가 (병사가 있어야만 가능) - 완화됨 ===
    const train = genData.train || 0;
    const atmos = genData.atmos || 0;
    const hasEnoughCrew = stats.crew >= 100; // 훈련 최소 병사 100명 (500->100)
    const canTrain = stats.strength >= 30; // 최소 무력 30 (50->30)
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
      console.log(`[SimpleAI] 훈련 불가 - 병사 부족 (${stats.crew} < 100)`);
    }

    // === 출병 평가 (병사/훈련도/사기 충분해야 함) ===
    const deployResult = await this.shouldDeploy(genData);
    if (deployResult.canDeploy) {
      const deployTarget = await this.selectDeployTarget(genData);
      // 대상 도시가 유효한 경우에만 출병 명령 추가
      if (deployTarget?.destCityID && deployTarget.destCityID > 0) {
        commands.push({
          command: '출병',
          args: deployTarget,
          weight: stats.strength * 2,
          reason: `출병 가능 (병사:${stats.crew}, 훈련:${train}, 사기:${atmos}, 대상:${deployTarget.destCityID})`
        });
      } else {
        console.log(`[SimpleAI] 출병 불가 - 유효한 대상 도시 없음`);
      }
    } else if (deployResult.reason) {
      // 출병 불가 사유 로그
      console.log(`[SimpleAI] 출병 불가 - ${deployResult.reason}`);
    }

    // === 정찰/첩보/선동을 위한 적 도시 탐색 ===
    let targetEnemyCity: { cityID: number; distance: number } | null = null;
    
    if (stats.intel >= 60) {
      try {
        const sessionId = genData.session_id || 'sangokushi_default';
        const currentCityID = genData.city || this.city?.city || this.city?.data?.city;
        
        if (currentCityID) {
          const nearbyDistances = await searchDistanceAsync(sessionId, currentCityID, 3, false);
          const nearbyIDs = Object.keys(nearbyDistances).map(Number);
          
          if (nearbyIDs.length > 0) {
            const cities = await cityRepository.findByCityNums(sessionId, nearbyIDs);
            
            for (const cityID of nearbyIDs) {
              const city = cities.get(cityID);
              if (!city) continue;
              
              const cityNation = city.nation ?? city.data?.nation ?? 0;
              if (cityNation !== 0 && cityNation !== nationID) {
                // 적 도시 발견
                targetEnemyCity = { cityID, distance: nearbyDistances[cityID] };
                break; // 가장 가까운 적 도시 선택
              }
            }
          }
        }
      } catch (error) {
        console.warn('[SimpleAI] 정찰/첩보/선동 대상 탐색 실패:', error);
      }
    }

    // === 정찰 평가 (지력이 높은 장수) ===
    if (stats.intel >= 60 && stats.crew >= 100 && targetEnemyCity) {
      // 전선 도시에 있을 때 정찰 확률 증가
      const cityData = this.city?.data || this.city;
      const isFrontline = cityData?.front === 1 || cityData?.supply === 0;
      
      if (isFrontline || this.rng.nextBool(0.2)) {
        commands.push({
          command: '정찰',
          args: { destCityID: targetEnemyCity.cityID },
          weight: stats.intel / 5,
          reason: `적 정보 수집 (지력:${stats.intel}, 대상:도시${targetEnemyCity.cityID})`
        });
      }
    }

    // === 첩보 평가 (지력이 매우 높은 장수) ===
    if (stats.intel >= 75 && stats.gold >= 500 && targetEnemyCity) {
      // 20% 확률로 첩보 활동
      if (this.rng.nextBool(0.2)) {
        commands.push({
          command: '첩보',
          args: { destCityID: targetEnemyCity.cityID },
          weight: stats.intel / 4,
          reason: `첩보 활동 (지력:${stats.intel}, 대상:도시${targetEnemyCity.cityID})`
        });
      }
    }

    // === 선동 평가 (적 도시 민심 떨어뜨리기) ===
    if (stats.intel >= 70 && stats.gold >= 300 && targetEnemyCity) {
      // 15% 확률로 선동 시도
      if (this.rng.nextBool(0.15)) {
        commands.push({
          command: '선동',
          args: { destCityID: targetEnemyCity.cityID },
          weight: stats.intel / 5,
          reason: `적 민심 교란 (지력:${stats.intel}, 대상:도시${targetEnemyCity.cityID})`
        });
      }
    }

    return commands;
  }

  /**
   * 최적 병종 선택 - units.json 기반 병종 ID 사용
   * 
   * 병종 ID 체계:
   * - 1100~1116: 보병 (FOOTMAN)
   * - 1200~1207: 궁병 (ARCHER)
   * - 1300~1309: 기병 (CAVALRY)
   * - 1400~1403: 특수병/책사 (WIZARD)
   * - 1500~1503: 공성병기 (SIEGE)
   */
  private selectBestCrewType(genData: any): number {
    const strength = genData.strength || 50;
    const intel = genData.intel || 50;
    const leadership = genData.leadership || 50;
    const officerLevel = genData.officer_level || 0;
    
    // 국가 정보
    const nationData = this.nation?.data || this.nation || {};
    const nationTech = nationData.tech || 0;
    const nationTypeId = nationData.nation_type || nationData.country_type || 'neutral';
    
    // 병종 우선순위 리스트 (높은 순위부터)
    // 각 병종의 조건: { id, reqTech, reqStrength, reqIntel, reqLeadership, reqOfficerLevel, reqNationType }
    const crewTypePriority = [
      // === 최상위 정예 병종 (국가 타입 + 능력치 요구) ===
      { id: 1314, reqTech: 3000, reqLeadership: 85, reqNationType: ['militarism'] },  // 옥룡대
      { id: 1123, reqTech: 2000, reqStrength: 80, reqNationType: ['militarism'] },    // 황룡대
      { id: 1122, reqTech: 2000, reqStrength: 75, reqNationType: ['militarism'] },    // 진주룡대
      { id: 1121, reqTech: 2500, reqStrength: 85, reqNationType: ['militarism'] },    // 참마도수
      // 함진영은 도시 제한(복양, 하비)이 있어 AI가 직접 선택하기 어려움 - 일반 병종 우선순위에서 제외
      
      // === 황실/유가 병종 ===
      { id: 1120, reqTech: 3000, reqOfficerLevel: 8, reqNationType: ['confucianism', 'legalism'] }, // 금군
      { id: 1313, reqTech: 3000, reqOfficerLevel: 9, reqNationType: ['confucianism', 'legalism'] }, // 제국창기병
      { id: 1118, reqTech: 2000, reqLeadership: 80, reqNationType: ['confucianism', 'virtue'] },    // 백이병
      
      // === 법가/병가 병종 ===
      { id: 1304, reqTech: 3000, reqLeadership: 90, reqNationType: ['legalism', 'militarism'] },    // 호표기
      
      // === 태평도 병종 ===
      { id: 1114, reqTech: 1000, reqNationType: ['taiping'] },  // 황건역사
      { id: 1113, reqTech: 0, reqNationType: ['taiping'] },     // 황건신도
      { id: 1417, reqTech: 0, reqNationType: ['taiping'] },     // 여남황건
      { id: 1419, reqTech: 500, reqIntel: 60, reqNationType: ['taiping', 'taoism_religious'] }, // 암송대
      
      // === 도적 병종 ===
      { id: 1418, reqTech: 1500, reqStrength: 80, reqNationType: ['bandits'] },  // 광전사
      { id: 1124, reqTech: 0, reqNationType: ['bandits'] },                       // 흑산적
      
      // === 고급 일반 병종 (기술 + 능력치 요구) ===
      { id: 1301, reqTech: 1000, reqLeadership: 65 },  // 중기병
      { id: 1302, reqTech: 500, reqStrength: 60 },     // 창기병
      { id: 1303, reqTech: 1000, reqStrength: 55 },    // 궁기병
      { id: 1317, reqTech: 1000, reqStrength: 65 },    // 쌍검기병
      { id: 1318, reqTech: 2000, reqLeadership: 70 },  // 전차병
      
      { id: 1204, reqTech: 2000, reqLeadership: 70 },  // 강노병
      { id: 1205, reqTech: 2500, reqStrength: 80 },    // 흑룡대
      { id: 1214, reqTech: 2000, reqStrength: 75 },    // 저격수
      
      { id: 1107, reqTech: 500, reqStrength: 70 },     // 양손도끼병
      { id: 1109, reqTech: 500, reqStrength: 65 },     // 쌍검병
      { id: 1110, reqTech: 700, reqStrength: 60 },     // 철퇴병
      { id: 1106, reqTech: 800, reqLeadership: 70 },   // 대방패병
      { id: 1105, reqTech: 400, reqLeadership: 60 },   // 방패보병
      
      // === 중급 병종 (기술만 요구) ===
      { id: 1300, reqTech: 300 },   // 경기병
      { id: 1202, reqTech: 500, reqIntel: 50 },    // 노병
      { id: 1201, reqTech: 300 },   // 장궁병
      { id: 1208, reqTech: 300, reqStrength: 55 }, // 투창병
      { id: 1213, reqTech: 500, reqIntel: 45 },    // 기름단지병
      
      { id: 1108, reqTech: 600 },   // 장창병
      { id: 1104, reqTech: 300 },   // 정규극병
      { id: 1112, reqTech: 300 },   // 둔전병
      { id: 1102, reqTech: 200 },   // 정규보병
      { id: 1103, reqTech: 200 },   // 정규창병
      
      // === 기본 병종 (조건 없음) ===
      { id: 1319, reqTech: 0 },     // 정찰기병
      { id: 1200, reqTech: 0 },     // 단궁병
      { id: 1210, reqTech: 0 },     // 투석병
      { id: 1101, reqTech: 0 },     // 창민병
      { id: 1100, reqTech: 0 },     // 도민병 (최하위 기본)
    ];
    
    // 조건을 만족하는 최고 우선순위 병종 선택
    for (const crewType of crewTypePriority) {
      // 기술 체크
      if (crewType.reqTech && nationTech < crewType.reqTech) continue;
      
      // 무력 체크
      if (crewType.reqStrength && strength < crewType.reqStrength) continue;
      
      // 지력 체크
      if (crewType.reqIntel && intel < crewType.reqIntel) continue;
      
      // 통솔력 체크
      if (crewType.reqLeadership && leadership < crewType.reqLeadership) continue;
      
      // 관직 레벨 체크
      if (crewType.reqOfficerLevel && officerLevel < crewType.reqOfficerLevel) continue;
      
      // 국가 타입 체크
      if (crewType.reqNationType && crewType.reqNationType.length > 0) {
        if (!crewType.reqNationType.includes(nationTypeId)) continue;
      }
      
      // 모든 조건 만족!
      return crewType.id;
    }
    
    // 기본값: 도민병
    return 1100;
  }

  /**
   * 출병 가능 여부
   */
  private async shouldDeploy(genData: any): Promise<{ canDeploy: boolean; reason?: string }> {
    const crew = genData.crew || 0;
    const train = genData.train || 0;
    const atmos = genData.atmos || 0;
    const leadership = genData.leadership || 50;

    // === 병사 체크 - 대폭 완화 ===
    if (crew <= 0) {
      return { canDeploy: false, reason: '병사 없음' };
    }

    // 최소 병사 수: (통솔-20) * 10, 최소 200, 최대 500 (대폭 완화)
    // 게임 초반에도 출병 가능하도록 설정
    const minCrew = Math.max(200, Math.min((leadership - 20) * 10, 500));
    if (crew < minCrew) {
      return { canDeploy: false, reason: `병사 부족 (${crew} < ${minCrew})` };
    }

    // === 훈련도 체크 - 완화됨 ===
    const minTrain = 40; // 70 -> 40
    if (train < minTrain) {
      return { canDeploy: false, reason: `훈련도 부족 (${train} < ${minTrain})` };
    }

    // === 사기 체크 - 완화됨 ===
    const minAtmos = 40; // 70 -> 40
    if (atmos < minAtmos) {
      return { canDeploy: false, reason: `사기 부족 (${atmos} < ${minAtmos})` };
    }

    // === 전쟁 상태 확인 - 완화: 전쟁 중 아니어도 출병 가능 ===
    // const nationData = this.nation?.data || this.nation;
    // if (!nationData || !nationData.war) {
    //   return { canDeploy: false, reason: '전쟁 중 아님' };
    // }

    // === 전방 도시 확인 (인접 적 도시 있는지) ===
    // FUTURE: 실제 도시 연결 정보로 확인
    // 현재는 간단히 가능 처리
    return { canDeploy: true };
  }

  /**
   * 출병 대상 선택
   * 인접 도시 중 적 도시를 찾아 반환
   */
  private async selectDeployTarget(genData: any): Promise<any> {
    const sessionId = genData.session_id || 'sangokushi_default';
    const currentCityID = genData.city || this.city?.city || this.city?.data?.city;
    const myNationID = genData.nation || 0;

    if (!currentCityID) {
      console.warn('[SimpleAI] selectDeployTarget: 현재 도시 ID를 알 수 없습니다.');
      return { destCityID: 0 };
    }

    try {
      // CityConst에서 직접 인접 도시 정보 가져오기 (거리 1)
      const cityConstEntry = CityConst.byID(currentCityID);
      const directNeighbors = cityConstEntry?.neighbors || [];
      
      // 거리 3까지 확장 (BFS)
      const nearbyDistances: Record<number, number> = {};
      const visited = new Set<number>();
      const queue: Array<{ cityID: number; distance: number }> = [];
      
      queue.push({ cityID: currentCityID, distance: 0 });
      visited.add(currentCityID);
      
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current.distance >= 3) continue;
        
        const cityEntry = CityConst.byID(current.cityID);
        const neighbors = cityEntry?.neighbors || [];
        
        for (const neighborID of neighbors) {
          if (visited.has(neighborID)) continue;
          visited.add(neighborID);
          const nextDistance = current.distance + 1;
          nearbyDistances[neighborID] = nextDistance;
          queue.push({ cityID: neighborID, distance: nextDistance });
        }
      }
      
      const nearbyIDs = Object.keys(nearbyDistances)
        .map(Number)
        .sort((a, b) => nearbyDistances[a] - nearbyDistances[b]); // 가까운 순서대로
      
      if (nearbyIDs.length === 0) {
        console.warn(`[SimpleAI] selectDeployTarget: 인접 도시가 없습니다. cityID=${currentCityID}, directNeighbors=${directNeighbors.length}`);
        return { destCityID: 0 };
      }

      // 인접 도시들 중 적 도시 찾기
      const cities = await cityRepository.findByCityNums(sessionId, nearbyIDs);
      
      const enemyCities: Array<{ cityID: number; distance: number; nation: number }> = [];
      const neutralCities: Array<{ cityID: number; distance: number }> = [];
      
      for (const cityID of nearbyIDs) {
        const city = cities.get(cityID);
        if (!city) continue;
        
        const cityNation = city.nation ?? city.data?.nation ?? 0;
        const distance = nearbyDistances[cityID];
        
        if (cityNation !== 0 && cityNation !== myNationID) {
          // 적 도시
          enemyCities.push({ cityID, distance, nation: cityNation });
        } else if (cityNation === 0) {
          // 공백지
          neutralCities.push({ cityID, distance });
        }
      }

      // 적 도시가 있으면 가장 가까운 적 도시 선택
      if (enemyCities.length > 0) {
        // 가장 가까운 적 도시 (이미 거리순 정렬됨)
        const target = enemyCities[0];
        console.log(`[SimpleAI] 출병 대상: 도시 ${target.cityID} (적국 ${target.nation}, 거리: ${target.distance})`);
        return { destCityID: target.cityID };
      }

      // 적 도시가 없으면 공백지 선택
      if (neutralCities.length > 0) {
        const target = neutralCities[0];
        console.log(`[SimpleAI] 출병 대상: 도시 ${target.cityID} (공백지, 거리: ${target.distance})`);
        return { destCityID: target.cityID };
      }

      // 적도 공백지도 없으면 출병 불가
      console.log('[SimpleAI] selectDeployTarget: 출병 가능한 대상 도시가 없습니다.');
      return { destCityID: 0 };
      
    } catch (error) {
      console.error('[SimpleAI] selectDeployTarget 오류:', error);
      return { destCityID: 0 };
    }
  }

  /**
   * 인접 도시 중 랜덤 선택 (방랑용)
   * DB의 neighbors 필드 또는 searchDistance를 사용하여 유효한 인접 도시 반환
   */
  private async selectRandomNeighborCityAsync(): Promise<number> {
    const genData = this.general.data || this.general;
    const sessionId = genData.session_id || 'sangokushi_default';
    const cityData = this.city?.data || this.city || {};
    const currentCityID = cityData.city || 1;
    
    // 먼저 DB의 neighbors 필드 확인
    const neighbors = cityData.neighbors || this.city?.neighbors || [];
    
    if (neighbors.length > 0) {
      // 유효한 숫자 ID만 필터링
      const validNeighbors = neighbors
        .map((n: any) => typeof n === 'number' ? n : parseInt(String(n), 10))
        .filter((n: number) => !isNaN(n) && n > 0);
      
      if (validNeighbors.length > 0) {
        const selected = this.rng.choice(validNeighbors) as number;
        console.log(`[SimpleAI] 인접 도시 선택 (neighbors): ${selected}`);
        return selected;
      }
    }
    
    // neighbors가 없으면 searchDistance로 인접 도시 찾기
    try {
      const nearbyDistances = await searchDistanceAsync(sessionId, currentCityID, 1, false);
      const nearbyIDs = Object.keys(nearbyDistances).map(Number);
      
      if (nearbyIDs.length > 0) {
        const selected = this.rng.choice(nearbyIDs) as number;
        console.log(`[SimpleAI] 인접 도시 선택 (searchDistance): ${selected}`);
        return selected;
      }
    } catch (error) {
      console.warn('[SimpleAI] selectRandomNeighborCityAsync: searchDistance 실패', error);
    }
    
    // 그래도 없으면 현재 도시 반환 (이동 안 함)
    console.warn(`[SimpleAI] 인접 도시를 찾을 수 없습니다. 현재 도시 ${currentCityID} 유지`);
    return currentCityID;
  }

  /**
   * 인접 도시 중 랜덤 선택 (동기 버전 - 레거시 호환)
   */
  private selectRandomNeighborCity(): number {
    const cityData = this.city?.data || this.city || {};
    const currentCityID = cityData.city || 1;
    const neighbors = cityData.neighbors || this.city?.neighbors || [];
    
    if (neighbors.length === 0) {
      // 인접 도시 없으면 현재 도시 반환 (이동 안 함)
      console.warn(`[SimpleAI] 인접 도시가 없습니다. 현재 도시 ${currentCityID} 유지`);
      return currentCityID;
    }
    
    // 유효한 숫자 ID만 필터링
    const validNeighbors = neighbors
      .map((n: any) => typeof n === 'number' ? n : parseInt(String(n), 10))
      .filter((n: number) => !isNaN(n) && n > 0);
    
    if (validNeighbors.length === 0) {
      console.warn(`[SimpleAI] 유효한 인접 도시가 없습니다. 현재 도시 ${currentCityID} 유지`);
      return currentCityID;
    }
    
    // 인접 도시 중 랜덤 선택
    const selected = this.rng.choice(validNeighbors) as number;
    return selected;
  }

  /**
   * 자기계발 명령 평가
   */
  private evaluateSelfImprovementCommands(stats: GeneralStats): AICommandDecision[] {
    const commands: AICommandDecision[] = [];
    const genData = this.general.data || this.general;
    const nationID = genData.nation || 0;

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

    // === 재야 장수 활동 ===
    if (nationID === 0) {
      const experience = genData.experience || 0;
      
      // 견문 (경험치 부족 시)
      if (experience < 5000) {
        let weight = 5;
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
      
      // 이동 (다른 도시로 방랑) - 30% 확률
      if (this.rng.nextBool(0.3)) {
        commands.push({
          command: '이동',
          args: { destCityID: this.selectRandomNeighborCity() },
          weight: 8,
          reason: '방랑 이동'
        });
      }
      
      // 인재탐색 (지력 60 이상) - 20% 확률
      if (stats.intel >= 60 && this.rng.nextBool(0.2)) {
        commands.push({
          command: '인재탐색',
          args: {},
          weight: 6,
          reason: `인재 발굴 (지력:${stats.intel})`
        });
      }
      
      return commands; // 재야는 여기서 반환
    }

    // === 물자조달 평가 (자원 부족 시) ===
    if (nationID !== 0 && (stats.gold < 500 || stats.rice < 500)) {
      let weight = 20;
      
      // 자원이 매우 부족하면 가중치 증가
      if (stats.gold < 200 || stats.rice < 200) {
        weight = 40;
      }
      
      commands.push({
        command: '물자조달',
        args: {},
        weight,
        reason: `자원 부족 (금:${stats.gold}, 양:${stats.rice})`
      });
    }

    // === 인재탐색 평가 (고위 장수가 가끔) ===
    if (nationID !== 0 && stats.officerLevel >= 5 && stats.intel >= 60) {
      // 30% 확률로 인재탐색 시도
      if (this.rng.nextBool(0.3)) {
        commands.push({
          command: '인재탐색',
          args: {},
          weight: 8,
          reason: `인재 발굴 (지력:${stats.intel})`
        });
      }
    }

    // === 요양 평가 (부상 시) ===
    const injury = genData.injury || 0;
    if (injury > 0) {
      let weight = 30;
      
      // 부상이 심하면 가중치 증가
      if (injury >= 50) {
        weight = 80;
      } else if (injury >= 20) {
        weight = 50;
      }
      
      commands.push({
        command: '요양',
        args: {},
        weight,
        reason: `부상 치료 (부상:${injury})`
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
    
    let random = this.rng.next() * totalWeight;

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
  
  // ================================================================
  // === dipState 기반 액션 선택 (PHP chooseGeneralTurn 포팅) ===
  // ================================================================
  
  /**
   * dipState 기반 액션 선택 (PHP chooseGeneralTurn 완전 포팅)
   * 
   * dipState 레벨:
   * - d평화 (0): 평화 시 - 내정 개발, 거래, 느린 징병
   * - d선포 (1): 선포 시 - 긴급 징병, 기본 훈련
   * - d징병 (2): 징병 시 - 최대 징병, 훈련 우선
   * - d직전 (3): 직전 시 - 전투 준비, 전방 배치
   * - d전쟁 (4): 전쟁 시 - 공격, 방어, 후퇴 로직
   */
  async decideCommandByDipState(): Promise<AICommandDecision | null> {
    const genData = this.general.data || this.general;
    
    // 환경 설정 구성
    const envConfig: EnvConfig = {
      month: this.env.month || 1,
      year: this.env.year || 200,
      startyear: this.env.startyear || this.env.init_year || 184,
      develcost: this.env.develcost || 24,
      baserice: GameConst.baserice || 50000,
    };
    
    // 정책 설정 구성
    const policyConfig: PolicyConfig = {
      minWarCrew: this.nationPolicy?.minWarCrew || 3000,
      properWarTrainAtmos: this.nationPolicy?.properWarTrainAtmos || 80,
      minNPCRecruitCityPopulation: this.nationPolicy?.minNPCRecruitCityPopulation || 5000,
      safeRecruitCityPopulationRatio: this.nationPolicy?.safeRecruitCityPopulationRatio || 0.6,
      minNPCWarLeadership: this.nationPolicy?.minNPCWarLeadership || 60,
      minimumResourceActionAmount: this.nationPolicy?.minimumResourceActionAmount || 100,
      cureThreshold: this.nationPolicy?.cureThreshold || 10,
    };
    
    // 외교 상태 업데이트 (최신 정보로)
    this.initializeDipState();
    
    // DipStateActionSelector 생성
    this.dipStateSelector = new DipStateActionSelector(
      this.general,
      this.city,
      this.nation,
      envConfig,
      policyConfig,
      this.dipState
    );
    
    // 우선순위 목록 가져오기
    const priority = this.generalPolicy?.priority || DEFAULT_GENERAL_PRIORITY;
    
    // 액션 선택
    const result = this.dipStateSelector.selectAction(priority);
    
    if (result) {
      console.log(`[SimpleAI] dipState(${DipState[this.dipState]}) 기반 선택: ${result.command} - ${result.reason}`);
    } else {
      console.log(`[SimpleAI] dipState(${DipState[this.dipState]}) 기반 선택: 휴식`);
    }
    
    return result;
  }
  
  /**
   * dipState별 평화 시 액션 선택
   * (do일반내정 직접 호출)
   */
  pickGeneralActionPeace(): AICommandDecision | null {
    if (!this.dipStateSelector) {
      this.decideCommandByDipState(); // 초기화
    }
    return this.dipStateSelector?.pickGeneralActionPeace() || null;
  }
  
  /**
   * dipState별 선포/징병 시 액션 선택
   * (do긴급내정 + do징병 직접 호출)
   */
  pickGeneralActionPreWar(): AICommandDecision | null {
    if (!this.dipStateSelector) {
      this.decideCommandByDipState(); // 초기화
    }
    
    // 긴급 내정 시도
    const emergencyAction = this.dipStateSelector?.pickGeneralActionDeclared();
    if (emergencyAction) return emergencyAction;
    
    // 징병 시도
    const recruitAction = this.dipStateSelector?.pickGeneralActionRecruit();
    if (recruitAction) return recruitAction;
    
    // 전투 준비 시도
    return this.dipStateSelector?.pickGeneralActionPreWar() || null;
  }
  
  /**
   * dipState별 전쟁 시 액션 선택
   * (do출병 + do전쟁내정 직접 호출)
   */
  pickGeneralActionWar(): AICommandDecision | null {
    if (!this.dipStateSelector) {
      this.decideCommandByDipState(); // 초기화
    }
    
    // 출병 시도
    const attackAction = this.dipStateSelector?.pickGeneralActionWar();
    if (attackAction) return attackAction;
    
    // 전쟁 내정 시도
    return this.dipStateSelector?.pickGeneralActionWarDomestic() || null;
  }

  /**
   * 국가 명령만 결정 (국가턴 전용)
   * 
   * 장수 명령(내정, 군사 등)을 제외하고 국가 명령만 평가합니다.
   */
  async decideNationCommandOnly(): Promise<AICommandDecision | null> {
    const genData = this.general.data || this.general;
    const stats = this.extractGeneralStats(genData);
    const genType = this.calculateGeneralType(stats);

    // 군주/수뇌가 아니면 국가 명령 불가
    if (stats.officerLevel < 5) {
      console.log(`[SimpleAI] 국가 명령 결정 불가 - 수뇌 이상만 가능 (officerLevel: ${stats.officerLevel})`);
      return null;
    }

    // 국가 명령만 평가
    const nationCommandCandidates = await this.evaluateNationCommands(stats, genType);
    console.log(`[SimpleAI] 국가 명령 후보: ${nationCommandCandidates.length}개`);

    if (nationCommandCandidates.length === 0) {
      // 기본적으로 휴식 반환 (국가 명령이 없으면)
      console.log('[SimpleAI] 국가 명령 후보 없음 - 휴식 반환');
      return {
        command: '휴식',
        args: {},
        weight: 1,
        reason: '국가 명령 후보 없음'
      };
    }

    // Policy 필터링
    let filteredCandidates = nationCommandCandidates;
    if (this.nationPolicy) {
      filteredCandidates = this.applyPolicyFilter(nationCommandCandidates);
      console.log(`[SimpleAI] 국가 Policy 필터 적용: ${nationCommandCandidates.length} -> ${filteredCandidates.length} 명령`);
    }

    if (filteredCandidates.length === 0) {
      return {
        command: '휴식',
        args: {},
        weight: 1,
        reason: '국가 Policy 필터 후 후보 없음'
      };
    }

    // 가중치 기반 선택
    const selected = this.selectCommandByWeight(filteredCandidates);
    if (selected) {
      console.log(`[SimpleAI] 국가 명령 선택: ${selected.command} (가중치: ${selected.weight?.toFixed(2)}, 이유: ${selected.reason})`);
    }
    return selected;
  }
}

// ================================================================
// === Export: DipState 관련 타입 및 상수 ===
// ================================================================

export { DipState, GenType, calculateDipState } from './DipStateActionSelector';
export type { PolicyConfig, EnvConfig, DevelRate } from './DipStateActionSelector';
