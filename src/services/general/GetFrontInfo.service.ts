import { generalRepository } from '../../repositories/general.repository';
import { General } from '../../models/general.model';
import { Session } from '../../models/session.model';
import { City } from '../../models/city.model';
import { Nation } from '../../models/nation.model';
import { GeneralRecord } from '../../models/general_record.model';
import { WorldHistory } from '../../models/world_history.model';

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
    const generalId = user?.generalId || data.general_id;
    
    const lastNationNoticeDate = data.lastNationNoticeDate || '2022-08-19 00:00:00';
    const lastGeneralRecordID = parseInt(data.lastGeneralRecordID) || 0;
    const lastWorldHistoryID = parseInt(data.lastWorldHistoryID) || 0;

    if (!generalId) {
      return { success: false, message: '장수 ID가 필요합니다' };
    }

    try {
      // 1. 장수 정보 조회
      const general = await General.findOne({
        session_id: sessionId,
        'data.no': generalId
      });

      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다' };
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
    const session = await Session.findOne({ session_id: sessionId });
    if (!session) {
      throw new Error('세션을 찾을 수 없습니다');
    }

    const data = session.data || {};

    // 장수 통계
    const genCount = await General.aggregate([
      { $match: { session_id: sessionId } },
      { $group: { _id: '$data.npc', count: { $sum: 1 } } }
    ]);

    return {
      scenarioText: data.scenario || '삼국지',
      extendedGeneral: false,
      isFiction: false,
      npcMode: data.npcmode || 0,
      joinMode: data.join_mode || 0,
      startyear: data.startyear || 180,
      year: data.year || 180,
      month: data.month || 1,
      autorunUser: data.autorun_user || 0,
      turnterm: data.turnterm || 600,
      lastExecuted: data.turntime || new Date(),
      lastVoteID: data.lastVote || null,
      develCost: data.develcost || 100,
      noticeMsg: data.msg || '',
      onlineNations: data.online_nation || [],
      onlineUserCnt: data.online_user_cnt || 0,
      apiLimit: data.refreshLimit || 1000,
      auctionCount: 0, // TODO: 경매 구현 시 추가
      isTournamentActive: false,
      isTournamentApplicationOpen: false,
      isBettingActive: false,
      isLocked: false,
      tournamentType: null,
      tournamentState: 0,
      tournamentTime: null,
      genCount: genCount.map(g => [g._id, g.count]),
      generalCntLimit: data.maxgeneral || 500,
      serverCnt: data.server_cnt || 1,
      lastVote: null
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
    const nation = await Nation.findOne({
      session_id: sessionId,
      'data.nation': nationId
    });

    if (!nation) {
      return this.generateDummyNationInfo();
    }

    const nationData = nation.data || {};

    // 국가 인구 통계
    const cityStats = await City.aggregate([
      { $match: { session_id: sessionId, 'data.nation': nationId } },
      {
        $group: {
          _id: null,
          cityCnt: { $sum: 1 },
          popNow: { $sum: '$data.pop' },
          popMax: { $sum: '$data.pop_max' }
        }
      }
    ]);

    const population = cityStats[0] || { cityCnt: 0, popNow: 0, popMax: 0 };

    // 국가 병력 통계
    const crewStats = await General.aggregate([
      { $match: { session_id: sessionId, 'data.nation': nationId, 'data.npc': { $ne: 5 } } },
      {
        $group: {
          _id: null,
          generalCnt: { $sum: 1 },
          crewNow: { $sum: '$data.crew' },
          crewMax: { $sum: { $multiply: ['$data.leadership', 100] } }
        }
      }
    ]);

    const crew = crewStats[0] || { generalCnt: 0, crewNow: 0, crewMax: 0 };

    // 고위 관직자 조회
    const topChiefs = await General.find({
      session_id: sessionId,
      'data.nation': nationId,
      'data.officer_level': { $gte: 11 }
    }).select('data.officer_level data.no data.name data.npc');

    return {
      id: nationId,
      full: true,
      name: nationData.name || '무명',
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
        name: '-',
        pros: '',
        cons: ''
      },
      color: nationData.color || 0,
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
      topChiefs: topChiefs.map(g => ({
        officer_level: g.data?.officer_level,
        no: g.data?.no,
        name: g.data?.name,
        npc: g.data?.npc
      })),
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
    return {
      id: 0,
      full: false,
      name: '재야',
      population: { cityCnt: 0, now: 0, max: 0 },
      crew: { generalCnt: 0, now: 0, max: 0 },
      type: { raw: 'None', name: '-', pros: '', cons: '' },
      color: 0,
      level: 0,
      capital: 0,
      gold: 0,
      rice: 0,
      tech: 0,
      gennum: 0,
      power: {},
      onlineGen: '',
      notice: '',
      topChiefs: [],
      impossibleStrategicCommand: []
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
      no: data.no,
      name: data.name || '무명',
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
      age: data.age || 20,
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
      reservedCommand: null,
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
    const city = await City.findOne({
      session_id: sessionId,
      'data.id': cityId
    });

    if (!city) {
      return null;
    }

    const cityData = city.data || {};
    const cityNationId = cityData.nation || 0;

    // 도시 소속 국가 정보
    let nationName = '재야';
    let nationColor = 0;

    if (cityNationId !== 0) {
      const nation = await Nation.findOne({
        session_id: sessionId,
        'data.nation': cityNationId
      });
      if (nation) {
        nationName = nation.data?.name || '무명';
        nationColor = nation.data?.color || 0;
      }
    }

    // 도시 관리 (태수, 도독 등)
    const officers = await General.find({
      session_id: sessionId,
      'data.officer_city': cityId,
      'data.officer_level': { $in: [2, 3, 4] }
    }).select('data.officer_level data.name data.npc');

    const officerList: any = { 4: null, 3: null, 2: null };
    officers.forEach(officer => {
      const level = officer.data?.officer_level;
      if (level) {
        officerList[level] = {
          name: officer.data?.name,
          npc: officer.data?.npc
        };
      }
    });

    return {
      id: cityId,
      name: cityData.name || '무명',
      nationInfo: {
        id: cityNationId,
        name: nationName,
        color: nationColor
      },
      level: cityData.level || 0,
      trust: cityData.trust || 0,
      pop: [cityData.pop || 0, cityData.pop_max || 10000],
      agri: [cityData.agri || 0, cityData.agri_max || 10000],
      comm: [cityData.comm || 0, cityData.comm_max || 10000],
      secu: [cityData.secu || 0, cityData.secu_max || 10000],
      def: [cityData.def || 0, cityData.def_max || 10000],
      wall: [cityData.wall || 0, cityData.wall_max || 10000],
      trade: cityData.trade || 0,
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
    const history = await WorldHistory.find({
      session_id: sessionId,
      'data.nation_id': 0,
      'data.id': { $gte: lastWorldHistoryID }
    })
      .sort({ 'data.id': -1 })
      .limit(this.ROW_LIMIT + 1)
      .select('data.id data.text');

    // 전역 기록
    const globalRecord = await GeneralRecord.find({
      session_id: sessionId,
      'data.general_id': 0,
      'data.log_type': 'history',
      'data.id': { $gte: lastGeneralRecordID }
    })
      .sort({ 'data.id': -1 })
      .limit(this.ROW_LIMIT + 1)
      .select('data.id data.text');

    // 장수 행동 기록
    const generalRecord = await GeneralRecord.find({
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
}
