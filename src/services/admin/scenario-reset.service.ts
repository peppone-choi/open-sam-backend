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
import { invalidateCache } from '../../common/cache/model-cache.helper';
import { scanSyncQueue, getSyncQueueItem, removeFromSyncQueue } from '../../common/cache/sync-queue.helper';
import { selectNpcTokenRepository } from '../../repositories/select-npc-token.repository';
import { selectPoolRepository } from '../../repositories/select-pool.repository';
// 스택 시스템 제거됨
import { diplomacyRepository } from '../../repositories/diplomacy.repository';
import { generateInitialGarrisonsForCities } from '../helpers/garrison.helper';
import { NgHistory } from '../../models/ng_history.model';

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

    // 8. 외교 관계 생성 (시나리오의 diplomacy 사용)
    await this.createDiplomacy(sessionId, scenarioMetadata);

    // 9. 초기 역사 로그 생성 (시나리오의 history 사용)
    await this.createInitialHistory(sessionId, scenarioMetadata);

    // 10. 초기 ng_history 생성 (연감 시스템용)
    await this.createInitialNgHistory(sessionId, scenarioId, scenarioMetadata);

    // 11. 초기 국력 계산
    await this.initializeNationPower(sessionId);

    console.log(`[ScenarioReset] Successfully reset session ${sessionId}`);

    // 초기화 이후 해당 세션 관련 캐시 무효화 (세션/도시/국가/장수 목록 등)
    try {
      await Promise.all([
        invalidateCache('session', sessionId),
        invalidateCache('city', sessionId),
        invalidateCache('nation', sessionId),
        invalidateCache('general', sessionId)
      ]);
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
      diplomacyResult
    ] = await Promise.all([
      commandRepository.deleteBySession(sessionId),
      messageRepository.deleteBySession(sessionId),
      battleRepository.deleteBySession(sessionId),
      eventRepository.deleteBySession(sessionId),
      troopRepository.deleteBySession(sessionId),
      worldHistoryRepository.deleteBySession(sessionId),
      selectNpcTokenRepository.deleteBySession(sessionId),
      selectPoolRepository.deleteBySession(sessionId),
      diplomacyRepository.deleteBySession(sessionId)
    ]);
 
    console.log(`[ScenarioReset] Deleted ${commandResult.deletedCount} commands`);
    console.log(`[ScenarioReset] Deleted ${messageResult.deletedCount} messages`);
    console.log(`[ScenarioReset] Deleted ${battleResult.deletedCount} battles`);
    console.log(`[ScenarioReset] Deleted ${eventResult.deletedCount} events`);
    console.log(`[ScenarioReset] Deleted ${troopResult.deletedCount} troops`);
    console.log(`[ScenarioReset] Deleted ${worldHistoryResult.deletedCount} world history records`);
    console.log(`[ScenarioReset] Deleted ${selectNpcTokenResult.deletedCount} select_npc_tokens`);
    console.log(`[ScenarioReset] Deleted ${selectPoolResult.deletedCount} select_pools`);
    console.log(`[ScenarioReset] Deleted ${diplomacyResult.deletedCount} diplomacy records`);

    // 4. ng_history 삭제 (연감 데이터)
    // @ts-ignore - Mongoose model type issue
    const ngHistoryResult = await NgHistory.deleteMany({ session_id: sessionId });
    console.log(`[ScenarioReset] Deleted ${ngHistoryResult.deletedCount} ng_history records`);

    // 5. rank_data 삭제
    const { RankData } = await import('../../models/rank_data.model');
    const rankDataResult = await RankData.deleteMany({ session_id: sessionId });
    console.log(`[ScenarioReset] Deleted ${rankDataResult.deletedCount} rank_data records`);
   }
 
   /**
   * 세션 초기화
   */
  private static async initializeSession(session: any, scenarioMetadata: any, options?: { turnterm?: number }): Promise<void> {
    console.log(`[ScenarioReset] Initializing session with scenario: ${scenarioMetadata.name}`);

    session.data = session.data || {};
    session.data.game_env = session.data.game_env || {};

    // 시나리오 정보 설정
    const scenarioName = scenarioMetadata.name || scenarioMetadata.title || '';
    session.scenario_name = scenarioName;
    session.data.game_env.scenario = scenarioName;
    
    // 시나리오 표시 이름 설정 (게임 화면에 표시됨)
    session.data.scenarioText = scenarioName;
    session.data.game_env.scenarioText = scenarioName;
    
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

    // ✅ PHP ResetHelper.php와 동일한 game_env 설정
    const killturn = Math.floor(4800 / turnterm); // PHP: $killturn = 4800 / $turnterm
    const develcost = 20; // PHP: ($year - $startyear + 10) * 2, 초기값은 20
    
    // PHP $env 배열과 동일한 모든 값 설정
    session.data.game_env.scenario = scenarioMetadata.gameSettings?.scenario || 0;           // 시나리오 번호
    session.data.game_env.scenario_text = scenarioName;                                       // 시나리오 텍스트
    session.data.game_env.icon_path = scenarioMetadata.iconPath || '.';                       // 아이콘 경로
    session.data.game_env.init_year = startYear;                                              // ✅ 초기 년도
    session.data.game_env.init_month = 1;                                                     // ✅ 초기 월
    session.data.game_env.map_theme = scenarioMetadata.gameConf?.mapName || 'che';            // ✅ 맵 테마
    session.data.game_env.season = 1;                                                         // ✅ 시즌 인덱스
    session.data.game_env.msg = '공지사항';                                                    // ✅ 공지사항
    session.data.game_env.maxnation = scenarioMetadata.const?.defaultMaxNation || 12;         // ✅ 최대 국가 수
    session.data.game_env.refreshLimit = 30000;                                               // ✅ 새로고침 제한
    session.data.game_env.develcost = scenarioMetadata.gameSettings?.develcost || develcost;  // 내정/이동 비용
    session.data.game_env.opentime = now.toISOString();                                       // ✅ 오픈 시간
    session.data.game_env.killturn = scenarioMetadata.gameSettings?.killturn || killturn;     // 삭턴
    session.data.game_env.genius = scenarioMetadata.const?.defaultMaxGenius || 100;           // ✅ 천재 제한
    session.data.game_env.show_img_level = scenarioMetadata.gameSettings?.show_img_level ?? 3; // ✅ 이미지 레벨
    session.data.game_env.join_mode = scenarioMetadata.gameSettings?.join_mode || 'full';      // 임관 모드
    session.data.game_env.block_general_create = scenarioMetadata.gameSettings?.block_general_create ?? 0; // ✅ 장수 생성 제한
    session.data.game_env.npcmode = scenarioMetadata.gameSettings?.npcmode ?? 0;              // ✅ NPC 모드
    session.data.game_env.extended_general = scenarioMetadata.gameSettings?.extended_general ?? 0; // ✅ 확장 장수
    session.data.game_env.fiction = scenarioMetadata.gameSettings?.fiction ?? 0;              // ✅ 픽션 모드
    session.data.game_env.tnmt_trig = scenarioMetadata.gameSettings?.tnmt_trig ?? false;      // ✅ 토너먼트 트리거
    session.data.game_env.prev_winner = null;                                                 // ✅ 이전 승자
    session.data.game_env.autorun_user = null;                                                // ✅ 자동 실행 유저
    session.data.game_env.tournament = 0;                                                     // ✅ 토너먼트 상태
    session.data.game_env.server_cnt = 1;                                                     // ✅ 서버 카운트
    session.data.game_env.allow_rebellion = scenarioMetadata.gameSettings?.allow_rebellion ?? true; // 모반 허용
    
    // NPC AI 기본값 설정 (full = 모든 NPC에 AI 활성화)
    session.data.game_env.npc_ai_mode = scenarioMetadata.gameSettings?.npc_ai_mode || 'full';
    
    console.log(`[ScenarioReset] Set game_env (PHP compatible):`);
    console.log(`   - develcost: ${session.data.game_env.develcost}`);
    console.log(`   - killturn: ${session.data.game_env.killturn}`);
    console.log(`   - npcmode: ${session.data.game_env.npcmode}`);
    console.log(`   - maxnation: ${session.data.game_env.maxnation}`);
    console.log(`   - genius: ${session.data.game_env.genius}`);
    console.log(`   - show_img_level: ${session.data.game_env.show_img_level}`);
    console.log(`   - extended_general: ${session.data.game_env.extended_general}`);
    console.log(`   - fiction: ${session.data.game_env.fiction}`);

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
     * 
     * 시나리오별 도시 오버라이드 지원:
     * - scenarioMetadata.cities 배열에 도시별 오버라이드 정의 가능
     * - { "name": "낙양", "override": { "levelId": 4, "population": 800, ... } }
     * - levelId, population, agriculture, commerce, security, defense, wall 오버라이드 가능
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

    // 시나리오별 도시 오버라이드 맵 생성
    const cityOverrideMap = new Map<string, any>(); // cityName -> override object
    const scenarioCities = scenarioMetadata.cities || [];
    
    if (scenarioCities.length > 0) {
      console.log(`[ScenarioReset] Found ${scenarioCities.length} city overrides in scenario`);
      for (const cityOverride of scenarioCities) {
        if (cityOverride.name && cityOverride.override) {
          cityOverrideMap.set(cityOverride.name, cityOverride.override);
          console.log(`[ScenarioReset]   - ${cityOverride.name}: ${JSON.stringify(cityOverride.override)}`);
        }
      }
    }

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

    // 레벨별 초기값 (scenario.json cityLevels.buildCost 기준)
    // 0:무(황무지), 1:향, 2:수, 3:진, 4:관, 5:이, 6:소, 7:중, 8:대, 9:특, 10:경
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

    // 도시 일괄 생성
    const citiesToCreate = [];
    for (const cityTemplate of cities) {
      const cityName = cityTemplate.name;
      const nationId = cityOwnershipMap.get(cityName) || 0; // 0 = 무소속

      // 시나리오별 오버라이드 적용
      const override = cityOverrideMap.get(cityName) || {};
      const initialState = cityTemplate.initialState || {};

      // 오버라이드 우선 적용 (override > initialState > 기본값)
      const population = override.population ?? initialState.population ?? 100;
      const agriculture = override.agriculture ?? initialState.agriculture ?? 100;
      const commerce = override.commerce ?? initialState.commerce ?? 100;
      const security = override.security ?? initialState.security ?? 50;
      const defense = override.defense ?? initialState.defense ?? 100;
      const wall = override.wall ?? initialState.wall ?? 100;

      const position = cityTemplate.position || {};

      // PHP CityConstBase.php와 동일하게 모든 값에 100을 곱함
      const popMax = population * 100;
      const agriMax = agriculture * 100;
      const commMax = commerce * 100;
      const secuMax = security * 100;
      const defMax = defense * 100;
      const wallMax = wall * 100;
      
      // 레벨도 오버라이드 가능
      const cityLevel = override.levelId ?? cityTemplate.levelId ?? 2;
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
    console.log(`[ScenarioReset] Created ${citiesToCreate.length} cities (${cityOverrideMap.size} overrides applied)`);
    return cities;
  }

  private static async initializeGarrisons(
    sessionId: string,
    scenarioId: string,
    cities: any[]
  ): Promise<void> {
    // 스택 시스템 제거됨 - 주둔병 초기화 스킵
    console.log('[ScenarioReset] Stack system removed, skipping garrison initialization');
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

      // PHP Nation.php와 동일한 초기화
      const aux = {
        'can_국기변경': 1,
        ...(nationLevel === 7 ? { 'can_국호변경': 1 } : {})
      };

      const nationData = {
        session_id: sessionId,
        nation: nationId,
        name: nationName,
        color: nationColor,
        capital: capitalId,
        gold: gold || 10000,
        rice: rice || 10000,
        level: nationLevel || 2, // 국가 크기 (1=소형, 2=일반, 3=대형, 4=제국 등)
        // PHP와 동일한 필드 추가
        bill: 100,                    // 세율 (PHP 기본값)
        rate: 15,                     // 징병율 (PHP 기본값)
        scout: 0,                     // 정찰 레벨
        war: 0,                       // 전쟁 플래그 (숫자 0, PHP와 동일)
        strategic_cmd_limit: 24,      // 전략명령 제한
        surlimit: 72,                 // 항복 조건
        gennum: 0,                    // 장수 수 (나중에 업데이트)
        aux: aux,                     // 보조 데이터
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
          bill: 100,
          rate: 15,
          scout: 0,
          war: 0,
          strategic_cmd_limit: 24,
          surlimit: 72,
          bill_history: [],
          diplomacy: {},
          environment: {},
          tech: tech || 0,
          tech_level: 0,
          gold: gold,
          rice: rice,
          trust: 50,
          aux: aux,
          aux_valid_until: null,
          regions: cityNames,
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
   * 장수 생성 (정치, 매력 추가 버전)
   * 
   * PHP 배열 포맷 지원:
   * - 구버전 (14개 요소): [affinity, name, pic, nation, city, LDR, STR, INT, Lv, Birth, Death, Ego, Special, Text]
   * - 신버전 (16개 요소): [affinity, name, pic, nation, city, LDR, STR, INT, POL, CHR, Lv, Birth, Death, Ego, Special, Text]
   */
  private static async createGenerals(
    sessionId: string,
    scenarioId: string,
    scenarioMetadata: any
  ): Promise<void> {
    console.log(`[ScenarioReset] Creating generals with extended stats`);

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

    // 도시명 → 도시ID 매핑 생성
    const cityNameToIdMap = new Map<string, number>();
    const allCities = await cityRepository.findByFilter({ session_id: sessionId });
    for (const city of allCities) {
      if (city.name) {
        cityNameToIdMap.set(city.name, city.city);
      }
    }
    console.log(`[ScenarioReset] Loaded ${cityNameToIdMap.size} city name mappings`);

    // 시나리오별 장수 근거지 오버라이드 (generalCities)
    const generalCitiesOverride: Record<string, string | number> = scenarioMetadata.generalCities || {};
    const overrideCount = Object.keys(generalCitiesOverride).length;
    if (overrideCount > 0) {
      console.log(`[ScenarioReset] Found ${overrideCount} general city overrides`);
    }

    const generalsToCreate = [];
    let generalIdCounter = 1; // 장수 ID 자동 생성용
    
    for (const genEntry of allGeneralsData) {
      const genTemplate = genEntry.data;
      const npcTypeFromCategory = genEntry.npcType; // general 구분에 따른 NPC 타입
      
      let name, nationNo, id, npc;
      let leadership, strength, intel, politics, charm;
      let officerLevel, birthYear, deathYear, personality, special, text;
      
      if (Array.isArray(genTemplate)) {
        // PHP 배열 포맷 - 정치/매력 유무 체크 (14개 vs 16개 요소)
        // 구버전: [0:affinity, 1:name, 2:pic, 3:nation, 4:city, 5:LDR, 6:STR, 7:INT, 8:Lv, 9:Birth, 10:Death, 11:Ego, 12:Special, 13:Text]
        // 신버전: [0:affinity, 1:name, 2:pic, 3:nation, 4:city, 5:LDR, 6:STR, 7:INT, 8:POL, 9:CHR, 10:Lv, 11:Birth, 12:Death, 13:Ego, 14:Special, 15:Text]
        const hasExtendedStats = genTemplate.length > 14;
        
        // 기본 정보
        name = genTemplate[1];
        const picturePath = genTemplate[2];
        const nationName = genTemplate[3];
        
        // 국가 ID 처리
        if (typeof nationName === 'number') {
          nationNo = nationName;
        } else if (typeof nationName === 'string') {
          nationNo = parseInt(nationName) || 0;
        } else {
          nationNo = 0;
        }
        if (nationNo === 999) nationNo = 0;
        
        id = picturePath || generalIdCounter;

        // 능력치 파싱
        leadership = genTemplate[5] || 50;
        strength = genTemplate[6] || 50;
        intel = genTemplate[7] || 50;

        if (hasExtendedStats) {
          // 신버전 포맷: 인덱스 8, 9에 정치, 매력 존재
          politics = genTemplate[8] || 50;
          charm = genTemplate[9] || 50;
          
          // 인덱스 밀림 적용
          officerLevel = genTemplate[10];
          birthYear = genTemplate[11];
          deathYear = genTemplate[12];
          personality = genTemplate[13];
          special = genTemplate[14];
          text = genTemplate[15];
        } else {
          // 구버전 포맷: 정치/매력 자동 계산 및 인덱스 유지
          politics = Math.round((leadership + intel) / 2);
          charm = Math.round((leadership + intel) / 2.5);
          
          officerLevel = genTemplate[8];
          birthYear = genTemplate[9];
          deathYear = genTemplate[10];
          personality = genTemplate[11];
          special = genTemplate[12];
          text = genTemplate[13];
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
        // 객체 포맷에서도 정치/매력 지원
        politics = genTemplate.stats?.politics || genTemplate.politics || Math.round((leadership + intel) / 2);
        charm = genTemplate.stats?.charm || genTemplate.charm || Math.round((leadership + intel) / 2.5);
        officerLevel = genTemplate.officerLevel;
        birthYear = genTemplate.birthYear || 20;
        deathYear = genTemplate.deathYear || 250;
        personality = genTemplate.personality || '평범';
        special = genTemplate.special || null;
      }
      
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
      
      // 배치 도시 결정 (우선순위: generalCities 오버라이드 > 장수 배열의 city > 국가 수도)
      let assignedCityId = 0;
      
      // 1. 시나리오 generalCities 오버라이드 확인
      if (generalCitiesOverride[name]) {
        const overrideCity = generalCitiesOverride[name];
        if (typeof overrideCity === 'number') {
          assignedCityId = overrideCity;
        } else if (typeof overrideCity === 'string') {
          assignedCityId = cityNameToIdMap.get(overrideCity) || 0;
          if (assignedCityId === 0) {
            console.log(`[ScenarioReset] City not found: ${overrideCity} for ${name}`);
          }
        }
      }
      
      // 2. 장수 배열의 city 필드 확인 (인덱스 4)
      if (assignedCityId === 0 && Array.isArray(genTemplate)) {
        const templateCity = genTemplate[4];
        if (templateCity) {
          if (typeof templateCity === 'number') {
            assignedCityId = templateCity;
          } else if (typeof templateCity === 'string') {
            assignedCityId = cityNameToIdMap.get(templateCity) || 0;
          }
        }
      }
      
      // 3. 국가 수도로 fallback
      if (assignedCityId === 0 && nationNo > 0) {
        const capital = nationCapitalMap.get(nationNo);
        assignedCityId = capital?.city || 0;
      }
      
      // 국가 소속인데 도시가 없으면 이 장수는 스킵 (시나리오에 등장하지 않음)
      if (nationNo > 0 && assignedCityId === 0) {
        console.log(`[ScenarioReset] Skipping general ${name} (nation ${nationNo}) - no city assigned`);
        continue;
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
      
      // PHP GeneralBuilder.php와 동일한 초기화
      // 경험치/헌신도 계산 (PHP: $experience = $this->experience ?: $age * 100)
      const experience = age * 100;
      const dedication = age * 100;
      
      // 친밀도 계산 (PHP: 1-150 랜덤)
      const affinity = Math.floor(Math.random() * 150) + 1;
      
      // 삭턴 계산 (PHP: killturn = (death - year) * 12 + random(0,11) + month - 1)
      const killturn = deathYear 
        ? (deathYear - startYear) * 12 + Math.floor(Math.random() * 12) + 1 - 1
        : 9999;
      
      // specAge 계산 (PHP 로직)
      // specAge = max(3, round((retirementYear - age) / 12 - relYear / 2)) + age
      const retirementYear = 70; // GameConst::$retirementYear 기본값
      const relYear = 0; // 시작 시점이므로 0
      const specAge = Math.max(3, Math.round((retirementYear - age) / 12 - relYear / 2)) + age;
      const specAge2 = Math.max(3, Math.round((retirementYear - age) / 6 - relYear / 2)) + age;
      
      // 기본 특기 (PHP: GameConst::$defaultSpecialDomestic, $defaultSpecialWar)
      const specialDomestic = special || 'None';
      const specialWar = 'None';
      
      // 기본 병종 (PHP: GameUnitConst::DEFAULT_CREWTYPE)
      const defaultCrewType = 0;
      
      const generalData = {
        session_id: sessionId,
        no: id,
        name: name,
        owner: 0,           // PHP: owner는 0 (NPC)
        owner_name: null,
        npc: npc || 2,
        npc_org: npc || 2,  // PHP: npc_org (원본 NPC 타입)
        affinity: affinity, // PHP: 친밀도
        nation: nationNo,
        city: assignedCityId,
        belong: 0,          // PHP: belong 초기값은 0
        turntime: npcTurntime,
        gold: 1000,
        rice: 1000,
        crew: 0,            // 초기 병사 0
        crewtype: defaultCrewType, // PHP: 기본 병종
        train: 0,
        atmos: 0,           // PHP: atmos 초기값은 0
        turnidx: 0,
        belong_history: [],
        officer_level: officerLevel,
        permission: 0,
        // PHP GeneralBuilder.php 추가 필드
        leadership: leadership,
        strength: strength,
        intel: intel,
        experience: experience,
        dedication: dedication,
        dedlevel: 1,        // PHP: dedlevel 초기값 1
        killturn: killturn,
        age: age,
        personal: personality || 'Normal', // PHP: personal (성격)
        special: specialDomestic,  // PHP: 내정특기
        specage: specAge,
        special2: specialWar,      // PHP: 전투특기
        specage2: specAge2,
        npcmsg: text || null,
        makelimit: 0,       // PHP: 제작 제한
        bornyear: birthYear,
        deadyear: deathYear,
        // 병종 숙련도 (PHP: dex1~dex5)
        dex1: 0,
        dex2: 0,
        dex3: 0,
        dex4: 0,
        dex5: 0,
        aux: {},            // PHP: aux
        imgsvr: 0,
        picture: 'default.jpg',
        data: {
          no: id,
          name: name,
          nation: nationNo,
          city: assignedCityId,
          belong: 0,
          leadership: leadership,
          strength: strength,
          intel: intel,
          politics: politics,
          charm: charm,
          experience: experience,
          dedication: dedication,
          dedlevel: 1,
          age: age,
          birth_year: birthYear,
          death_year: deathYear,
          special: specialDomestic,
          special2: specialWar,
          specage: specAge,
          specage2: specAge2,
          personality: personality || 'Normal',
          personal: personality || 'Normal',
          gold: 1000,
          rice: 1000,
          crew: 0,
          crewtype: defaultCrewType,
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
          intel_exp: 0,
          politics_exp: 0,
          charm_exp: 0,
          officer_level: officerLevel,
          permission: 0,
          turntime: npcTurntime.toISOString(),
          killturn: killturn,
          affinity: affinity,
          npc: npc || 2,
          npc_org: npc || 2,
          dex1: 0,
          dex2: 0,
          dex3: 0,
          dex4: 0,
          dex5: 0,
          makelimit: 0,
          aux: {}
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

    // ✅ PHP GeneralBuilder.php와 동일: general_turn 초기화
    // PHP: GameConst::$maxTurn (기본값 12)
    const maxTurn = 12;
    await this.initializeGeneralTurns(sessionId, generalsToCreate, maxTurn);
    
    // ✅ PHP GeneralBuilder.php와 동일: rank_data 초기화
    await this.initializeRankData(sessionId, generalsToCreate);
  }
  
  /**
   * 장수별 턴 데이터 초기화 (PHP GeneralBuilder.php 대응)
   * PHP: general_turn 테이블에 각 장수별로 maxTurn개의 '휴식' 턴 생성
   */
  private static async initializeGeneralTurns(
    sessionId: string,
    generals: any[],
    maxTurn: number
  ): Promise<void> {
    console.log(`[ScenarioReset] Initializing general_turn for ${generals.length} generals (maxTurn=${maxTurn})`);
    
    const turnRows: any[] = [];
    for (const general of generals) {
      for (let turnIdx = 0; turnIdx < maxTurn; turnIdx++) {
        turnRows.push({
          session_id: sessionId,
          data: {
            general_id: general.no,
            turn_idx: turnIdx,
            action: '휴식',
            arg: null,
            brief: '휴식'
          }
        });
      }
    }
    
    // 벌크 삽입
    if (turnRows.length > 0) {
      const { GeneralTurn } = await import('../../models/general_turn.model');
      await GeneralTurn.insertMany(turnRows);
      console.log(`[ScenarioReset] Created ${turnRows.length} general_turn entries`);
    }
  }
  
  /**
   * 장수별 랭킹 데이터 초기화 (PHP GeneralBuilder.php 대응)
   * PHP: rank_data 테이블에 각 장수별로 모든 RankColumn 타입의 초기 데이터 생성
   */
  private static async initializeRankData(
    sessionId: string,
    generals: any[]
  ): Promise<void> {
    console.log(`[ScenarioReset] Initializing rank_data for ${generals.length} generals`);
    
    // RankColumn enum 가져오기
    const { getRankColumnCases } = await import('../../Enums/RankColumn');
    const rankColumns = getRankColumnCases();
    
    const rankRows: any[] = [];
    for (const general of generals) {
      for (const rankColumn of rankColumns) {
        rankRows.push({
          session_id: sessionId,
          data: {
            id: `${general.no}_${rankColumn}`,  // 유니크 ID: general_no + type
            general_id: general.no,
            nation_id: 0,
            type: rankColumn,
            value: 0
          }
        });
      }
    }
    
    // 벌크 삽입
    if (rankRows.length > 0) {
      const { RankData } = await import('../../models/rank_data.model');
      await RankData.insertMany(rankRows);
      console.log(`[ScenarioReset] Created ${rankRows.length} rank_data entries (${rankColumns.length} types per general)`);
    }
  }

  /**
   * 외교 관계 생성
   * 시나리오의 diplomacy 배열을 diplomacy 테이블에 삽입
   * 
   * diplomacy 배열 형식: [me, you, state, term]
   * - me: 국가 ID (주체)
   * - you: 국가 ID (상대)
   * - state: 외교 상태 (0=전쟁, 1=선전포고, 2=중립, 7=동맹 등)
   * - term: 기한 (턴 수)
   */
  private static async createDiplomacy(
    sessionId: string,
    scenarioMetadata: any
  ): Promise<void> {
    const diplomacyData = scenarioMetadata.diplomacy || [];
    
    // 모든 국가 목록 가져오기 (국가 0 제외)
    const nations = await nationRepository.findByFilter({ session_id: sessionId });
    const nationIds = nations.map(n => n.nation).filter(id => id > 0);
    
    console.log(`[ScenarioReset] Creating diplomacy for ${nationIds.length} nations`);
    console.log(`[ScenarioReset] Scenario diplomacy data count: ${diplomacyData.length}`);
    console.log(`[ScenarioReset] Scenario diplomacy first 5:`, JSON.stringify(diplomacyData.slice(0, 5)));

    // 시나리오에서 정의된 외교 관계를 맵으로 변환 (양방향 동일 적용)
    const scenarioDiplomacy = new Map<string, { state: number; term: number }>();
    for (const diplo of diplomacyData) {
      const me = Array.isArray(diplo) ? diplo[0] : diplo.me;
      const you = Array.isArray(diplo) ? diplo[1] : diplo.you;
      const state = Array.isArray(diplo) ? diplo[2] : diplo.state;
      const rawTerm = Array.isArray(diplo) ? diplo[3] : diplo.term;
      
      // 전쟁 상태(state=0)인데 term이 없으면 기본값 999 사용 (즉시 종전 방지)
      // 선전포고(state=1)인데 term이 없으면 기본값 24 사용
      let term = rawTerm ?? 0;
      if ((state === 0 || state === 1) && (rawTerm === undefined || rawTerm === null || rawTerm === 0)) {
        term = state === 0 ? 999 : 24;  // 전쟁: 999턴, 선전포고: 24턴
      }
      const diploValue = { state: state ?? 2, term };
      
      console.log(`[ScenarioReset] Diplomacy: ${me}-${you} state=${state} term=${rawTerm} -> ${term}`);
      
      // 양방향으로 동일하게 설정 (선전포고, 전쟁, 불가침은 양측 동일)
      scenarioDiplomacy.set(`${me}-${you}`, diploValue);
      scenarioDiplomacy.set(`${you}-${me}`, diploValue);
    }

    // 모든 국가 쌍에 대해 외교 관계 생성
    const diplomacyEntries: any[] = [];
    for (const me of nationIds) {
      for (const you of nationIds) {
        if (me === you) continue; // 자기 자신과의 외교 제외
        
        const key = `${me}-${you}`;
        const existing = scenarioDiplomacy.get(key);
        
        diplomacyEntries.push({
          session_id: sessionId,
          me: me,
          you: you,
          state: existing?.state ?? 2,  // 기본값 2 = 중립/평화
          term: existing?.term ?? 0
        });
      }
    }

    // 일괄 삽입
    if (diplomacyEntries.length > 0) {
      await diplomacyRepository.insertMany(diplomacyEntries);
    }

    console.log(`[ScenarioReset] Created ${diplomacyEntries.length} diplomacy relations for ${nationIds.length} nations`);
  }

  /**
   * 초기 역사 로그 생성
   * 시나리오의 history 배열을 world_history에 삽입
   */
  private static async createInitialHistory(
    sessionId: string,
    scenarioMetadata: any
  ): Promise<void> {
    const historyData = scenarioMetadata.history || [];
    
    if (historyData.length === 0) {
      console.log('[ScenarioReset] No initial history in scenario');
      return;
    }

    console.log(`[ScenarioReset] Creating ${historyData.length} initial history entries`);

    const startYear = scenarioMetadata.startYear || 184;
    const startMonth = 1;

    const historyEntries = historyData.map((text: string) => ({
      session_id: sessionId,
      nation_id: 0,  // 전역 히스토리
      year: startYear,
      month: startMonth,
      text: text,
      created_at: new Date()
    }));

    // 일괄 삽입
    for (const entry of historyEntries) {
      await worldHistoryRepository.create(entry);
    }

    console.log(`[ScenarioReset] Created ${historyEntries.length} history entries`);
  }

  /**
   * 초기 ng_history 생성 (연감 시스템용)
   * world_history의 데이터를 ng_history에 복사하여 초기 연감 생성
   */
  private static async createInitialNgHistory(
    sessionId: string,
    scenarioId: string,
    scenarioMetadata: any
  ): Promise<void> {
    const startYear = scenarioMetadata.startYear || 184;
    const startMonth = 1;
    // server_id는 sessionId를 사용해야 프론트엔드에서 올바르게 조회 가능
    const serverID = sessionId;

    console.log(`[ScenarioReset] Creating initial ng_history for ${startYear}년 ${startMonth}월 (server_id: ${serverID})`);

    // world_history에서 초기 기록 가져오기
    const worldHistory = await worldHistoryRepository.findByFilter({
      session_id: sessionId,
      year: startYear,
      month: startMonth
    });

    // 국가 스냅샷 생성
    const nations = await nationRepository.findByFilter({ session_id: sessionId });
    const nationSnapshots = nations.map(nation => ({
      id: nation.nation,
      name: nation.name,
      color: nation.color,
      capital: nation.capital,
      gold: nation.gold,
      rice: nation.rice,
      level: nation.level
    }));

    // 도시 맵 생성 (간단 버전)
    const cities = await cityRepository.findByFilter({ session_id: sessionId });
    const cityMap: any = {};
    for (const city of cities) {
      cityMap[city.city] = {
        id: city.city,
        name: city.name,
        nation: city.nation,
        x: city.x,
        y: city.y
      };
    }

    // global_history 포맷 (world_history 텍스트를 배열로)
    const globalHistoryArray = worldHistory.map(h => ({
      year: h.year,
      month: h.month,
      text: h.text
    }));

    // ng_history 문서 생성
    const ngHistoryDoc = {
      server_id: serverID,
      year: startYear,
      month: startMonth,
      global_history: globalHistoryArray,
      global_action: [],  // 초기에는 비어있음
      nations: nationSnapshots,
      map: cityMap,
      created_at: new Date()
    };

    // 기존 문서 삭제 후 삽입 (unique index로 인한 충돌 방지)
    // @ts-ignore - Mongoose model type issue
    await NgHistory.deleteMany({
      server_id: serverID,
      year: startYear,
      month: startMonth
    });

    // @ts-ignore - Mongoose model type issue
    await NgHistory.create(ngHistoryDoc);

    console.log(`[ScenarioReset] Created ng_history with ${globalHistoryArray.length} global history entries`);
  }

  /**
   * 초기 국력 계산
   * 시나리오 리셋 후 모든 국가의 국력을 계산하여 저장
   */
  private static async initializeNationPower(sessionId: string): Promise<void> {
    console.log(`[ScenarioReset] Initializing nation power for session ${sessionId}`);
    
    const nations = await nationRepository.findByFilter({ session_id: sessionId });
    
    for (const nation of nations) {
      const nationId = nation.nation || nation.data?.nation;
      if (!nationId || nationId === 0) continue;
      
      try {
        // 국가 자원
        const nationGold = nation.data?.gold || nation.gold || 0;
        const nationRice = nation.data?.rice || nation.rice || 0;
        const tech = nation.data?.tech || nation.tech || 0;
        
        // 장수 정보 집계
        const generals = await generalRepository.findByFilter({
          session_id: sessionId,
          nation: nationId
        });
        
        let generalGoldRice = 0;
        let generalAbility = 0;
        let generalDex = 0;
        let generalExpDed = 0;
        let totalCrew = 0;
        
        for (const gen of generals) {
          const gData = gen.data || gen;
          generalGoldRice += (gData.gold || 0) + (gData.rice || 0);
          generalAbility += (gData.leadership || 0) + (gData.strength || 0) + 
                          (gData.intel || 0) + (gData.dex || 0) + 
                          Math.round(gData.exp || 0) + Math.round(gData.ded || 0);
          totalCrew += gData.crew || 0;
        }
        
        // 도시 정보 집계
        const nationCities = await cityRepository.findByFilter({
          session_id: sessionId,
          nation: nationId
        });
        
        let cityPower = 0;
        if (nationCities.length > 0) {
          let popSum = 0;
          let devSum = 0;
          let devMaxSum = 0;
          
          for (const city of nationCities) {
            const cData = city.data || city;
            popSum += cData.pop || 0;
            devSum += (cData.pop || 0) + (cData.agri || 0) + (cData.comm || 0) + 
                     (cData.secu || 0) + (cData.wall || 0) + (cData.def || 0);
            devMaxSum += (cData.pop_max || 1) + (cData.agri_max || 1) + (cData.comm_max || 1) + 
                        (cData.secu_max || 1) + (cData.wall_max || 1) + (cData.def_max || 1);
          }
          
          if (devMaxSum > 0) {
            cityPower = Math.round(popSum * devSum / devMaxSum / 100);
          }
        }
        
        // 국력 계산
        const power = Math.round(
          (Math.round((nationGold + nationRice + generalGoldRice) / 100) +
           tech +
           cityPower +
           generalAbility +
           Math.round(generalDex / 1000) +
           Math.round(generalExpDed / 100)) / 10
        );
        
        // 국력 저장
        await nationRepository.updateByNationNum(sessionId, nationId, {
          power: power
        });
        
      } catch (error: any) {
        console.error(`[ScenarioReset] Failed to calculate power for nation ${nationId}:`, error.message);
      }
    }
    
    console.log(`[ScenarioReset] Nation power initialized for ${nations.length} nations`);
  }
}
