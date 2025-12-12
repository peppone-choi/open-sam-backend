/**
 * GIN7 Scenario Loader Service
 * 
 * 시나리오 파일 로딩 및 초기화
 * JSON/YAML 시나리오 파싱 및 MongoDB 저장
 * 
 * @see agents/gin7-agents/gin7-scenario-script/CHECKLIST.md
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { Scenario, IScenario } from '../../models/gin7/Scenario';
import { ScenarioSession, IScenarioSession } from '../../models/gin7/ScenarioSession';
import { 
  ScenarioMeta,
  ScenarioFaction,
  ScenarioInitialState,
  GameCondition,
  ScenarioEvent,
} from '../../types/gin7/scenario.types';
import { logger } from '../../common/logger';

// ============================================================================
// Types
// ============================================================================

export interface LoadResult {
  success: boolean;
  scenarioId?: string;
  error?: string;
}

export interface ScenarioListItem {
  id: string;
  name: string;
  nameEn?: string;
  description: string;
  difficulty: string;
  estimatedTurns: number;
  tags: string[];
  isOfficial: boolean;
  playableFactions: string[];
}

export interface StartScenarioParams {
  scenarioId: string;
  playerId: string;
  playerFactionId: string;
  sessionId?: string;
}

export interface StartScenarioResult {
  success: boolean;
  sessionId?: string;
  error?: string;
}

// ============================================================================
// Service Implementation
// ============================================================================

export class ScenarioLoaderService extends EventEmitter {
  private static instance: ScenarioLoaderService;
  
  // 시나리오 데이터 캐시
  private scenarioCache: Map<string, IScenario> = new Map();
  
  // 기본 시나리오 디렉토리
  private scenarioDataDir: string;
  
  private constructor() {
    super();
    this.scenarioDataDir = path.join(__dirname, '../../data/gin7/scenarios');
  }
  
  public static getInstance(): ScenarioLoaderService {
    if (!ScenarioLoaderService.instance) {
      ScenarioLoaderService.instance = new ScenarioLoaderService();
    }
    return ScenarioLoaderService.instance;
  }
  
  // ==========================================================================
  // Scenario Loading
  // ==========================================================================
  
  /**
   * JSON 파일에서 시나리오 로드 및 DB 저장
   */
  async loadFromFile(filePath: string): Promise<LoadResult> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const scenarioData = JSON.parse(content);
      
      return this.saveScenario(scenarioData);
    } catch (error) {
      logger.error('[ScenarioLoaderService] Failed to load from file', { filePath, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * 객체에서 시나리오 저장
   */
  async saveScenario(scenarioData: Partial<IScenario>): Promise<LoadResult> {
    try {
      // 유효성 검증
      const validation = this.validateScenario(scenarioData);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }
      
      const scenarioId = scenarioData.meta!.id;
      
      // 기존 시나리오 확인
      const existing = await Scenario.findOne({ 'meta.id': scenarioId });
      
      if (existing) {
        // 업데이트
        await Scenario.updateOne(
          { 'meta.id': scenarioId },
          { 
            $set: { 
              ...scenarioData,
              'meta.updatedAt': new Date(),
            } 
          }
        );
        
        // 캐시 무효화
        this.scenarioCache.delete(scenarioId);
        
        logger.info('[ScenarioLoaderService] Scenario updated', { scenarioId });
      } else {
        // 새로 생성
        await Scenario.create(scenarioData);
        logger.info('[ScenarioLoaderService] Scenario created', { scenarioId });
      }
      
      this.emit('scenario:loaded', { scenarioId });
      
      return { success: true, scenarioId };
    } catch (error) {
      logger.error('[ScenarioLoaderService] Failed to save scenario', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * 시나리오 유효성 검증
   */
  private validateScenario(data: Partial<IScenario>): { valid: boolean; error?: string } {
    if (!data.meta?.id) {
      return { valid: false, error: 'Missing meta.id' };
    }
    
    if (!data.meta?.name) {
      return { valid: false, error: 'Missing meta.name' };
    }
    
    if (!data.factions || data.factions.length === 0) {
      return { valid: false, error: 'Missing factions' };
    }
    
    if (!data.initialState) {
      return { valid: false, error: 'Missing initialState' };
    }
    
    if (!data.victoryConditions || data.victoryConditions.length === 0) {
      return { valid: false, error: 'Missing victoryConditions' };
    }
    
    if (!data.defeatConditions || data.defeatConditions.length === 0) {
      return { valid: false, error: 'Missing defeatConditions' };
    }
    
    // 초기 상태 검증
    if (!data.initialState.gameDate) {
      return { valid: false, error: 'Missing initialState.gameDate' };
    }
    
    return { valid: true };
  }
  
  /**
   * 디렉토리의 모든 시나리오 로드
   */
  async loadAllFromDirectory(dirPath?: string): Promise<{ loaded: number; failed: number }> {
    const targetDir = dirPath || this.scenarioDataDir;
    
    if (!fs.existsSync(targetDir)) {
      logger.warn('[ScenarioLoaderService] Scenario directory not found', { targetDir });
      return { loaded: 0, failed: 0 };
    }
    
    const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.json'));
    
    let loaded = 0;
    let failed = 0;
    
    for (const file of files) {
      const filePath = path.join(targetDir, file);
      const result = await this.loadFromFile(filePath);
      
      if (result.success) {
        loaded++;
      } else {
        failed++;
        logger.error('[ScenarioLoaderService] Failed to load', { file, error: result.error });
      }
    }
    
    logger.info('[ScenarioLoaderService] Bulk load completed', { loaded, failed });
    
    return { loaded, failed };
  }
  
  // ==========================================================================
  // Scenario Query
  // ==========================================================================
  
  /**
   * 시나리오 ID로 조회
   */
  async getScenario(scenarioId: string): Promise<IScenario | null> {
    // 캐시 확인
    if (this.scenarioCache.has(scenarioId)) {
      return this.scenarioCache.get(scenarioId)!;
    }
    
    // DB에서 조회
    const scenario = await Scenario.findOne({ 'meta.id': scenarioId });
    
    if (scenario) {
      this.scenarioCache.set(scenarioId, scenario);
    }
    
    return scenario;
  }
  
  /**
   * 공개된 시나리오 목록 조회
   */
  async listPublishedScenarios(options?: {
    difficulty?: string;
    tags?: string[];
    official?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ScenarioListItem[]> {
    const query: any = { isPublished: true };
    
    if (options?.difficulty) {
      query['meta.difficulty'] = options.difficulty;
    }
    
    if (options?.tags && options.tags.length > 0) {
      query['meta.tags'] = { $in: options.tags };
    }
    
    if (options?.official !== undefined) {
      query.isOfficial = options.official;
    }
    
    const scenarios = await Scenario.find(query)
      .sort({ 'meta.createdAt': -1 })
      .skip(options?.offset || 0)
      .limit(options?.limit || 50)
      .select('meta factions');
    
    return scenarios.map(s => ({
      id: s.meta.id,
      name: s.meta.name,
      nameEn: s.meta.nameEn,
      description: s.meta.description,
      difficulty: s.meta.difficulty,
      estimatedTurns: s.meta.estimatedTurns,
      tags: s.meta.tags,
      isOfficial: s.isOfficial,
      playableFactions: s.factions.filter(f => f.isPlayable).map(f => f.factionId),
    }));
  }
  
  /**
   * 시나리오 검색
   */
  async searchScenarios(query: string): Promise<ScenarioListItem[]> {
    const scenarios = await Scenario.find({
      isPublished: true,
      $text: { $search: query },
    })
      .limit(20)
      .select('meta factions');
    
    return scenarios.map(s => ({
      id: s.meta.id,
      name: s.meta.name,
      nameEn: s.meta.nameEn,
      description: s.meta.description,
      difficulty: s.meta.difficulty,
      estimatedTurns: s.meta.estimatedTurns,
      tags: s.meta.tags,
      isOfficial: s.isOfficial,
      playableFactions: s.factions.filter(f => f.isPlayable).map(f => f.factionId),
    }));
  }
  
  // ==========================================================================
  // Scenario Session Management
  // ==========================================================================
  
  /**
   * 시나리오 시작
   */
  async startScenario(params: StartScenarioParams): Promise<StartScenarioResult> {
    const { scenarioId, playerId, playerFactionId } = params;
    
    // 시나리오 조회
    const scenario = await this.getScenario(scenarioId);
    if (!scenario) {
      return { success: false, error: 'Scenario not found' };
    }
    
    // 플레이 가능한 세력인지 확인
    const faction = scenario.factions.find(f => f.factionId === playerFactionId);
    if (!faction || !faction.isPlayable) {
      return { success: false, error: 'Faction not playable' };
    }
    
    // 세션 ID 생성
    const sessionId = params.sessionId || `scenario_${scenarioId}_${Date.now()}`;
    
    try {
      // 세션 생성
      await ScenarioSession.create({
        sessionId,
        scenarioId,
        playerId,
        playerFactionId,
        currentTurn: 1,
        gameDate: scenario.initialState.gameDate,
        status: 'active',
        flags: new Map(),
        variables: new Map(),
        triggeredEvents: [],
        activeEvents: [],
        pendingChoices: [],
        satisfiedConditions: [],
        stats: {
          battlesWon: 0,
          battlesLost: 0,
          unitsLost: 0,
          unitsKilled: 0,
          charactersLost: 0,
          turnsPlayed: 0,
          playTimeMinutes: 0,
        },
        startedAt: new Date(),
        lastPlayedAt: new Date(),
      });
      
      this.emit('scenario:started', {
        sessionId,
        scenarioId,
        playerId,
        playerFactionId,
      });
      
      logger.info('[ScenarioLoaderService] Scenario started', {
        sessionId,
        scenarioId,
        playerId,
        playerFactionId,
      });
      
      return { success: true, sessionId };
    } catch (error) {
      logger.error('[ScenarioLoaderService] Failed to start scenario', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * 세션 조회
   */
  async getSession(sessionId: string): Promise<IScenarioSession | null> {
    return ScenarioSession.findOne({ sessionId });
  }
  
  /**
   * 플레이어의 활성 세션 목록
   */
  async getPlayerSessions(playerId: string): Promise<IScenarioSession[]> {
    return ScenarioSession.find({
      playerId,
      status: { $in: ['active', 'paused'] },
    }).sort({ lastPlayedAt: -1 });
  }
  
  /**
   * 세션 상태 업데이트
   */
  async updateSessionStatus(
    sessionId: string,
    status: 'active' | 'paused' | 'victory' | 'defeat' | 'abandoned'
  ): Promise<void> {
    const update: any = {
      status,
      lastPlayedAt: new Date(),
    };
    
    if (['victory', 'defeat', 'abandoned'].includes(status)) {
      update.completedAt = new Date();
    }
    
    await ScenarioSession.updateOne({ sessionId }, { $set: update });
    
    this.emit('session:statusChanged', { sessionId, status });
  }
  
  /**
   * 세션 삭제
   */
  async deleteSession(sessionId: string): Promise<void> {
    await ScenarioSession.deleteOne({ sessionId });
    
    this.emit('session:deleted', { sessionId });
  }
  
  // ==========================================================================
  // Cache Management
  // ==========================================================================
  
  /**
   * 캐시 클리어
   */
  clearCache(scenarioId?: string): void {
    if (scenarioId) {
      this.scenarioCache.delete(scenarioId);
    } else {
      this.scenarioCache.clear();
    }
  }
  
  /**
   * 시나리오 프리로드
   */
  async preloadScenarios(scenarioIds: string[]): Promise<void> {
    for (const id of scenarioIds) {
      await this.getScenario(id);
    }
  }
}

export default ScenarioLoaderService;















