/**
 * SessionStateMachine - 세션 상태 머신
 * 세션의 생명주기 상태 전환 관리
 *
 * 기능:
 * - 상태 전환 규칙 정의
 * - 상태 전환 가능 여부 확인
 * - 가능한 액션 조회
 */

import { EventEmitter } from 'events';
import { logger } from '../../common/logger';

// ============================================================
// Types & Enums
// ============================================================

/**
 * 세션 머신 상태 (SessionLifecycleService의 SessionPhase와 구분)
 */
export enum SMSessionState {
  CREATED = 'CREATED',                   // 생성됨
  SETUP = 'SETUP',                       // 설정 단계
  CHARACTER_SELECT = 'CHARACTER_SELECT', // 캐릭터 선택
  STARTING = 'STARTING',                 // 시작 중
  RUNNING = 'RUNNING',                   // 진행 중
  PAUSED = 'PAUSED',                     // 일시 중지
  ENDING = 'ENDING',                     // 종료 중
  ENDED = 'ENDED',                       // 종료됨
}

/**
 * 상태 전환 액션
 */
export enum SessionAction {
  CREATE = 'CREATE',                     // 세션 생성
  CONFIGURE = 'CONFIGURE',               // 설정 변경
  START_CHARACTER_SELECT = 'START_CHARACTER_SELECT', // 캐릭터 선택 시작
  SELECT_CHARACTER = 'SELECT_CHARACTER', // 캐릭터 선택
  START = 'START',                       // 게임 시작
  PAUSE = 'PAUSE',                       // 일시 중지
  RESUME = 'RESUME',                     // 재개
  END = 'END',                           // 종료 시작
  FORCE_END = 'FORCE_END',               // 강제 종료
  FINALIZE = 'FINALIZE',                 // 종료 완료
}

/**
 * 상태 전환 규칙
 */
interface StateTransition {
  from: SMSessionState;
  to: SMSessionState;
  action: SessionAction;
  condition?: (context: SessionContext) => boolean;
}

/**
 * 세션 컨텍스트
 */
export interface SessionContext {
  sessionId: string;
  currentState: SMSessionState;
  playerCount: number;
  minPlayers: number;
  maxPlayers: number;
  characterSelectionComplete: boolean;
  hasWinner: boolean;
  forcedEnd: boolean;
  createdAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  data?: Record<string, unknown>;
}

/**
 * 상태 전환 결과
 */
export interface TransitionResult {
  success: boolean;
  previousState?: SMSessionState;
  currentState: SMSessionState;
  action?: SessionAction;
  error?: string;
}

// ============================================================
// 상태 전환 규칙 정의
// ============================================================

const STATE_TRANSITIONS: StateTransition[] = [
  // CREATED -> SETUP
  {
    from: SMSessionState.CREATED,
    to: SMSessionState.SETUP,
    action: SessionAction.CONFIGURE,
  },
  
  // SETUP -> CHARACTER_SELECT
  {
    from: SMSessionState.SETUP,
    to: SMSessionState.CHARACTER_SELECT,
    action: SessionAction.START_CHARACTER_SELECT,
  },
  
  // CHARACTER_SELECT -> STARTING (캐릭터 선택 완료)
  {
    from: SMSessionState.CHARACTER_SELECT,
    to: SMSessionState.STARTING,
    action: SessionAction.START,
    condition: (ctx) => ctx.playerCount >= ctx.minPlayers,
  },
  
  // STARTING -> RUNNING
  {
    from: SMSessionState.STARTING,
    to: SMSessionState.RUNNING,
    action: SessionAction.START,
  },
  
  // RUNNING -> PAUSED
  {
    from: SMSessionState.RUNNING,
    to: SMSessionState.PAUSED,
    action: SessionAction.PAUSE,
  },
  
  // PAUSED -> RUNNING
  {
    from: SMSessionState.PAUSED,
    to: SMSessionState.RUNNING,
    action: SessionAction.RESUME,
  },
  
  // RUNNING -> ENDING (승리 조건 충족)
  {
    from: SMSessionState.RUNNING,
    to: SMSessionState.ENDING,
    action: SessionAction.END,
    condition: (ctx) => ctx.hasWinner,
  },
  
  // RUNNING -> ENDING (강제 종료)
  {
    from: SMSessionState.RUNNING,
    to: SMSessionState.ENDING,
    action: SessionAction.FORCE_END,
  },
  
  // PAUSED -> ENDING (강제 종료)
  {
    from: SMSessionState.PAUSED,
    to: SMSessionState.ENDING,
    action: SessionAction.FORCE_END,
  },
  
  // ENDING -> ENDED
  {
    from: SMSessionState.ENDING,
    to: SMSessionState.ENDED,
    action: SessionAction.FINALIZE,
  },
];

// 상태별 가능한 액션
const STATE_ACTIONS: Record<SMSessionState, SessionAction[]> = {
  [SMSessionState.CREATED]: [SessionAction.CONFIGURE],
  [SMSessionState.SETUP]: [SessionAction.CONFIGURE, SessionAction.START_CHARACTER_SELECT],
  [SMSessionState.CHARACTER_SELECT]: [SessionAction.SELECT_CHARACTER, SessionAction.START],
  [SMSessionState.STARTING]: [SessionAction.START],
  [SMSessionState.RUNNING]: [SessionAction.PAUSE, SessionAction.END, SessionAction.FORCE_END],
  [SMSessionState.PAUSED]: [SessionAction.RESUME, SessionAction.FORCE_END],
  [SMSessionState.ENDING]: [SessionAction.FINALIZE],
  [SMSessionState.ENDED]: [],
};

// ============================================================
// SessionStateMachine Class
// ============================================================

export class SessionStateMachine extends EventEmitter {
  private static instance: SessionStateMachine;
  
  // 세션별 컨텍스트 저장
  private sessionContexts: Map<string, SessionContext> = new Map();

  private constructor() {
    super();
    logger.info('[SessionStateMachine] Initialized');
  }

  public static getInstance(): SessionStateMachine {
    if (!SessionStateMachine.instance) {
      SessionStateMachine.instance = new SessionStateMachine();
    }
    return SessionStateMachine.instance;
  }

  // ============================================================
  // 컨텍스트 관리
  // ============================================================

  /**
   * 새 세션 컨텍스트 생성
   */
  public createContext(
    sessionId: string,
    options: {
      minPlayers?: number;
      maxPlayers?: number;
      data?: Record<string, unknown>;
    } = {},
  ): SessionContext {
    const context: SessionContext = {
      sessionId,
      currentState: SMSessionState.CREATED,
      playerCount: 0,
      minPlayers: options.minPlayers ?? 1,
      maxPlayers: options.maxPlayers ?? 100,
      characterSelectionComplete: false,
      hasWinner: false,
      forcedEnd: false,
      createdAt: new Date(),
      data: options.data,
    };

    this.sessionContexts.set(sessionId, context);
    
    this.emit('context:created', { sessionId, context });
    logger.info(`[SessionStateMachine] Context created for session: ${sessionId}`);

    return context;
  }

  /**
   * 세션 컨텍스트 조회
   */
  public getContext(sessionId: string): SessionContext | undefined {
    return this.sessionContexts.get(sessionId);
  }

  /**
   * 세션 컨텍스트 업데이트
   */
  public updateContext(
    sessionId: string,
    updates: Partial<Omit<SessionContext, 'sessionId' | 'currentState'>>,
  ): SessionContext | undefined {
    const context = this.sessionContexts.get(sessionId);
    if (!context) {
      logger.warn(`[SessionStateMachine] Context not found: ${sessionId}`);
      return undefined;
    }

    Object.assign(context, updates);
    
    this.emit('context:updated', { sessionId, updates, context });
    
    return context;
  }

  /**
   * 세션 컨텍스트 삭제
   */
  public deleteContext(sessionId: string): boolean {
    const deleted = this.sessionContexts.delete(sessionId);
    if (deleted) {
      this.emit('context:deleted', { sessionId });
      logger.info(`[SessionStateMachine] Context deleted: ${sessionId}`);
    }
    return deleted;
  }

  // ============================================================
  // 상태 조회
  // ============================================================

  /**
   * 현재 상태 조회
   */
  public getCurrentState(sessionId: string): SMSessionState | undefined {
    return this.sessionContexts.get(sessionId)?.currentState;
  }

  /**
   * 특정 상태인지 확인
   */
  public isInState(sessionId: string, state: SMSessionState): boolean {
    return this.getCurrentState(sessionId) === state;
  }

  /**
   * 세션이 활성 상태인지 확인
   */
  public isActive(sessionId: string): boolean {
    const state = this.getCurrentState(sessionId);
    return state === SMSessionState.RUNNING || state === SMSessionState.PAUSED;
  }

  /**
   * 세션이 종료되었는지 확인
   */
  public isEnded(sessionId: string): boolean {
    const state = this.getCurrentState(sessionId);
    return state === SMSessionState.ENDING || state === SMSessionState.ENDED;
  }

  // ============================================================
  // 상태 전환
  // ============================================================

  /**
   * 상태 전환 가능 여부 확인
   */
  public canTransition(sessionId: string, action: SessionAction): boolean {
    const context = this.sessionContexts.get(sessionId);
    if (!context) {
      return false;
    }

    const transition = this.findTransition(context.currentState, action);
    if (!transition) {
      return false;
    }

    // 조건이 있으면 조건 확인
    if (transition.condition && !transition.condition(context)) {
      return false;
    }

    return true;
  }

  /**
   * 상태 전환 실행
   */
  public transition(sessionId: string, action: SessionAction): TransitionResult {
    const context = this.sessionContexts.get(sessionId);
    if (!context) {
      return {
        success: false,
        currentState: SMSessionState.CREATED,
        error: '세션을 찾을 수 없습니다.',
      };
    }

    const previousState = context.currentState;
    const transition = this.findTransition(previousState, action);

    if (!transition) {
      return {
        success: false,
        currentState: previousState,
        error: `현재 상태(${previousState})에서 액션(${action})을 수행할 수 없습니다.`,
      };
    }

    // 조건 확인
    if (transition.condition && !transition.condition(context)) {
      return {
        success: false,
        currentState: previousState,
        error: '상태 전환 조건을 충족하지 않습니다.',
      };
    }

    // 상태 전환 실행
    context.currentState = transition.to;

    // 특수 상태 처리
    if (transition.to === SMSessionState.STARTING || transition.to === SMSessionState.RUNNING) {
      context.startedAt = context.startedAt ?? new Date();
    }
    if (transition.to === SMSessionState.ENDED) {
      context.endedAt = new Date();
    }

    this.emit('state:changed', {
      sessionId,
      previousState,
      currentState: context.currentState,
      action,
    });

    logger.info(`[SessionStateMachine] Session ${sessionId}: ${previousState} -> ${context.currentState} (${action})`);

    return {
      success: true,
      previousState,
      currentState: context.currentState,
      action,
    };
  }

  /**
   * 전환 규칙 찾기
   */
  private findTransition(
    fromState: SMSessionState,
    action: SessionAction,
  ): StateTransition | undefined {
    return STATE_TRANSITIONS.find(
      (t) => t.from === fromState && t.action === action,
    );
  }

  // ============================================================
  // 가능한 액션 조회
  // ============================================================

  /**
   * 현재 상태에서 가능한 모든 액션 조회
   */
  public getAvailableActions(sessionId: string): SessionAction[] {
    const context = this.sessionContexts.get(sessionId);
    if (!context) {
      return [];
    }

    const possibleActions = STATE_ACTIONS[context.currentState] || [];
    
    // 조건부 액션 필터링
    return possibleActions.filter((action) => {
      const transition = this.findTransition(context.currentState, action);
      if (!transition) return false;
      if (transition.condition && !transition.condition(context)) return false;
      return true;
    });
  }

  /**
   * 상태별 가능한 액션 목록 조회 (정적)
   */
  public getStateActions(state: SMSessionState): SessionAction[] {
    return STATE_ACTIONS[state] || [];
  }

  // ============================================================
  // 헬퍼 메서드
  // ============================================================

  /**
   * 상태 이름 반환
   */
  public getStateName(state: SMSessionState): string {
    const names: Record<SMSessionState, string> = {
      [SMSessionState.CREATED]: '생성됨',
      [SMSessionState.SETUP]: '설정 중',
      [SMSessionState.CHARACTER_SELECT]: '캐릭터 선택',
      [SMSessionState.STARTING]: '시작 중',
      [SMSessionState.RUNNING]: '진행 중',
      [SMSessionState.PAUSED]: '일시 중지',
      [SMSessionState.ENDING]: '종료 중',
      [SMSessionState.ENDED]: '종료됨',
    };
    return names[state] || state;
  }

  /**
   * 액션 이름 반환
   */
  public getActionName(action: SessionAction): string {
    const names: Record<SessionAction, string> = {
      [SessionAction.CREATE]: '생성',
      [SessionAction.CONFIGURE]: '설정',
      [SessionAction.START_CHARACTER_SELECT]: '캐릭터 선택 시작',
      [SessionAction.SELECT_CHARACTER]: '캐릭터 선택',
      [SessionAction.START]: '시작',
      [SessionAction.PAUSE]: '일시 중지',
      [SessionAction.RESUME]: '재개',
      [SessionAction.END]: '종료',
      [SessionAction.FORCE_END]: '강제 종료',
      [SessionAction.FINALIZE]: '완료',
    };
    return names[action] || action;
  }

  /**
   * 모든 활성 세션 조회
   */
  public getActiveSessions(): SessionContext[] {
    return Array.from(this.sessionContexts.values()).filter(
      (ctx) => ctx.currentState === SMSessionState.RUNNING || ctx.currentState === SMSessionState.PAUSED,
    );
  }

  /**
   * 상태별 세션 수 조회
   */
  public getSessionCountByState(): Record<SMSessionState, number> {
    const counts: Record<SMSessionState, number> = {
      [SMSessionState.CREATED]: 0,
      [SMSessionState.SETUP]: 0,
      [SMSessionState.CHARACTER_SELECT]: 0,
      [SMSessionState.STARTING]: 0,
      [SMSessionState.RUNNING]: 0,
      [SMSessionState.PAUSED]: 0,
      [SMSessionState.ENDING]: 0,
      [SMSessionState.ENDED]: 0,
    };

    for (const ctx of Array.from(this.sessionContexts.values())) {
      counts[ctx.currentState]++;
    }

    return counts;
  }

  // ============================================================
  // 정리
  // ============================================================

  /**
   * 종료된 세션 정리
   */
  public cleanupEndedSessions(olderThanMs: number = 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, context] of Array.from(this.sessionContexts.entries())) {
      if (context.currentState === SMSessionState.ENDED && context.endedAt) {
        if (now - context.endedAt.getTime() > olderThanMs) {
          this.sessionContexts.delete(sessionId);
          cleaned++;
        }
      }
    }

    if (cleaned > 0) {
      logger.info(`[SessionStateMachine] Cleaned up ${cleaned} ended sessions`);
    }

    return cleaned;
  }
}

export const sessionStateMachine = SessionStateMachine.getInstance();
export default SessionStateMachine;
