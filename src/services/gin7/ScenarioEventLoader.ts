/**
 * ScenarioEventLoader - 시나리오 이벤트 로더 서비스
 *
 * 시나리오 이벤트 데이터 로드 및 관리
 * - 모든 이벤트 로드
 * - 진영별 이벤트 조회
 * - 트리거 체크
 * - 이벤트 실행
 * - 선택지 처리
 */

import { EventEmitter } from 'events';
import { logger } from '../../common/logger';
import { ScenarioEvent, EventTriggerType } from '../../types/gin7/scenario.types';

// 이벤트 데이터 import
import {
  ALL_SCENARIO_EVENTS,
  ALL_EVENT_IDS,
  IMPERIAL_EVENTS,
  ALLIANCE_EVENTS,
  INDEPENDENCE_EVENTS,
  getImperialEventById,
  getAllianceEventById,
  getIndependenceEventById,
} from '../../constants/gin7/scenario_events';

// ============================================================================
// Types
// ============================================================================

/**
 * 진영 타입 (이벤트 로더용)
 */
export type ScenarioFactionType = 'imperial' | 'alliance' | 'independence' | 'all';

/**
 * 이벤트 트리거 컨텍스트
 */
export interface ScenarioEventTriggerContext {
  sessionId: string;
  currentTurn: number;
  gameDate: { year: number; month: number; day: number };
  factionId?: string;
  characterId?: string;
  fleetId?: string;
  locationId?: string;
  triggeredEventId?: string;
  customData?: Record<string, unknown>;
}

/**
 * 이벤트 실행 결과 (이벤트 로더용)
 */
export interface ScenarioEventExecutionResult {
  success: boolean;
  eventId: string;
  eventName: string;
  actionsExecuted: number;
  choicesPending: boolean;
  error?: string;
}

/**
 * 선택지 처리 결과
 */
export interface ChoiceResult {
  success: boolean;
  eventId: string;
  choiceId: string;
  actionsExecuted: number;
  error?: string;
}

// ============================================================================
// ScenarioEventLoader Service
// ============================================================================

export class ScenarioEventLoader extends EventEmitter {
  private static instance: ScenarioEventLoader;

  // 로드된 이벤트 저장소
  private loadedEvents: Map<string, ScenarioEvent> = new Map();

  // 세션별 트리거된 이벤트 기록
  private triggeredEvents: Map<string, Set<string>> = new Map();

  // 세션별 대기 중인 선택지
  private pendingChoices: Map<string, { eventId: string; choiceIds: string[] }[]> = new Map();

  // 세션별 플래그 저장소
  private sessionFlags: Map<string, Map<string, unknown>> = new Map();

  private constructor() {
    super();
    this.loadAllEvents();
    logger.info('[ScenarioEventLoader] Initialized');
  }

  public static getInstance(): ScenarioEventLoader {
    if (!ScenarioEventLoader.instance) {
      ScenarioEventLoader.instance = new ScenarioEventLoader();
    }
    return ScenarioEventLoader.instance;
  }

  // ==========================================================================
  // Event Loading
  // ==========================================================================

  /**
   * 모든 이벤트 로드
   */
  private loadAllEvents(): void {
    for (const event of ALL_SCENARIO_EVENTS) {
      this.loadedEvents.set(event.id, event);
    }

    logger.info('[ScenarioEventLoader] All events loaded', {
      total: this.loadedEvents.size,
      imperial: IMPERIAL_EVENTS.length,
      alliance: ALLIANCE_EVENTS.length,
      independence: INDEPENDENCE_EVENTS.length,
    });
  }

  /**
   * 이벤트 재로드
   */
  public reloadEvents(): void {
    this.loadedEvents.clear();
    this.loadAllEvents();
    this.emit('events:reloaded', { count: this.loadedEvents.size });
  }

  // ==========================================================================
  // Event Query Methods
  // ==========================================================================

  /**
   * 이벤트 ID로 조회
   */
  public getEventById(eventId: string): ScenarioEvent | undefined {
    return this.loadedEvents.get(eventId);
  }

  /**
   * 진영별 이벤트 조회
   */
  public getEventsByFaction(faction: ScenarioFactionType): ScenarioEvent[] {
    switch (faction) {
      case 'imperial':
        return [...IMPERIAL_EVENTS];
      case 'alliance':
        return [...ALLIANCE_EVENTS];
      case 'independence':
        return [...INDEPENDENCE_EVENTS];
      case 'all':
      default:
        return [...ALL_SCENARIO_EVENTS];
    }
  }

  /**
   * 트리거 타입별 이벤트 조회
   */
  public getEventsByTriggerType(triggerType: EventTriggerType): ScenarioEvent[] {
    return Array.from(this.loadedEvents.values()).filter(
      (event) => event.trigger.type === triggerType
    );
  }

  /**
   * 활성화된 이벤트만 조회
   */
  public getActiveEvents(): ScenarioEvent[] {
    return Array.from(this.loadedEvents.values()).filter(
      (event) => event.enabled !== false
    );
  }

  /**
   * 선택지가 있는 이벤트 조회
   */
  public getEventsWithChoices(): ScenarioEvent[] {
    return Array.from(this.loadedEvents.values()).filter(
      (event) => event.choices && event.choices.length > 0
    );
  }

  /**
   * 모든 이벤트 ID 조회
   */
  public getAllEventIds(): typeof ALL_EVENT_IDS {
    return ALL_EVENT_IDS;
  }

  // ==========================================================================
  // Trigger Checking
  // ==========================================================================

  /**
   * 이벤트 트리거 조건 체크
   */
  public checkEventTriggers(
    context: ScenarioEventTriggerContext
  ): ScenarioEvent[] {
    const triggerableEvents: ScenarioEvent[] = [];

    for (const event of Array.from(this.loadedEvents.values())) {
      // 비활성화된 이벤트 스킵
      if (event.enabled === false) continue;

      // 이미 트리거된 1회성 이벤트 스킵
      if (event.once) {
        const triggered = this.triggeredEvents.get(context.sessionId);
        if (triggered?.has(event.id)) continue;
      }

      // 트리거 조건 체크
      if (this.checkTrigger(event, context)) {
        triggerableEvents.push(event);
      }
    }

    // 우선순위로 정렬
    triggerableEvents.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    return triggerableEvents;
  }

  /**
   * 단일 이벤트 트리거 조건 체크
   */
  private checkTrigger(event: ScenarioEvent, context: ScenarioEventTriggerContext): boolean {
    const { trigger } = event;
    const params = trigger.params;

    switch (trigger.type) {
      case 'ON_TURN':
        return params.turn === context.currentTurn;

      case 'ON_TURN_RANGE':
        return (
          context.currentTurn >= (params.turnMin || 0) &&
          context.currentTurn <= (params.turnMax || Infinity)
        );

      case 'ON_DAY_START':
      case 'ON_MONTH_START':
        return true; // TimeEngine에서 호출될 때 이미 조건 충족

      case 'ON_EVENT_TRIGGERED':
        return params.eventId === context.triggeredEventId;

      case 'ON_PLANET_CAPTURED':
        return (
          params.locationId === context.locationId &&
          (!params.factionId || params.factionId === context.factionId)
        );

      case 'ON_FLEET_ARRIVED':
        return (
          params.locationId === context.locationId &&
          (!params.fleetId || params.fleetId === context.fleetId)
        );

      case 'ON_CHARACTER_DEATH':
      case 'ON_CHARACTER_CAPTURED':
        return params.characterId === context.characterId;

      case 'ON_CONDITION_MET':
        return this.checkConditionMet(params.conditionId as string, context);

      case 'MANUAL':
        return false; // 수동 트리거만 가능

      default:
        return true;
    }
  }

  /**
   * 조건 충족 여부 체크
   */
  private checkConditionMet(conditionId: string, context: ScenarioEventTriggerContext): boolean {
    const flags = this.sessionFlags.get(context.sessionId);
    if (!flags) return false;

    // 조건 ID에 해당하는 플래그가 true인지 확인
    return flags.get(conditionId) === true;
  }

  // ==========================================================================
  // Event Execution
  // ==========================================================================

  /**
   * 이벤트 실행
   */
  public async executeEvent(
    eventId: string,
    context: ScenarioEventTriggerContext
  ): Promise<ScenarioEventExecutionResult> {
    const event = this.loadedEvents.get(eventId);

    if (!event) {
      logger.warn('[ScenarioEventLoader] Event not found', { eventId });
      return {
        success: false,
        eventId,
        eventName: 'Unknown',
        actionsExecuted: 0,
        choicesPending: false,
        error: `Event not found: ${eventId}`,
      };
    }

    logger.info('[ScenarioEventLoader] Executing event', {
      eventId: event.id,
      eventName: event.name,
      sessionId: context.sessionId,
    });

    try {
      // 이벤트 트리거 기록
      this.recordTriggeredEvent(context.sessionId, eventId);

      // 선택지가 있는 경우 대기 상태로
      if (event.choices && event.choices.length > 0) {
        this.addPendingChoice(context.sessionId, eventId, event.choices.map(c => c.id));

        this.emit('event:choiceRequired', {
          sessionId: context.sessionId,
          eventId: event.id,
          eventName: event.name,
          choices: event.choices,
        });

        return {
          success: true,
          eventId: event.id,
          eventName: event.name,
          actionsExecuted: 0,
          choicesPending: true,
        };
      }

      // 액션 실행
      const actionsExecuted = await this.executeActions(event.actions, context);

      this.emit('event:executed', {
        sessionId: context.sessionId,
        eventId: event.id,
        eventName: event.name,
        actionsExecuted,
      });

      return {
        success: true,
        eventId: event.id,
        eventName: event.name,
        actionsExecuted,
        choicesPending: false,
      };
    } catch (error) {
      logger.error('[ScenarioEventLoader] Event execution failed', {
        eventId,
        error,
      });

      return {
        success: false,
        eventId: event.id,
        eventName: event.name,
        actionsExecuted: 0,
        choicesPending: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 액션 실행
   */
  private async executeActions(
    actions: ScenarioEvent['actions'],
    context: ScenarioEventTriggerContext
  ): Promise<number> {
    let executed = 0;

    for (const action of actions) {
      // 딜레이 처리
      if (action.delay && action.delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, action.delay));
      }

      // 액션 타입별 이벤트 emit
      this.emit(`action:${action.type.toLowerCase()}`, {
        sessionId: context.sessionId,
        params: action.params,
      });

      // SET_FLAG 액션 직접 처리
      if (action.type === 'SET_FLAG' && action.params.flagName) {
        this.setFlag(
          context.sessionId,
          action.params.flagName as string,
          action.params.flagValue ?? true
        );
      }

      // TRIGGER_EVENT 액션 처리
      if (action.type === 'TRIGGER_EVENT' && action.params.eventId) {
        setTimeout(() => {
          this.executeEvent(action.params.eventId as string, {
            ...context,
            triggeredEventId: action.params.eventId as string,
          });
        }, action.delay || 0);
      }

      executed++;
    }

    return executed;
  }

  // ==========================================================================
  // Choice Handling
  // ==========================================================================

  /**
   * 선택지 처리
   */
  public async handleChoice(
    sessionId: string,
    eventId: string,
    choiceId: string
  ): Promise<ChoiceResult> {
    const event = this.loadedEvents.get(eventId);

    if (!event || !event.choices) {
      return {
        success: false,
        eventId,
        choiceId,
        actionsExecuted: 0,
        error: 'Event or choices not found',
      };
    }

    const choice = event.choices.find((c) => c.id === choiceId);

    if (!choice) {
      return {
        success: false,
        eventId,
        choiceId,
        actionsExecuted: 0,
        error: `Choice not found: ${choiceId}`,
      };
    }

    logger.info('[ScenarioEventLoader] Processing choice', {
      eventId,
      choiceId,
      sessionId,
    });

    try {
      // 선택지 액션 실행
      const context: ScenarioEventTriggerContext = {
        sessionId,
        currentTurn: 0, // 실제 턴 정보는 세션에서 가져와야 함
        gameDate: { year: 0, month: 0, day: 0 },
      };

      const actionsExecuted = await this.executeActions(choice.actions, context);

      // 대기 중인 선택지 제거
      this.removePendingChoice(sessionId, eventId);

      this.emit('event:choiceProcessed', {
        sessionId,
        eventId,
        choiceId,
        choiceText: choice.text,
        actionsExecuted,
      });

      return {
        success: true,
        eventId,
        choiceId,
        actionsExecuted,
      };
    } catch (error) {
      logger.error('[ScenarioEventLoader] Choice processing failed', {
        eventId,
        choiceId,
        error,
      });

      return {
        success: false,
        eventId,
        choiceId,
        actionsExecuted: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 대기 중인 선택지 조회
   */
  public getPendingChoices(sessionId: string): { eventId: string; choiceIds: string[] }[] {
    return this.pendingChoices.get(sessionId) || [];
  }

  // ==========================================================================
  // Internal State Management
  // ==========================================================================

  /**
   * 트리거된 이벤트 기록
   */
  private recordTriggeredEvent(sessionId: string, eventId: string): void {
    if (!this.triggeredEvents.has(sessionId)) {
      this.triggeredEvents.set(sessionId, new Set());
    }
    this.triggeredEvents.get(sessionId)!.add(eventId);
  }

  /**
   * 대기 중인 선택지 추가
   */
  private addPendingChoice(
    sessionId: string,
    eventId: string,
    choiceIds: string[]
  ): void {
    if (!this.pendingChoices.has(sessionId)) {
      this.pendingChoices.set(sessionId, []);
    }
    this.pendingChoices.get(sessionId)!.push({ eventId, choiceIds });
  }

  /**
   * 대기 중인 선택지 제거
   */
  private removePendingChoice(sessionId: string, eventId: string): void {
    const pending = this.pendingChoices.get(sessionId);
    if (pending) {
      const index = pending.findIndex((p) => p.eventId === eventId);
      if (index !== -1) {
        pending.splice(index, 1);
      }
    }
  }

  /**
   * 플래그 설정
   */
  public setFlag(sessionId: string, flagName: string, value: unknown): void {
    if (!this.sessionFlags.has(sessionId)) {
      this.sessionFlags.set(sessionId, new Map());
    }
    this.sessionFlags.get(sessionId)!.set(flagName, value);

    logger.debug('[ScenarioEventLoader] Flag set', { sessionId, flagName, value });
  }

  /**
   * 플래그 조회
   */
  public getFlag(sessionId: string, flagName: string): unknown {
    return this.sessionFlags.get(sessionId)?.get(flagName);
  }

  /**
   * 모든 플래그 조회
   */
  public getAllFlags(sessionId: string): Record<string, unknown> {
    const flags = this.sessionFlags.get(sessionId);
    if (!flags) return {};

    const result: Record<string, unknown> = {};
    flags.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  // ==========================================================================
  // Session Cleanup
  // ==========================================================================

  /**
   * 세션 정리
   */
  public cleanupSession(sessionId: string): void {
    this.triggeredEvents.delete(sessionId);
    this.pendingChoices.delete(sessionId);
    this.sessionFlags.delete(sessionId);

    logger.info('[ScenarioEventLoader] Session cleaned up', { sessionId });
  }

  /**
   * 전체 초기화
   */
  public reset(): void {
    this.triggeredEvents.clear();
    this.pendingChoices.clear();
    this.sessionFlags.clear();

    logger.info('[ScenarioEventLoader] Reset complete');
  }

  // ==========================================================================
  // Statistics
  // ==========================================================================

  /**
   * 로드된 이벤트 통계
   */
  public getStatistics(): {
    totalEvents: number;
    imperialEvents: number;
    allianceEvents: number;
    independenceEvents: number;
    eventsWithChoices: number;
  } {
    return {
      totalEvents: this.loadedEvents.size,
      imperialEvents: IMPERIAL_EVENTS.length,
      allianceEvents: ALLIANCE_EVENTS.length,
      independenceEvents: INDEPENDENCE_EVENTS.length,
      eventsWithChoices: this.getEventsWithChoices().length,
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const scenarioEventLoader = ScenarioEventLoader.getInstance();

export default ScenarioEventLoader;

