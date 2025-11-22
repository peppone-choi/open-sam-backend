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
import { SessionSync } from '../../utils/session-sync';
import { cacheService } from '../../common/cache/cache.service';
import { scanSyncQueue, getSyncQueueItem, removeFromSyncQueue } from '../../common/cache/sync-queue.helper';
import { selectNpcTokenRepository } from '../../repositories/select-npc-token.repository';
import { selectPoolRepository } from '../../repositories/select-pool.repository';
import { unitStackRepository } from '../../repositories/unit-stack.repository';
import { generateInitialGarrisonsForCities } from '../helpers/garrison.helper';

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
   * @param options 추가 옵션 (turnterm 등)
   */
  static async resetScenario(sessionId: string, scenarioId: string, options?: { turnterm?: number }): Promise<void> {
    console.log(`[ScenarioReset] Start resetting session ${sessionId} with scenario ${scenarioId}`);
    console.log(`[ScenarioReset] Scenarios directory: ${this.SCENARIOS_DIR}`);

    // 1. 시나리오 ID 파싱 (예: "sangokushi/scenario-1010" -> dir=sangokushi, file=scenario_1010.json)
    let scenarioDir: string;
    let phpScenarioFile: string | null = null;
    
    if (scenarioId.includes('/')) {
      const parts = scenarioId.split('/');
      scenarioDir = parts[0];
      const fileId = parts[1]; // scenario-1010
      phpScenarioFile = fileId.replace('-', '_') + '.json'; // scenario_1010.json
    } else {
      scenarioDir = scenarioId;
    }
    
    // 2. 시나리오 메타데이터 로드
    let scenarioMetadata: any = {};
    
    if (phpScenarioFile) {
      // PHP 시나리오 파일 직접 로드
      const phpScenarioPath = path.join(this.SCENARIOS_DIR, scenarioDir, phpScenarioFile);
      console.log(`[ScenarioReset] Loading PHP scenario: ${phpScenarioPath}`);
      
      // 파일 존재 확인
      try {
        await fs.access(phpScenarioPath);
        scenarioMetadata = await this.loadScenarioFile(phpScenarioPath);
      } catch (err) {
        throw new Error(`PHP scenario file not found: ${phpScenarioPath}`);
      }
    } else {
      // 기존 scenario.json 방식
      const scenarioPath = path.join(this.SCENARIOS_DIR, scenarioDir, 'scenario.json');
      console.log(`[ScenarioReset] Loading scenario: ${scenarioPath}`);
      
      // scenario.json 존재 확인
      try {
        await fs.access(scenarioPath);
        scenarioMetadata = await this.loadScenarioFile(scenarioPath);
      } catch (err) {
        // scenario.json이 없으면 PHP 시나리오 파일 찾기
        const phpScenarioFiles = await fs.readdir(path.join(this.SCENARIOS_DIR, scenarioDir)).catch(() => []);
        const foundPhpFile = phpScenarioFiles.find(f => f.startsWith('scenario_') && f.endsWith('.json'));
        
        if (foundPhpFile) {
          const phpScenarioPath = path.join(this.SCENARIOS_DIR, scenarioDir, foundPhpFile);
          console.log(`[ScenarioReset] Found PHP scenario file: ${phpScenarioPath}`);
          scenarioMetadata = await this.loadScenarioFile(phpScenarioPath);
        } else {
          throw new Error(`No scenario file found in directory: ${scenarioDir}`);
        }
      }
    }

    // 2. 세션 찾기
    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session) {
      throw new Error(`세션을 찾을 수 없습니다.: ${sessionId}`);
    }

    // 3. 기존 데이터 삭제
    await this.clearSessionData(sessionId);

    // 3-1. 이 세션과 관련된 sync-queue 항목 제거 (이전 상태 잔존 방지)
    await this.clearSyncQueueForSession(sessionId);
 
    // 4. 세션 초기화
    await this.initializeSession(session, scenarioMetadata, options);
 
    // 5. 도시 생성 (기본 cities.json 로드)
    const cities = await this.initializeCities(sessionId, scenarioId, scenarioMetadata);
    await this.initializeGarrisons(sessionId, scenarioId, cities || []);

    // 6. 국가 생성 (시나리오의 nations 사용)
    await this.createNations(sessionId, scenarioId, scenarioMetadata);

    // 7. 장수 생성 (시나리오의 generals 사용)
    await this.createGenerals(sessionId, scenarioId, scenarioMetadata);

    console.log(`[ScenarioReset] Successfully reset session ${sessionId}`);

    // 초기화 이후 해당 세션 관련 캐시 무효화 (세션/도시/국가/장수 목록 등)
    try {
      await cacheService.invalidate(
        [`session:byId:${sessionId}`],
        ['sessions:*', 'cities:*', 'nations:*', 'generals:*']
      );
      console.log(`[ScenarioReset] Cache invalidated for session ${sessionId}`);
    } catch (err: any) {
      console.warn(`[ScenarioReset] Failed to invalidate cache for session ${sessionId}:`, err?.message || err);
    }
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
      worldHistoryResult,
      selectNpcTokenResult,
      selectPoolResult,
      unitStackResult
    ] = await Promise.all([
      commandRepository.deleteBySession(sessionId),
      messageRepository.deleteBySession(sessionId),
      battleRepository.deleteBySession(sessionId),
      eventRepository.deleteBySession(sessionId),
      troopRepository.deleteBySession(sessionId),
      worldHistoryRepository.deleteBySession(sessionId),
      selectNpcTokenRepository.deleteBySession(sessionId),
      selectPoolRepository.deleteBySession(sessionId),
      unitStackRepository.deleteBySession(sessionId)
    ]);
 
     console.log(`[ScenarioReset] Deleted ${commandResult.deletedCount} commands`);
    console.log(`[ScenarioReset] Deleted ${messageResult.deletedCount} messages`);
     console.log(`[ScenarioReset] Deleted ${battleResult.deletedCount} battles`);
     console.log(`[ScenarioReset] Deleted ${eventResult.deletedCount} events`);
     console.log(`[ScenarioReset] Deleted ${troopResult.deletedCount} troops`);
    console.log(`[ScenarioReset] Deleted ${worldHistoryResult.deletedCount} world history records`);
    console.log(`[ScenarioReset] Deleted ${selectNpcTokenResult.deletedCount} select_npc_tokens`);
    console.log(`[ScenarioReset] Deleted ${selectPoolResult.deletedCount} select_pools`);
    console.log(`[ScenarioReset] Deleted ${unitStackResult.deletedCount} unit stacks`);
   }
 
   /**
   * 세션 초기화
   */
  private static async initializeSession(session: any, scenarioMetadata: any, options?: { turnterm?: number }): Promise<void> {
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
    
    // SessionSync 유틸리티로 모든 위치에 동기화
    SessionSync.syncStartyear(session, startYear);
    SessionSync.syncYear(session, startYear);
    SessionSync.syncMonth(session, 1);
    
    console.log(`[ScenarioReset] Set year to ${startYear}, month to 1`);

    // 게임 시작 시간 (현재 시간 기준)
    // starttime은 게임을 시작한 "현실 시간"이며, 이를 기준으로 경과 턴을 계산함
    // turnDate()는 (현재시간 - starttime) / turnterm으로 경과 턴을 계산하고,
    // 경과 턴 수를 게임 내 월/년으로 변환함
    const now = new Date();
    SessionSync.syncStarttime(session, now);
    
    // 턴 시간 (현재 시간 + 1분 후)
    const nextTurn = new Date(now.getTime() + 60 * 1000);
    SessionSync.syncTurntime(session, nextTurn);
    
    // 턴 텀 설정 - 우선순위: options > scenarioMetadata > 기본값 60
    const turnterm = options?.turnterm || scenarioMetadata.gameSettings?.turnterm || scenarioMetadata.turnterm || 60;
    SessionSync.syncTurnterm(session, turnterm);
    
    console.log(`[ScenarioReset] Set starttime to ${now.toISOString()} (${startYear}년 1월 1일)`);
    console.log(`[ScenarioReset] Set turntime to ${nextTurn.toISOString()} (1 minute from now)`);
    console.log(`[ScenarioReset] Set turnterm to ${turnterm} minutes (from: ${options?.turnterm ? 'options' : 'scenario metadata'})`);

    // 최대 장수 설정
    const maxGeneral = scenarioMetadata.gameSettings?.defaultMaxGeneral || 
                      scenarioMetadata.const?.defaultMaxGeneral || 
                      600;
    session.data.game_env.maxgeneral = maxGeneral;
    console.log(`[ScenarioReset] Set maxgeneral to ${maxGeneral}`);

    // 임관 모드 설정
    session.data.game_env.join_mode = scenarioMetadata.gameSettings?.join_mode || 'full';
    console.log(`[ScenarioReset] Set join_mode to ${session.data.game_env.join_mode}`);

    // 게임 기본 설정 (PHP game_env와 동일)
    session.data.game_env.develcost = scenarioMetadata.gameSettings?.develcost || 100;  // 내정/이동 비용
    session.data.game_env.killturn = scenarioMetadata.gameSettings?.killturn || 30;     // 삭턴
    session.data.game_env.scenario = scenarioMetadata.gameSettings?.scenario || 0;      // 시나리오 번호
    session.data.game_env.allow_rebellion = scenarioMetadata.gameSettings?.allow_rebellion ?? true; // 모반 허용
    console.log(`[ScenarioReset] Set game_env: develcost=${session.data.game_env.develcost}, killturn=${session.data.game_env.killturn}`);

    // 서버 상태를 폐쇄(준비중)로 설정
    // 시나리오 리셋 후에는 관리자가 수동으로 서버를 오픈해야 함
    session.status = 'preparing';
    SessionSync.syncIsunited(session, 2); // 2 = 폐쇄
    
    console.log(`[ScenarioReset] Set status to 'preparing' (폐쇄), isunited: 2`);

    session.markModified('data.game_env');
    session.markModified('data');

    await sessionRepository.saveDocument(session);
    
    // 저장 후 실제 DB 값 확인
    const savedSession = await sessionRepository.findBySessionId(session.session_id);
    const savedData = savedSession?.data || {};
    const savedGameEnv = savedData.game_env || {};
    
    console.log(`[ScenarioReset] 📊 DB 저장 확인:`);
    console.log(`   - data.startyear: ${savedData.startyear}`);
    console.log(`   - data.year: ${savedData.year}`);
    console.log(`   - data.month: ${savedData.month}`);
    console.log(`   - data.starttime: ${savedData.starttime}`);
    console.log(`   - data.turntime: ${savedData.turntime}`);
    console.log(`   - data.isunited: ${savedData.isunited}`);
    console.log(`   - game_env.startyear: ${savedGameEnv.startyear}`);
    console.log(`   - game_env.year: ${savedGameEnv.year}`);
    console.log(`   - game_env.month: ${savedGameEnv.month}`);
    console.log(`   - game_env.starttime: ${savedGameEnv.starttime}`);
    console.log(`   - game_env.isunited: ${savedGameEnv.isunited}`);
   }
 
   /**
    * 해당 세션에 대한 sync-queue 항목 제거
    */
   private static async clearSyncQueueForSession(sessionId: string): Promise<void> {
     try {
       console.log(`[ScenarioReset] Clearing sync queue for session ${sessionId}`);
       const items = await scanSyncQueue();
       const tasks = items.map(async (item) => {
         const queueData = await getSyncQueueItem(item.key);
         const data = queueData?.data;
         if (data?.session_id === sessionId) {
           await removeFromSyncQueue(item.key);
         }
       });
       await Promise.all(tasks);
     } catch (err: any) {
       console.warn(`[ScenarioReset] Failed to clear sync queue for session ${sessionId}:`, err?.message || err);
     }
   }
 
   /**
    * 도시 초기화
    */
  private static async initializeCities(
    sessionId: string,
    scenarioId: string,
    scenarioMetadata: any
  ): Promise<any[]> {
    console.log(`[ScenarioReset] Initializing cities`);

    // cities 컬렉션 로드
    // PHP 시나리오는 scenario.json이 없으므로 기본 cities.json 사용
    let cities;
    try {
      cities = await this.loadScenarioDataFile(scenarioId, 'cities');
    } catch (err) {
      // PHP 시나리오인 경우 기본 cities.json 사용
      const scenarioDir = scenarioId.includes('/') ? scenarioId.split('/')[0] : scenarioId;
      const citiesPath = path.join(this.SCENARIOS_DIR, scenarioDir, 'data', 'cities.json');
      console.log(`[ScenarioReset] Loading cities from: ${citiesPath}`);
      const citiesData = await this.loadScenarioFile(citiesPath);
      // cities.json은 {cities: [...]} 구조
      cities = citiesData.cities || citiesData;
    }
    console.log(`[ScenarioReset] Found ${cities.length} cities`);

    // 시나리오에 정의된 국가별 도시 소유권 맵 생성
    const cityOwnershipMap = new Map<string, number>(); // cityName -> nationId

    // PHP JSON 구조: nation (단수형, 배열 형식)
    const nationsData = scenarioMetadata.nation || scenarioMetadata.data?.scenario?.nations || [];
    let nationIdCounter = 1;
    
    for (const nationTemplate of nationsData) {
      let nationId, nationName, cityNames;
      
      if (Array.isArray(nationTemplate)) {
        // PHP 배열 포맷: [name, color, gold, rice, description, ???, policy, ???, cities]
        [nationName, , , , , , , , cityNames] = nationTemplate;
        nationId = nationIdCounter++;
        cityNames = cityNames || [];
      } else {
        nationId = nationTemplate.id || nationIdCounter++;
        nationName = nationTemplate.name;
        cityNames = nationTemplate.cities || [];
      }
      
      if (cityNames.length > 0) {
        console.log(`[ScenarioReset] Mapping ${cityNames.length} cities to nation ${nationId} (${nationName})`);
        for (const cityName of cityNames) {
          cityOwnershipMap.set(cityName, nationId);
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

      // PHP CityConstBase.php와 동일하게 모든 값에 100을 곱함
      const popMax = (initialState.population || 100) * 100;
      const agriMax = (initialState.agriculture || 100) * 100;
      const commMax = (initialState.commerce || 100) * 100;
      const secuMax = (initialState.security || 50) * 100;
      const defMax = (initialState.defense || 100) * 100;
      const wallMax = (initialState.wall || 100) * 100;
      
      // 레벨별 초기값 (scenario.json cityLevels.buildCost 기준)
      // 0:무(황무지), 1:향, 2:수, 3:진, 4:관, 5:이, 6:소, 7:중, 8:대, 9:특, 10:경
      const cityLevel = cityTemplate.levelId || 2;
      const levelInitValues: Record<number, any> = {
        0: { pop: 10, agri: 0, comm: 0, secu: 10, def: 10, wall: 10 },               // 무 (황무지, 거의 무인)
        1: { pop: 1000, agri: 50, comm: 50, secu: 50, def: 100, wall: 100 },         // 향
        2: { pop: 5000, agri: 100, comm: 100, secu: 100, def: 500, wall: 500 },      // 수
        3: { pop: 5000, agri: 100, comm: 100, secu: 100, def: 500, wall: 500 },      // 진
        4: { pop: 10000, agri: 100, comm: 100, secu: 100, def: 1000, wall: 1000 },   // 관
        5: { pop: 50000, agri: 1000, comm: 1000, secu: 1000, def: 1000, wall: 1000 }, // 이
        6: { pop: 100000, agri: 1000, comm: 1000, secu: 1000, def: 2000, wall: 2000 }, // 소
        7: { pop: 100000, agri: 1000, comm: 1000, secu: 1000, def: 3000, wall: 3000 }, // 중
        8: { pop: 150000, agri: 1000, comm: 1000, secu: 1000, def: 4000, wall: 4000 }, // 대
        9: { pop: 150000, agri: 1000, comm: 1000, secu: 1000, def: 5000, wall: 5000 }, // 특
        10: { pop: 200000, agri: 1500, comm: 1500, secu: 1500, def: 7000, wall: 7000 } // 경
      };
      const initValues = levelInitValues[cityLevel] || levelInitValues[2];
      
      const cityData = {
        session_id: sessionId,
        city: cityTemplate.id,
        name: cityName,
        nation: nationId,
        region: cityTemplate.regionId || 1,
        x: position.x || 0,
        y: position.y || 0,
        level: cityLevel,
        pop: initValues.pop,
        pop_max: popMax,
        agri: initValues.agri,
        agri_max: agriMax,
        comm: initValues.comm,
        comm_max: commMax,
        secu: initValues.secu,
        secu_max: secuMax,
        def: initValues.def,
        def_max: defMax,
        wall: initValues.wall,
        wall_max: wallMax,
        trade: 100,
        supply: 1,
        state: 0,
        trust: 50,
        data: {
          name: cityName,
          level: cityLevel,
          region: cityTemplate.regionId || 1,
          pop: initValues.pop,
          agri: initValues.agri,
          comm: initValues.comm,
          secu: initValues.secu,
          def: initValues.def,
          wall: initValues.wall,
          trust: 50,
          trade: 100
        }
      };

      citiesToCreate.push(cityData);
    }

    await cityRepository.bulkCreate(citiesToCreate);
    console.log(`[ScenarioReset] Created ${citiesToCreate.length} cities`);
    return cities;
  }

  private static async initializeGarrisons(
    sessionId: string,
    scenarioId: string,
    cities: any[]
  ): Promise<void> {
    const entries = generateInitialGarrisonsForCities(scenarioId, cities);
    if (!entries.length) {
      console.log('[ScenarioReset] Garrison data is empty, skipping');
      return;
    }

    let totalStacks = 0;
    for (const entry of entries) {
      await unitStackRepository.bulkCreate(sessionId, 'city', entry.cityId, entry.stacks);
      totalStacks += entry.stacks.length;
    }

    console.log(`[ScenarioReset] Created ${totalStacks} garrison stacks across ${entries.length} cities`);
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

    // PHP JSON 구조: nation (단수형, 배열 형식)
    const nationsData = scenarioMetadata.nation || scenarioMetadata.data?.scenario?.nations || [];
    console.log(`[ScenarioReset] Found ${nationsData.length} nations in scenario`);
    
    if (nationsData.length === 0) {
      console.warn('[ScenarioReset] No nations in scenario');
      return;
    }

    const nationsToCreate = [];
    let nationIdCounter = 1;

    for (const nationTemplate of nationsData) {
      // PHP JSON 포맷: [name, color, gold, rice, description, tech, policy, nationLevel, cities]
      let nationId, nationName, nationColor, gold, rice, description, tech, policy, nationLevel, cityNames;
      
      if (Array.isArray(nationTemplate)) {
        // PHP 배열 포맷
        [nationName, nationColor, gold, rice, description, tech, policy, nationLevel, cityNames] = nationTemplate;
        nationId = nationIdCounter++;
        cityNames = cityNames || [];
        tech = tech || 0;
        nationLevel = nationLevel || 2; // 기본값 2 (일반 국가)
      } else {
        // 객체 포맷 (기존 호환)
        nationId = nationTemplate.id || nationIdCounter++;
        nationName = nationTemplate.name || '무명';
        nationColor = nationTemplate.color || '#808080';
        cityNames = nationTemplate.cities || [];
        gold = nationTemplate.treasury?.gold || 10000;
        rice = nationTemplate.treasury?.rice || 10000;
        description = nationTemplate.description || '';
        tech = nationTemplate.tech || 0;
        policy = nationTemplate.policy || 'neutral';
        nationLevel = nationTemplate.level || 2;
      }
      
      console.log(`[ScenarioReset] Creating nation ${nationId}: ${nationName}, color: ${nationColor}, cities: ${cityNames.length}`);

      // 수도 결정: 첫 번째 도시를 수도로
      let capitalId = 0;
      if (cityNames.length > 0) {
        const firstCity = await cityRepository.findOneByFilter({
          session_id: sessionId,
          name: cityNames[0]
        });
        if (firstCity) {
          capitalId = firstCity.city;
          console.log(`  - ${nationName} 수도: ${cityNames[0]} (ID: ${capitalId})`);
        }
      }

      const nationData = {
        session_id: sessionId,
        nation: nationId,
        name: nationName,
        color: nationColor,
        capital: capitalId,
        gold: gold || 10000,
        rice: rice || 10000,
        level: nationLevel || 2, // 국가 크기 (1=소형, 2=일반, 3=대형, 4=제국 등)
        data: {
          nation: nationId,
          name: nationName,
          color: nationColor,
          level: nationLevel || 2, // 국가 크기
          capital: capitalId,
          capital_name: cityNames[0] || '',
          type: policy || 'neutral', // 국가 타입 (병가, 법가, 유가 등)
          infoText: description || '',
          leader: 0, // 지도자 ID (장수 생성 후 설정됨)
          chief: {},
          bills: [],
          gennum: 0,
          bill_history: [],
          diplomacy: {},
          environment: {},
          tech: tech || 0,
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

    // KVStorage에 scout_msg 저장 (임관 권유문)
    const { kvStorageRepository } = await import('../../repositories/kvstorage.repository');
    for (const nationData of nationsToCreate) {
      const nationId = nationData.nation;
      const scoutMsg = nationData.data.infoText || '';
      
      if (scoutMsg) {
        await kvStorageRepository.upsert(
          { 
            session_id: sessionId, 
            storage_id: `nation_env:${nationId}:scout_msg` 
          },
          {
            session_id: sessionId,
            storage_id: `nation_env:${nationId}:scout_msg`,
            value: scoutMsg,
            data: { value: scoutMsg }
          }
        );
        console.log(`[ScenarioReset] Saved scout_msg for nation ${nationId} (${nationData.name})`);
      }
    }
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

    // PHP JSON 구조: general, general_ex, general_neutral
    const generalsDataMain = scenarioMetadata.general || scenarioMetadata.data?.scenario?.general || [];
    const generalsDataEx = scenarioMetadata.general_ex || scenarioMetadata.data?.scenario?.general_ex || [];
    const generalsDataNeutral = scenarioMetadata.general_neutral || scenarioMetadata.data?.scenario?.general_neutral || [];
    
    console.log(`[ScenarioReset] Found generals - main: ${generalsDataMain.length}, ex: ${generalsDataEx.length}, neutral: ${generalsDataNeutral.length}`);
    
    // 모든 장수 데이터를 NPC 타입과 함께 저장
    const allGeneralsData: Array<{data: any, npcType: number}> = [
      ...generalsDataMain.map(g => ({ data: g, npcType: 2 })),      // general: npcType = 2
      ...generalsDataEx.map(g => ({ data: g, npcType: 2 })),        // general_ex: npcType = 2
      ...generalsDataNeutral.map(g => ({ data: g, npcType: 6 }))    // general_neutral: npcType = 6
    ];
    
    if (allGeneralsData.length === 0) {
      console.log('[ScenarioReset] No generals in scenario');
      return;
    }

    // 세션에서 turnterm 가져오기
    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session) {
      throw new Error(`세션을 찾을 수 없습니다.: ${sessionId}`);
    }
    const turnterm = session.data?.game_env?.turnterm || 60;
    const now = new Date();

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
    let generalIdCounter = 1; // 장수 ID 자동 생성용
    
    for (const genEntry of allGeneralsData) {
      const genTemplate = genEntry.data;
      const npcTypeFromCategory = genEntry.npcType; // general 구분에 따른 NPC 타입
      // PHP JSON 포맷 (최대 14개 요소): 
      // [affinity, name, picturePath, nationName, locatedCity, 
      //  leadership, strength, intel, officerLevel, birth, death, ego, char, text]
      let affinity, name, picturePath, nationName, locatedCity, leadership, strength, intel, officerLevel, birthYear, deathYear, personality, special, text;
      let nationNo, id, npc;
      
      if (Array.isArray(genTemplate)) {
        // PHP 배열 포맷
        affinity = genTemplate[0];               // 친화도/소속 (사용 안 함)
        name = genTemplate[1];                   // 이름
        picturePath = genTemplate[2];            // 초상화 ID
        nationName = genTemplate[3];             // 국가 이름 또는 번호
        locatedCity = genTemplate[4];            // 배치 도시 (null)
        leadership = genTemplate[5] || 50;       // 통솔
        strength = genTemplate[6] || 50;         // 무력
        intel = genTemplate[7] || 50;            // 지력
        officerLevel = genTemplate[8];           // 관직 레벨 (undefined 허용, 나중에 처리)
        birthYear = genTemplate[9];              // 출생년
        deathYear = genTemplate[10];             // 사망년
        personality = genTemplate[11];           // 성격 (ego)
        special = genTemplate[12];               // 특기 (char)
        text = genTemplate[13];                  // 메시지
        
        // nationName이 숫자면 그대로, 아니면 국가 이름에서 ID 찾기
        if (typeof nationName === 'number') {
          nationNo = nationName;
        } else if (typeof nationName === 'string') {
          // 국가 이름으로 ID 찾기 (TODO: 나중에 구현)
          nationNo = parseInt(nationName) || 0;
        } else {
          nationNo = 0; // 재야
        }
        
        // 999는 재야
        if (nationNo === 999) {
          nationNo = 0;
        }
        
        // ID는 picturePath 사용
        id = picturePath || generalIdCounter;
        
        // NPC 타입은 배열 구분으로 결정 (나중에 설정)
        
        // nationNo가 999면 재야로 처리
        if (nationNo === 999) {
          nationNo = 0;
        }
      } else {
        // 객체 포맷 (기존 호환)
        nationNo = genTemplate.nation || 0;
        name = genTemplate.name || '무명';
        id = genTemplate.no || genTemplate.id;
        npc = genTemplate.npc || 2;
        leadership = genTemplate.stats?.leadership || genTemplate.leadership || 50;
        strength = genTemplate.stats?.strength || genTemplate.strength || 50;
        intel = genTemplate.stats?.intel || genTemplate.intel || 50;
        officerLevel = genTemplate.officerLevel;  // undefined 허용, 나중에 처리
        birthYear = genTemplate.birthYear || 20;
        deathYear = genTemplate.deathYear || 250;
        personality = genTemplate.personality || '평범';
        special = genTemplate.special || null;
      }
      
      // 정치와 매력 계산 (PHP에는 없으므로 통솔/무력/지력에서 유추)
      // 정치 = (통솔 + 지력) / 2
      // 매력 = (통솔 + 지력) / 2.5 (정치보다 약간 낮게)
      const politics = Math.round((leadership + intel) / 2);
      const charm = Math.round((leadership + intel) / 2.5);
      
      // birthYear에서 age 계산
      const startYear = scenarioMetadata.startYear || 181;
      const age = startYear - birthYear;
      
      // ✅ 시나리오 시작 년도에 아직 태어나지 않은 장수는 스킵
      if (birthYear > startYear) {
        console.log(`[ScenarioReset] Skipping ${name} - not born yet (birth: ${birthYear}, scenario: ${startYear})`);
        continue;
      }
      
      // ✅ 시나리오 시작 년도에 이미 죽은 장수는 스킵
      if (deathYear && deathYear < startYear) {
        console.log(`[ScenarioReset] Skipping ${name} - already dead (death: ${deathYear}, scenario: ${startYear})`);
        continue;
      }
      
      // ✅ 나이가 음수이거나 너무 많으면 스킵 (데이터 오류)
      if (age < 0 || age > 100) {
        console.log(`[ScenarioReset] Skipping ${name} - invalid age ${age} (birth: ${birthYear}, scenario: ${startYear})`);
        continue;
      }
      
      // NPC 타입은 general/general_ex/general_neutral 구분으로 결정
      npc = npcTypeFromCategory;
      
      // ✅ officer_level 처리: 재야는 0, 국가 소속은 최소 1
      if (nationNo === 0 || nationNo === 999) {
        // 재야는 무조건 0
        officerLevel = 0;
      } else {
        // 국가 소속: 시나리오 값이 있으면 사용, 없거나 0이면 1로 설정
        if (officerLevel === undefined || officerLevel === null || officerLevel === 0) {
          officerLevel = 1; // 기본 관직
        }
        // 시나리오에 명시적으로 관직이 있으면 그대로 사용
      }
      
      const cityId = 0; // PHP에서는 city가 배열에 없음
      
      // 배치 도시 결정
      let assignedCityId = 0;
      if (nationNo > 0) {
        // 국가의 수도에 배치
        const capital = nationCapitalMap.get(nationNo);
        assignedCityId = capital?.city || 0;
        
        // 국가 소속인데 도시가 없으면 이 장수는 스킵 (시나리오에 등장하지 않음)
        if (assignedCityId === 0) {
          console.log(`[ScenarioReset] Skipping general ${name} (nation ${nationNo}) - no capital city`);
          continue;
        }
      }
      
      // NPC마다 다른 turntime 부여 (turnterm 내에서 랜덤 분산)
      const rng = Math.abs((id || 0) * 1103515245 + 12345);
      const randomOffsetSeconds = rng % (turnterm * 60);
      const npcTurntime = new Date(now.getTime() + randomOffsetSeconds * 1000);
      
      // ID 검증 및 자동 증가
      if (!id || id === null || id === undefined) {
        id = generalIdCounter;
      }
      generalIdCounter = Math.max(generalIdCounter, id) + 1; // 다음 ID는 현재 최대값 + 1
      
      // ✅ PHP와 동일한 최종 검증: DB 삽입 직전 officer_level 재확인
      // PHP: if(!$officerLevel || $isNewGeneral) { $officerLevel = $nationID?1:0; }
      if (!officerLevel) {
        officerLevel = nationNo > 0 ? 1 : 0;
      }
      
      const generalData = {
        session_id: sessionId,
        no: id,
        name: name,
        owner: 'NPC',
        npc: npc || 2,
        nation: nationNo,
        city: assignedCityId,
        belong: nationNo,
        turntime: npcTurntime,
        owner_name: null,
        gold: 1000,
        rice: 1000,
        crew: 0,  // 초기 병사 0
        train: 0,
        atmos: 50,
        turnidx: 0,
        belong_history: [],
        officer_level: officerLevel,  // ✅ 최상위 필드에도 저장
        permission: 0,
        data: {
          no: id,
          name: name,
          nation: nationNo,
          city: assignedCityId,
          belong: nationNo,
          leadership: leadership,
          strength: strength,
          intel: intel,
          politics: politics,
          charm: charm,
          experience: 0,
          dedication: 50,
          age: age,
          birth_year: birthYear,
          death_year: deathYear,
          special: special,
          personality: personality,
          gold: 1000,
          rice: 1000,
          crew: 0,  // 초기 병사 수 0 (징병/모병 필요)
          crew_leadership: 0,
          crew_strength: 0,
          crew_intel: 0,
          horse: 0,
          horse_type: 0,
          atmos: 50,
          train: 0,
          injury: 0,
          general_type: nationNo === 0 ? 0 : 5,
          leadership_exp: 0,
          strength_exp: 0,
          intel_exp: 0,
          officer_level: officerLevel,
          permission: 0,
          turntime: npcTurntime.toISOString()
        }
      };

      generalsToCreate.push(generalData);
    }

    await generalRepository.bulkCreate(generalsToCreate);
    console.log(`[ScenarioReset] Created ${generalsToCreate.length} generals`);
    
    // ✅ 생성된 장수 검증: nation > 0인데 officer_level = 0인 경우 경고
    const invalidGenerals = generalsToCreate.filter(g => g.nation > 0 && g.officer_level === 0);
    if (invalidGenerals.length > 0) {
      console.warn(`[ScenarioReset] ⚠️ WARNING: ${invalidGenerals.length} generals with nation > 0 but officer_level = 0`);
      invalidGenerals.forEach(g => {
        console.warn(`  - ${g.name} (no=${g.no}, nation=${g.nation}, officer_level=${g.officer_level})`);
      });
    }
    
    // 국가별 gennum 업데이트 & 첫 번째 장수를 군주로 설정
    const nationGenCount = new Map<number, number>();
    const nationFirstGeneral = new Map<number, number>(); // 국가별 첫 번째 장수 ID
    
    for (const general of generalsToCreate) {
      const nationId = general.nation;
      if (nationId > 0) {
        nationGenCount.set(nationId, (nationGenCount.get(nationId) || 0) + 1);
        // 첫 번째 장수 기록
        if (!nationFirstGeneral.has(nationId)) {
          nationFirstGeneral.set(nationId, general.no);
        }
      }
    }
    
    // 각 국가의 gennum 업데이트
    for (const [nationId, count] of nationGenCount.entries()) {
      await nationRepository.updateOneByFilter(
        { session_id: sessionId, 'data.nation': nationId },
        { 'data.gennum': count, gennum: count }
      );
      console.log(`[ScenarioReset] Updated nation ${nationId} gennum to ${count}`);
    }
    
    // 각 국가의 첫 번째 장수를 군주로 설정 (officer_level = 12) + 국가의 leader 설정
    for (const [nationId, generalNo] of nationFirstGeneral.entries()) {
      await generalRepository.updateBySessionAndNo(sessionId, generalNo, {
        'data.officer_level': 12,
        'data.npc': 1, // 군주는 NPC 타입 1
        officer_level: 12,
        npc: 1
      });
      console.log(`[ScenarioReset] Set general ${generalNo} as ruler of nation ${nationId}`);
      
      // 국가의 leader 필드 업데이트
      await nationRepository.updateOneByFilter(
        { session_id: sessionId, 'data.nation': nationId },
        { 'data.leader': generalNo, leader: generalNo }
      );
      console.log(`[ScenarioReset] Set nation ${nationId} leader to general ${generalNo}`);
    }
  }
}
