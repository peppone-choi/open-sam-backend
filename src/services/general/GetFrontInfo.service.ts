// @ts-nocheck
import { General } from '../../models/general.model';
import { generalRepository } from '../../repositories/general.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { cityRepository } from '../../repositories/city.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { generalRecordRepository } from '../../repositories/general-record.repository';
import { worldHistoryRepository } from '../../repositories/world-history.repository';
import * as fs from 'fs';
import * as path from 'path';
import { generalTurnRepository } from '../../repositories/general-turn.repository';
import { getNationTypeInfo as getNationTypeInfoFromFactory } from '../../core/nation-type/NationTypeFactory';
import { cityDefenseRepository } from '../../repositories/city-defense.repository';
import { kvStorageRepository } from '../../repositories/kvstorage.repository';
import { getSocketManager } from '../../socket/socketManager';
import { GameUnitConst } from '../../const/GameUnitConst';
import { troopRepository } from '../../repositories/troop.repository';
import { getOfficerTitle } from '../../utils/rank-system';

// Constants 로드
let cachedConstants: any = null;
function loadConstants() {
  if (!cachedConstants) {
    try {
      // dist 폴더에서 실행되므로 프로젝트 루트로 이동
      const constantsPath = path.resolve(__dirname, '../../../config/scenarios/sangokushi/data/constants.json');
      cachedConstants = JSON.parse(fs.readFileSync(constantsPath, 'utf-8'));
      console.log('[GetFrontInfo] Constants loaded successfully from:', constantsPath);
    } catch (error) {
      console.error('[GetFrontInfo] Failed to load constants.json:', error);
      // 폴백: 기본값 반환
      cachedConstants = {
        regions: {},
        levelMap: {},
        officerTitles: {},
        nationLevels: {}
      };
    }
  }
  return cachedConstants;
}

// 스택 시스템 제거됨
type LeanUnitStack = any;

/**
 * 전선 정보 - 전역 게임 환경 정보
 *
 * 단위 규칙:
 * - year/month: 시나리오 상 연/월 (in‑game 달력)
 * - startyear: 시나리오 시작 연도
 * - turnterm: 한 턴 길이 (분 단위)
 * - lastExecuted: 마지막 턴 처리 시각 (서버 시각, 'YYYY-MM-DD HH:MM:SS')
 */
interface GlobalFrontInfo {
  serverName: string | null;
  scenarioText: string;
  extendedGeneral: 0 | 1;
  isFiction: 0 | 1;
  npcMode: 0 | 1 | 2;
  joinMode: 'onlyRandom' | 'full';
  startyear: number;
  year: number;
  month: number;
  autorunUser: {
    /** 자동 턴 처리 제한 시간 (분) */
    limit_minutes: number;
    options: Record<string, any>;
  };
  /** 한 턴 길이 (분 단위) */
  turnterm: number;
  /** 마지막 턴 처리 시각 (서버 시각 문자열) */
  lastExecuted: string;
  lastVoteID: number | null;
  develCost: number;
  noticeMsg: number;
  onlineNations: string | null;
  onlineUserCnt: number | null;
  apiLimit: number;
  auctionCount: number;
  isTournamentActive: boolean;
  isTournamentApplicationOpen: boolean;
  isBettingActive: boolean;
  isLocked: boolean;
  /** 세션 상태: preparing, running, paused, finished, united */
  sessionStatus: 'preparing' | 'running' | 'paused' | 'finished' | 'united';
  tournamentType: any;
  tournamentState: number;
  tournamentTime: any;
  /** [npc플래그, 장수 수] 배열 */
  genCount: Array<[number, number]>;
  generalCntLimit: number;
  serverCnt: number;
  lastVote: any;
}

/**
 * 전선 정보 - 국가 요약 정보
 *
 * 단위 규칙:
 * - population.now / max: 총 인구 수
 * - crew.now / max: 장수 병력 합 / 최대 병력 (통솔×100)
 * - gold / rice / tech: 국가 자원 수치 (정수)
 * - taxRate: 세율 (%)
 */
interface NationFrontInfo {
  id: number;
  full: boolean;
  name: string;
  population: {
    /** 보유 도시 수 */
    cityCnt: number;
    /** 총 인구 (현재값) */
    now: number;
    /** 총 인구 (최대값) */
    max: number;
  };
  crew: {
    /** 장수 수 (npc 5 제외) */
    generalCnt: number;
    /** 장수 병력 합 */
    now: number;
    /** 통솔 기반 최대 병력 합 */
    max: number;
  };
  type: {
    raw: string;
    name: string;
    pros: string;
    cons: string;
  };
  /** 국가 대표 색상 (hex, '#RRGGBB') */
  color: string;
  /** 국가 레벨 (constants.nationLevels 기준) */
  level: number;
  /** 수도 도시 ID (city_id) */
  capital: number;
  gold: number;
  rice: number;
  tech: number;
  /** 국가 소속 장수 수 (캐시 필드) */
  gennum: number;
  power: Record<string, any>;
  /** 지급률/비용 정책 문자열 */
  bill: string;
  /** 세율 (%) */
  taxRate: number;
  /** 온라인 장수 목록 (쉼표 구분 문자열) */
  onlineGen: string;
  /** 최신 국가 공지 */
  notice: any;
  /** 군주/부군주 등 상위 관직자 맵 */
  topChiefs: Record<number, any>;
  /** 외교 제한 턴 수 */
  diplomaticLimit: number;
  /** 전략 커맨드 사용 제한 */
  strategicCmdLimit: Record<string, any>;
  /** 사용 불가 전략 커맨드 목록 (프론트 표시용) */
  impossibleStrategicCommand: string[];
  /** 정찰 금지 여부 플래그 */
  prohibitScout: number;
  /** 전쟁 금지 여부 플래그 */
  prohibitWar: number;
}

/**
 * 전선 정보 - 장수 요약 정보
 *
 * 주요 단위:
 * - gold / rice: 개인 보유 금/군량
 * - crew: 장수 병력 (없으면 unitStacks.totalTroops 사용)
 * - train / atmos: 0~100 범위 훈련/사기
 * - unitStacks.totalTroops: 부대 병력 합계
 */
interface GeneralFrontInfo {
  no: number;
  name: string;
  nation: number;
  npc: number;
  injury: number;
  leadership: number;
  strength: number;
  intel: number;
  politics: number;
  charm: number;
  explevel: number;
  dedlevel: number;
  gold: number;
  rice: number;
  /** 장수 병력 (명 단위) */
  crew: number;
  /** 부대 스택 정보 (없으면 null) */
  unitStacks: {
    totalTroops: number;
    stackCount: number;
    averageTrain: number;
    averageMorale: number;
    stacks: Array<{
      id: string;
      crewTypeId: number;
      crewTypeName?: string;
      unitSize: number;
      stackCount: number;
      troops: number;
      train: number;
      morale: number;
      updatedAt?: Date | string;
    }>;
  } | null;
  /** 훈련 (0~100) */
  train: number;
  /** 사기 (0~100) */
  atmos: number;
  /** 다음 개인 턴 예정 시각 */
  turntime: Date | string;
  /** 소속 도시 ID */
  city: number;
  /** 소속 부대 ID (0이면 미배치) */
  troop: number;
  /** 관직 레벨 (0=재야, 1=일반, 12=군주) */
  officerLevel: number;
  /** 관직 이름 (군주/태사/태수 등) */
  officerLevelText: string;
  /** 예약된 일반턴 명령 목록 */
  reservedCommand: any[] | null;
  /** 수동/자동턴 제한 (분 단위) */
  autorun_limit: number;
  /** 장수별 권한 비트 플래그 (0=일반, 4=수뇌부 등) */
  permission: number;
  [key: string]: any;
}

/**
 * 전선 정보 - 도시 요약 정보
 *
 * 단위 규칙:
 * - pop/agri/comm/secu/def/wall: [현재값, 최대값]
 * - trust: 민심 (0~100)
 * - garrison.totalTroops: 주둔 병력 합계
 */
interface CityFrontInfo {
  id: number;
  name: string;
  /** 지역 ID (constants.regions 키) */
  region: number;
  nationInfo: {
    id: number;
    name: string;
    /** 국가 색상 (hex, '#RRGGBB') */
    color: string;
  };
  /** 도시 레벨 (constants.levelMap / cityLevels 기준) */
  level: number;
  /** 민심 (0~100) */
  trust: number;
  /** [현재인구, 최대인구] */
  pop: [number, number];
  /** [현재농업, 최대농업] */
  agri: [number, number];
  /** [현재상업, 최대상업] */
  comm: [number, number];
  /** [현재치안, 최대치안] */
  secu: [number, number];
  /** [현재수비, 최대수비] */
  def: [number, number];
  /** [현재성벽HP, 최대성벽HP] */
  wall: [number, number];
  /** 시세(%) 또는 null */
  trade: number | null;
  officerList: Record<2 | 3 | 4, {
    officer_level: 2 | 3 | 4;
    no?: number;
    name: string;
    npc: number;
  } | null>;
  defense?: {
    wall: [number, number];
    gate: [number, number];
    towerLevel?: number;
    repairRate?: number;
    lastDamageAt?: Date | string;
    lastRepairAt?: Date | string;
  } | null;
  garrison?: {
    totalTroops: number;
    stackCount: number;
    stacks: Array<{
      id: string;
      crewTypeId: number;
      crewTypeName?: string;
      troops: number;
      train: number;
      morale: number;
      updatedAt?: Date | string;
    }>;
  };
}

function resolveCrewTypeName(crewTypeId?: number | null, rawName?: string | null): string | undefined {

  const normalizedId = typeof crewTypeId === 'number' && Number.isFinite(crewTypeId) ? crewTypeId : undefined;
  const trimmedName = rawName?.trim();
  const isGenericName = !trimmedName || /^병종(\s*\d+)?$/u.test(trimmedName);

  if (!isGenericName && trimmedName) {
    return trimmedName;
  }

  if (normalizedId !== undefined && normalizedId >= 0) {
    try {
      const unit = GameUnitConst.byID(normalizedId);
      if (unit?.name) {
        return unit.name;
      }
    } catch (error) {
      // ignore and fall back below
    }
  }

  if (trimmedName) {
    return trimmedName;
  }

  return normalizedId !== undefined ? `병종 ${normalizedId}` : undefined;
}

/**
 * GetFrontInfo Service  
 * 메인 페이지의 모든 정보를 한 번에 반환
 */
export class GetFrontInfoService {
  private static resolveFallbackCrewTypeId(generalDoc: any): number | undefined {
    const candidates = [
      generalDoc?.crewtype,
      generalDoc?.data?.crewtype,
      generalDoc?.result_turn?.arg?.crewType,
      generalDoc?.data?.result_turn?.arg?.crewType,
    ];

    for (const value of candidates) {
      const normalized = Number(value);
      if (Number.isFinite(normalized) && normalized > 0) {
        return normalized;
      }
    }
    return undefined;
  }

  static readonly ROW_LIMIT = 15; // PHP와 동일

  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || user?.id || data.user_id;
    let generalId = user?.generalId || data.general_id;
    
    console.log('[GetFrontInfo] 시작', {
      sessionId,
      userId,
      generalId,
      user,
      data: { session_id: data.session_id, user_id: data.user_id, general_id: data.general_id }
    });
    
    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session) {
      return {
        success: false,
        message: '세션을 찾을 수 없습니다'
      };
    }

    const sessionStatus = session.status || session.data?.status;
    if (sessionStatus && ['finished', 'united'].includes(sessionStatus)) {
      return {
        success: false,
        message: '이미 종료된 세션입니다'
      };
    }
    
    const lastNationNoticeDate = data.lastNationNoticeDate || '2022-08-19 00:00:00';
    const lastGeneralRecordID = parseInt(data.lastGeneralRecordID) || 0; // 장수동향 (action)
    const lastPersonalHistoryID = parseInt(data.lastPersonalHistoryID) || 0; // 개인기록 (history)
    const lastGlobalHistoryID = parseInt(data.lastGlobalHistoryID) || 0; // 중원정세 (history, general_id=0)
    const lastWorldHistoryID = parseInt(data.lastWorldHistoryID) || 0; // 구식 (미사용)

    try {
      // 1. 장수 정보 조회 (generalId가 없으면 userId로 찾기)
      let general;
      
      if (generalId) {
        // generalId로 직접 조회
        console.log('[GetFrontInfo] generalId로 조회', { sessionId, generalId });
        general = await generalRepository.findBySessionAndNo(sessionId, generalId);
      } else if (userId) {
        // userId로 owner 필드를 통해 조회
        // npc < 2 필터를 제거: npc=2인 빙의된 NPC도 owner 필드로 찾을 수 있어야 함
        console.log('[GetFrontInfo] userId로 조회', { sessionId, userId: String(userId) });
        general = await generalRepository.findBySessionAndOwner(
          sessionId,
          String(userId)
        );
        
        console.log('[GetFrontInfo] userId 조회 결과', { found: !!general, generalNo: general?.no });
        
        if (general) {
          generalId = general.no;
        }
      }

      if (!general) {
        console.log('[GetFrontInfo] 장수 없음', { generalId, userId });
        return {
          success: false,
          message: generalId ? '장수를 찾을 수 없습니다' : '장수가 없습니다. 먼저 장수를 생성해주세요.'
        };
      }
      
      console.log('[GetFrontInfo] 장수 찾음', { generalId, generalNo: general.no, generalName: general.name || general.data?.name });

      if (!generalId) {
        generalId = general.no;
      }

      const nationId = general.nation || general.data?.nation || 0;
      const cityId = general.city || general.data?.city;

      // 2. 전역 정보 생성
      const onlineGeneralMap = await this.buildOnlineGeneralMap(sessionId);
      const globalInfo = await this.generateGlobalInfo(sessionId, session);
 
       // 3. 국가 정보 생성
       const nationInfo = nationId !== 0
         ? await this.generateNationInfo(sessionId, nationId, lastNationNoticeDate, onlineGeneralMap)
         : await this.generateDummyNationInfo();


      // 4. 장수 정보 생성
      const generalInfo = await this.generateGeneralInfo(sessionId, general, nationId, nationInfo);
      
      // 권한 계산
      const permission = await this.calculatePermission(sessionId, general, nationId);
      generalInfo.permission = permission;

      // 5. 도시 정보 생성
      const cityInfo = cityId
        ? await this.generateCityInfo(sessionId, cityId, nationId)
        : null;

      // 6. 최근 기록 생성
      const recentRecord = await this.generateRecentRecord(
        sessionId,
        generalId,
        lastGeneralRecordID,
        lastPersonalHistoryID,
        lastGlobalHistoryID
      );

      // 7. 보조 정보
      const auxInfo: any = {};

      // 8. constants.json에서 상수 로드
      const constants = loadConstants();

      return {
        success: true,
        result: true,
        recentRecord,
        global: globalInfo,
        nation: nationInfo,
        general: generalInfo,
        city: cityInfo,
        aux: auxInfo,
        cityConstMap: {
          region: constants.regions || {},
          level: constants.levelMap || {},
          officerTitles: constants.officerTitles || {},
          nationLevels: constants.nationLevels || {}
        }
      };
    } catch (error: any) {
      console.error('[GetFrontInfo] execute error:', error);
      return {
        success: false,
        result: false,
        message: error?.message || '전선 정보를 불러오는 중 오류가 발생했습니다',
      };
    }
  }


  /**
   * 접속 중인 국가 목록 조회
   */
  private static async getOnlineNations(sessionId: string): Promise<string> {
    try {
      const { getSocketManager } = await import('../../socket/socketManager');
      const socketManager = getSocketManager();
      if (socketManager) {
        const nationIds = await socketManager.getOnlineNations(sessionId);
        return nationIds.length > 0 ? nationIds.join(',') : null;
      }
    } catch (error: any) {
      console.error('getOnlineNations error:', error);
    }
    
    // SocketManager를 사용할 수 없으면 세션 데이터에서 가져오기
    const session = await sessionRepository.findBySessionId(sessionId );
    const data = session?.data || {};
    return Array.isArray(data.online_nation) ? data.online_nation.join(',') : (data.online_nation || null);
  }

  /**
   * 접속 중인 사용자 수 조회
   */
  private static async getOnlineUserCount(sessionId: string): Promise<number | null> {
    try {
      const { getSocketManager } = await import('../../socket/socketManager');
      const socketManager = getSocketManager();
      if (socketManager) {
        return socketManager.getOnlineUserCount(sessionId);
      }
    } catch (error: any) {
      console.error('getOnlineUserCount error:', error);
    }
    
    // SocketManager를 사용할 수 없으면 세션 데이터에서 가져오기
    const session = await sessionRepository.findBySessionId(sessionId );
    const data = session?.data || {};
    return data.online_user_cnt || null;
  }

  private static async buildOnlineGeneralMap(sessionId: string): Promise<Map<number, string[]>> {
    const map = new Map<number, string[]>();
    try {
      const socketManager = getSocketManager();
      if (!socketManager || typeof socketManager.getOnlineGenerals !== 'function') {
        return map;
      }
      const onlineGenerals = await socketManager.getOnlineGenerals(sessionId);
      for (const info of onlineGenerals) {
        if (!info || !info.nationId || info.nationId <= 0) {
          continue;
        }
        const list = map.get(info.nationId) || [];
        list.push(info.name || `장수 ${info.generalId}`);
        map.set(info.nationId, list);
      }
    } catch (error: any) {
      console.error('[GetFrontInfo] buildOnlineGeneralMap error:', error);
    }
    return map;
  }
 
  /**
   * 전역 게임 정보 생성
   */

  private static async generateGlobalInfo(sessionId: string, sessionDoc?: any) {
    const session = sessionDoc ?? await sessionRepository.findBySessionId(sessionId );
    if (!session) {
      throw new Error('세션을 찾을 수 없습니다');
    }
 
    const data = session.data || {};

    const gameEnv = data.game_env || {};
    
    // 장수 통계
    const genCount = await General.aggregate([
      { $match: { session_id: sessionId } },
      { $group: { _id: '$data.npc', count: { $sum: 1 } } }
    ]);

    const turntime = (gameEnv.turntime || data.turntime) ? new Date(gameEnv.turntime || data.turntime) : new Date();
    const lastExecutedStr = turntime instanceof Date 
      ? turntime.toISOString().slice(0, 19).replace('T', ' ')
      : String(turntime);
    
    // 세션 상태 확인: preparing 상태일 때는 년월 계산/업데이트 안 함
    const currentSessionStatus = session.status || 'running';
    let turnInfo: { year: number; month: number; turn: number };
    
    if (currentSessionStatus === 'running') {
      // running 상태에서만 년월 계산
      // turnDate는 gameEnv 객체를 직접 수정하므로 복사본을 만들어 사용
      const { ExecuteEngineService } = await import('../global/ExecuteEngine.service');
      const gameEnvCopy = { ...gameEnv };
      turnInfo = ExecuteEngineService.turnDate(turntime, gameEnvCopy);
      
      // 년/월 또는 starttime이 변경되었으면 DB에 저장
      if (gameEnvCopy.year !== gameEnv.year || gameEnvCopy.month !== gameEnv.month || gameEnvCopy.starttime !== gameEnv.starttime) {
        const starttimeChanged = gameEnvCopy.starttime !== gameEnv.starttime;
        gameEnv.year = gameEnvCopy.year;
        gameEnv.month = gameEnvCopy.month;
        if (starttimeChanged) {
          gameEnv.starttime = gameEnvCopy.starttime;
          console.log(`[${new Date().toISOString()}] ✅ Saved corrected starttime to DB: ${gameEnv.starttime}`);
        }
        data.game_env = gameEnv;
        session.data = data;
        session.markModified('data.game_env');

        // 세션 저장 시 VersionError(동시 업데이트) 발생 가능성이 있어
        // sessionRepository.saveDocument를 사용해 낙관적 잠금 충돌을 흡수한다.
        try {
          const { sessionRepository } = await import('../../repositories/session.repository');
          await sessionRepository.saveDocument(session);
        } catch (err: any) {
          const msg = err?.message || '';
          if (err?.name === 'VersionError' || msg.includes('No matching document found for id')) {
            console.warn('[GetFrontInfo] Ignoring VersionError while saving session turn info:', msg);
          } else {
            throw err;
          }
        }
      }
    } else {
      // preparing/paused/finished 상태: 저장된 년월 그대로 사용
      turnInfo = {
        year: gameEnv.year || gameEnv.startyear || 184,
        month: gameEnv.month || 1,
        turn: 0
      };
    }
    
    // 세션 이름이 설정되어 있고 기술적 ID와 다를 때만 반환
    // 그렇지 않으면 null (프론트엔드에서 시나리오 이름 사용)
    const sessionDisplayName = session.name && session.name !== sessionId 
      ? session.name 
      : null;
    
    // 시나리오 표시 이름: scenarioText가 있으면 우선 사용, 없으면 scenario
    const scenarioText = data.scenarioText || data.scenario || '삼국지';

    // 전쟁 관련 년도 설정 (상대 년도: startyear 기준)
    const openingPartYear = data.openingPartYear ?? gameEnv.openingPartYear ?? 3;
    // 선전포고 가능 상대 년도 (기본값: openingPartYear - 2 = 1)
    const warDeclareYear = data.warDeclareYear ?? gameEnv.warDeclareYear ?? (openingPartYear - 2);
    // 출병 가능 상대 년도 (기본값: openingPartYear = 3)
    const warDeployYear = data.warDeployYear ?? gameEnv.warDeployYear ?? openingPartYear;

    return {
      serverName: sessionDisplayName, // 세션 표시 이름 (없으면 null)
      scenarioText,
      extendedGeneral: (data.extended_general || 0) as 0 | 1,
      isFiction: (data.is_fiction || 0) as 0 | 1,
      // npcMode: 0=불가, 1=빙의가능, 2=선택생성
      // npcmode 필드가 있으면 우선 사용, 없으면 allow_npc_possess로 판단
      npcMode: (data.npcmode ?? (data.allow_npc_possess ? 1 : 0)) as 0 | 1 | 2,
      joinMode: data.join_mode === 0 ? 'onlyRandom' : 'full',
      startyear: data.startyear ?? data.startYear ?? 184,
      openingPartYear, // 초반 제한 기간 (기본값 3년)
      warDeclareYear,  // 선전포고 가능 상대 년도 (startyear + warDeclareYear 부터 가능)
      warDeployYear,   // 출병 가능 상대 년도 (startyear + warDeployYear 부터 가능)
      year: turnInfo.year,
      month: turnInfo.month,
      autorunUser: {
        limit_minutes: data.autorun_user?.limit_minutes || data.autorun_limit || 0,
        options: data.autorun_user?.options || {}
      },
      turnterm: gameEnv.turnterm || data.turnterm || 60, // 분 단위
      lastExecuted: lastExecutedStr,
      lastVoteID: data.lastVote || null,
      develCost: data.develcost || 100,
      noticeMsg: typeof data.msg === 'number' ? data.msg : (data.msg ? parseInt(String(data.msg)) || 0 : 0),
      // 접속자 정보 (SocketManager 또는 세션 데이터에서)
      onlineNations: await this.getOnlineNations(sessionId),
      onlineUserCnt: await this.getOnlineUserCount(sessionId),
      apiLimit: data.refreshLimit || 1000,
      auctionCount: data.auction_count || 0,
      isTournamentActive: data.is_tournament_active || false,
      isTournamentApplicationOpen: data.is_tournament_application_open || false,
      isBettingActive: data.is_betting_active || false,
      isLocked: data.is_locked || false,
      // 세션 상태: preparing, running, paused, finished, united
      sessionStatus: session.status || 'running',
      tournamentType: data.tournament_type || null,
      tournamentState: data.tournament_state || 0,
      tournamentTime: data.tournament_time || null,
      genCount: genCount.map(g => [g._id || 0, g.count || 0]),
      generalCntLimit: data.maxgeneral || 500,
      serverCnt: data.server_cnt || 1,
      lastVote: data.lastVote_data || null
    };
  }

  /**
   * 국가 정보 생성
   */
  private static async generateNationInfo(
    sessionId: string,
    nationId: number,
    lastNationNoticeDate: string,
    onlineGeneralMap?: Map<number, string[]>
  ) {
    const nation = await nationRepository.findOneByFilter({
      session_id: sessionId,
      nation: nationId
    });

    if (!nation) {
      return this.generateDummyNationInfo();
    }

    const nationData = nation;

    // 국가 인구 통계
    const cities = await cityRepository.findByFilter({
      session_id: sessionId,
      nation: nationId
    });

    const population = {
      cityCnt: cities.length,
      popNow: cities.reduce((sum: number, c: any) => sum + (c.pop ?? 0), 0),
      popMax: cities.reduce((sum: number, c: any) => sum + (c.pop_max ?? 0), 0)
    };

    // 국가 병력 통계 (npc가 5가 아닌 것만)
    const generals = await generalRepository.findByFilter({
      session_id: sessionId,
      nation: nationId,
      $or: [
        { npc: { $ne: 5 } },
        { npc: { $exists: false } }
      ]
    });

    const crew = {
      generalCnt: generals.length,
      crewNow: generals.reduce((sum: number, g: any) => {
        const curCrew = g.crew ?? g.data?.crew ?? 0;
        return sum + (typeof curCrew === 'number' && !isNaN(curCrew) ? curCrew : 0);
      }, 0),
      crewMax: generals.reduce((sum: number, g: any) => {
        const leadership = g.leadership ?? g.data?.leadership ?? 50;
        const safeLeadership = (typeof leadership === 'number' && !isNaN(leadership)) ? leadership : 50;
        return sum + safeLeadership * 100;
      }, 0),
    };

    // 고위 관직자 조회 (군주=12, 부군주=11)
    // nation과 officer_level로 필터링 (최상위 및 data 내부 모두 검색)
    const topChiefs = await generalRepository.findByFilter({
      session_id: sessionId,
      $or: [
        { nation: nationId, officer_level: { $in: [11, 12] } },
        { nation: nationId, 'data.officer_level': { $in: [11, 12] } },
        { 'data.nation': nationId, officer_level: { $in: [11, 12] } },
        { 'data.nation': nationId, 'data.officer_level': { $in: [11, 12] } }
      ]
    });

    console.log('[GetFrontInfo] TopChiefs query result:', {
      nationId,
      count: topChiefs.length,
      chiefs: topChiefs.map((g: any) => ({
        no: g.no,
        name: g.name,
        officer_level: g.officer_level,
        data_officer_level: g.data?.officer_level
      }))
    });

    const topChiefsMap: Record<number, any> = {};
    topChiefs.forEach((g: any) => {
      const level = g.officer_level ?? g.data?.officer_level;
      if (level === 11 || level === 12) {
        topChiefsMap[level] = {
          officer_level: level,
          no: g.no,
          name: g.name || '무명',
          npc: g.npc ?? g.data?.npc ?? 0
        };
      }
    });
    
    console.log('[GetFrontInfo] TopChiefs map:', topChiefsMap);

    // 재야(nation 0)는 "재야"로 표시
    const nationName = nationId === 0 ? '재야' : (nationData.name || '무명');
    
    // color를 문자열로 변환 (hex 형식)
    const nationColor = nationData.color || 0;
    const colorStr = typeof nationColor === 'string' 
      ? (nationColor.startsWith('#') ? nationColor : '#' + nationColor)
      : typeof nationColor === 'number'
      ? '#' + nationColor.toString(16).padStart(6, '0')
      : '#000000';
    
    // 국가 타입 정보 가져오기 (최상위 필드 우선, 없으면 data에서)
    const typeRaw = (nationData.type || nationData.data?.type || 'none').toLowerCase();
    const typeInfo = this.getNationTypeInfo(typeRaw);
    
    console.log('[GetFrontInfo] Nation Type Info:', {
      nationId,
      typeRaw,
      typeInfo,
      nationDataType: nationData.type,
      nationDataDataType: nationData.data?.type
    });

    const notice = await this.getNationNotice(sessionId, nationId, lastNationNoticeDate);
    const onlineGenList = onlineGeneralMap?.get(nationId) ?? [];
    const onlineGen = onlineGenList.length ? onlineGenList.join(', ') : '';
    
    return {
      id: nationId,
      full: true,
      name: nationName,
      population: {
        cityCnt: population.cityCnt,
        now: population.popNow,
        max: population.popMax
      },
      crew: {
        generalCnt: crew.generalCnt,
        now: crew.crewNow,
        max: crew.crewMax
      },
      type: {
        raw: nationData.type || nationData.data?.type || 'None',
        name: typeInfo.name,
        pros: typeInfo.pros,
        cons: typeInfo.cons
      },
      color: colorStr,
      level: nationData.data?.level ?? nationData.level ?? 0,
      capital: nationData.data?.capital ?? nationData.capital ?? 0,
      gold: nationData.data?.gold ?? nationData.gold ?? 0,  // data 내부 값 우선 (실제 변하는 값)
      rice: nationData.data?.rice ?? nationData.rice ?? 0,  // data 내부 값 우선 (실제 변하는 값)
      tech: nationData.data?.tech ?? nationData.tech ?? 0,
      gennum: nationData.data?.gennum ?? nationData.gennum ?? 0,
      power: nationData.power || {},
      bill: nationData.bill || '',
      taxRate: nationData.rate || 10,
      onlineGen,
      notice,
      topChiefs: topChiefsMap,
      diplomaticLimit: nationData.surlimit || 0,
      strategicCmdLimit: nationData.strategic_cmd_limit || {},
      impossibleStrategicCommand: [],
      prohibitScout: nationData.scout || 0,
      prohibitWar: nationData.war || 0
    };
  }

  /**
   * 더미 국가 정보 (소속 없는 경우)
   */
  private static async generateDummyNationInfo() {
    const { getNationStaticInfo } = await import('../../utils/functions');
    const staticInfo = await getNationStaticInfo(0);
    
    const color = staticInfo.color || 0;
    const colorStr = typeof color === 'string' 
      ? (color.startsWith('#') ? color : '#' + color)
      : typeof color === 'number'
      ? '#' + color.toString(16).padStart(6, '0')
      : '#000000';
    
    return {
      id: 0,
      full: false,
      name: staticInfo.name || '재야',
      population: { cityCnt: 0, now: 0, max: 0 },
      crew: { generalCnt: 0, now: 0, max: 0 },
      type: { raw: staticInfo.type || 'None', name: '-', pros: '', cons: '' },
      color: colorStr,
      level: staticInfo.level || 0,
      capital: staticInfo.capital || 0,  // 재야는 수도 없음
      gold: staticInfo.gold || 0,
      rice: staticInfo.rice || 0,
      tech: staticInfo.tech || 0,
      gennum: staticInfo.gennum || 0,
      power: {},
      onlineGen: '',
      notice: '',
      topChiefs: [],
      impossibleStrategicCommand: [],
      diplomaticLimit: 0,
      strategicCmdLimit: {},
      prohibitScout: 0,
      prohibitWar: 0,
      taxRate: 10
    };
  }

  private static async getNationNotice(
    sessionId: string,
    nationId: number,
    lastNationNoticeDate: string
  ): Promise<any | null> {
    try {
      const doc = await kvStorageRepository.findOneByFilter({
        session_id: sessionId,
        storage_id: `nation_${nationId}`
      });
      if (!doc) {
        return null;
      }
      const source = doc.data ?? doc.value ?? {};
      const notice = source.nationNotice || source.notice;
      if (!notice) {
        return null;
      }
      if (notice.date && lastNationNoticeDate) {
        const noticeDate = new Date(notice.date);
        const lastDate = new Date(lastNationNoticeDate);
        if (!(noticeDate > lastDate)) {
          return null;
        }
      }
      return notice;
    } catch (error: any) {
      console.error('[GetFrontInfo] Failed to read nation notice:', error);
      return null;
    }
  }
 
  /**
   * 장수 정보 생성
   */

  private static async generateGeneralInfo(
    sessionId: string,
    general: any,
    nationId: number,
    nationInfo?: any
  ) {
    const data = general;
    const generalNo = data.no || general.no;
    // 스택 시스템 제거됨 - 장수의 crew 직접 사용
    const formattedStacks: any[] = [];
    const unitStackInfo = null;
    const derivedCrew = data.crew || 0;
    const derivedTrain = data.train || 0;
    const derivedAtmos = data.atmos || 50;
    
    // 능력치 범위 보정 (40-150 사이로 제한)

    // 기존 DB에 잘못된 값이 있을 경우 자동 수정
    // 최상위 필드 우선, 없으면 data.data에서 읽기
    let leadership = data.leadership ?? data.data?.leadership ?? 50;
    let strength = data.strength ?? data.data?.strength ?? 50;
    let intel = data.intel ?? data.data?.intel ?? 50;
    let politics = data.politics ?? data.data?.politics ?? Math.round((leadership + intel) / 2);
    let charm = data.charm ?? data.data?.charm ?? Math.round((leadership + intel) / 2);
    
    // 범위를 벗어난 값 체크 및 로그
    if (leadership < 10 || leadership > 150) {
      console.warn(`[WARNING] Invalid leadership value for general ${data.no}: ${leadership}. Clamping to valid range.`);
      leadership = Math.max(40, Math.min(150, leadership));
    }
    if (strength < 10 || strength > 150) {
      console.warn(`[WARNING] Invalid strength value for general ${data.no}: ${strength}. Clamping to valid range.`);
      strength = Math.max(40, Math.min(150, strength));
    }
    if (intel < 10 || intel > 150) {
      console.warn(`[WARNING] Invalid intel value for general ${data.no}: ${intel}. Clamping to valid range.`);
      intel = Math.max(40, Math.min(150, intel));
    }
    
    // nation이 0이면 재야(officer_level=0)
    // nation.level이 0이면 방랑군(officer_level=12, 군주)
    let defaultOfficerLevel = 1;
    if (nationId === 0) {
      defaultOfficerLevel = 0; // 재야
    } else if (nationInfo && nationInfo.level === 0) {
      defaultOfficerLevel = 12; // 방랑군 군주
    }
    
    // Check both top-level and data.officer_level
    const officerLevel = data.officer_level !== undefined 
      ? data.officer_level 
      : (data.data?.officer_level !== undefined ? data.data.officer_level : defaultOfficerLevel);

    const aux = data.aux ?? data.data?.aux ?? {};
    const defenceTrain = data.defence_train ?? data.data?.defence_train ?? 0;
    const useTreatment = typeof aux.use_treatment === 'number' ? aux.use_treatment : 10;
    const useAutoNationTurn = typeof aux.use_auto_nation_turn === 'number' ? aux.use_auto_nation_turn : 1;

    return {
      no: data.no || general.no,
      name: general.name || data.name || '무명',
      nation: nationId,
      npc: data.npc || 0,
      injury: data.injury || 0,
      leadership: leadership,
      strength: strength,
      intel: intel,
      politics: politics,
      charm: charm,
      explevel: data.explevel || 0,
      dedlevel: data.dedlevel || 0,
      gold: (typeof data.gold === 'number' && !isNaN(data.gold)) ? data.gold : 1000,
      rice: (typeof data.rice === 'number' && !isNaN(data.rice)) ? data.rice : 1000,
      killturn: data.killturn || 0,
      picture: data.picture || '',
      imgsvr: data.imgsvr || 0,
      age: (typeof data.age === 'number' && data.age >= 0 && data.age <= 200) ? data.age : 20,
      specialDomestic: data.special || 'None',
      specialWar: data.special2 || 'None',
      personal: data.personal || 'None',
      belong: data.belong || 0,
      refreshScoreTotal: 0,
      officerLevel: officerLevel,
      officerLevelText: getOfficerTitle(officerLevel, nationInfo?.level ?? 0) || this.getOfficerLevelText(officerLevel),
      lbonus: this.calculateStatBonus(data, 'leadership'),
      sbonus: this.calculateStatBonus(data, 'strength'),
      ibonus: this.calculateStatBonus(data, 'intel'),
      pbonus: this.calculateStatBonus(data, 'politics'),
      cbonus: this.calculateStatBonus(data, 'charm'),
      ownerName: data.owner_name || null,
      honorText: this.getHonor(data.experience || 0),
      dedLevelText: this.getDed(data.dedication || 0),
      bill: 0,
      reservedCommand: await this.getReservedCommand(sessionId, data.no),
      use_treatment: useTreatment,
      use_auto_nation_turn: useAutoNationTurn,
      autorun_limit: aux.autorun_limit || 0,
      city: data.city ?? data.data?.city ?? 0,
      troop: data.troop ?? data.data?.troop ?? 0,
      refreshScore: 0,
      specage: data.specage || 0,
      specage2: data.specage2 || 0,
      leadership_exp: data.leadership_exp || 0,
      strength_exp: data.strength_exp || 0,
      intel_exp: data.intel_exp || 0,
      politics_exp: data.politics_exp || 0,
      charm_exp: data.charm_exp || 0,
      dex1: data.dex1 || 0,
      dex2: data.dex2 || 0,
      dex3: data.dex3 || 0,
      dex4: data.dex4 || 0,
      dex5: data.dex5 || 0,
      experience: data.experience || 0,
      dedication: data.dedication || 0,
      officer_city: data.officer_city || 0,
      defence_train: defenceTrain,
      crewtype: (() => {
        let crewtype = data.crewtype ?? data.data?.crewtype ?? 0;
        const crew = data.crew || 0;
        const resultTurn = data.result_turn || data.data?.result_turn;
        const cmd = resultTurn?.command;
        const argCrewType = resultTurn?.arg?.crewType;

        // 징병/모병 직후인데 crewtype이 0이면 결과 턴의 병종으로 보정
        if (!crewtype && crew > 0 && argCrewType &&
          ['징병', '모병', 'che_징병', 'che_모병', 'conscript', 'recruitSoldiers'].includes(cmd)) {
          crewtype = argCrewType;
        }

        // unit_stack에서 병종 정보 가져오기 (fallback)
        if (!crewtype && formattedStacks.length > 0) {
          crewtype = formattedStacks[0].crewTypeId;
        }

        if (!crewtype) {
          return 'None';
        }

        try {
          const { GameUnitConst } = require('../../const/GameUnitConst');
          const unit = GameUnitConst.byID(Number(crewtype));
          return {
            id: unit.id || Number(crewtype),
            label: unit.name || String(crewtype),
          };
        } catch (e) {
          return crewtype;
        }
      })(),
      crew: derivedCrew || 0,
      unitStacks: unitStackInfo,

      train: derivedTrain,
      atmos: derivedAtmos,
      turntime: data.turntime || new Date(),
      recent_war: data.recent_war || '',
      horse: data.item2 || 'None',
      weapon: data.item0 || 'None',
      book: data.item3 || 'None',
      item: data.item4 || 'None',
      warnum: 0,
      killnum: 0,
      deathnum: 0,
      killcrew: 0,
      deathcrew: 0,
      firenum: 0,
      permission: 0
    };
  }

  /**
   * 도시 정보 생성
   */
  static async generateCityInfo(
    sessionId: string,
    cityId: number,
    currentNationId: number
  ) {
    const cityDoc = await cityRepository.findByCityNum(sessionId, cityId);

    if (!cityDoc) {
      return null;
    }

    const cityPlain = cityDoc as any;
    const city: any = typeof cityPlain.toObject === 'function' ? cityPlain.toObject() : cityPlain;
    const cityNationId = city.nation ?? 0;

    // 도시 소속 국가 정보
    let nationName = '재야';
    let nationColor = '#000000';

    if (cityNationId !== 0) {
      const nationDoc = await nationRepository.findByNationNum(sessionId, cityNationId);
      const nation = nationDoc
        ? (typeof nationDoc.toObject === 'function' ? nationDoc.toObject() : nationDoc)
        : null;
      if (nation) {
        nationName = nation.name || nation.data?.name || '무명';
        const color = nation.color ?? nation.data?.color ?? 0;
        nationColor = typeof color === 'string'
          ? color.startsWith('#') ? color : '#' + color
          : typeof color === 'number'
          ? '#' + color.toString(16).padStart(6, '0')
          : '#000000';
      }
    }

    // 도시 관리 (태수, 군사, 종사)
    // 최상위 및 data 내부 모두 검색
    const officers = await generalRepository.findByFilter({
      session_id: sessionId,
      $or: [
        { officer_city: cityId, officer_level: { $in: [2, 3, 4] } },
        { officer_city: cityId, 'data.officer_level': { $in: [2, 3, 4] } },
        { 'data.officer_city': cityId, officer_level: { $in: [2, 3, 4] } },
        { 'data.officer_city': cityId, 'data.officer_level': { $in: [2, 3, 4] } }
      ]
    });

    const officerList: any = { 4: null, 3: null, 2: null };
    officers.forEach(officer => {
      const level = officer.officer_level ?? officer.data?.officer_level;
      if (level && (level === 2 || level === 3 || level === 4)) {
        officerList[level] = {
          officer_level: level,
          no: officer.no || officer.data?.no,
          name: officer.name || officer.data?.name || '무명',
          npc: officer.npc || officer.data?.npc || 0
        };
      }
    });
    
    const defenseState = await cityDefenseRepository.ensure(
      sessionId,
      cityId,
      city.name || `도시${cityId}`
    );
    // 스택 시스템 제거됨 - 도시 주둔군 정보 없음

    const pop = city.pop ?? 0;
    const popMax = city.pop_max ?? 10000;
    const agri = city.agri ?? 0;
    const agriMax = city.agri_max ?? 10000;
    const comm = city.comm ?? 0;
    const commMax = city.comm_max ?? 10000;
    const secu = city.secu ?? 0;
    const secuMax = city.secu_max ?? 10000;
    const def = city.def ?? 0;
    const defMax = city.def_max ?? 10000;
    const baseWall = city.wall ?? 0;
    const baseWallMax = city.wall_max ?? 10000;
    const trade = city.trade ?? null;
    const level = city.level ?? 0;
    const trust = city.trust ?? 0;

    const wallCurrent = defenseState?.wall_hp ?? baseWall;
    const wallMaximum = defenseState?.wall_max ?? baseWallMax;
    const gateCurrent = defenseState?.gate_hp ?? defenseState?.gate_max ?? 0;
    const gateMaximum = defenseState?.gate_max ?? gateCurrent;

    const garrisonInfo = {
      totalTroops: 0,
      stackCount: 0,
      stacks: [],
    };

    const defenseInfo = defenseState
      ? {
          wall: [wallCurrent, wallMaximum],
          gate: [gateCurrent, gateMaximum],
          towerLevel: defenseState.tower_level ?? 0,
          repairRate: defenseState.repair_rate ?? 0,
          lastDamageAt: defenseState.last_damage_at,
          lastRepairAt: defenseState.last_repair_at,
        }
      : null;

    const region = city.region ?? 0;

    return {
      id: cityId,
      name: city.name || '무명',
      region: region,
      nationInfo: {
        id: cityNationId,
        name: nationName,
        color: nationColor
      },
      level: level,
      trust: trust,
      pop: [pop, popMax],
      agri: [agri, agriMax],
      comm: [comm, commMax],
      secu: [secu, secuMax],
      def: [def, defMax],
      wall: [wallCurrent, wallMaximum],
      trade: trade,
      officerList,
      defense: defenseInfo,
      garrison: garrisonInfo,
    };
  }

  /**
   * 최근 기록 생성
   * 
   * PHP 버전과의 매핑:
   * - general (장수동향): general_record에서 general_id=0, log_type='history' (전역 장수동향)
   * - history (개인기록): general_record에서 general_id=장수ID, log_type='action' (개인 행동 기록)
   * - global (중원정세): world_history에서 nation_id=0 (전역 세계 역사)
   */
  private static async generateRecentRecord(
    sessionId: string,
    generalId: number,
    lastGeneralRecordID: number,
    lastPersonalHistoryID: number,
    lastGlobalHistoryID: number
  ) {
    // 장수 동향 (general) - general_record에서 general_id=0, log_type='history' (PHP: getGlobalRecord)
    const generalFilter: any = {
      session_id: sessionId,
      general_id: 0,  // general_id = 0 (전역 장수동향)
      log_type: 'history'
    };
    if (lastGeneralRecordID > 0) {
      generalFilter._id = { $gt: lastGeneralRecordID };
    }
    const generalRecord = await generalRecordRepository.findByFilter(generalFilter, {
      sort: { _id: -1 },
      limit: this.ROW_LIMIT + 1
    });

    // 개인 기록 (history) - general_record에서 general_id=장수ID
    // 전투 페이즈 로그(battle)와 전투 결과(battle_brief)도 포함 (PHP와 동일한 타입명)
    const personalHistoryFilter: any = {
      session_id: sessionId,
      general_id: generalId,
      log_type: { $in: ['action', 'battle', 'battle_brief'] }
    };
    if (lastPersonalHistoryID > 0) {
      personalHistoryFilter._id = { $gt: lastPersonalHistoryID };
    }
    const personalHistoryRecord = await generalRecordRepository.findByFilter(personalHistoryFilter, {
      sort: { _id: -1 },
      limit: this.ROW_LIMIT + 1
    });

    // 중원정세 (global) - world_history에서 nation_id=0 (PHP: getHistory)
    const globalFilter: any = {
      session_id: sessionId,
      nation_id: 0  // nation_id = 0 (전역 세계 역사)
    };
    if (lastGlobalHistoryID > 0) {
      globalFilter._id = { $gt: lastGlobalHistoryID };
    }
    const globalRecord = await worldHistoryRepository.findByFilter(globalFilter)
      .sort({ _id: -1 })
      .limit(this.ROW_LIMIT + 1)
      .lean();

    return {
      general: generalRecord.map(g => [g._id?.toString() || g.id, g.text]), // 장수동향
      history: personalHistoryRecord.map(h => [h._id?.toString() || h.id, h.text]), // 개인기록
      global: globalRecord.map((g: any) => [g._id?.toString(), g.text]), // 중원정세
      flushGeneral: generalRecord.length > this.ROW_LIMIT ? 1 : 0,
      flushHistory: personalHistoryRecord.length > this.ROW_LIMIT ? 1 : 0,
      flushGlobal: globalRecord.length > this.ROW_LIMIT ? 1 : 0
    };
  }

  private static getStackTroopCount(stack: any): number {
    if (!stack) {
      return 0;
    }
    if (typeof stack.hp === 'number') {
      return stack.hp;
    }
    const unitSize = stack.unit_size ?? 100;
    const stackCount = stack.stack_count ?? 0;
    return unitSize * stackCount;
  }

  // 헬퍼 함수들
  private static getOfficerLevelText(level: number): string {
    const levels: Record<number, string> = {
      12: '군주', 11: '태사', 10: '대도독', 9: '도독',
      8: '대장군', 7: '장군', 6: '집금오', 5: '장수',
      4: '태수', 3: '도위', 2: '현령', 1: '일반', 0: '재야'
    };
    return levels[level] || '일반';
  }

  private static getHonor(experience: number): string {
    if (experience >= 10000) return '명장';
    if (experience >= 5000) return '용장';
    if (experience >= 2000) return '맹장';
    if (experience >= 1000) return '장수';
    return '병졸';
  }

  private static getDed(dedication: number): string {
    if (dedication >= 10000) return '충신';
    if (dedication >= 5000) return '충복';
    if (dedication >= 2000) return '충의';
    if (dedication >= 1000) return '충성';
    return '무명';
  }

  /**
   * 예약된 명령 조회
   */
  private static async getReservedCommand(sessionId: string, generalId: number): Promise<any[] | null> {
    try {
      const GeneralTurn = (await import('../../models/general_turn.model')).GeneralTurn;
      const rawTurns = await generalTurnRepository.findByFilter({
        session_id: sessionId,
        general_id: generalId
      }).sort({ turn_idx: 1 }).limit(30);

      if (!rawTurns || rawTurns.length === 0) {
        return null;
      }

      const commandList: any[] = [];
      for (const turn of rawTurns) {
        commandList.push({
          turn: turn.turn_idx,
          commandName: turn.action || '',
          commandText: turn.action || '',
          brief: turn.brief || '',
          arg: typeof turn.arg === 'string' ? JSON.parse(turn.arg) : (turn.arg || {})
        });
      }

      return commandList.length > 0 ? commandList : null;
    } catch (error) {
      console.error('getReservedCommand error:', error);
      return null;
    }
  }

  /**
   * 국가 타입 정보 가져오기
   */
  private static getNationTypeInfo(typeRaw: string): { name: string; pros: string; cons: string } {
    try {
      // NationTypeFactory 사용
      return getNationTypeInfoFromFactory(typeRaw);
    } catch (error) {
      console.error('getNationTypeInfo error:', error);
      return {
        name: '-',
        pros: '',
        cons: ''
      };
    }
  }

  /**
   * 권한 계산
   */
  private static async calculatePermission(sessionId: string, general: any, nationId: number): Promise<number> {
    try {
      const officerLevel = general.officer_level || 0;

      // 수뇌부 권한 (officer_level >= 4)
      if (officerLevel >= 4 && nationId > 0) {
        return 4; // 수뇌부 권한
      }

      // 도시 관리 권한 (officer_level >= 2)
      if (officerLevel >= 2) {
        return officerLevel;
      }

      return 0;
    } catch (error) {
      console.error('calculatePermission error:', error);
      return 0;
    }
  }

  /**
   * 능력치 보정치 계산
   * 아이템, 특기 등으로 인한 능력치 보너스/페널티를 계산합니다.
   * 
   * @param data - 장수 데이터
   * @param statType - 능력치 타입 ('leadership' | 'strength' | 'intel')
   * @returns 보정치 (양수: 보너스, 음수: 페널티, 0: 보정 없음)
   */
  private static calculateStatBonus(data: any, statType: 'leadership' | 'strength' | 'intel' | 'politics' | 'charm'): number {
    let bonus = 0;

    
    // - 명마(horse): 통솔 +X
    // - 무기(weapon): 무력 +X
    // - 서적(book): 지력 +X
    // - 도구(item): 특정 능력치 +X
    
    
    // - 특기(special, special2)에 따른 능력치 보정
    
    
    // (calcInjury 함수에서 별도 처리)

    return bonus;
  }
}
