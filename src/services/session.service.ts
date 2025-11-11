import { City } from '../models/city.model';
import { Nation } from '../models/nation.model';
import { General } from '../models/general.model';
import { InitService } from './init.service';
import { sessionRepository } from '../repositories/session.repository';
import { cacheService } from '../common/cache/cache.service';
import { logger } from '../common/logger';
import { NotFoundError, ConflictError } from '../common/errors/app-error';
import * as fs from 'fs';
import * as path from 'path';
import { cityRepository } from '../repositories/city.repository';
import { nationRepository } from '../repositories/nation.repository';
import { generalRepository } from '../repositories/general.repository';
// 고아 객체 삭제를 위한 repository 임포트
import { commandRepository } from '../repositories/command.repository';
import { messageRepository } from '../repositories/message.repository';
import { troopRepository } from '../repositories/troop.repository';
import { auctionRepository } from '../repositories/auction.repository';
import { voteRepository } from '../repositories/vote.repository';
import { diplomacyRepository } from '../repositories/diplomacy.repository';
import { ngDiplomacyRepository } from '../repositories/ng-diplomacy.repository';
import { worldHistoryRepository } from '../repositories/world-history.repository';
import { kvStorageRepository } from '../repositories/kvstorage.repository';
import { battleRepository } from '../repositories/battle.repository';
import { battleMapTemplateRepository } from '../repositories/battle-map-template.repository';
import { bettingRepository } from '../repositories/betting.repository';
import { generalTurnRepository } from '../repositories/general-turn.repository';
import { nationTurnRepository } from '../repositories/nation-turn.repository';
import { generalRecordRepository } from '../repositories/general-record.repository';
import { generalAccessLogRepository } from '../repositories/general-access-log.repository';
import { generalLogRepository } from '../repositories/general-log.repository';
import { nationEnvRepository } from '../repositories/nation-env.repository';
import { boardRepository } from '../repositories/board.repository';
import { commentRepository } from '../repositories/comment.repository';
import { userRecordRepository } from '../repositories/user-record.repository';
import { eventRepository } from '../repositories/event.repository';
import { battleActionRepository } from '../repositories/battle-action.repository';
import { battleInstanceRepository } from '../repositories/battle-instance.repository';
import { battlemapTemplateRepository } from '../repositories/battlemap-template.repository';
import { voteCommentRepository } from '../repositories/vote-comment.repository';
import { ngAuctionBidRepository } from '../repositories/ng-auction-bid.repository';
import { ngBettingRepository } from '../repositories/ng-betting.repository';
import { plockRepository } from '../repositories/plock.repository';
import { rankDataRepository } from '../repositories/rank-data.repository';
import { statisticRepository } from '../repositories/statistic.repository';
import { selectNpcTokenRepository } from '../repositories/select-npc-token.repository';
import { selectPoolRepository } from '../repositories/select-pool.repository';

/**
 * 세션 관리 서비스
 * 
 * 템플릿 기반으로 여러 게임 세션(인스턴스)을 생성/관리합니다.
 * 
 * 데이터 접근:
 * - DB 접근: sessionRepository를 통해서만 수행
 * - 캐시: cacheService를 통한 L1(메모리) + L2(Redis) 캐싱
 * 
 * 캐시 키 규칙:
 * - session:byId:{sessionId} - 특정 세션
 * - sessions:allActive - 활성 세션 목록
 */
export class SessionService {
  /**
   * JSON 파일로부터 세션 생성
   * 
   * @param configPath - 세션 설정 JSON 파일 경로
   * @returns 생성된 세션
   */
  static async createFromConfig(configPath: string): Promise<any> {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    // 세션 생성 (Repository 사용)
    const session = await sessionRepository.create(config);
    
    // 캐시 무효화
    await cacheService.invalidate(
      [`session:byId:${session.session_id}`],
      ['sessions:*']
    );
    
    logger.info('세션 생성 완료', {
      sessionId: session.session_id,
      sessionName: session.name,
      gameMode: session.game_mode,
      resourceCount: Object.keys(config.resources || {}).length,
      attributeCount: Object.keys(config.attributes || {}).length,
      commandCount: Object.keys(config.commands || {}).length,
      cityTemplateCount: Object.keys(config.cities || {}).length
    });
    
    // DB 저장 검증
    const dbCommandCount = Object.keys(session.commands || {}).length;
    const dbCityCount = Object.keys(session.cities || {}).length;
    
    if (dbCommandCount !== Object.keys(config.commands || {}).length) {
      logger.warn('커맨드 저장 불일치', {
        expected: Object.keys(config.commands || {}).length,
        actual: dbCommandCount
      });
    }
    
    if (dbCityCount !== Object.keys(config.cities || {}).length) {
      logger.warn('도시 템플릿 저장 불일치', {
        expected: Object.keys(config.cities || {}).length,
        actual: dbCityCount
      });
    }
    
    return session;
  }
  
  /**
   * 기본 삼국지 세션 생성
   * 
   * @returns 생성된 세션
   */
  static async createDefaultSangokushi(): Promise<any> {
    const configPath = path.join(__dirname, '../../config/session-sangokushi.json');
    return this.createFromConfig(configPath);
  }
  
  /**
   * 세션 조회 (캐시 우선)
   * 
   * @param sessionId - 세션 ID
   * @returns 세션 또는 null
   */
  static async getSession(sessionId: string) {
    return cacheService.getOrLoad(
      `session:byId:${sessionId}`,
      () => sessionRepository.findBySessionId(sessionId),
      60
    );
  }
  
  /**
   * 모든 활성 세션 조회 (캐시 우선)
   * 
   * @returns 활성 세션 목록
   */
  static async getAllSessions() {
    return cacheService.getOrLoad(
      'sessions:allActive',
      () => sessionRepository.findAllActive(),
      30
    );
  }
  
  /**
   * 시나리오 기반으로 새 세션 생성 (권장)
   * 
   * config/scenarios/{scenarioId}/ 디렉토리에서 데이터를 로드합니다.
   * 
   * @param scenarioId - 시나리오 ID (예: 'sangokushi')
   * @param sessionId - 새 세션 ID (예: 'sangokushi_room1')
   * @param sessionName - 세션 이름 (예: '삼국지 방 1')
   * @param autoInit - 자동 초기화 여부 (기본값: true)
   * @returns 생성된 세션
   * @throws NotFoundError - 시나리오를 찾을 수 없는 경우
   * @throws ConflictError - 이미 존재하는 세션 ID인 경우
   */
  static async createSessionFromScenario(
    scenarioId: string,
    sessionId: string,
    sessionName: string,
    autoInit: boolean = true
  ) {
    // 1. 시나리오 경로 확인
    const scenarioPath = path.join(__dirname, `../../config/scenarios/${scenarioId}`);
    const scenarioFile = path.join(scenarioPath, 'scenario.json');
    
    if (!fs.existsSync(scenarioFile)) {
      throw new NotFoundError(`시나리오를 찾을 수 없습니다: ${scenarioId}`, { scenarioId });
    }
    
    // 2. 기존 세션이 있으면 에러
    const existing = await sessionRepository.exists(sessionId);
    if (existing) {
      throw new ConflictError(`이미 존재하는 세션 ID입니다: ${sessionId}`, { sessionId });
    }
    
    // 3. 시나리오 설정 로드
    const scenarioConfig = JSON.parse(fs.readFileSync(scenarioFile, 'utf-8'));
    
    // 4. 새 세션 생성
    const session = await sessionRepository.create({
      session_id: sessionId,
      name: sessionName,
      scenario_id: scenarioId,
      scenario_name: scenarioConfig.name || scenarioId,
      status: 'waiting',
      game_mode: 'scenario',
      data: {
        scenario: scenarioConfig,
        turnterm: 60, // 60분 (분 단위로 저장)
        year: 184,
        month: 1,
        startyear: 184
      }
    });
    
    // 캐시 무효화
    await cacheService.invalidate(
      [`session:byId:${sessionId}`],
      ['sessions:*']
    );
    
    logger.info('시나리오 기반 세션 생성 완료', {
      sessionId,
      sessionName,
      scenarioId,
      scenarioName: scenarioConfig.name
    });
    
    // 5. 자동 초기화
    if (autoInit) {
      await InitService.initializeSession(sessionId);
      logger.info('세션 자동 초기화 완료', { sessionId });
    }
    
    return session;
  }

  /**
   * 템플릿 기반으로 새 세션 인스턴스 생성 (레거시)
   * 
   * @deprecated createSessionFromScenario 사용을 권장합니다
   * 
   * @param templateId - 템플릿 ID (예: 'sangokushi')
   * @param sessionId - 새 세션 ID (예: 'sangokushi_room1')
   * @param sessionName - 세션 이름 (예: '삼국지 방 1')
   * @param autoInit - 자동 초기화 여부 (기본값: true)
   * @returns 생성된 세션
   * @throws NotFoundError - 템플릿을 찾을 수 없는 경우
   * @throws ConflictError - 이미 존재하는 세션 ID인 경우
   */
  static async createSessionFromTemplate(
    templateId: string,
    sessionId: string,
    sessionName: string,
    autoInit: boolean = true
  ) {
    // 새로운 시나리오 기반 메서드로 리다이렉트
    return this.createSessionFromScenario(templateId, sessionId, sessionName, autoInit);
  }
  
  /**
   * 세션 초기화 (게임 데이터 리셋)
   * 
   * 세션 설정은 유지하고 게임 데이터(도시, 국가, 장수)만 초기화합니다.
   * 
   * @param sessionId - 초기화할 세션 ID
   * @throws NotFoundError - 세션을 찾을 수 없는 경우
   */
  static async resetSession(sessionId: string) {
    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session) {
      throw new NotFoundError(`세션을 찾을 수 없습니다: ${sessionId}`, { sessionId });
    }
    
    logger.info('세션 초기화 시작', { sessionId });
    
    // IMPORTANT: 장수 삭제 전에 해당 유저들의 참조 정리
    const generals = await generalRepository.findByFilter({ session_id: sessionId });
    const ownerIds = generals.map((g: any) => g.owner).filter((id: string) => id);
    
    if (ownerIds.length > 0) {
      logger.info('해당 세션 장수의 소유자 정리', { sessionId, ownerCount: ownerIds.length });
    }
    
    // 핵심 게임 데이터 삭제
    await cityRepository.deleteManyByFilter({ session_id: sessionId });
    await nationRepository.deleteManyByFilter({ session_id: sessionId });
    await generalRepository.deleteManyByFilter({ session_id: sessionId });
    
    // 연관 고아 객체 삭제 (cascade delete)
    await this._deleteOrphanedData(sessionId);
    
    logger.info('기존 게임 데이터 삭제 완료', { sessionId });
    
    // 재초기화
    await InitService.initializeSession(sessionId);
    
    // 캐시 무효화
    await cacheService.invalidate(
      [`session:byId:${sessionId}`],
      ['sessions:*', 'cities:*', 'nations:*', 'generals:*']
    );
    
    logger.info('세션 초기화 완료', { sessionId });
    
    // 세션 상태 리셋
    await sessionRepository.updateBySessionId(sessionId, { 
        status: 'waiting',
        started_at: undefined,
        finished_at: undefined
      }
    );
    
    return session;
  }
  
  /**
   * 세션 삭제 (설정 + 게임 데이터 전부)
   */
  static async deleteSession(sessionId: string) {
    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session) {
      throw new Error(`세션을 찾을 수 없습니다: ${sessionId}`);
    }
    
    logger.info('세션 삭제 시작', { sessionId });
    
    // IMPORTANT: 장수 삭제 전에 해당 유저들의 참조 정리
    const generals = await generalRepository.findByFilter({ session_id: sessionId });
    const ownerIds = generals.map((g: any) => g.owner).filter((id: string) => id);
    
    if (ownerIds.length > 0) {
      logger.info('해당 세션 장수의 소유자 정리', { sessionId, ownerCount: ownerIds.length });
    }
    
    // 핵심 게임 데이터 삭제
    await cityRepository.deleteManyByFilter({ session_id: sessionId });
    await nationRepository.deleteManyByFilter({ session_id: sessionId });
    await generalRepository.deleteManyByFilter({ session_id: sessionId });
    
    // 연관 고아 객체 삭제 (cascade delete)
    await this._deleteOrphanedData(sessionId);
    
    // 세션 설정 삭제
    await sessionRepository.deleteBySessionId(sessionId);
    
    // 캐시 무효화 (전체)
    await cacheService.invalidate(
      [`session:byId:${sessionId}`],
      ['sessions:*', 'cities:*', 'nations:*', 'generals:*', '*']
    );
    
    logger.info('세션 삭제 완료', { sessionId });
  }
  
  /**
   * 세션 관련 고아 객체 삭제 (내부 메서드)
   * 
   * 세션 삭제/초기화 시 호출되어 연관된 모든 데이터를 정리합니다.
   * Repository 패턴을 사용하여 데이터 삭제를 수행합니다.
   * 
   * @param sessionId - 세션 ID
   * @private
   */
  private static async _deleteOrphanedData(sessionId: string) {
    logger.info('고아 객체 삭제 시작', { sessionId });
    
    const deleteTasks = [
      // Repository가 있는 것들
      { name: 'commands', fn: () => commandRepository.deleteBySession(sessionId) },
      { name: 'messages', fn: () => messageRepository.deleteBySession(sessionId) },
      { name: 'troops', fn: () => troopRepository.deleteBySession(sessionId) },
      { name: 'votes', fn: () => voteRepository.deleteBySession(sessionId) },
      { name: 'world_histories', fn: () => worldHistoryRepository.deleteBySession(sessionId) },
      { name: 'general_turns', fn: () => generalTurnRepository.deleteBySession(sessionId) },
      { name: 'nation_turns', fn: () => nationTurnRepository.deleteBySession(sessionId) },
      { name: 'general_records', fn: () => generalRecordRepository.deleteBySession(sessionId) },
      { name: 'kvstorages', fn: () => kvStorageRepository.deleteBySession(sessionId) },
      { name: 'battles', fn: () => battleRepository.deleteBySession(sessionId) },
      { name: 'battle_map_templates', fn: () => battleMapTemplateRepository.deleteBySession(sessionId) },
      { name: 'diplomacies', fn: () => diplomacyRepository.deleteBySession(sessionId) },
      { name: 'ng_diplomacies', fn: () => ngDiplomacyRepository.deleteBySession(sessionId) },
      { name: 'auctions', fn: () => auctionRepository.deleteBySession(sessionId) },
      { name: 'bettings', fn: () => bettingRepository.deleteBySession(sessionId) },
      
      // 추가 Repository들
      { name: 'general_access_logs', fn: () => generalAccessLogRepository.deleteBySession(sessionId) },
      { name: 'general_logs', fn: () => generalLogRepository.deleteBySession(sessionId) },
      { name: 'nation_envs', fn: () => nationEnvRepository.deleteBySession(sessionId) },
      { name: 'boards', fn: () => boardRepository.deleteBySession(sessionId) },
      { name: 'comments', fn: () => commentRepository.deleteBySession(sessionId) },
      { name: 'user_records', fn: () => userRecordRepository.deleteBySession(sessionId) },
      { name: 'events', fn: () => eventRepository.deleteBySession(sessionId) },
      { name: 'battleactions', fn: () => battleActionRepository.deleteBySession(sessionId) },
      { name: 'battleinstances', fn: () => battleInstanceRepository.deleteBySession(sessionId) },
      { name: 'battlemaptemplates', fn: () => battlemapTemplateRepository.deleteBySession(sessionId) },
      { name: 'vote_comments', fn: () => voteCommentRepository.deleteBySession(sessionId) },
      { name: 'ng_auction_bids', fn: () => ngAuctionBidRepository.deleteBySession(sessionId) },
      { name: 'ng_bettings', fn: () => ngBettingRepository.deleteBySession(sessionId) },
      { name: 'plocks', fn: () => plockRepository.deleteBySession(sessionId) },
      { name: 'rank_datas', fn: () => rankDataRepository.deleteBySession(sessionId) },
      { name: 'statistics', fn: () => statisticRepository.deleteBySession(sessionId) },
      { name: 'select_npc_tokens', fn: () => selectNpcTokenRepository.deleteBySession(sessionId) },
      { name: 'select_pools', fn: () => selectPoolRepository.deleteBySession(sessionId) },
    ];
    
    try {
      const results = await Promise.allSettled(
        deleteTasks.map(task => task.fn())
      );
      
      // 삭제 결과 로깅
      let totalDeleted = 0;
      results.forEach((result, idx) => {
        const taskName = deleteTasks[idx].name;
        if (result.status === 'fulfilled') {
          const deleted = (result.value as any)?.deletedCount || 0;
          if (deleted > 0) {
            totalDeleted += deleted;
            logger.debug(`${taskName}: ${deleted}개 삭제`, { sessionId });
          }
        } else {
          logger.warn('고아 객체 삭제 실패', { 
            sessionId, 
            collection: taskName, 
            error: result.reason?.message 
          });
        }
      });
      
      logger.info('고아 객체 삭제 완료', { 
        sessionId, 
        totalDeleted,
        collections: deleteTasks.length 
      });
    } catch (error: any) {
      logger.error('고아 객체 삭제 중 오류', { 
        sessionId, 
        error: error.message 
      });
      // 오류가 발생해도 계속 진행 (일부 컬렉션이 없을 수 있음)
    }
  }
  
  /**
   * 세션 설정 업데이트 (부분 업데이트)
   * 
   * 특정 필드만 업데이트하고 나머지는 유지
   * 게임 데이터는 영향받지 않음
   */
  static async updateSession(sessionId: string, updates: Partial<{
    name: string;
    game_mode: 'turn' | 'realtime';
    turn_config: any;
    realtime_config: any;
    resources: any;
    attributes: any;
    field_mappings: any;
    commands: any;
    game_constants: any;
    cities: any;
    status: 'waiting' | 'running' | 'finished';
  }>) {
    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session) {
      throw new Error(`세션을 찾을 수 없습니다: ${sessionId}`);
    }
    
    // console.log(`🔧 세션 설정 업데이트: ${sessionId}`);
    
    // 업데이트할 필드만 적용
    const updateFields: any = {};
    
    if (updates.name !== undefined) {
      updateFields.name = updates.name;
      // console.log(`   - 이름: ${updates.name}`);
    }
    
    if (updates.game_mode !== undefined) {
      updateFields.game_mode = updates.game_mode;
      // console.log(`   - 게임 모드: ${updates.game_mode}`);
    }
    
    if (updates.turn_config !== undefined) {
      updateFields.turn_config = updates.turn_config;
      // console.log(`   - 턴 설정 업데이트`);
    }
    
    if (updates.realtime_config !== undefined) {
      updateFields.realtime_config = updates.realtime_config;
      // console.log(`   - 리얼타임 설정 업데이트`);
    }
    
    if (updates.resources !== undefined) {
      updateFields.resources = updates.resources;
      // console.log(`   - 자원 정의 업데이트: ${Object.keys(updates.resources).length}개`);
    }
    
    if (updates.attributes !== undefined) {
      updateFields.attributes = updates.attributes;
      // console.log(`   - 속성 정의 업데이트: ${Object.keys(updates.attributes).length}개`);
    }
    
    if (updates.field_mappings !== undefined) {
      updateFields.field_mappings = updates.field_mappings;
      // console.log(`   - 필드 매핑 업데이트`);
    }
    
    if (updates.commands !== undefined) {
      updateFields.commands = updates.commands;
      // console.log(`   - 커맨드 설정 업데이트: ${Object.keys(updates.commands).length}개`);
    }
    
    if (updates.game_constants !== undefined) {
      updateFields.game_constants = updates.game_constants;
      // console.log(`   - 게임 상수 업데이트`);
    }
    
    if (updates.cities !== undefined) {
      updateFields.cities = updates.cities;
      // console.log(`   - 도시 템플릿 업데이트: ${Object.keys(updates.cities).length}개`);
    }
    
    if (updates.status !== undefined) {
      updateFields.status = updates.status;
      // console.log(`   - 상태: ${updates.status}`);
    }
    
    // DB 업데이트
    await sessionRepository.updateBySessionId(sessionId, updateFields);
    
    // console.log(`   ✅ 업데이트 완료`);
    
    // 업데이트된 세션 반환
    return await sessionRepository.findBySessionId(sessionId);
  }
  
  /**
   * 템플릿으로부터 세션 설정 리로드
   * 
   * 게임 데이터는 유지하고 설정만 템플릿 기준으로 다시 로드
   * 
   * @param sessionId 세션 ID
   * @param templateId 템플릿 ID (생략시 기존 template_id 사용)
   */
  static async reloadSessionConfig(sessionId: string, templateId?: string) {
    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session) {
      throw new Error(`세션을 찾을 수 없습니다: ${sessionId}`);
    }
    
    // 템플릿 ID 결정
    const targetTemplateId = templateId || session.template_id;
    if (!targetTemplateId) {
      throw new Error('템플릿 ID를 지정해야 합니다 (세션에 template_id가 없음)');
    }
    
    // 템플릿 파일 로드
    const configPath = path.join(__dirname, `../../config/session-${targetTemplateId}.json`);
    if (!fs.existsSync(configPath)) {
      throw new Error(`템플릿을 찾을 수 없습니다: ${targetTemplateId}`);
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    // console.log(`🔄 세션 설정 리로드: ${sessionId}`);
    // console.log(`   - 템플릿: ${targetTemplateId}`);
    
    // 세션 ID와 이름은 유지, 나머지는 템플릿에서 로드
    const updateFields = {
      ...config,
      session_id: sessionId,  // 기존 ID 유지
      name: session.name,      // 기존 이름 유지
      template_id: targetTemplateId,
      status: session.status,  // 기존 상태 유지
      started_at: session.started_at,
      finished_at: session.finished_at
    };
    
    // DB 업데이트
    await sessionRepository.updateBySessionId(sessionId, updateFields);
    
    // console.log(`   ✅ 설정 리로드 완료`);
    // console.log(`   - 자원: ${Object.keys(config.resources || {}).length}개`);
    // console.log(`   - 커맨드: ${Object.keys(config.commands || {}).length}개`);
    // console.log(`   - 도시 템플릿: ${Object.keys(config.cities || {}).length}개`);
    
    return await sessionRepository.findBySessionId(sessionId);
  }
  
  /**
   * 특정 커맨드 설정만 업데이트
   */
  static async updateCommand(sessionId: string, commandId: string, commandConfig: any) {
    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session) {
      throw new Error(`세션을 찾을 수 없습니다: ${sessionId}`);
    }
    
    // console.log(`🔧 커맨드 업데이트: ${sessionId} / ${commandId}`);
    
    // 기존 commands 가져오기
    const commands = session.commands || {};
    commands[commandId] = commandConfig;
    
    // 업데이트
    await sessionRepository.updateBySessionId(
      sessionId,
      { commands }
    );
    
    // console.log(`   ✅ 커맨드 업데이트 완료`);
    
    return await sessionRepository.findBySessionId(sessionId);
  }
  
  /**
   * 사용 가능한 템플릿 목록
   */
  static getAvailableTemplates(): string[] {
    const configDir = path.join(__dirname, '../../config');
    const files = fs.readdirSync(configDir);
    
    return files
      .filter(f => f.startsWith('session-') && f.endsWith('.json'))
      .map(f => f.replace('session-', '').replace('.json', ''));
  }
}
