import { generalRepository } from '../../repositories/general.repository';
import { General } from '../../models/general.model';
import { Session } from '../../models/session.model';
import { City } from '../../models/city.model';
import { Nation } from '../../models/nation.model';
import { GeneralRecord } from '../../models/general_record.model';
import { WorldHistory } from '../../models/world_history.model';
import * as fs from 'fs';
import * as path from 'path';

/**
 * GetFrontInfo Service  
 * 메인 페이지의 모든 정보를 한 번에 반환
 * PHP: /sam/hwe/sammo/API/General/GetFrontInfo.php
 * 
 * 이 API는 게임의 핵심 API로, 메인 화면에 필요한 모든 정보를 조회합니다:
 * - 전역 정보 (게임 시간, 시나리오, 설정)
 * - 국가 정보 (소속 국가의 상세 정보)
 * - 장수 정보 (자신의 상세 정보)
 * - 도시 정보 (현재 위치 도시)
 * - 최근 기록 (역사, 전역 기록, 개인 행동 기록)
 */
export class GetFrontInfoService {
  static readonly ROW_LIMIT = 15;

  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || user?.id || data.user_id;
    let generalId = user?.generalId || data.general_id;
    
    const lastNationNoticeDate = data.lastNationNoticeDate || '2022-08-19 00:00:00';
    const lastGeneralRecordID = parseInt(data.lastGeneralRecordID) || 0;
    const lastWorldHistoryID = parseInt(data.lastWorldHistoryID) || 0;

    try {
      // 1. 장수 정보 조회 (generalId가 없으면 userId로 찾기)
      let general;
      
      if (generalId) {
        // generalId로 직접 조회
        general = await (General as any).findOne({
          session_id: sessionId,
          'data.no': generalId
        });
      } else if (userId) {
        // userId로 owner 필드를 통해 조회
        general = await (General as any).findOne({
          session_id: sessionId,
          owner: String(userId),
          'data.npc': { $lt: 2 } // NPC가 아닌 실제 플레이어 장수
        });
        
        if (general) {
          generalId = general.data?.no || general.no;
        }
      }

      if (!general) {
        return { 
          success: false, 
          message: generalId ? '장수를 찾을 수 없습니다' : '장수가 없습니다. 먼저 장수를 생성해주세요.'
        };
      }
      
      if (!generalId) {
        generalId = general.data?.no || general.no;
      }

      const nationId = general.data?.nation || 0;
      const cityId = general.data?.city;

      // 2. 전역 정보 생성
      const globalInfo = await this.generateGlobalInfo(sessionId);

      // 3. 국가 정보 생성
      const nationInfo = nationId !== 0
        ? await this.generateNationInfo(sessionId, nationId, lastNationNoticeDate)
        : await this.generateDummyNationInfo();

      // 4. 장수 정보 생성
      const generalInfo = await this.generateGeneralInfo(sessionId, general, nationId);
      
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
        lastWorldHistoryID,
        lastGeneralRecordID
      );

      // 7. 보조 정보
      const auxInfo: any = {};

      return {
        success: true,
        result: true,
        recentRecord,
        global: globalInfo,
        nation: nationInfo,
        general: generalInfo,
        city: cityInfo,
        aux: auxInfo
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * 전역 게임 정보 생성
   */
  private static async generateGlobalInfo(sessionId: string) {
    const session = await (Session as any).findOne({ session_id: sessionId });
    if (!session) {
      throw new Error('세션을 찾을 수 없습니다');
    }

    const data = session.data || {};

    // 장수 통계
    const genCount = await (General as any).aggregate([
      { $match: { session_id: sessionId } },
      { $group: { _id: '$data.npc', count: { $sum: 1 } } }
    ]);

    const turntime = data.turntime || new Date();
    const lastExecutedStr = turntime instanceof Date 
      ? turntime.toISOString().slice(0, 19).replace('T', ' ')
      : String(turntime);
    
    return {
      scenarioText: data.scenario || '삼국지',
      extendedGeneral: (data.extended_general || 0) as 0 | 1,
      isFiction: (data.is_fiction || 0) as 0 | 1,
      npcMode: (data.npcmode || 0) as 0 | 1 | 2,
      joinMode: data.join_mode === 0 ? 'onlyRandom' : 'full',
      startyear: data.startyear || 180,
      year: data.year || 180,
      month: data.month || 1,
      autorunUser: {
        limit_minutes: data.autorun_user?.limit_minutes || data.autorun_limit || 0,
        options: data.autorun_user?.options || {}
      },
      turnterm: data.turnterm || 60, // 분 단위
      lastExecuted: lastExecutedStr,
      lastVoteID: data.lastVote || null,
      develCost: data.develcost || 100,
      noticeMsg: typeof data.msg === 'number' ? data.msg : (data.msg ? parseInt(String(data.msg)) || 0 : 0),
      onlineNations: Array.isArray(data.online_nation) ? data.online_nation.join(',') : (data.online_nation || null),
      onlineUserCnt: data.online_user_cnt || null,
      apiLimit: data.refreshLimit || 1000,
      auctionCount: data.auction_count || 0,
      isTournamentActive: data.is_tournament_active || false,
      isTournamentApplicationOpen: data.is_tournament_application_open || false,
      isBettingActive: data.is_betting_active || false,
      isLocked: data.is_locked || false,
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
    lastNationNoticeDate: string
  ) {
    const nation = await (Nation as any).findOne({
      session_id: sessionId,
      'data.nation': nationId
    });

    if (!nation) {
      return this.generateDummyNationInfo();
    }

    const nationData = nation.data || {};

    // 국가 인구 통계 (data.nation 또는 nation 필드 확인)
    const cities = await (City as any).find({
      session_id: sessionId,
      $or: [
        { 'data.nation': nationId },
        { nation: nationId }
      ]
    }).lean();

    const population = {
      cityCnt: cities.length,
      popNow: cities.reduce((sum: number, c: any) => sum + (c.data?.pop ?? c.pop ?? 0), 0),
      popMax: cities.reduce((sum: number, c: any) => sum + (c.data?.pop_max ?? c.pop_max ?? 0), 0)
    };

    // 국가 병력 통계 (data.nation 또는 nation 필드 확인, npc가 5가 아닌 것만)
    const generals = await (General as any).find({
      session_id: sessionId,
      $and: [
        {
          $or: [
            { 'data.nation': nationId },
            { nation: nationId }
          ]
        },
        {
          $or: [
            { 'data.npc': { $ne: 5 } },
            { npc: { $ne: 5 } },
            { 'data.npc': { $exists: false } },
            { npc: { $exists: false } }
          ]
        }
      ]
    }).lean();

    const crew = {
      generalCnt: generals.length,
      crewNow: generals.reduce((sum: number, g: any) => sum + (g.data?.crew ?? g.crew ?? 0), 0),
      crewMax: generals.reduce((sum: number, g: any) => {
        const leadership = g.data?.leadership ?? g.leadership ?? 50;
        return sum + (leadership * 100);
      }, 0)
    };

    // 고위 관직자 조회 (군주, 태사)
    const topChiefs = await (General as any).find({
      session_id: sessionId,
      'data.nation': nationId,
      'data.officer_level': { $in: [11, 12] }
    }).select('data.officer_level data.no data.name data.npc').lean();
    
    const topChiefsMap: Record<number, any> = {};
    topChiefs.forEach((g: any) => {
      const level = g.data?.officer_level;
      if (level === 11 || level === 12) {
        topChiefsMap[level] = {
          officer_level: level,
          no: g.data?.no || g.no,
          name: g.data?.name || g.name || '무명',
          npc: g.data?.npc || 0
        };
      }
    });

    // 재야(nation 0)는 "재야"로 표시
    const nationName = nationId === 0 ? '재야' : (nationData.name || '무명');
    
    // color를 문자열로 변환 (hex 형식)
    const nationColor = nationData.color || 0;
    const colorStr = typeof nationColor === 'string' 
      ? (nationColor.startsWith('#') ? nationColor : '#' + nationColor)
      : typeof nationColor === 'number'
      ? '#' + nationColor.toString(16).padStart(6, '0')
      : '#000000';
    
    // 국가 타입 정보 가져오기
    const typeRaw = (nationData.type || 'none').toLowerCase();
    const typeInfo = this.getNationTypeInfo(typeRaw);
    
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
        raw: nationData.type || 'None',
        name: typeInfo.name,
        pros: typeInfo.pros,
        cons: typeInfo.cons
      },
      color: colorStr,
      level: nationData.level || 0,
      capital: nationData.capital || 0,
      gold: nationData.gold || 0,
      rice: nationData.rice || 0,
      tech: nationData.tech || 0,
      gennum: nationData.gennum || 0,
      power: nationData.power || {},
      bill: nationData.bill || '',
      taxRate: nationData.rate || 10,
      onlineGen: '', // TODO: 접속자 구현
      notice: null,
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

  /**
   * 장수 정보 생성
   */
  private static async generateGeneralInfo(
    sessionId: string,
    general: any,
    nationId: number
  ) {
    const data = general.data || {};

    return {
      no: data.no || general.no,
      name: general.name || data.name || '무명',
      nation: nationId,
      npc: data.npc || 0,
      injury: data.injury || 0,
      leadership: data.leadership || 50,
      strength: data.strength || 50,
      intel: data.intel || 50,
      explevel: data.explevel || 0,
      dedlevel: data.dedlevel || 0,
      gold: data.gold || 1000,
      rice: data.rice || 1000,
      killturn: data.killturn || 0,
      picture: data.picture || '',
      imgsvr: data.imgsvr || 0,
      age: (typeof data.age === 'number' && data.age >= 0 && data.age <= 200) ? data.age : 20,
      specialDomestic: data.special || 'None',
      specialWar: data.special2 || 'None',
      personal: data.personal || 'None',
      belong: data.belong || 0,
      refreshScoreTotal: 0,
      officerLevel: data.officer_level || 1,
      officerLevelText: this.getOfficerLevelText(data.officer_level || 1),
      lbonus: 0,
      ownerName: data.owner_name || null,
      honorText: this.getHonor(data.experience || 0),
      dedLevelText: this.getDed(data.dedication || 0),
      bill: 0,
      reservedCommand: await this.getReservedCommand(sessionId, data.no),
      autorun_limit: data.aux?.autorun_limit || 0,
      city: data.city || 0,
      troop: data.troop || 0,
      refreshScore: 0,
      specage: data.specage || 0,
      specage2: data.specage2 || 0,
      leadership_exp: data.leadership_exp || 0,
      strength_exp: data.strength_exp || 0,
      intel_exp: data.intel_exp || 0,
      dex1: data.dex1 || 0,
      dex2: data.dex2 || 0,
      dex3: data.dex3 || 0,
      dex4: data.dex4 || 0,
      dex5: data.dex5 || 0,
      experience: data.experience || 0,
      dedication: data.dedication || 0,
      officer_city: data.officer_city || 0,
      defence_train: data.defence_train || 0,
      crewtype: data.crewtype || 'None',
      crew: data.crew || 0,
      train: data.train || 0,
      atmos: data.atmos || 50,
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
  private static async generateCityInfo(
    sessionId: string,
    cityId: number,
    currentNationId: number
  ) {
    const city = await (City as any).findOne({
      session_id: sessionId,
      city: cityId
    });

    if (!city) {
      return null;
    }

    const cityData = city.data || {};
    const cityNationId = cityData.nation ?? city.nation ?? 0;

    // 도시 소속 국가 정보
    let nationName = '재야';
    let nationColor = '#000000';

    if (cityNationId !== 0) {
      const nation = await (Nation as any).findOne({
        session_id: sessionId,
        'data.nation': cityNationId
      });
      if (nation) {
        nationName = nation.data?.name || '무명';
        const color = nation.data?.color || 0;
        nationColor = typeof color === 'string'
          ? color.startsWith('#') ? color : '#' + color
          : typeof color === 'number'
          ? '#' + color.toString(16).padStart(6, '0')
          : '#000000';
      }
    }

    // 도시 관리 (태수, 도독 등)
    const officers = await (General as any).find({
      session_id: sessionId,
      'data.officer_city': cityId,
      'data.officer_level': { $in: [2, 3, 4] }
    }).select('data.officer_level data.name data.npc');

    const officerList: any = { 4: null, 3: null, 2: null };
    officers.forEach(officer => {
      const level = officer.data?.officer_level;
      if (level && (level === 2 || level === 3 || level === 4)) {
        officerList[level] = {
          officer_level: level,
          name: officer.data?.name || officer.name || '무명',
          npc: officer.data?.npc || 0
        };
      }
    });
    
    // 도시 자원 정보 (data 필드 우선, 없으면 상위 필드)
    const pop = cityData.pop ?? city.pop ?? 0;
    const popMax = cityData.pop_max ?? city.pop_max ?? 10000;
    const agri = cityData.agri ?? city.agri ?? 0;
    const agriMax = cityData.agri_max ?? city.agri_max ?? 10000;
    const comm = cityData.comm ?? city.comm ?? 0;
    const commMax = cityData.comm_max ?? city.comm_max ?? 10000;
    const secu = cityData.secu ?? city.secu ?? 0;
    const secuMax = cityData.secu_max ?? city.secu_max ?? 10000;
    const def = cityData.def ?? city.def ?? 0;
    const defMax = cityData.def_max ?? city.def_max ?? 10000;
    const wall = cityData.wall ?? city.wall ?? 0;
    const wallMax = cityData.wall_max ?? city.wall_max ?? 10000;
    const trade = cityData.trade ?? city.trade ?? null;
    const level = cityData.level ?? city.level ?? 0;
    const trust = cityData.trust ?? city.trust ?? 0;
    
    const region = cityData.region ?? city.region ?? 0;
    
    return {
      id: cityId,
      name: city.name || cityData.name || '무명',
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
      wall: [wall, wallMax],
      trade: trade,
      officerList
    };
  }

  /**
   * 최근 기록 생성
   */
  private static async generateRecentRecord(
    sessionId: string,
    generalId: number,
    lastWorldHistoryID: number,
    lastGeneralRecordID: number
  ) {
    // 역사 기록
    const history = await (WorldHistory as any).find({
      session_id: sessionId,
      'data.nation_id': 0,
      'data.id': { $gte: lastWorldHistoryID }
    })
      .sort({ 'data.id': -1 })
      .limit(this.ROW_LIMIT + 1)
      .select('data.id data.text');

    // 전역 기록
    const globalRecord = await (GeneralRecord as any).find({
      session_id: sessionId,
      'data.general_id': 0,
      'data.log_type': 'history',
      'data.id': { $gte: lastGeneralRecordID }
    })
      .sort({ 'data.id': -1 })
      .limit(this.ROW_LIMIT + 1)
      .select('data.id data.text');

    // 장수 행동 기록
    const generalRecord = await (GeneralRecord as any).find({
      session_id: sessionId,
      'data.general_id': generalId,
      'data.log_type': 'action',
      'data.id': { $gte: lastGeneralRecordID }
    })
      .sort({ 'data.id': -1 })
      .limit(this.ROW_LIMIT + 1)
      .select('data.id data.text');

    return {
      history: history.map(h => [h.data?.id, h.data?.text]),
      global: globalRecord.map(g => [g.data?.id, g.data?.text]),
      general: generalRecord.map(g => [g.data?.id, g.data?.text]),
      flushHistory: history.length > this.ROW_LIMIT ? 1 : 0,
      flushGlobal: globalRecord.length > this.ROW_LIMIT ? 1 : 0,
      flushGeneral: generalRecord.length > this.ROW_LIMIT ? 1 : 0
    };
  }

  // 헬퍼 함수들
  private static getOfficerLevelText(level: number): string {
    const levels: Record<number, string> = {
      12: '군주', 11: '태사', 10: '대도독', 9: '도독',
      8: '대장군', 7: '장군', 6: '집금오', 5: '장수',
      4: '태수', 3: '도위', 2: '현령', 1: '백신'
    };
    return levels[level] || '백신';
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
      const rawTurns = await (GeneralTurn as any).find({
        session_id: sessionId,
        'data.general_id': generalId
      }).sort({ 'data.turn_idx': 1 }).limit(30);

      if (!rawTurns || rawTurns.length === 0) {
        return null;
      }

      const commandList: any[] = [];
      for (const turn of rawTurns) {
        commandList.push({
          turn: turn.data.turn_idx,
          commandName: turn.data.action || '',
          commandText: turn.data.action || '',
          brief: turn.data.brief || '',
          arg: typeof turn.data.arg === 'string' ? JSON.parse(turn.data.arg) : (turn.data.arg || {})
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
      const typeFilePath = path.join(__dirname, '../../config/scenarios/sangokushi/data/nation-types.json');
      if (fs.existsSync(typeFilePath)) {
        const typeData = JSON.parse(fs.readFileSync(typeFilePath, 'utf-8'));
        const typeInfo = typeData.nationTypes?.[typeRaw];
        if (typeInfo) {
          // description에서 pros/cons 추출 (예: "농상↑ 민심↑ / 쌀수입↓")
          const description = typeInfo.description || '';
          const parts = description.split(' / ');
          const pros = parts[0] || '';
          const cons = parts[1] || '';
          
          return {
            name: typeInfo.name || '-',
            pros: pros,
            cons: cons
          };
        }
      }
    } catch (error) {
      console.error('getNationTypeInfo error:', error);
    }
    
    return {
      name: '-',
      pros: '',
      cons: ''
    };
  }

  /**
   * 권한 계산
   */
  private static async calculatePermission(sessionId: string, general: any, nationId: number): Promise<number> {
    try {
      const data = general.data || {};
      const officerLevel = data.officer_level || 0;

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
}
