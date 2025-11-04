import { General } from '../../models/general.model';
import { City } from '../../models/city.model';
import { Nation } from '../../models/nation.model';
import { Session } from '../../models/session.model';
import { Troop } from '../../models/troop.model';
import { CommandFactory } from '../../core/command/CommandFactory';
import { logger } from '../../common/logger';
import { GameConst } from '../../const/GameConst';
import { getAllUnitTypes } from '../../const/GameUnitConst';
import { getDexLevelList } from '../../utils/dexLevel';
import { GetMapService } from '../global/GetMap.service';
import { calculateDistanceList } from '../../utils/cityDistance';
import { GetConstService } from '../global/GetConst.service';

/**
 * GetProcessingCommand Service
 * 커맨드 처리 폼에 필요한 데이터를 반환
 * PHP: Command 클래스의 exportJSVars() 메서드와 동일한 역할
 */
export class GetProcessingCommandService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const command = data.command || data.action;
    const turnList = data.turnList || [0];
    const isChief = data.isChief || false;
    
    let generalId = user?.generalId || data.general_id;
    if (generalId) {
      generalId = Number(generalId);
      if (isNaN(generalId) || generalId === 0) {
        generalId = undefined;
      }
    }

    if (!command) {
          return {
            result: false,
        reason: '커맨드가 지정되지 않았습니다'
      };
    }

    try {
      // 장수 조회
      let general: any = null;
      if (generalId) {
        general = await (General as any).findOne({
          session_id: sessionId,
          no: generalId
        });
      } else if (user?.userId) {
        general = await (General as any).findOne({
        session_id: sessionId,
          owner: String(user.userId),
          'data.npc': { $lt: 2 }
      });
      }
      
      if (!general) {
        return {
          result: false,
          reason: '장수를 찾을 수 없습니다'
        };
      }
      
      generalId = general.no;

      // 세션 조회 (년도, 월 등)
      const session = await (Session as any).findOne({ session_id: sessionId });
      if (!session) {
        return {
          result: false,
          reason: '세션을 찾을 수 없습니다'
        };
      }

      const gameEnv = session.data?.game_env || {};
      const year = gameEnv.year || 1;
      const month = gameEnv.month || 1;
      const env = {
        session_id: sessionId,
        year,
        month,
        ...gameEnv
      };

      // 커맨드 타입에 따라 필요한 데이터 반환
      const commandData = await this.getCommandData(command, general, env, isChief);
      
      return {
        result: true,
        commandData: {
          name: command,
          commandType: command,
          ...commandData
        }
      };
    } catch (error: any) {
      logger.error('GetProcessingCommand error:', error);
      return {
        result: false,
        reason: error.message || '명령 데이터 조회 중 오류가 발생했습니다'
      };
    }
  }

  /**
   * 커맨드 타입별 필요한 데이터 반환
   */
  private static async getCommandData(
    command: string,
    general: any,
    env: any,
    isChief: boolean
  ): Promise<any> {
    const sessionId = env.session_id;
    const generalId = general.no;
    const generalData = general.data || {};

    // 등용 커맨드
    if (command === '등용' || command === 'che_등용' || command === 'recruit') {
      return await this.getRecruitData(sessionId, generalId);
    }

    // 이동, 강행, 출병, 첩보, 화계, 탈취, 파괴, 선동 등 도시 선택 커맨드
    if (['이동', '강행', '출병', '첩보', '화계', '탈취', '파괴', '선동',
         'che_이동', 'che_강행', 'che_출병', 'che_첩보', 'che_화계', 'che_탈취', 'che_파괴', 'che_선동',
         'move', 'forcedMove', 'attack', 'scout', 'fireAttack', 'plunder', 'destroy', 'agitate'].includes(command)) {
      return await this.getMoveData(sessionId, generalData.city || 0);
    }

    // 군량매매 커맨드
    if (command === '군량매매' || command === 'che_군량매매' || command === 'tradeRice') {
      return await this.getTradeRiceData(sessionId, generalId);
    }

    // 건국 커맨드
    if (command === '건국' || command === 'che_건국' || command === 'foundNation') {
      return await this.getFoundNationData(sessionId, env);
    }

    // 몰수/포상/증여 커맨드 (장수 선택 + 금액 입력)
    if (['몰수', '포상', '증여', 'che_몰수', 'che_포상', 'che_증여', 
         'confiscate', 'reward', 'donate'].includes(command)) {
      return await this.getGeneralAmountData(sessionId, generalId, generalData, command);
    }

    // 징병/모병 커맨드
    if (['징병', '모병', 'che_징병', 'che_모병', 'conscript', 'recruitSoldiers'].includes(command)) {
      return await this.getConscriptData(sessionId, generalId, generalData, env, command);
    }

    // 헌납 커맨드
    if (command === '헌납' || command === 'che_헌납' || command === 'tribute') {
      return await this.getTributeData(sessionId, generalId, generalData);
    }

    // 선양 커맨드
    if (command === '선양' || command === 'che_선양' || command === 'abdicate') {
      return await this.getAbdicateData(sessionId, generalId);
    }

    // 임관 커맨드
    if (command === '임관' || command === 'che_임관' || command === 'joinNation') {
      return await this.getJoinNationData(sessionId, generalId);
    }

    // 장수대상임관 커맨드
    if (command === '장수대상임관' || command === 'che_장수대상임관' || command === 'followGeneralJoinNation') {
      return await this.getFollowGeneralJoinNationData(sessionId, generalId);
    }

    // 무작위건국 커맨드
    if (command === '무작위건국' || command === 'che_무작위건국' || command === 'randomFoundNation') {
      return await this.getFoundNationData(sessionId, env); // 건국과 동일한 데이터
    }

    // 숙련전환 커맨드
    if (command === '숙련전환' || command === 'che_숙련전환' || command === 'convertMastery') {
      return await this.getConvertMasteryData(sessionId, generalId);
    }

    // 장비매매 커맨드
    if (command === '장비매매' || command === 'che_장비매매' || command === 'tradeEquipment') {
      return await this.getTradeEquipmentData(sessionId, generalId);
    }

    // 국기변경 커맨드 (Nation)
    if (command === '국기변경' || command === 'che_국기변경' || command === 'changeNationFlag') {
      return await this.getChangeNationFlagData(sessionId, env);
    }

    // 국호변경 커맨드 (Nation)
    if (command === '국호변경' || command === 'che_국호변경' || command === 'changeNationName') {
      return {};
    }

    // 물자원조 커맨드 (Nation)
    if (command === '물자원조' || command === 'che_물자원조' || command === 'materialAid') {
      const data = await this.getMaterialAidData(sessionId, generalId);
      // 맵 데이터 추가
      const mapData = await GetMapService.execute({ session_id: sessionId, neutralView: 0, showMe: 1 });
      return {
        ...data,
        mapData: mapData.success && mapData.result ? mapData : null,
      };
    }

    // 발령 커맨드 (Nation)
    if (command === '발령' || command === 'che_발령' || command === 'appointGeneral') {
      const data = await this.getAppointGeneralData(sessionId, generalId);
      // 맵 데이터 추가
      const mapData = await GetMapService.execute({ session_id: sessionId, neutralView: 0, showMe: 1 });
      return {
        ...data,
        mapData: mapData.success && mapData.result ? mapData : null,
      };
    }

    // 불가침제의 커맨드 (Nation)
    if (command === '불가침제의' || command === 'che_불가침제의' || command === 'noAggressionProposal') {
      return await this.getNoAggressionProposalData(sessionId, generalId);
    }

    // 피장파장 커맨드 (Nation)
    if (command === '피장파장' || command === 'che_피장파장' || command === 'piJangPaJang') {
      return await this.getPiJangPaJangData(sessionId, generalId);
    }

    // 인구이동 커맨드 (Nation)
    if (command === '인구이동' || command === 'cr_인구이동' || command === 'movePopulation') {
      return await this.getMovePopulationData(sessionId, generalId);
    }

    // 기본 빈 데이터
    return {};
  }

  /**
   * 등용 커맨드 데이터
   */
  private static async getRecruitData(sessionId: string, generalId: number): Promise<any> {
    // 등용 가능한 장수 목록 (NPC < 2, officer_level != 12, 자기 자신 제외)
    const generals = await (General as any).find({
      session_id: sessionId,
      'data.npc': { $lt: 2 },
      'data.officer_level': { $ne: 12 },
      no: { $ne: generalId }
    })
      .select('no name data')
      .sort({ 'data.npc': 1, name: 1 })
      .lean();

    const generalList = generals.map((gen: any) => {
      const genData = gen.data || {};
      return {
        no: gen.no,
        name: gen.name,
        nationID: genData.nation || 0,
        officerLevel: genData.officer_level || 1,
        npc: genData.npc || 0,
        leadership: genData.leadership || 0,
        strength: genData.strength || 0,
        intel: genData.intel || 0
      };
    });

    // 국가 목록
    const nations = await (Nation as any).find({ session_id: sessionId }).lean();
    const nationList = nations.map((nation: any) => {
      const nationData = nation.data || {};
      return {
        id: nation.nation,
        name: nation.name,
        color: nationData.color || '#808080',
        power: nationData.power || 0
      };
    });

    // 중립 국가(0) 추가
    nationList.unshift({
      id: 0,
      name: '무주공산',
      color: '#808080',
      power: 0
    });

    return {
      generals: generalList,
      nations: nationList
    };
  }

  /**
   * 이동 등 도시 선택 커맨드 데이터
   */
  private static async getMoveData(sessionId: string, currentCity: number): Promise<any> {
    const { GetMapService } = await import('../global/GetMap.service');
    
    // 맵 데이터 가져오기 (도시 목록 + 국가 정보)
    const mapResult = await GetMapService.execute({ 
      session_id: sessionId,
      serverID: sessionId
    }, undefined);

    const cities = await (City as any).find({ session_id: sessionId })
      .select('city name')
      .lean();

    const citiesMap = new Map<number, { name: string; info?: string }>();
    for (const city of cities) {
      citiesMap.set(city.city, {
        name: city.name || `도시 ${city.city}`
      });
    }

    // distanceList 계산 (현재 도시 기준 인접 도시)
    let distanceList: Record<number, number[]> = {};
    try {
      const constData = await GetConstService.execute({ session_id: sessionId });
      if (constData.success && constData.result && (constData.result as any).cityConst) {
        distanceList = calculateDistanceList(currentCity, (constData.result as any).cityConst, 10);
      }
    } catch (error: any) {
      logger.debug('Failed to calculate distanceList:', error.message);
    }

    // Map을 배열로 변환 (프론트엔드에서 Map으로 재구성)
    const citiesArray = Array.from(citiesMap.entries()).map(([id, data]) => [id, data.name]);
    
    return {
      cities: citiesArray,
      currentCity: currentCity,
      distanceList,
      mapData: mapResult.result ? {
        cityList: mapResult.cityList || [],
        nationList: mapResult.nationList || [],
        year: mapResult.year || 1,
        month: mapResult.month || 1,
        startYear: mapResult.startYear || 1,
        spyList: mapResult.spyList || {},
        myCity: currentCity,
        myNation: mapResult.myNation || null
      } : null
    };
  }

  /**
   * 군량매매 커맨드 데이터
   */
  private static async getTradeRiceData(sessionId: string, generalId: number): Promise<any> {
    const general = await (General as any).findOne({
      session_id: sessionId,
      no: generalId
    });

    if (!general) {
      return {
        minAmount: 100,
        maxAmount: 100000,
        amountGuide: [1000, 5000, 10000, 50000]
      };
    }

    const generalData = general.data || {};
    const gold = generalData.gold || 0;
    const rice = generalData.rice || 0;

    // 최대 매매 가능 금액 (자금 또는 군량의 50%까지)
    const maxByGold = Math.floor(gold * 0.5);
    const maxByRice = Math.floor(rice * 0.5);
    const maxAmount = Math.min(
      Math.max(maxByGold, maxByRice),
      GameConst.maxResourceActionAmount || 100000
    );

    return {
      minAmount: 100,
      maxAmount: maxAmount,
      amountGuide: [1000, 5000, 10000, 50000, 100000].filter(amt => amt <= maxAmount)
    };
  }

  /**
   * 건국 커맨드 데이터
   */
  private static async getFoundNationData(sessionId: string, env: any): Promise<any> {
    // nationTypes 로드
    let nationTypes: Record<string, any> = {};
    try {
      const path = require('path');
      const fs = require('fs');
      const nationTypesPath = path.join(
        __dirname,
        '../../../config/scenarios/sangokushi/data/nation-types.json'
      );
      if (fs.existsSync(nationTypesPath)) {
        const nationTypesData = JSON.parse(fs.readFileSync(nationTypesPath, 'utf-8'));
        nationTypes = nationTypesData.types || nationTypesData || {};
      }
    } catch (error: any) {
      logger.debug('Failed to load nation types:', error.message);
      // 기본값
      nationTypes = {
        'normal': {
          type: 'normal',
          name: '일반',
          pros: '특별한 장단점 없음',
          cons: '특별한 장단점 없음'
        }
      };
    }

    // colors 로드 (constants.json에서)
    let colors: string[] = [];
    try {
      const path = require('path');
      const fs = require('fs');
      const constantsPath = path.join(
        __dirname,
        '../../../config/scenarios/sangokushi/data/constants.json'
      );
      if (fs.existsSync(constantsPath)) {
        const constantsData = JSON.parse(fs.readFileSync(constantsPath, 'utf-8'));
        // colors 배열 생성 (일반적으로 18개 색상)
        const colorList = constantsData.colors || {};
        colors = [
          '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
          '#800000', '#008000', '#000080', '#808000', '#800080', '#008080',
          '#C0C0C0', '#808080', '#FFA500', '#FFC0CB', '#A52A2A', '#000000'
        ];
      } else {
        colors = [
          '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
          '#FFA500', '#800080', '#FFC0CB', '#A52A2A', '#808080', '#000000'
        ];
      }
    } catch (error: any) {
      logger.debug('Failed to load colors:', error.message);
      colors = [
        '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
        '#FFA500', '#800080', '#FFC0CB', '#A52A2A', '#808080', '#000000'
      ];
    }

    // 국가 수 확인
    const nations = await (Nation as any).find({ session_id: sessionId }).lean();
    const maxNation = (GameConst as any).maxNation || 99;
    const available건국 = nations.length < maxNation;

    return {
      available건국,
      nationTypes,
      colors
    };
  }

  /**
   * 몰수/포상/증여 커맨드 데이터
   */
  private static async getGeneralAmountData(
    sessionId: string,
    generalId: number,
    generalData: any,
    command: string
  ): Promise<any> {
    const nationID = generalData.nation || 0;
    const generalList: any[] = [];

    if (command === '증여' || command === 'che_증여' || command === 'donate') {
      // 증여: 같은 국가의 장수들
      const generals = await (General as any).find({
        session_id: sessionId,
        'data.nation': nationID,
        no: { $ne: generalId },
        'data.npc': { $lt: 2 }
      })
        .select('no name data')
        .sort({ 'data.npc': 1, name: 1 })
        .lean();

      for (const gen of generals) {
        const genData = gen.data || {};
        generalList.push({
          no: gen.no,
          name: gen.name,
          nationID: genData.nation || 0,
          officerLevel: genData.officer_level || 1,
          npc: genData.npc || 0,
          leadership: genData.leadership || 0,
          strength: genData.strength || 0,
          intel: genData.intel || 0,
          gold: genData.gold || 0,
          rice: genData.rice || 0
        });
      }
    } else {
      // 몰수/포상: 국가의 모든 장수
      const generals = await (General as any).find({
        session_id: sessionId,
        'data.nation': nationID
      })
        .select('no name data')
        .sort({ 'data.npc': 1, name: 1 })
        .lean();

      for (const gen of generals) {
        const genData = gen.data || {};
        generalList.push({
          no: gen.no,
          name: gen.name,
          nationID: genData.nation || 0,
          officerLevel: genData.officer_level || 1,
          npc: genData.npc || 0,
          leadership: genData.leadership || 0,
          strength: genData.strength || 0,
          intel: genData.intel || 0,
          gold: genData.gold || 0,
          rice: genData.rice || 0,
          cityID: genData.city || 0,
          crew: genData.crew || 0,
          train: genData.train || 0,
          atmos: genData.atmos || 0
        });
      }
    }

    return {
      generals: generalList,
      minAmount: 100,
      maxAmount: GameConst.maxResourceActionAmount || 100000,
      amountGuide: GameConst.resourceActionAmountGuide || [100, 500, 1000, 2000, 5000, 10000]
    };
  }

  /**
   * 징병/모병 커맨드 데이터
   */
  private static async getConscriptData(
    sessionId: string,
    generalId: number,
    generalData: any,
    env: any,
    command: string
  ): Promise<any> {
    const { 
      getAllUnitTypes, 
      getUnitsByType, 
      isUnitAvailable,
      ARM_TYPE
    } = await import('../../const/GameUnitConst');
    
    // 세션에서 시나리오 ID 가져오기
    const session = await (Session as any).findOne({ session_id: sessionId }).lean();
    const scenarioId = session?.scenario_id || 'sangokushi';
    
    const nationID = generalData.nation || 0;
    const tech = generalData.tech || 0;
    const year = env.year || 1;
    const startYear = env.startyear || 1;
    const relYear = year - startYear;
    
    // 국가의 소유 도시와 지역 정보
    const cities = await (City as any).find({ 
      session_id: sessionId,
      nation: nationID 
    }).select('city region level name').lean();
    
    const ownCities = new Map<number, { region: string; level: number; name: string }>();
    const ownRegions = new Set<string>();
    
    for (const city of cities) {
      ownCities.set(city.city, { 
        region: city.region || '', 
        level: city.level || 1,
        name: city.name || ''
      });
      if (city.region) {
        ownRegions.add(city.region);
      }
    }

    // 통솔력 계산
    // fullLeadership는 부상 무시 통솔력 (getLeadership(false))
    // DB의 leadership는 원래 통솔력 값이므로 그대로 사용
    // 부상 반영 통솔력은 leadership * (100 - injury) / 100
    const leadership = generalData.leadership || 0;
    const injury = generalData.injury || 0;
    const fullLeadership = leadership; // 부상 무시 통솔력 = 원래 통솔력

    // 병종 계열별 데이터 구성
    const armCrewTypes: any[] = [];
    const allArmTypes = getAllUnitTypes();
    
    for (const [armType, armName] of Object.entries(allArmTypes)) {
      const armTypeNum = Number(armType);
      const units = getUnitsByType(armTypeNum, scenarioId);
      
      const crewTypes: any[] = [];
      for (const unit of units) {
        // 도시 이름으로 검증
        const cityNames = ownCities ? Array.from(ownCities.values()).map(c => c.name) : [];
        const available = isUnitAvailable(
          unit,
          tech,
          relYear,
          Array.from(ownCities.keys()),
          Array.from(ownRegions),
          cityNames
        );
        
        // baseCost, baseRice 계산 (기술력 반영)
        // 기술력에 따른 비용 계산 (getTechCost)
        const techLevel = Math.floor(tech / 1000);
        const techCostMultiplier = 1 + techLevel * 0.15; // PHP: getTechCost($tech)
        const baseCost = Math.round(unit.cost * techCostMultiplier);
        const baseRice = Math.round(unit.rice * techCostMultiplier);
        
        crewTypes.push({
          id: unit.id,
          reqTech: unit.reqTech,
          reqYear: unit.reqYear,
          notAvailable: !available,
          baseRice: baseRice,
          baseCost: baseCost,
          name: unit.name,
          attack: unit.attack,
          defence: unit.defence,
          speed: unit.speed,
          avoid: unit.avoid,
          img: `/image/game/crewtype${unit.id}.png`, // 실제 이미지 경로
          info: unit.info
        });
      }
      
      if (crewTypes.length > 0) {
        armCrewTypes.push({
          armType: armTypeNum,
          armName: armName,
          values: crewTypes
        });
      }
    }

    // goldCoeff: 모병은 2배, 징병은 1배
    const goldCoeff = (command === '모병' || command === 'che_모병' || command === 'recruitSoldiers') ? 2 : 1;

    return {
      relYear,
      year,
      tech,
      techLevel: Math.floor(tech / 1000), // 기술력 레벨 (tech / 1000)
      startYear,
      goldCoeff,
      leadership,
      fullLeadership,
      armCrewTypes,
      currentCrewType: generalData.crewtype || 1100,
      crew: generalData.crew || 0,
      gold: generalData.gold || 0
    };
  }

  /**
   * 헌납 커맨드 데이터
   */
  private static async getTributeData(
    sessionId: string,
    generalId: number,
    generalData: any
  ): Promise<any> {
    const gold = generalData.gold || 0;
    const rice = generalData.rice || 0;

    // 최소/최대 금액 계산
    const minAmount = 100;
    const maxAmount = Math.max(gold, rice);
    const amountGuide = [100, 500, 1000, 2000, 5000, 10000];

    return {
      minAmount,
      maxAmount,
      amountGuide
    };
  }

  /**
   * 선양 커맨드 데이터
   */
  private static async getAbdicateData(
    sessionId: string,
    generalId: number
  ): Promise<any> {
    // 같은 국가의 장수 목록 (자기 자신 제외)
    const general = await (General as any).findOne({
      session_id: sessionId,
      no: generalId
    }).lean();

    if (!general) {
      return { generals: [] };
    }

    const generalData = general.data || {};
    const nationID = generalData.nation || 0;

    const generals = await (General as any).find({
      session_id: sessionId,
      'data.nation': nationID,
      'data.npc': { $lt: 2 },
      no: { $ne: generalId }
    })
      .select('no name data')
      .sort({ 'data.officer_level': -1, name: 1 })
      .lean();

    const generalList = generals.map((gen: any) => {
      const genData = gen.data || {};
      return {
        no: gen.no,
        name: gen.name,
        nationID: genData.nation || 0,
        officerLevel: genData.officer_level || 1,
        npc: genData.npc || 0,
        leadership: genData.leadership || 0,
        strength: genData.strength || 0,
        intel: genData.intel || 0
      };
    });

    // 국가 목록 (선택 표시용)
    const nations = await (Nation as any).find({ session_id: sessionId }).lean();
    const nationList = nations.map((nation: any) => {
      const nationData = nation.data || {};
      return {
        id: nation.nation,
        name: nation.name,
        color: nationData.color || '#808080',
        power: nationData.power || 0
      };
    });

    return {
      generals: generalList,
      nations: nationList
    };
  }

  /**
   * 임관 커맨드 데이터
   */
  private static async getJoinNationData(
    sessionId: string,
    generalId: number
  ): Promise<any> {
    // 임관 가능한 국가 목록 (이미 임관한 국가 제외)
    const general = await (General as any).findOne({
      session_id: sessionId,
      no: generalId
    }).lean();

    if (!general) {
      return { nations: [] };
    }

    const generalData = general.data || {};
    const currentNationID = generalData.nation || 0;

    // 모든 국가 목록 (현재 국가 제외)
    const nations = await (Nation as any).find({
      session_id: sessionId,
      nation: { $ne: currentNationID }
    })
      .lean();

    const nationList = nations.map((nation: any) => {
      const nationData = nation.data || {};
      return {
        id: nation.nation,
        name: nation.name,
        color: nationData.color || '#808080',
        power: nationData.power || 0,
        scoutMsg: nationData.scout_msg || ''
      };
    });

    return {
      nations: nationList
    };
  }

  /**
   * 장수대상임관 커맨드 데이터
   */
  private static async getFollowGeneralJoinNationData(
    sessionId: string,
    generalId: number
  ): Promise<any> {
    // 임관 가능한 국가의 장수 목록
    const general = await (General as any).findOne({
      session_id: sessionId,
      no: generalId
    }).lean();

    if (!general) {
      return { generals: [], nations: [] };
    }

    const generalData = general.data || {};
    const currentNationID = generalData.nation || 0;

    // 다른 국가의 장수 목록 (현재 국가 제외)
    const generals = await (General as any).find({
      session_id: sessionId,
      'data.nation': { $ne: currentNationID },
      'data.npc': { $lt: 2 },
      'data.officer_level': { $ne: 12 } // 군주 제외
    })
      .select('no name data')
      .sort({ 'data.officer_level': -1, name: 1 })
      .lean();

    const generalList = generals.map((gen: any) => {
      const genData = gen.data || {};
      return {
        no: gen.no,
        name: gen.name,
        nationID: genData.nation || 0,
        officerLevel: genData.officer_level || 1,
        npc: genData.npc || 0,
        leadership: genData.leadership || 0,
        strength: genData.strength || 0,
        intel: genData.intel || 0
      };
    });

    // 국가 목록
    const nations = await (Nation as any).find({
      session_id: sessionId,
      nation: { $ne: currentNationID }
    })
      .lean();

    const nationList = nations.map((nation: any) => {
      const nationData = nation.data || {};
      return {
        id: nation.nation,
        name: nation.name,
        color: nationData.color || '#808080',
        power: nationData.power || 0,
        scoutMsg: nationData.scout_msg || ''
      };
    });

    return {
      generals: generalList,
      nations: nationList
    };
  }

  /**
   * 숙련전환 커맨드 데이터
   */
  private static async getConvertMasteryData(
    sessionId: string,
    generalId: number
  ): Promise<any> {
    const general = await (General as any).findOne({
      session_id: sessionId,
      no: generalId
    }).lean();

    if (!general) {
      return { ownDexList: [], dexLevelList: [] };
    }

    const generalData = general.data || {};
    const allArmTypes = getAllUnitTypes();

    // 각 병종별 숙련도 목록
    const ownDexList: any[] = [];
    for (const [armType, armName] of Object.entries(allArmTypes)) {
      const dexKey = `dex${armType}`;
      ownDexList.push({
        armType: Number(armType),
        name: armName,
        amount: generalData[dexKey] || 0,
      });
    }

    // 숙련도 등급 목록
    const dexLevelList = getDexLevelList();

    // PHP: ConvertExpCommand::$decreaseCoeff = 0.4, $convertCoeff = 0.9
    return {
      ownDexList,
      dexLevelList,
      decreaseCoeff: 0.4, // 40% 감소
      convertCoeff: 0.9, // 90% 전환
    };
  }

  /**
   * 장비매매 커맨드 데이터
   * TradeEquipmentCommand의 exportJSVars() 로직을 직접 구현
   */
  private static async getTradeEquipmentData(
    sessionId: string,
    generalId: number
  ): Promise<any> {
    const general = await (General as any).findOne({
      session_id: sessionId,
      no: generalId
    }).lean();

    if (!general) {
      return { citySecu: 0, gold: 0, itemList: {}, ownItem: {} };
    }

    const generalData = general.data || {};
    const cityID = generalData.city || 0;

    // 도시 치안 조회
    const city = await (City as any).findOne({
      session_id: sessionId,
      city: cityID
    }).lean();

    const citySecu = city?.data?.secu || 0;
    const gold = generalData.gold || 0;

    // 아이템 목록 생성 (TradeEquipmentCommand.exportJSVars() 로직)
    const itemList: any = {};
    const allItems = (GameConst as any).allItems || {};
    const itemMap: Record<string, string> = {
      horse: '명마',
      weapon: '무기',
      book: '서적',
      item: '도구',
    };

    // buildItemClass 함수 가져오기
    const buildItemClass = (global as any).buildItemClass;
    if (!buildItemClass) {
      logger.warn('buildItemClass function not found, returning empty itemList');
      return {
        citySecu,
        gold,
        itemList: {},
        ownItem: this.getOwnItemFromData(generalData),
      };
    }

    // 각 아이템 타입별로 구매 가능한 아이템 목록 생성
    for (const [itemType, itemCategories] of Object.entries(allItems) as [string, any][]) {
      const typeName = itemMap[itemType] || itemType;
      const values: any[] = [];

      for (const [itemCode, cnt] of Object.entries(itemCategories) as [string, any][]) {
        // cnt > 0이면 유니크 아이템이 이미 사용 중이므로 제외
        if (cnt > 0) {
          continue;
        }

        try {
          const item = buildItemClass(itemCode);
          if (!item || !item.isBuyable()) {
            continue;
          }

          values.push({
            id: itemCode,
            name: item.getName(),
            reqSecu: item.getReqSecu(),
            cost: item.getCost(),
            info: item.getInfo(),
            isBuyable: item.isBuyable(),
          });
        } catch (error: any) {
          logger.debug(`Failed to build item class for ${itemCode}:`, error.message);
          continue;
        }
      }

      if (values.length > 0) {
        itemList[itemType] = {
          typeName,
          values,
        };
      }
    }

    // 소유 장비 정보
    const ownItem = this.getOwnItemFromData(generalData, buildItemClass);

    return {
      citySecu,
      gold,
      itemList,
      ownItem,
    };
  }

  /**
   * 장수 데이터에서 소유 장비 정보 추출
   */
  private static getOwnItemFromData(generalData: any, buildItemClass?: any): any {
    const ownItem: any = {};
    const itemTypes = ['horse', 'weapon', 'book', 'item'];

    for (const itemType of itemTypes) {
      const itemCode = generalData[itemType] || 'None';

      if (itemCode === 'None') {
        ownItem[itemType] = {
          id: 'None',
          name: '',
          cost: 0,
          reqSecu: 0,
          info: '',
          isBuyable: false,
        };
      } else if (buildItemClass) {
        try {
          const item = buildItemClass(itemCode);
          if (item) {
            ownItem[itemType] = {
              id: item.getRawClassName?.() || itemCode,
              name: item.getName?.() || '',
              reqSecu: item.getReqSecu?.() || 0,
              cost: item.getCost?.() || 0,
              info: item.getInfo?.() || '',
              isBuyable: item.isBuyable?.() || false,
            };
          } else {
            ownItem[itemType] = {
              id: itemCode,
              name: '',
              cost: 0,
              reqSecu: 0,
              info: '',
              isBuyable: false,
            };
          }
        } catch (error: any) {
          ownItem[itemType] = {
            id: itemCode,
            name: '',
            cost: 0,
            reqSecu: 0,
            info: '',
            isBuyable: false,
          };
        }
      } else {
        ownItem[itemType] = {
          id: itemCode,
          name: '',
          cost: 0,
          reqSecu: 0,
          info: '',
          isBuyable: false,
        };
      }
    }

    return ownItem;
  }

  /**
   * 국기변경 커맨드 데이터 (Nation)
   */
  private static async getChangeNationFlagData(
    sessionId: string,
    env: any
  ): Promise<any> {
    // 색상 목록 로드 (constants.json에서)
    let colors: string[] = [];
    try {
      const path = require('path');
      const fs = require('fs');
      const constantsPath = path.join(
        __dirname,
        '../../../config/scenarios/sangokushi/data/constants.json'
      );
      if (fs.existsSync(constantsPath)) {
        const constantsData = JSON.parse(fs.readFileSync(constantsPath, 'utf-8'));
        // 표준 색상 팔레트 (18개)
        colors = [
          '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
          '#800000', '#008000', '#000080', '#808000', '#800080', '#008080',
          '#C0C0C0', '#808080', '#FFA500', '#FFC0CB', '#A52A2A', '#000000'
        ];
      } else {
        colors = [
          '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
          '#FFA500', '#800080', '#FFC0CB', '#A52A2A', '#808080', '#000000'
        ];
      }
    } catch (error: any) {
      logger.debug('Failed to load colors:', error.message);
      colors = [
        '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
        '#FFA500', '#800080', '#FFC0CB', '#A52A2A', '#808080', '#000000'
      ];
    }

    return { colors };
  }

  /**
   * 물자원조 커맨드 데이터 (Nation)
   */
  private static async getMaterialAidData(
    sessionId: string,
    generalId: number
  ): Promise<any> {
    const general = await (General as any).findOne({
      session_id: sessionId,
      no: generalId
    }).lean();

    if (!general) {
      return { nations: [], currentNationLevel: 0, levelInfo: {}, minAmount: 0, maxAmount: 0, amountGuide: [] };
    }

    const generalData = general.data || {};
    const nationID = generalData.nation || 0;

    // 국가 목록 (자신 제외)
    const nations = await (Nation as any).find({
      session_id: sessionId,
      nation: { $ne: nationID }
    })
      .lean();

    const nationList = nations.map((nation: any) => {
      const nationData = nation.data || {};
      return {
        id: nation.nation,
        name: nation.name,
        color: nationData.color || '#808080',
        power: nationData.power || 0,
      };
    });

    // 국가 레벨 정보
    const currentNation = await (Nation as any).findOne({
      session_id: sessionId,
      nation: nationID
    }).lean();

    const currentNationLevel = currentNation?.data?.level || 0;

    // 레벨별 원조 제한 (constants.json의 nationLevels에서 가져오기)
    let levelInfo: Record<number, { text: string; amount: number }> = {
      0: { text: '재야', amount: 0 },
      1: { text: '군주', amount: 10000 },
      2: { text: '공', amount: 50000 },
      3: { text: '왕', amount: 100000 },
      4: { text: '황제', amount: 200000 },
    };
    
    try {
      const path = require('path');
      const fs = require('fs');
      const constantsPath = path.join(
        __dirname,
        '../../../config/scenarios/sangokushi/data/constants.json'
      );
      if (fs.existsSync(constantsPath)) {
        const constantsData = JSON.parse(fs.readFileSync(constantsPath, 'utf-8'));
        const nationLevels = constantsData.nationLevels || {};
        // 레벨별 원조 제한 계산 (레벨에 따라 증가)
        levelInfo = {};
        for (const [level, levelData] of Object.entries(nationLevels) as [string, any][]) {
          const levelNum = Number(level);
          const amount = levelNum === 0 ? 0 : Math.pow(10, levelNum) * 1000; // 기본 계산
          levelInfo[levelNum] = {
            text: levelData.name || `레벨${levelNum}`,
            amount: amount
          };
        }
      }
    } catch (error: any) {
      logger.debug('Failed to load level info:', error.message);
    }

    const maxAmount = levelInfo[currentNationLevel]?.amount || 0;
    const minAmount = 10;
    const amountGuide = [10, 100, 1000, 10000, 50000, 100000];

    return {
      nations: nationList,
      currentNationLevel,
      levelInfo,
      minAmount,
      maxAmount,
      amountGuide,
    };
  }

  /**
   * 발령 커맨드 데이터 (Nation)
   */
  private static async getAppointGeneralData(
    sessionId: string,
    generalId: number
  ): Promise<any> {
    const general = await (General as any).findOne({
      session_id: sessionId,
      no: generalId
    }).lean();

    if (!general) {
      return { generals: [], cities: [], troops: {} };
    }

    const generalData = general.data || {};
    const nationID = generalData.nation || 0;

    // 같은 국가의 장수 목록
    const generals = await (General as any).find({
      session_id: sessionId,
      'data.nation': nationID
    })
      .select('no name data')
      .sort({ name: 1 })
      .lean();

    const generalList = generals.map((gen: any) => {
      const genData = gen.data || {};
      return {
        no: gen.no,
        name: gen.name,
        nationID: genData.nation || 0,
        officerLevel: genData.officer_level || 1,
        npc: genData.npc || 0,
        leadership: genData.leadership || 0,
        strength: genData.strength || 0,
        intel: genData.intel || 0,
        cityID: genData.city || 0,
        crew: genData.crew || 0,
        train: genData.train || 0,
        atmos: genData.atmos || 0,
        troopID: genData.troop || null,
      };
    });

    // 같은 국가의 도시 목록
    const cities = await (City as any).find({
      session_id: sessionId,
      'data.nation': nationID
    })
      .lean();

    const citiesMap = cities.map((city: any) => {
      const cityData = city.data || {};
      return [
        city.city,
        {
          name: city.name,
          info: `${cityData.pop || 0}명`,
        },
      ];
    });

    // 부대 정보
    const troops = await (Troop as any).find({
      session_id: sessionId,
      'data.nation': nationID
    })
      .lean();

    const troopMap: Record<number, { troop_leader: number; nation: number; name: string }> = {};
    for (const troop of troops) {
      const troopData = troop.data || {};
      const troopLeader = troopData.troop_leader;
      if (troopLeader) {
        troopMap[troopLeader] = {
          troop_leader: troopLeader,
          nation: troopData.nation || 0,
          name: troop.name || '',
        };
      }
    }

    return {
      generals: generalList,
      cities: citiesMap,
      troops: troopMap,
      currentCity: generalData.city || 0,
    };
  }

  /**
   * 불가침제의 커맨드 데이터 (Nation)
   */
  private static async getNoAggressionProposalData(
    sessionId: string,
    generalId: number
  ): Promise<any> {
    const general = await (General as any).findOne({
      session_id: sessionId,
      no: generalId
    }).lean();

    if (!general) {
      return { nations: [], startYear: 180, minYear: 180, maxYear: 200, month: 1 };
    }

    const generalData = general.data || {};
    const nationID = generalData.nation || 0;

    // 국가 목록 (자신 제외)
    const nations = await (Nation as any).find({
      session_id: sessionId,
      nation: { $ne: nationID }
    })
      .lean();

    const nationList = nations.map((nation: any) => {
      const nationData = nation.data || {};
      return {
        id: nation.nation,
        name: nation.name,
        color: nationData.color || '#808080',
        power: nationData.power || 0,
        notAvailable: false, // TODO: 실제 불가능 여부 확인 (기한 등)
      };
    });

    // 세션 정보
    const session = await (Session as any).findOne({ session_id: sessionId }).lean();
    const sessionData = session?.data || {};
    const startYear = sessionData.startyear || 180;
    const year = sessionData.year || 180;
    const month = sessionData.month || 1;
    const minYear = year + 1; // 다음 달부터 가능
    const maxYear = year + 24; // 최대 2년

    // 맵 데이터 추가
    const mapData = await GetMapService.execute({ session_id: sessionId, neutralView: 0, showMe: 1 });

    return {
      nations: nationList,
      startYear,
      minYear,
      maxYear,
      month,
      mapData: mapData.success && mapData.result ? mapData : null,
    };
  }

  /**
   * 피장파장 커맨드 데이터 (Nation)
   */
  private static async getPiJangPaJangData(
    sessionId: string,
    generalId: number
  ): Promise<any> {
    const general = await (General as any).findOne({
      session_id: sessionId,
      no: generalId
    }).lean();

    if (!general) {
      return {
        nations: [],
        delayCnt: 0,
        postReqTurn: 0,
        availableCommandTypeList: {},
      };
    }

    const generalData = general.data || {};
    const nationID = generalData.nation || 0;

    // 국가 목록 (자신 제외, 선포/전쟁 중인 국가만)
    const nations = await (Nation as any).find({
      session_id: sessionId,
      nation: { $ne: nationID }
    })
      .lean();

    const nationList = nations.map((nation: any) => {
      const nationData = nation.data || {};
      return {
        id: nation.nation,
        name: nation.name,
        color: nationData.color || '#808080',
        power: nationData.power || 0,
        notAvailable: false, // TODO: 실제 선포/전쟁 상태 확인
      };
    });

    // TODO: 실제 전략 커맨드 목록 가져오기
    const availableCommandTypeList: Record<string, { name: string; remainTurn: number }> = {
      '급습': { name: '급습', remainTurn: 0 },
      '백성동원': { name: '백성동원', remainTurn: 0 },
      '필사즉생': { name: '필사즉생', remainTurn: 0 },
      '허보': { name: '허보', remainTurn: 0 },
      '이호경식': { name: '이호경식', remainTurn: 0 },
    };

    // 맵 데이터 추가
    const mapData = await GetMapService.execute({ session_id: sessionId, neutralView: 0, showMe: 1 });

    return {
      nations: nationList,
      delayCnt: 3, // TODO: 실제 값
      postReqTurn: 2, // TODO: 실제 값
      availableCommandTypeList,
      mapData: mapData.success && mapData.result ? mapData : null,
    };
  }

  /**
   * 인구이동 커맨드 데이터 (Nation)
   */
  private static async getMovePopulationData(
    sessionId: string,
    generalId: number
  ): Promise<any> {
    const general = await (General as any).findOne({
      session_id: sessionId,
      no: generalId
    }).lean();

    if (!general) {
      return {
        cities: [],
        currentCity: 0,
        minAmount: 100,
        maxAmount: 100000,
        amountGuide: [5000, 10000, 20000, 30000, 50000, 100000],
      };
    }

    const generalData = general.data || {};
    const nationID = generalData.nation || 0;
    const currentCity = generalData.city || 0;

    // 같은 국가의 도시 목록 (인접 도시만)
    const cities = await (City as any).find({
      session_id: sessionId,
      'data.nation': nationID
    })
      .lean();

    const citiesMap = cities.map((city: any) => {
      const cityData = city.data || {};
      return [
        city.city,
        {
          name: city.name,
          info: `${cityData.pop || 0}명`,
        },
      ];
    });

    // 맵 데이터 추가
    const mapData = await GetMapService.execute({ session_id: sessionId, neutralView: 0, showMe: 1 });

    return {
      cities: citiesMap,
      currentCity,
      minAmount: 100,
      maxAmount: 100000,
      amountGuide: [5000, 10000, 20000, 30000, 50000, 100000],
      mapData: mapData.success && mapData.result ? mapData : null,
    };
  }
}
