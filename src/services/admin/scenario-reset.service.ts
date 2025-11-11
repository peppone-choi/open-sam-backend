import * as fs from 'fs/promises';
import * as path from 'path';
import { sessionRepository } from '../../repositories/session.repository';
import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { cityRepository } from '../../repositories/city.repository';
import { generalLogRepository } from '../../repositories/general-log.repository';
import { generalAccessLogRepository } from '../../repositories/general-access-log.repository';
import { generalRecordRepository } from '../../repositories/general-record.repository';
import { generalTurnRepository } from '../../repositories/general-turn.repository';
import { commandRepository } from '../../repositories/command.repository';
import { messageRepository } from '../../repositories/message.repository';
import { battleRepository } from '../../repositories/battle.repository';
import { eventRepository } from '../../repositories/event.repository';
import { nationTurnRepository } from '../../repositories/nation-turn.repository';
import { troopRepository } from '../../repositories/troop.repository';
import { worldHistoryRepository } from '../../repositories/world-history.repository';

/**
 * 시나리오 초기화 서비스 (CQRS 통합 버전)
 * 
 * config/scenarios/{scenarioId}/ 디렉토리의 CQRS 형식 시나리오를 사용합니다.
 * 레거시 data/scenario-templates는 더 이상 사용하지 않습니다.
 */
export class ScenarioResetService {
  // CQRS 시나리오 경로
  private static readonly SCENARIOS_DIR = path.resolve(process.cwd(), 'config', 'scenarios');

  /**
   * 시나리오 초기화 실행
   * @param sessionId 세션 ID
   * @param scenarioId 시나리오 ID (예: "sangokushi-huangjin")
   */
  static async resetScenario(sessionId: string, scenarioId: string): Promise<void> {
    console.log(`[ScenarioReset] Start resetting session ${sessionId} with scenario ${scenarioId}`);
    console.log(`[ScenarioReset] Scenarios directory: ${this.SCENARIOS_DIR}`);

    // 1. 시나리오 메타데이터 로드
    const scenarioPath = path.join(this.SCENARIOS_DIR, scenarioId, 'scenario.json');
    console.log(`[ScenarioReset] Loading scenario: ${scenarioPath}`);
    const scenarioMetadata = await this.loadScenarioFile(scenarioPath);

    // 2. 세션 찾기
    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // 3. 기존 데이터 삭제
    await this.clearSessionData(sessionId);

    // 4. 세션 초기화
    await this.initializeSession(session, scenarioMetadata);

    // 5. 도시 생성 (기본 cities.json 로드)
    await this.initializeCities(sessionId, scenarioId, scenarioMetadata);

    // 6. 국가 생성 (시나리오의 nations 사용)
    await this.createNations(sessionId, scenarioId, scenarioMetadata);

    // 7. 장수 생성 (시나리오의 generals 사용)
    await this.createGenerals(sessionId, scenarioId, scenarioMetadata);

    console.log(`[ScenarioReset] Successfully reset session ${sessionId}`);
  }

  /**
   * 시나리오 파일 로드
   */
  private static async loadScenarioFile(filePath: string): Promise<any> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (err: any) {
      console.error(`[ScenarioReset] Failed to load file: ${filePath}`, err);
      throw new Error(`Failed to load scenario file: ${filePath} (error: ${err.message})`);
    }
  }

  /**
   * 시나리오 데이터 파일 로드 (cities.json, nations.json, generals.json 등)
   */
  private static async loadScenarioDataFile(scenarioId: string, dataFileName: string): Promise<any> {
    const scenarioPath = path.join(this.SCENARIOS_DIR, scenarioId);
    const metadataPath = path.join(scenarioPath, 'scenario.json');
    const metadata = await this.loadScenarioFile(metadataPath);

    // scenario.json의 data.collections에서 파일 경로 찾기
    const collections = metadata?.data?.collections || {};
    const collection = collections[dataFileName];

    if (!collection || !collection.file) {
      throw new Error(`Collection '${dataFileName}' not found in scenario metadata`);
    }

    // 상대 경로 처리
    const dataFilePath = path.join(scenarioPath, collection.file);
    const data = await this.loadScenarioFile(dataFilePath);

    // root 필드로 데이터 추출
    if (collection.root && data[collection.root]) {
      return data[collection.root];
    }

    return data;
  }

  /**
   * 기존 데이터 삭제
   */
  private static async clearSessionData(sessionId: string): Promise<void> {
    console.log(`[ScenarioReset] Clearing data for session ${sessionId}`);

    // 1. 핵심 게임 데이터 삭제
    const [generalResult, nationResult, cityResult] = await Promise.all([
      generalRepository.deleteManyByFilter({ session_id: sessionId }),
      nationRepository.deleteBySession(sessionId),
      cityRepository.deleteBySession(sessionId)
    ]);

    console.log(`[ScenarioReset] Deleted ${generalResult.deletedCount} generals`);
    console.log(`[ScenarioReset] Deleted ${nationResult.deletedCount} nations`);
    console.log(`[ScenarioReset] Deleted ${cityResult.deletedCount} cities`);

    // 2. 로그 및 기록 데이터 삭제
    const [
      generalLogResult,
      generalAccessLogResult,
      generalRecordResult,
      generalTurnResult,
      nationTurnResult
    ] = await Promise.all([
      generalLogRepository.deleteBySession(sessionId),
      generalAccessLogRepository.deleteBySession(sessionId),
      generalRecordRepository.deleteBySession(sessionId),
      generalTurnRepository.deleteBySession(sessionId),
      nationTurnRepository.deleteBySession(sessionId)
    ]);

    console.log(`[ScenarioReset] Deleted ${generalLogResult.deletedCount} general logs`);
    console.log(`[ScenarioReset] Deleted ${generalAccessLogResult.deletedCount} general access logs`);
    console.log(`[ScenarioReset] Deleted ${generalRecordResult.deletedCount} general records`);
    console.log(`[ScenarioReset] Deleted ${generalTurnResult.deletedCount} general turns`);
    console.log(`[ScenarioReset] Deleted ${nationTurnResult.deletedCount} nation turns`);

    // 3. 명령, 메시지, 이벤트 등 게임 진행 데이터 삭제
    const [
      commandResult,
      messageResult,
      battleResult,
      eventResult,
      troopResult,
      worldHistoryResult
    ] = await Promise.all([
      commandRepository.deleteBySession(sessionId),
      messageRepository.deleteBySession(sessionId),
      battleRepository.deleteBySession(sessionId),
      eventRepository.deleteBySession(sessionId),
      troopRepository.deleteBySession(sessionId),
      worldHistoryRepository.deleteBySession(sessionId)
    ]);

    console.log(`[ScenarioReset] Deleted ${commandResult.deletedCount} commands`);
    console.log(`[ScenarioReset] Deleted ${messageResult.deletedCount} messages`);
    console.log(`[ScenarioReset] Deleted ${battleResult.deletedCount} battles`);
    console.log(`[ScenarioReset] Deleted ${eventResult.deletedCount} events`);
    console.log(`[ScenarioReset] Deleted ${troopResult.deletedCount} troops`);
    console.log(`[ScenarioReset] Deleted ${worldHistoryResult.deletedCount} world history records`);
  }

  /**
   * 세션 초기화
   */
  private static async initializeSession(session: any, scenarioMetadata: any): Promise<void> {
    console.log(`[ScenarioReset] Initializing session with scenario: ${scenarioMetadata.name}`);

    session.data = session.data || {};
    session.data.game_env = session.data.game_env || {};

    // 시나리오 정보 설정
    session.scenario_name = scenarioMetadata.name || '';
    session.data.game_env.scenario = scenarioMetadata.name || '';
    
    // 년도 설정 (시나리오 메타데이터에서 가져오거나 기본값 184년)
    const startYear = scenarioMetadata.metadata?.startYear || 
                     scenarioMetadata.startYear || 
                     scenarioMetadata.data?.scenario?.startYear || 
                     184;
    
    console.log(`[ScenarioReset] Detected startYear: ${startYear} (from metadata.startYear: ${scenarioMetadata.metadata?.startYear})`);
    
    session.data.game_env.startYear = startYear;
    session.data.game_env.startyear = startYear;
    session.data.year = startYear;
    session.data.game_env.year = startYear;
    session.data.month = 1;
    session.data.game_env.month = 1;
    
    // 최상위 레벨 필드도 업데이트 (init.service.ts와 동일)
    session.year = startYear;
    session.month = 1;
    session.startyear = startYear;
    
    console.log(`[ScenarioReset] Set year to ${startYear}, month to 1`);

    // 게임 시작 시간 (현재 시간 기준)
    // starttime은 게임을 시작한 "현실 시간"이며, 이를 기준으로 경과 턴을 계산함
    // turnDate()는 (현재시간 - starttime) / turnterm으로 경과 턴을 계산하고,
    // 경과 턴 수를 게임 내 월/년으로 변환함
    const now = new Date();
    const starttime = now; // 현재 시간을 게임 시작 시간으로 설정
    session.data.game_env.starttime = starttime.toISOString();
    session.starttime = starttime; // 최상위 레벨에도 저장
    
    // 턴 시간 (현재 시간 + 1분 후)
    const nextTurn = new Date(now.getTime() + 60 * 1000);
    session.data.turntime = nextTurn.toISOString();
    session.data.game_env.turntime = nextTurn.toISOString();
    session.turntime = nextTurn; // 최상위 레벨에도 저장
    
    // 턴 텀 설정
    const turnterm = scenarioMetadata.gameSettings?.turnterm || scenarioMetadata.turnterm || 60;
    session.data.game_env.turnterm = turnterm;
    session.turnterm = turnterm; // 최상위 레벨에도 저장
    
    console.log(`[ScenarioReset] Set starttime to ${starttime.toISOString()} (${startYear}년 1월 1일)`);
    console.log(`[ScenarioReset] Set turntime to ${nextTurn.toISOString()} (1 minute from now)`);
    console.log(`[ScenarioReset] Set turnterm to ${turnterm} minutes`);

    // 최대 장수 설정
    const maxGeneral = scenarioMetadata.gameSettings?.defaultMaxGeneral || 
                      scenarioMetadata.const?.defaultMaxGeneral || 
                      600;
    session.data.game_env.maxgeneral = maxGeneral;
    console.log(`[ScenarioReset] Set maxgeneral to ${maxGeneral}`);

    // 서버 상태를 폐쇄(준비중)로 설정
    // 시나리오 리셋 후에는 관리자가 수동으로 서버를 오픈해야 함
    session.status = 'preparing';
    session.data.game_env.isunited = 2;  // 2 = 폐쇄
    session.data.isunited = 2;
    
    console.log(`[ScenarioReset] Set status to 'preparing' (폐쇄), isunited: 2`);

    session.markModified('data.game_env');
    session.markModified('data');

    await sessionRepository.saveDocument(session);
  }

  /**
   * 도시 초기화
   */
  private static async initializeCities(
    sessionId: string,
    scenarioId: string,
    scenarioMetadata: any
  ): Promise<void> {
    console.log(`[ScenarioReset] Initializing cities`);

    // cities 컬렉션 로드
    const cities = await this.loadScenarioDataFile(scenarioId, 'cities');
    console.log(`[ScenarioReset] Found ${cities.length} cities`);

    // 시나리오에 정의된 국가별 도시 소유권 맵 생성
    const cityOwnershipMap = new Map<string, number>(); // cityName -> nationId

    if (scenarioMetadata.data?.scenario?.nations) {
      for (const nationData of scenarioMetadata.data.scenario.nations) {
        const nationId = nationData.id;
        const nationName = nationData.name;
        const cities = nationData.cities || [];
        
        if (cities.length > 0) {
          console.log(`[ScenarioReset] Mapping ${cities.length} cities to nation ${nationId} (${nationName})`);
          for (const cityName of cities) {
            cityOwnershipMap.set(cityName, nationId);
          }
        }
      }
    }

    console.log(`[ScenarioReset] City ownership map: ${cityOwnershipMap.size} cities mapped`);

    // 도시 일괄 생성
    const citiesToCreate = [];
    for (const cityTemplate of cities) {
      const cityName = cityTemplate.name;
      const nationId = cityOwnershipMap.get(cityName) || 0; // 0 = 무소속

      const initialState = cityTemplate.initialState || {};
      const position = cityTemplate.position || {};

      const cityData = {
        session_id: sessionId,
        city: cityTemplate.id,
        name: cityName,
        nation: nationId,
        region: cityTemplate.regionId || 1,
        x: position.x || 0,
        y: position.y || 0,
        level: cityTemplate.levelId || 2,
        pop: initialState.population || 10000,
        pop_max: (initialState.population || 10000) * 10,
        agri: initialState.agriculture || 100,
        agri_max: (initialState.agriculture || 100) * 10,
        comm: initialState.commerce || 100,
        comm_max: (initialState.commerce || 100) * 10,
        secu: initialState.security || 50,
        secu_max: 100,
        def: initialState.defense || 100,
        def_max: (initialState.defense || 100) * 10,
        wall: initialState.wall || 100,
        wall_max: (initialState.wall || 100) * 10,
        trade: 0,
        supply: 0,
        state: 0,
        data: {
          name: cityName,
          level: cityTemplate.levelId || 2,
          region: cityTemplate.regionId || 1,
          pop: initialState.population || 10000,
          agri: initialState.agriculture || 100,
          comm: initialState.commerce || 100,
          secu: initialState.security || 50,
          def: initialState.defense || 100,
          wall: initialState.wall || 100
        }
      };

      citiesToCreate.push(cityData);
    }

    await cityRepository.bulkCreate(citiesToCreate);
    console.log(`[ScenarioReset] Created ${citiesToCreate.length} cities`);
  }

  /**
   * 국가 생성
   */
  private static async createNations(
    sessionId: string,
    scenarioId: string,
    scenarioMetadata: any
  ): Promise<void> {
    console.log(`[ScenarioReset] Creating nations`);

    const nationsData = scenarioMetadata.data?.scenario?.nations || [];
    if (nationsData.length === 0) {
      console.warn('[ScenarioReset] No nations in scenario');
      return;
    }

    const nationsToCreate = [];

    for (const nationTemplate of nationsData) {
      const nationId = nationTemplate.id;
      const nationName = nationTemplate.name || '무명';
      const nationColor = nationTemplate.color || '#808080';
      const cityNames = nationTemplate.cities || [];
      
      console.log(`[ScenarioReset] Creating nation ${nationId}: ${nationName}, color: ${nationColor}`);

      // capital 필드 처리: 문자열(도시 이름)이면 도시 ID로 변환
      let capitalId = 0;
      if (nationTemplate.capital) {
        // 1. capital이 자신의 cities 배열에 포함되어 있는지 검증
        const capitalName = typeof nationTemplate.capital === 'string' 
          ? nationTemplate.capital 
          : null;
        
        if (capitalName && !cityNames.includes(capitalName)) {
          console.error(`  ❌ ${nationName} 수도 '${capitalName}'이(가) 자신의 영토에 없음!`);
          throw new Error(
            `Invalid scenario: Nation '${nationName}' capital '${capitalName}' is not in its cities list`
          );
        }
        
        // 2. 도시 ID로 변환
        if (typeof nationTemplate.capital === 'string') {
          // 도시 이름으로 조회
          const capitalCity = await cityRepository.findOneByFilter({
            session_id: sessionId,
            name: nationTemplate.capital,
            nation: nationId  // 자신의 영토인지 다시 한번 확인
          });
          if (capitalCity) {
            capitalId = capitalCity.city;
            console.log(`  - ${nationName} 수도: ${nationTemplate.capital} (ID: ${capitalId})`);
          } else {
            console.error(`  ❌ ${nationName} 수도 '${nationTemplate.capital}' 찾을 수 없거나 다른 국가 영토임`);
            throw new Error(
              `Invalid scenario: Nation '${nationName}' capital '${capitalName}' not found or belongs to another nation`
            );
          }
        } else if (typeof nationTemplate.capital === 'number') {
          // 숫자로 지정된 경우도 검증
          const capitalCity = await cityRepository.findOneByFilter({
            session_id: sessionId,
            city: nationTemplate.capital,
            nation: nationId
          });
          if (capitalCity) {
            capitalId = nationTemplate.capital;
          } else {
            console.error(`  ❌ ${nationName} 수도 ID ${nationTemplate.capital}이(가) 자신의 영토에 없음`);
            throw new Error(
              `Invalid scenario: Nation '${nationName}' capital ID ${nationTemplate.capital} not found or belongs to another nation`
            );
          }
        }
      }

      // 수도가 지정되지 않았으면 첫 번째 도시를 수도로
      if (capitalId === 0 && cityNames.length > 0) {
        const firstCity = await cityRepository.findOneByFilter({
          session_id: sessionId,
          name: cityNames[0]
        });
        if (firstCity) {
          capitalId = firstCity.city;
          console.log(`  - ${nationName} 수도(자동): ${cityNames[0]} (ID: ${capitalId})`);
        }
      }

      const treasury = nationTemplate.treasury || {};
      const gold = treasury.gold || 10000;
      const rice = treasury.rice || 10000;

      const nationData = {
        session_id: sessionId,
        nation: nationId,
        name: nationName,
        color: nationColor,
        capital: capitalId,
        gold: gold,
        rice: rice,
        data: {
          nation: nationId,
          name: nationName,
          color: nationColor,
          level: nationTemplate.level || 0,
          capital: capitalId,
          capital_name: nationTemplate.capital || '',
          type: nationTemplate.policy || 'neutral',
          infoText: nationTemplate.description || '',
          leader: 0,
          chief: {},
          bills: [],
          bill_history: [],
          diplomacy: {},
          environment: {},
          tech: nationTemplate.tech || 0,
          tech_level: 0,
          gold: gold,
          rice: rice,
          trust: 50,
          aux_valid_until: null,
          regions: cityNames,
          war: {},
          stat: {
            gen: 0,
            strength: 0,
            leadership: 0,
            intel: 0,
            city: cityNames.length,
            pop: 0,
            region_count: cityNames.length,
          }
        }
      };

      nationsToCreate.push(nationData);
      console.log(`[ScenarioReset] Prepared nation: ${nationName} (id=${nationId}, cities=${cityNames.length})`);
    }

    await nationRepository.bulkCreate(nationsToCreate);
    console.log(`[ScenarioReset] Created ${nationsToCreate.length} nations`);
  }

  /**
   * 장수 생성
   */
  private static async createGenerals(
    sessionId: string,
    scenarioId: string,
    scenarioMetadata: any
  ): Promise<void> {
    console.log(`[ScenarioReset] Creating generals`);

    const generalsData = scenarioMetadata.data?.scenario?.generals || [];
    if (generalsData.length === 0) {
      console.log('[ScenarioReset] No generals in scenario');
      return;
    }

    // 국가별 수도 찾기
    const nationCapitalMap = new Map<number, any>();
    const nations = await nationRepository.findByFilter({ session_id: sessionId });
    
    for (const nation of nations) {
      if (nation.capital && nation.capital > 0) {
        const city = await cityRepository.findOneByFilter({ 
          session_id: sessionId, 
          city: nation.capital
        });
        if (city) {
          nationCapitalMap.set(nation.nation, city);
        }
      }
    }

    const generalsToCreate = [];
    
    for (const genTemplate of generalsData) {
      const nationNo = genTemplate.nation || 0;
      const cityId = genTemplate.city || 0;
      
      // 배치 도시 결정
      let assignedCityId = 0;
      if (cityId > 0) {
        // 명시적으로 지정된 도시
        assignedCityId = cityId;
      } else if (nationNo > 0) {
        // 국가의 수도에 배치
        const capital = nationCapitalMap.get(nationNo);
        assignedCityId = capital?.city || 0;
      }

      const stats = genTemplate.stats || {};
      const generalData = {
        session_id: sessionId,
        no: genTemplate.no || genTemplate.id,
        name: genTemplate.name || '무명',
        owner: 'NPC',           // NPC 장수
        npc: 2,                 // AI NPC
        nation: nationNo,
        city: assignedCityId,
        belong: nationNo,
        turntime: new Date(),
        owner_name: null,
        gold: 1000,
        rice: 1000,
        train: 0,
        atmos: 0,
        turnidx: 0,
        belong_history: [],
        data: {
          no: genTemplate.no || genTemplate.id,
          name: genTemplate.name || '무명',
          nation: nationNo,
          city: assignedCityId,
          belong: nationNo,
          leadership: stats.leadership || 50,
          strength: stats.strength || 50,
          intel: stats.intel || 50,
          experience: 0,
          dedication: stats.charm || 50,
          age: genTemplate.age || 20,
          birth_year: genTemplate.age || 20,
          death_year: genTemplate.deathYear || 250,
          special: genTemplate.special || null,
          personality: genTemplate.personality || '평범',
          gold: 1000,
          rice: 1000,
          crew: 1000,
          crew_leadership: 0,
          crew_strength: 0,
          crew_intel: 0,
          horse: 0,
          horse_type: 0,
          atmos: 0,
          train: 0,
          injury: 0,
          general_type: nationNo === 0 ? 0 : 5,
          leadership_exp: 0,
          strength_exp: 0,
          intel_exp: 0
        }
      };

      generalsToCreate.push(generalData);
    }

    await generalRepository.bulkCreate(generalsToCreate);
    console.log(`[ScenarioReset] Created ${generalsToCreate.length} generals`);
  }
}
