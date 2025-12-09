/**
 * SessionLifecycleService - 세션 생명주기 관리 확장
 * 매뉴얼 기반 구현
 *
 * 기능:
 * - 세션 생성/시작/종료
 * - 캐릭터 선택 및 배정
 * - 승리 조건 판정
 * - 세션 상태 관리
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Gin7GameSession, IGin7GameSession } from '../../models/gin7/GameSession';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { Planet } from '../../models/gin7/Planet';
import { TimeEngine, GIN7_EVENTS } from '../../core/gin7/TimeEngine';
import { VictoryConditionService, victoryConditionService } from './VictoryConditionService';
import { logger } from '../../common/logger';

// ============================================================
// Types
// ============================================================

export enum SessionPhase {
  SETUP = 'SETUP',               // 설정 단계
  CHARACTER_SELECT = 'CHARACTER_SELECT', // 캐릭터 선택
  RUNNING = 'RUNNING',           // 진행 중
  PAUSED = 'PAUSED',             // 일시 중지
  ENDED = 'ENDED',               // 종료
}

export enum CharacterSelectMode {
  FREE = 'FREE',                 // 자유 선택
  LOTTERY = 'LOTTERY',           // 추첨
  DRAFT = 'DRAFT',               // 드래프트
  ASSIGNED = 'ASSIGNED',         // 지정
}

export interface SessionConfig {
  name: string;
  scenario: string;              // 시나리오 ID
  maxPlayers: number;
  selectMode: CharacterSelectMode;
  timeScale: number;             // 게임 속도
  startDate: {
    year: number;
    month: number;
    day: number;
  };
  options: {
    allowOriginalCharacters: boolean;
    allowNewCharacters: boolean;
    permadeath: boolean;
    aiDifficulty: 'easy' | 'normal' | 'hard';
  };
}

export interface CharacterSelection {
  playerId: string;
  characterId: string;
  selectedAt: Date;
  isOriginal: boolean;
}

export interface SessionState {
  sessionId: string;
  phase: SessionPhase;
  currentPlayers: number;
  maxPlayers: number;
  characterSelections: CharacterSelection[];
  startedAt?: Date;
  endedAt?: Date;
  winnerId?: string;
  winCondition?: string;
}

// ============================================================
// SessionLifecycleService Class
// ============================================================

export class SessionLifecycleService extends EventEmitter {
  private static instance: SessionLifecycleService;
  
  // 세션 상태 캐시
  private sessionStates: Map<string, SessionState> = new Map();
  
  // 캐릭터 선택 풀
  private characterPools: Map<string, string[]> = new Map();

  private constructor() {
    super();
    this.setupVictoryConditionEvents();
    logger.info('[SessionLifecycleService] Initialized');
  }

  public static getInstance(): SessionLifecycleService {
    if (!SessionLifecycleService.instance) {
      SessionLifecycleService.instance = new SessionLifecycleService();
    }
    return SessionLifecycleService.instance;
  }

  /**
   * VictoryConditionService 이벤트 연동
   */
  private setupVictoryConditionEvents(): void {
    victoryConditionService.on('victory:conditionMet', async (data) => {
      await this.handleVictory(data.sessionId, data.winnerId, data.conditionType);
    });
  }

  // ============================================================
  // 세션 생성
  // ============================================================

  /**
   * 새 세션 생성
   */
  public async createSession(config: SessionConfig): Promise<{
    success: boolean;
    sessionId?: string;
    error?: string;
  }> {
    try {
      const sessionId = `SESSION-${uuidv4().slice(0, 8)}`;

      // 게임 세션 생성
      const session = new Gin7GameSession({
        sessionId,
        name: config.name,
        scenario: config.scenario,
        status: 'setup',
        timeConfig: {
          tickRateMs: 1000,
          timeScale: config.timeScale,
          gameStartDate: config.startDate,
          baseTime: new Date(),
        },
        currentState: {
          tick: 0,
          gameDate: new Date(
            config.startDate.year,
            config.startDate.month - 1,
            config.startDate.day
          ),
          isPaused: true,
          lastTickTime: new Date(),
        },
        data: {
          maxPlayers: config.maxPlayers,
          selectMode: config.selectMode,
          options: config.options,
        },
      });

      await session.save();

      // 세션 상태 초기화
      const state: SessionState = {
        sessionId,
        phase: SessionPhase.SETUP,
        currentPlayers: 0,
        maxPlayers: config.maxPlayers,
        characterSelections: [],
      };
      this.sessionStates.set(sessionId, state);

      // 캐릭터 풀 초기화 (시나리오 기반)
      await this.initializeCharacterPool(sessionId, config.scenario, config.options);

      this.emit('session:created', {
        sessionId,
        config,
      });

      logger.info(`[SessionLifecycleService] Session created: ${sessionId}`);

      return { success: true, sessionId };
    } catch (error) {
      logger.error('[SessionLifecycleService] Create session error:', error);
      return { success: false, error: '세션 생성 중 오류 발생' };
    }
  }

  /**
   * 캐릭터 풀 초기화
   */
  private async initializeCharacterPool(
    sessionId: string,
    scenario: string,
    options: SessionConfig['options'],
  ): Promise<void> {
    const pool: string[] = [];

    // 원작 캐릭터 추가
    if (options.allowOriginalCharacters) {
      const originalCharacters = await Gin7Character.find({
        sessionId,
        isOriginal: true,
      }).lean();
      pool.push(...originalCharacters.map(c => c.characterId));
    }

    this.characterPools.set(sessionId, pool);
  }

  // ============================================================
  // 캐릭터 선택
  // ============================================================

  /**
   * 캐릭터 선택 단계 시작
   */
  public async startCharacterSelection(sessionId: string): Promise<{ success: boolean }> {
    const state = this.sessionStates.get(sessionId);
    if (!state) {
      return { success: false };
    }

    state.phase = SessionPhase.CHARACTER_SELECT;
    
    this.emit('session:characterSelectStarted', { sessionId });

    return { success: true };
  }

  /**
   * 캐릭터 선택 (자유 선택 모드)
   */
  public async selectCharacter(
    sessionId: string,
    playerId: string,
    characterId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const state = this.sessionStates.get(sessionId);
    if (!state || state.phase !== SessionPhase.CHARACTER_SELECT) {
      return { success: false, error: '캐릭터 선택 단계가 아닙니다.' };
    }

    // 이미 선택된 캐릭터인지 확인
    if (state.characterSelections.some(s => s.characterId === characterId)) {
      return { success: false, error: '이미 선택된 캐릭터입니다.' };
    }

    // 이미 선택한 플레이어인지 확인
    if (state.characterSelections.some(s => s.playerId === playerId)) {
      return { success: false, error: '이미 캐릭터를 선택했습니다.' };
    }

    // 캐릭터 존재 확인
    const character = await Gin7Character.findOne({ sessionId, characterId });
    if (!character) {
      return { success: false, error: '캐릭터를 찾을 수 없습니다.' };
    }

    // 선택 등록
    const selection: CharacterSelection = {
      playerId,
      characterId,
      selectedAt: new Date(),
      isOriginal: character.isOriginal || false,
    };
    state.characterSelections.push(selection);
    state.currentPlayers++;

    // 캐릭터에 플레이어 연결
    character.playerId = playerId;
    await character.save();

    this.emit('session:characterSelected', {
      sessionId,
      playerId,
      characterId,
      characterName: character.name,
    });

    return { success: true };
  }

  /**
   * 캐릭터 추첨 (추첨 모드)
   */
  public async lotteryCharacter(
    sessionId: string,
    playerId: string,
    preferences?: string[],  // 선호 캐릭터 목록
  ): Promise<{ success: boolean; characterId?: string; error?: string }> {
    const state = this.sessionStates.get(sessionId);
    if (!state || state.phase !== SessionPhase.CHARACTER_SELECT) {
      return { success: false, error: '캐릭터 선택 단계가 아닙니다.' };
    }

    const pool = this.characterPools.get(sessionId) || [];
    const selectedIds = state.characterSelections.map(s => s.characterId);
    const availableIds = pool.filter(id => !selectedIds.includes(id));

    if (availableIds.length === 0) {
      return { success: false, error: '선택 가능한 캐릭터가 없습니다.' };
    }

    // 선호도 기반 가중치 적용
    let selectedId: string;
    if (preferences && preferences.length > 0) {
      const preferredAvailable = availableIds.filter(id => preferences.includes(id));
      if (preferredAvailable.length > 0 && Math.random() < 0.7) {
        // 70% 확률로 선호 캐릭터 중에서 선택
        selectedId = preferredAvailable[Math.floor(Math.random() * preferredAvailable.length)];
      } else {
        selectedId = availableIds[Math.floor(Math.random() * availableIds.length)];
      }
    } else {
      selectedId = availableIds[Math.floor(Math.random() * availableIds.length)];
    }

    // 선택 등록
    const result = await this.selectCharacter(sessionId, playerId, selectedId);
    if (result.success) {
      return { success: true, characterId: selectedId };
    }

    return result;
  }

  /**
   * 선택 가능한 캐릭터 목록
   */
  public async getAvailableCharacters(sessionId: string): Promise<{
    available: Array<{ characterId: string; name: string; faction: string; isOriginal: boolean }>;
    selected: CharacterSelection[];
  }> {
    const state = this.sessionStates.get(sessionId);
    const selectedIds = state?.characterSelections.map(s => s.characterId) || [];

    const characters = await Gin7Character.find({
      sessionId,
      characterId: { $nin: selectedIds },
      status: 'active',
    }).lean();

    return {
      available: characters.map(c => ({
        characterId: c.characterId,
        name: c.name,
        faction: c.factionId || 'unknown',
        isOriginal: c.isOriginal || false,
      })),
      selected: state?.characterSelections || [],
    };
  }

  // ============================================================
  // 세션 진행
  // ============================================================

  /**
   * 세션 시작
   */
  public async startSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
    const state = this.sessionStates.get(sessionId);
    if (!state) {
      return { success: false, error: '세션을 찾을 수 없습니다.' };
    }

    // 최소 플레이어 수 확인
    if (state.currentPlayers < 1) {
      return { success: false, error: '최소 1명 이상의 플레이어가 필요합니다.' };
    }

    state.phase = SessionPhase.RUNNING;
    state.startedAt = new Date();

    // DB 업데이트
    await Gin7GameSession.updateOne(
      { sessionId },
      { 
        $set: { 
          status: 'running',
          'currentState.isPaused': false,
          'currentState.lastTickTime': new Date(),
        } 
      }
    );

    // TimeEngine에 등록
    try {
      const timeEngine = TimeEngine.getInstance();
      const session = await Gin7GameSession.findOne({ sessionId });
      if (session) {
        timeEngine.registerSession(session);
      }
    } catch (error) {
      logger.warn('[SessionLifecycleService] TimeEngine registration failed:', error);
    }

    this.emit('session:started', {
      sessionId,
      startedAt: state.startedAt,
      playerCount: state.currentPlayers,
    });

    logger.info(`[SessionLifecycleService] Session started: ${sessionId}`);

    return { success: true };
  }

  /**
   * 세션 일시 중지
   */
  public async pauseSession(sessionId: string): Promise<{ success: boolean }> {
    const state = this.sessionStates.get(sessionId);
    if (!state || state.phase !== SessionPhase.RUNNING) {
      return { success: false };
    }

    state.phase = SessionPhase.PAUSED;

    await Gin7GameSession.updateOne(
      { sessionId },
      { $set: { 'currentState.isPaused': true } }
    );

    try {
      const timeEngine = TimeEngine.getInstance();
      await timeEngine.togglePause(sessionId, true);
    } catch (error) {
      logger.warn('[SessionLifecycleService] TimeEngine pause failed:', error);
    }

    this.emit('session:paused', { sessionId });

    return { success: true };
  }

  /**
   * 세션 재개
   */
  public async resumeSession(sessionId: string): Promise<{ success: boolean }> {
    const state = this.sessionStates.get(sessionId);
    if (!state || state.phase !== SessionPhase.PAUSED) {
      return { success: false };
    }

    state.phase = SessionPhase.RUNNING;

    await Gin7GameSession.updateOne(
      { sessionId },
      { 
        $set: { 
          'currentState.isPaused': false,
          'currentState.lastTickTime': new Date(),
        } 
      }
    );

    try {
      const timeEngine = TimeEngine.getInstance();
      await timeEngine.togglePause(sessionId, false);
    } catch (error) {
      logger.warn('[SessionLifecycleService] TimeEngine resume failed:', error);
    }

    this.emit('session:resumed', { sessionId });

    return { success: true };
  }

  // ============================================================
  // 승리 처리
  // ============================================================

  /**
   * 승리 처리
   */
  private async handleVictory(
    sessionId: string,
    winnerId: string,
    winCondition: string,
  ): Promise<void> {
    const state = this.sessionStates.get(sessionId);
    if (!state || state.phase === SessionPhase.ENDED) {
      return;
    }

    state.phase = SessionPhase.ENDED;
    state.endedAt = new Date();
    state.winnerId = winnerId;
    state.winCondition = winCondition;

    // DB 업데이트
    await Gin7GameSession.updateOne(
      { sessionId },
      { 
        $set: { 
          status: 'finished',
          'data.winnerId': winnerId,
          'data.winCondition': winCondition,
          'data.endedAt': state.endedAt,
        } 
      }
    );

    // TimeEngine에서 제거
    try {
      const timeEngine = TimeEngine.getInstance();
      await timeEngine.endSession(sessionId, winnerId, winCondition);
    } catch (error) {
      logger.warn('[SessionLifecycleService] TimeEngine end failed:', error);
    }

    this.emit('session:ended', {
      sessionId,
      winnerId,
      winCondition,
      endedAt: state.endedAt,
    });

    logger.info(`[SessionLifecycleService] Session ended: ${sessionId}, Winner: ${winnerId}`);
  }

  /**
   * 세션 강제 종료
   */
  public async forceEndSession(
    sessionId: string,
    reason: string,
  ): Promise<{ success: boolean }> {
    const state = this.sessionStates.get(sessionId);
    if (!state) {
      return { success: false };
    }

    state.phase = SessionPhase.ENDED;
    state.endedAt = new Date();
    state.winCondition = `Forced: ${reason}`;

    await Gin7GameSession.updateOne(
      { sessionId },
      { 
        $set: { 
          status: 'finished',
          'data.winCondition': state.winCondition,
          'data.endedAt': state.endedAt,
        } 
      }
    );

    try {
      const timeEngine = TimeEngine.getInstance();
      await timeEngine.endSession(sessionId, undefined, reason);
    } catch (error) {
      logger.warn('[SessionLifecycleService] TimeEngine force end failed:', error);
    }

    this.emit('session:forceEnded', {
      sessionId,
      reason,
      endedAt: state.endedAt,
    });

    return { success: true };
  }

  // ============================================================
  // 조회
  // ============================================================

  /**
   * 세션 상태 조회
   */
  public getSessionState(sessionId: string): SessionState | undefined {
    return this.sessionStates.get(sessionId);
  }

  /**
   * 활성 세션 목록
   */
  public getActiveSessions(): SessionState[] {
    return Array.from(this.sessionStates.values())
      .filter(s => s.phase !== SessionPhase.ENDED);
  }

  /**
   * 세션 통계
   */
  public async getSessionStats(sessionId: string): Promise<{
    duration: number;
    playerCount: number;
    factionStats: Record<string, { planets: number; characters: number }>;
  } | null> {
    const state = this.sessionStates.get(sessionId);
    if (!state) return null;

    const startTime = state.startedAt?.getTime() || Date.now();
    const endTime = state.endedAt?.getTime() || Date.now();
    const duration = endTime - startTime;

    // 진영별 통계
    const planets = await Planet.find({ sessionId }).lean();
    const characters = await Gin7Character.find({ sessionId, status: 'active' }).lean();

    const factionStats: Record<string, { planets: number; characters: number }> = {};
    
    for (const planet of planets) {
      const factionId = planet.ownerId || 'unowned';
      if (!factionStats[factionId]) {
        factionStats[factionId] = { planets: 0, characters: 0 };
      }
      factionStats[factionId].planets++;
    }

    for (const char of characters) {
      const factionId = char.factionId || 'unknown';
      if (!factionStats[factionId]) {
        factionStats[factionId] = { planets: 0, characters: 0 };
      }
      factionStats[factionId].characters++;
    }

    return {
      duration,
      playerCount: state.currentPlayers,
      factionStats,
    };
  }
}

export const sessionLifecycleService = SessionLifecycleService.getInstance();
export default SessionLifecycleService;





