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
   * @param scenarioName - 시나리오 이름 (폴더명, 예: 'sangokushi')
   * @param customSessionId - 커스텀 세션 ID (선택, 없으면 시나리오명_default 사용)
   * @returns 생성된 세션
   */
  static async createFromScenario(scenarioName: string, customSessionId?: string): Promise<any> {
    const configPath = path.join(__dirname, `../../config/scenarios/${scenarioName}/game-config.json`);
    
    if (!fs.existsSync(configPath)) {
      throw new NotFoundError(`시나리오를 찾을 수 없습니다: ${scenarioName}`, { scenarioName });
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    // session_id 결정: customSessionId > 환경변수 > 시나리오명_default
    const sessionId = customSessionId || `${scenarioName}_default`;
    
    // 기존 세션이 있으면 에러
    const existing = await sessionRepository.exists(sessionId);
    if (existing) {
      throw new ConflictError(`이미 존재하는 세션 ID입니다: ${sessionId}`, { sessionId });
    }
    
    // 세션 생성 (config의 session_id는 무시하고 새로운 ID 사용)
    const session = await sessionRepository.create({
      ...config,
      session_id: sessionId,
      template_id: scenarioName,
      status: 'waiting'
    });
    
    // 캐시 무효화
    await cacheService.invalidate(
      [`session:byId:${session.session_id}`],
      ['sessions:*']
    );
    
    logger.info('세션 생성 완료', {
      scenarioName,
      sessionId: session.session_id,
      sessionName: session.name,
      gameMode: session.game_mode,
      cityTemplateCount: Object.keys(config.cities || {}).length
    });
    
    return session;
  }
  
  /**
   * 기본 삼국지 세션 생성
   * 
   * @param sessionId - 세션 ID (선택, 없으면 sangokushi_default 사용)
   * @returns 생성된 세션
   */
  static async createDefaultSangokushi(sessionId?: string): Promise<any> {
    return this.createFromScenario('sangokushi', sessionId);
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
   * 시나리오 기반으로 새 세션 인스턴스 생성
   * 
   * @param scenarioName - 시나리오 이름 (폴더명, 예: 'sangokushi')
   * @param sessionId - 새 세션 ID (예: 'sangokushi_room1')
   * @param sessionName - 세션 이름 (예: '삼국지 방 1')
   * @param autoInit - 자동 초기화 여부 (기본값: true)
   * @returns 생성된 세션
   * @throws NotFoundError - 시나리오를 찾을 수 없는 경우
   * @throws ConflictError - 이미 존재하는 세션 ID인 경우
   */
  static async createSessionFromTemplate(
    scenarioName: string,
    sessionId: string,
    sessionName: string,
    autoInit: boolean = true
  ) {
    // 1. 시나리오 설정 파일 로드
    const configPath = path.join(__dirname, `../../config/scenarios/${scenarioName}/game-config.json`);
    
    if (!fs.existsSync(configPath)) {
      throw new NotFoundError(`시나리오를 찾을 수 없습니다: ${scenarioName}`, { scenarioName });
    }
    
    // 2. 기존 세션이 있으면 에러
    const existing = await sessionRepository.exists(sessionId);
    if (existing) {
      throw new ConflictError(`이미 존재하는 세션 ID입니다: ${sessionId}`, { sessionId });
    }
    
    // 3. 시나리오 설정 로드
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    // 4. 새 세션 생성
    const session = await sessionRepository.create({
      ...config,
      session_id: sessionId,
      name: sessionName,
      template_id: scenarioName,
      status: 'waiting'
    });
    
    // 캐시 무효화
    await cacheService.invalidate(
      [`session:byId:${sessionId}`],
      ['sessions:*']
    );
    
    logger.info('세션 인스턴스 생성 완료', {
      sessionId,
      sessionName,
      scenarioName,
      gameMode: session.game_mode
    });
    
    // 5. 자동 초기화
    if (autoInit) {
      await InitService.initializeSession(sessionId);
      logger.info('세션 자동 초기화 완료', { sessionId });
    }
    
    return session;
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
    
    // 게임 데이터 삭제
    await City.deleteMany({ session_id: sessionId });
    await Nation.deleteMany({ session_id: sessionId });
    await General.deleteMany({ session_id: sessionId });
    
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
    
    // console.log(`   - 초기화 완료`);
    
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
    
    // console.log(`🗑️  세션 삭제: ${sessionId}`);
    
    // 게임 데이터 삭제
    await City.deleteMany({ session_id: sessionId });
    await Nation.deleteMany({ session_id: sessionId });
    await General.deleteMany({ session_id: sessionId });
    
    // 세션 설정 삭제
    await sessionRepository.deleteBySessionId(sessionId);
    
    // console.log(`   - 삭제 완료`);
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
   * 시나리오로부터 세션 설정 리로드
   * 
   * 게임 데이터는 유지하고 설정만 시나리오 기준으로 다시 로드
   * 
   * @param sessionId 세션 ID
   * @param scenarioName 시나리오 이름 (생략시 기존 template_id 사용)
   */
  static async reloadSessionConfig(sessionId: string, scenarioName?: string) {
    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session) {
      throw new NotFoundError(`세션을 찾을 수 없습니다: ${sessionId}`, { sessionId });
    }
    
    // 시나리오 이름 결정
    const targetScenario = scenarioName || session.template_id;
    if (!targetScenario) {
      throw new Error('시나리오 이름을 지정해야 합니다 (세션에 template_id가 없음)');
    }
    
    // 시나리오 파일 로드
    const configPath = path.join(__dirname, `../../config/scenarios/${targetScenario}/game-config.json`);
    if (!fs.existsSync(configPath)) {
      throw new NotFoundError(`시나리오를 찾을 수 없습니다: ${targetScenario}`, { scenarioName: targetScenario });
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    logger.info('세션 설정 리로드', {
      sessionId,
      scenarioName: targetScenario
    });
    
    // 세션 ID와 이름은 유지, 나머지는 시나리오에서 로드
    const updateFields = {
      ...config,
      session_id: sessionId,  // 기존 ID 유지
      name: session.name,      // 기존 이름 유지
      template_id: targetScenario,
      status: session.status,  // 기존 상태 유지
      started_at: session.started_at,
      finished_at: session.finished_at
    };
    
    // DB 업데이트
    await sessionRepository.updateBySessionId(sessionId, updateFields);
    
    // 캐시 무효화
    await cacheService.invalidate(
      [`session:byId:${sessionId}`],
      ['sessions:*']
    );
    
    logger.info('설정 리로드 완료', {
      sessionId,
      cityCount: Object.keys(config.cities || {}).length
    });
    
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
    const commands = (session as any).commands || {};
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
   * 사용 가능한 시나리오 목록
   * 
   * config/scenarios 폴더의 모든 하위 폴더를 스캔하여
   * game-config.json이 있는 시나리오만 반환
   */
  static getAvailableTemplates(): string[] {
    const scenariosDir = path.join(__dirname, '../../config/scenarios');
    
    if (!fs.existsSync(scenariosDir)) {
      logger.warn('시나리오 디렉토리가 없습니다', { scenariosDir });
      return [];
    }
    
    const folders = fs.readdirSync(scenariosDir, { withFileTypes: true });
    
    return folders
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .filter(folderName => {
        const configPath = path.join(scenariosDir, folderName, 'game-config.json');
        return fs.existsSync(configPath);
      });
  }
}
