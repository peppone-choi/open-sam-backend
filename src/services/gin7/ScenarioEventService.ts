/**
 * ScenarioEventService - 시나리오 이벤트 서비스
 * 
 * 이벤트 조건 체크, 이벤트 결과 적용, 분기 선택지, 이벤트 체인
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { ScenarioSession, IScenarioSession } from '../../models/gin7/ScenarioSession';
import { Scenario, IScenario } from '../../models/gin7/Scenario';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { Fleet, IFleet } from '../../models/gin7/Fleet';
import { Planet, IPlanet } from '../../models/gin7/Planet';
import { Faction, IFaction } from '../../models/gin7/Faction';
import { logger } from '../../common/logger';

// ============================================================
// Types & Interfaces
// ============================================================

/**
 * 시나리오 이벤트
 */
export interface ScenarioEvent {
  eventId: string;
  scenarioId: string;
  
  // 기본 정보
  name: string;
  nameKo: string;
  description: string;
  category: EventCategory;
  
  // 이벤트 체인
  chainId?: string;           // 소속 체인 ID
  chainOrder?: number;        // 체인 내 순서
  prerequisiteEvents: string[]; // 선행 이벤트 ID
  
  // 조건
  conditions: EventConditionGroup;
  
  // 결과
  outcomes: ScenarioEventOutcome[];
  defaultOutcomeIndex: number;
  
  // 분기 선택지
  branches?: EventBranch[];
  
  // 설정
  isRepeatable: boolean;
  repeatCooldown?: number;    // 반복 쿨다운 (턴)
  maxRepeats?: number;        // 최대 반복 횟수
  
  priority: number;           // 우선순위 (높을수록 먼저)
  
  // 상태 추적
  timesTriggered: number;
  lastTriggeredTurn?: number;
  
  // 메타데이터
  data: Record<string, unknown>;
}

/**
 * 이벤트 카테고리
 */
export type EventCategory =
  | 'STORY'           // 스토리 이벤트
  | 'RANDOM'          // 랜덤 이벤트
  | 'TRIGGERED'       // 트리거 이벤트
  | 'CHAIN'           // 체인 이벤트
  | 'RECURRING'       // 반복 이벤트
  | 'TUTORIAL';       // 튜토리얼 이벤트

/**
 * 이벤트 조건 그룹
 */
export interface EventConditionGroup {
  operator: 'AND' | 'OR' | 'NOT';
  conditions: EventCondition[];
  subGroups?: EventConditionGroup[];
}

/**
 * 이벤트 조건
 */
export interface EventCondition {
  conditionId: string;
  type: ConditionType;
  params: Record<string, unknown>;
  
  // 역조건 (NOT)
  negate?: boolean;
}

/**
 * 조건 유형
 */
export type ConditionType =
  | 'TURN_RANGE'              // 턴 범위
  | 'DATE_RANGE'              // 날짜 범위
  | 'FLAG_SET'                // 플래그 설정됨
  | 'FLAG_VALUE'              // 플래그 값 비교
  | 'CHARACTER_EXISTS'        // 캐릭터 존재
  | 'CHARACTER_STAT'          // 캐릭터 스탯
  | 'CHARACTER_LOCATION'      // 캐릭터 위치
  | 'FACTION_OWNS'            // 세력 소유
  | 'FACTION_STAT'            // 세력 스탯
  | 'FACTION_RELATION'        // 세력 관계
  | 'FLEET_EXISTS'            // 함대 존재
  | 'FLEET_LOCATION'          // 함대 위치
  | 'FLEET_STRENGTH'          // 함대 전력
  | 'BATTLE_OCCURRED'         // 전투 발생
  | 'EVENT_OCCURRED'          // 이벤트 발생
  | 'RESOURCE_AMOUNT'         // 자원량
  | 'RANDOM_CHANCE'           // 확률
  | 'CUSTOM';                 // 커스텀

/**
 * 이벤트 결과
 */
export interface ScenarioEventOutcome {
  outcomeId: string;
  name: string;
  description: string;
  
  // 결과 조건 (선택적)
  condition?: EventConditionGroup;
  
  // 확률 (조건 없을 때)
  probability?: number;
  
  // 효과
  effects: ScenarioEventEffect[];
  
  // 후속 이벤트
  followUpEvents: string[];
  
  // 플래그 설정
  setFlags: FlagSetting[];
}

/**
 * 이벤트 효과
 */
export interface ScenarioEventEffect {
  effectId: string;
  type: EffectType;
  target: ScenarioEffectTarget;
  params: Record<string, unknown>;
  
  delay?: number;             // 지연 (턴)
  duration?: number;          // 지속 시간 (턴), undefined = 영구
}

/**
 * 효과 유형
 */
export type EffectType =
  | 'MODIFY_RESOURCE'
  | 'MODIFY_STAT'
  | 'SPAWN_ENTITY'
  | 'REMOVE_ENTITY'
  | 'CHANGE_OWNER'
  | 'START_BATTLE'
  | 'END_BATTLE'
  | 'GRANT_ITEM'
  | 'REMOVE_ITEM'
  | 'SHOW_DIALOGUE'
  | 'PLAY_CUTSCENE'
  | 'UNLOCK_FEATURE'
  | 'TRIGGER_EVENT'
  | 'SET_FLAG'
  | 'CUSTOM';

/**
 * 효과 대상
 */
export interface ScenarioEffectTarget {
  targetType: 'CHARACTER' | 'FACTION' | 'FLEET' | 'PLANET' | 'SYSTEM' | 'GLOBAL' | 'PLAYER';
  targetId?: string;
  targetFilter?: Record<string, unknown>;
}

/**
 * 플래그 설정
 */
export interface FlagSetting {
  flagName: string;
  value: unknown;
  scope: 'GLOBAL' | 'FACTION' | 'CHARACTER';
  scopeId?: string;
}

/**
 * 이벤트 분기
 */
export interface EventBranch {
  branchId: string;
  text: string;
  textKo: string;
  
  // 분기 조건
  requirements?: EventCondition[];
  
  // 분기 결과
  outcome: ScenarioEventOutcome;
  
  // UI 힌트
  tone?: 'positive' | 'negative' | 'neutral' | 'dangerous';
  tooltip?: string;
}

/**
 * 이벤트 체인
 */
export interface EventChain {
  chainId: string;
  name: string;
  nameKo: string;
  description: string;
  
  // 체인 이벤트 목록
  eventIds: string[];
  
  // 체인 상태
  currentEventIndex: number;
  isComplete: boolean;
  isFailed: boolean;
  
  // 체인 설정
  failOnMissedEvent: boolean;
  allowBranching: boolean;
  
  // 체인 결과
  completionReward?: ScenarioEventOutcome;
  failureConsequence?: ScenarioEventOutcome;
}

/**
 * 이벤트 실행 컨텍스트
 */
export interface EventExecutionContext {
  sessionId: string;
  currentTurn: number;
  gameDate: { year: number; month: number; day: number };
  
  playerId?: string;
  playerFactionId?: string;
  
  triggeredBy?: string;         // 트리거한 이벤트 ID
  customData?: Record<string, unknown>;
}

/**
 * 이벤트 실행 결과
 */
export interface ScenarioExecutionResult {
  success: boolean;
  eventId: string;
  outcomeId?: string;
  branchId?: string;
  
  effectsApplied: string[];
  flagsSet: string[];
  followUpEvents: string[];
  
  error?: string;
}

// ============================================================
// ScenarioEventService Class
// ============================================================

export class ScenarioEventService extends EventEmitter {
  private static instance: ScenarioEventService;
  
  // 이벤트 저장소
  private events: Map<string, ScenarioEvent> = new Map();
  private chains: Map<string, EventChain> = new Map();
  
  // 세션별 상태
  private sessionFlags: Map<string, Map<string, unknown>> = new Map();
  private sessionTriggeredEvents: Map<string, Set<string>> = new Map();
  
  private constructor() {
    super();
    logger.info('[ScenarioEventService] Initialized');
  }
  
  public static getInstance(): ScenarioEventService {
    if (!ScenarioEventService.instance) {
      ScenarioEventService.instance = new ScenarioEventService();
    }
    return ScenarioEventService.instance;
  }
  
  // ============================================================
  // Event Registration
  // ============================================================
  
  /**
   * 이벤트 등록
   */
  registerEvent(event: Omit<ScenarioEvent, 'eventId' | 'timesTriggered'>): ScenarioEvent {
    const fullEvent: ScenarioEvent = {
      ...event,
      eventId: event.chainId ? `${event.chainId}-${uuidv4().slice(0, 4)}` : `EVT-${uuidv4().slice(0, 8)}`,
      timesTriggered: 0,
    };
    
    this.events.set(fullEvent.eventId, fullEvent);
    
    logger.info('[ScenarioEventService] Event registered', {
      eventId: fullEvent.eventId,
      name: fullEvent.nameKo,
      category: fullEvent.category,
    });
    
    return fullEvent;
  }
  
  /**
   * 이벤트 체인 등록
   */
  registerChain(chain: Omit<EventChain, 'currentEventIndex' | 'isComplete' | 'isFailed'>): EventChain {
    const fullChain: EventChain = {
      ...chain,
      currentEventIndex: 0,
      isComplete: false,
      isFailed: false,
    };
    
    this.chains.set(fullChain.chainId, fullChain);
    
    logger.info('[ScenarioEventService] Chain registered', {
      chainId: fullChain.chainId,
      name: fullChain.nameKo,
      eventCount: fullChain.eventIds.length,
    });
    
    return fullChain;
  }
  
  /**
   * 시나리오에서 이벤트 로드
   */
  async loadEventsFromScenario(scenarioId: string): Promise<number> {
    const scenario = await Scenario.findOne({ 'meta.id': scenarioId });
    if (!scenario) {
      throw new Error(`Scenario not found: ${scenarioId}`);
    }
    
    let count = 0;
    
    // 시나리오의 이벤트 로드
    for (const eventData of scenario.events || []) {
      const event: ScenarioEvent = {
        eventId: eventData.id,
        scenarioId,
        name: eventData.name,
        nameKo: eventData.name, // 한글 이름 필드가 있다면 사용
        description: eventData.description || '',
        category: this.mapEventCategory(eventData),
        prerequisiteEvents: [],
        conditions: this.convertTriggerToConditionGroup(eventData.trigger),
        outcomes: this.convertActionsToOutcomes(eventData.actions, eventData.choices),
        defaultOutcomeIndex: 0,
        branches: this.convertChoicesToBranches(eventData.choices),
        isRepeatable: !eventData.once,
        priority: eventData.priority || 50,
        timesTriggered: 0,
        data: {},
      };
      
      this.events.set(event.eventId, event);
      count++;
    }
    
    logger.info('[ScenarioEventService] Events loaded from scenario', {
      scenarioId,
      count,
    });
    
    return count;
  }
  
  /**
   * 이벤트 카테고리 매핑
   */
  private mapEventCategory(eventData: any): EventCategory {
    if (eventData.chainId) return 'CHAIN';
    if (!eventData.once) return 'RECURRING';
    if (eventData.trigger?.type === 'RANDOM') return 'RANDOM';
    return 'STORY';
  }
  
  /**
   * 트리거를 조건 그룹으로 변환
   */
  private convertTriggerToConditionGroup(trigger: any): EventConditionGroup {
    if (!trigger) {
      return { operator: 'AND', conditions: [] };
    }
    
    const conditions: EventCondition[] = [];
    
    switch (trigger.type) {
      case 'ON_TURN':
        conditions.push({
          conditionId: uuidv4().slice(0, 8),
          type: 'TURN_RANGE',
          params: { turn: trigger.params?.turn, operator: 'eq' },
        });
        break;
        
      case 'ON_TURN_RANGE':
        conditions.push({
          conditionId: uuidv4().slice(0, 8),
          type: 'TURN_RANGE',
          params: {
            minTurn: trigger.params?.turnMin,
            maxTurn: trigger.params?.turnMax,
          },
        });
        break;
        
      // 기타 트리거 타입들...
      default:
        if (trigger.params) {
          conditions.push({
            conditionId: uuidv4().slice(0, 8),
            type: 'CUSTOM',
            params: trigger.params,
          });
        }
    }
    
    return { operator: 'AND', conditions };
  }
  
  /**
   * 액션을 결과로 변환
   */
  private convertActionsToOutcomes(actions: any[], choices: any[]): ScenarioEventOutcome[] {
    if (!actions || actions.length === 0) {
      return [{
        outcomeId: 'default',
        name: 'Default Outcome',
        description: '',
        effects: [],
        followUpEvents: [],
        setFlags: [],
      }];
    }
    
    const effects: ScenarioEventEffect[] = actions.map((action: any) => ({
      effectId: uuidv4().slice(0, 8),
      type: this.mapActionType(action.type),
      target: { targetType: 'GLOBAL' },
      params: action.params || {},
      delay: action.delay,
    }));
    
    return [{
      outcomeId: 'default',
      name: 'Default Outcome',
      description: '',
      effects,
      followUpEvents: [],
      setFlags: [],
    }];
  }
  
  /**
   * 액션 타입 매핑
   */
  private mapActionType(type: string): EffectType {
    const typeMap: Record<string, EffectType> = {
      'SHOW_DIALOGUE': 'SHOW_DIALOGUE',
      'SET_FLAG': 'SET_FLAG',
      'MODIFY_RESOURCE': 'MODIFY_RESOURCE',
      'SPAWN_FLEET': 'SPAWN_ENTITY',
      'SPAWN_CHARACTER': 'SPAWN_ENTITY',
      'MOVE_FLEET': 'CUSTOM',
      'TRIGGER_EVENT': 'TRIGGER_EVENT',
      'START_BATTLE': 'START_BATTLE',
      'CHANGE_OWNER': 'CHANGE_OWNER',
    };
    
    return typeMap[type] || 'CUSTOM';
  }
  
  /**
   * 선택지를 분기로 변환
   */
  private convertChoicesToBranches(choices: any[]): EventBranch[] | undefined {
    if (!choices || choices.length === 0) return undefined;
    
    return choices.map((choice: any) => ({
      branchId: choice.id,
      text: choice.text || '',
      textKo: choice.textKo || choice.text || '',
      outcome: {
        outcomeId: `outcome-${choice.id}`,
        name: choice.text || '',
        description: '',
        effects: (choice.actions || []).map((action: any) => ({
          effectId: uuidv4().slice(0, 8),
          type: this.mapActionType(action.type),
          target: { targetType: 'GLOBAL' },
          params: action.params || {},
        })),
        followUpEvents: choice.followUpEventId ? [choice.followUpEventId] : [],
        setFlags: [],
      },
    }));
  }
  
  // ============================================================
  // Condition Checking
  // ============================================================
  
  /**
   * 이벤트 조건 체크
   */
  async checkEventConditions(
    event: ScenarioEvent,
    context: EventExecutionContext
  ): Promise<boolean> {
    return this.checkConditionGroup(event.conditions, context);
  }
  
  /**
   * 조건 그룹 체크
   */
  private async checkConditionGroup(
    group: EventConditionGroup,
    context: EventExecutionContext
  ): Promise<boolean> {
    // 하위 조건들 체크
    const conditionResults = await Promise.all(
      group.conditions.map(c => this.checkCondition(c, context))
    );
    
    // 하위 그룹들 체크
    const subGroupResults = await Promise.all(
      (group.subGroups || []).map(sg => this.checkConditionGroup(sg, context))
    );
    
    const allResults = [...conditionResults, ...subGroupResults];
    
    switch (group.operator) {
      case 'AND':
        return allResults.every(r => r);
      case 'OR':
        return allResults.some(r => r);
      case 'NOT':
        return !allResults.some(r => r);
      default:
        return true;
    }
  }
  
  /**
   * 단일 조건 체크
   */
  private async checkCondition(
    condition: EventCondition,
    context: EventExecutionContext
  ): Promise<boolean> {
    let result = false;
    const params = condition.params;
    
    switch (condition.type) {
      case 'TURN_RANGE':
        result = this.checkTurnRange(context.currentTurn, params);
        break;
        
      case 'FLAG_SET':
        result = this.checkFlagSet(context.sessionId, params.flagName as string);
        break;
        
      case 'FLAG_VALUE':
        result = this.checkFlagValue(
          context.sessionId,
          params.flagName as string,
          params.value,
          params.operator as string
        );
        break;
        
      case 'CHARACTER_EXISTS':
        result = await this.checkCharacterExists(context.sessionId, params);
        break;
        
      case 'CHARACTER_STAT':
        result = await this.checkCharacterStat(context.sessionId, params);
        break;
        
      case 'FACTION_OWNS':
        result = await this.checkFactionOwns(context.sessionId, params);
        break;
        
      case 'FLEET_EXISTS':
        result = await this.checkFleetExists(context.sessionId, params);
        break;
        
      case 'FLEET_LOCATION':
        result = await this.checkFleetLocation(context.sessionId, params);
        break;
        
      case 'EVENT_OCCURRED':
        result = this.checkEventOccurred(context.sessionId, params.eventId as string);
        break;
        
      case 'RANDOM_CHANCE':
        result = Math.random() < (params.chance as number || 0.5);
        break;
        
      case 'CUSTOM':
        result = await this.checkCustomCondition(context, params);
        break;
        
      default:
        result = true;
    }
    
    // negate 처리
    return condition.negate ? !result : result;
  }
  
  /**
   * 턴 범위 체크
   */
  private checkTurnRange(currentTurn: number, params: Record<string, unknown>): boolean {
    const { minTurn, maxTurn, turn, operator } = params;
    
    if (operator === 'eq' && turn !== undefined) {
      return currentTurn === (turn as number);
    }
    
    const min = (minTurn as number) || 0;
    const max = (maxTurn as number) || Infinity;
    
    return currentTurn >= min && currentTurn <= max;
  }
  
  /**
   * 플래그 설정 여부 체크
   */
  private checkFlagSet(sessionId: string, flagName: string): boolean {
    const flags = this.sessionFlags.get(sessionId);
    return flags?.has(flagName) || false;
  }
  
  /**
   * 플래그 값 체크
   */
  private checkFlagValue(
    sessionId: string,
    flagName: string,
    expectedValue: unknown,
    operator: string
  ): boolean {
    const flags = this.sessionFlags.get(sessionId);
    const actualValue = flags?.get(flagName);
    
    if (actualValue === undefined) return false;
    
    switch (operator) {
      case 'eq': return actualValue === expectedValue;
      case 'neq': return actualValue !== expectedValue;
      case 'gt': return (actualValue as number) > (expectedValue as number);
      case 'gte': return (actualValue as number) >= (expectedValue as number);
      case 'lt': return (actualValue as number) < (expectedValue as number);
      case 'lte': return (actualValue as number) <= (expectedValue as number);
      default: return actualValue === expectedValue;
    }
  }
  
  /**
   * 캐릭터 존재 체크
   */
  private async checkCharacterExists(
    sessionId: string,
    params: Record<string, unknown>
  ): Promise<boolean> {
    const query: Record<string, unknown> = { sessionId };
    
    if (params.characterId) {
      query.characterId = params.characterId;
    }
    if (params.isAlive !== undefined) {
      query.state = params.isAlive ? { $ne: 'dead' } : 'dead';
    }
    if (params.role) {
      query['position.title'] = params.role;
    }
    
    const character = await Gin7Character.findOne(query);
    return character !== null;
  }
  
  /**
   * 캐릭터 스탯 체크
   */
  private async checkCharacterStat(
    sessionId: string,
    params: Record<string, unknown>
  ): Promise<boolean> {
    const character = await Gin7Character.findOne({
      sessionId,
      characterId: params.characterId,
    });
    
    if (!character) return false;
    
    const statValue = (character.stats as any)?.[params.stat as string] || 0;
    const threshold = params.value as number;
    const operator = params.operator as string || 'gte';
    
    switch (operator) {
      case 'eq': return statValue === threshold;
      case 'gt': return statValue > threshold;
      case 'gte': return statValue >= threshold;
      case 'lt': return statValue < threshold;
      case 'lte': return statValue <= threshold;
      default: return statValue >= threshold;
    }
  }
  
  /**
   * 세력 소유 체크
   */
  private async checkFactionOwns(
    sessionId: string,
    params: Record<string, unknown>
  ): Promise<boolean> {
    const { factionId, locationId, locationType } = params;
    
    if (locationType === 'planet') {
      const planet = await Planet.findOne({
        sessionId,
        planetId: locationId,
      });
      return planet?.ownerId === factionId;
    }
    
    // 시스템 체크...
    return false;
  }
  
  /**
   * 함대 존재 체크
   */
  private async checkFleetExists(
    sessionId: string,
    params: Record<string, unknown>
  ): Promise<boolean> {
    const query: Record<string, unknown> = {
      sessionId,
      status: { $ne: 'DESTROYED' },
    };
    
    if (params.fleetId) {
      query.fleetId = params.fleetId;
    }
    if (params.factionId) {
      query.factionId = params.factionId;
    }
    
    const fleet = await Fleet.findOne(query);
    return fleet !== null;
  }
  
  /**
   * 함대 위치 체크
   */
  private async checkFleetLocation(
    sessionId: string,
    params: Record<string, unknown>
  ): Promise<boolean> {
    const fleet = await Fleet.findOne({
      sessionId,
      fleetId: params.fleetId,
    });
    
    if (!fleet) return false;
    
    if (params.systemId) {
      return fleet.location?.systemId === params.systemId;
    }
    if (params.planetId) {
      return fleet.location?.planetId === params.planetId;
    }
    
    return false;
  }
  
  /**
   * 이벤트 발생 여부 체크
   */
  private checkEventOccurred(sessionId: string, eventId: string): boolean {
    const triggered = this.sessionTriggeredEvents.get(sessionId);
    return triggered?.has(eventId) || false;
  }
  
  /**
   * 커스텀 조건 체크
   */
  private async checkCustomCondition(
    context: EventExecutionContext,
    params: Record<string, unknown>
  ): Promise<boolean> {
    // 커스텀 체크 로직 구현
    return true;
  }
  
  // ============================================================
  // Event Execution
  // ============================================================
  
  /**
   * 이벤트 실행
   */
  async executeEvent(
    eventId: string,
    context: EventExecutionContext,
    branchId?: string
  ): Promise<ScenarioExecutionResult> {
    const event = this.events.get(eventId);
    if (!event) {
      return {
        success: false,
        eventId,
        effectsApplied: [],
        flagsSet: [],
        followUpEvents: [],
        error: `Event not found: ${eventId}`,
      };
    }
    
    // 조건 체크
    const conditionsMet = await this.checkEventConditions(event, context);
    if (!conditionsMet) {
      return {
        success: false,
        eventId,
        effectsApplied: [],
        flagsSet: [],
        followUpEvents: [],
        error: 'Event conditions not met',
      };
    }
    
    // 반복 체크
    if (!event.isRepeatable && event.timesTriggered > 0) {
      return {
        success: false,
        eventId,
        effectsApplied: [],
        flagsSet: [],
        followUpEvents: [],
        error: 'Event already triggered and not repeatable',
      };
    }
    
    // 쿨다운 체크
    if (event.repeatCooldown && event.lastTriggeredTurn) {
      const turnsSinceLastTrigger = context.currentTurn - event.lastTriggeredTurn;
      if (turnsSinceLastTrigger < event.repeatCooldown) {
        return {
          success: false,
          eventId,
          effectsApplied: [],
          flagsSet: [],
          followUpEvents: [],
          error: `Event on cooldown (${event.repeatCooldown - turnsSinceLastTrigger} turns remaining)`,
        };
      }
    }
    
    // 결과 결정
    let selectedOutcome: ScenarioEventOutcome;
    let selectedBranchId: string | undefined;
    
    if (branchId && event.branches) {
      // 분기 선택됨
      const branch = event.branches.find(b => b.branchId === branchId);
      if (!branch) {
        return {
          success: false,
          eventId,
          effectsApplied: [],
          flagsSet: [],
          followUpEvents: [],
          error: `Branch not found: ${branchId}`,
        };
      }
      
      selectedOutcome = branch.outcome;
      selectedBranchId = branchId;
    } else {
      // 기본 결과
      selectedOutcome = event.outcomes[event.defaultOutcomeIndex];
    }
    
    // 효과 적용
    const effectsApplied: string[] = [];
    for (const effect of selectedOutcome.effects) {
      if (!effect.delay) {
        await this.applyEffect(effect, context);
        effectsApplied.push(effect.effectId);
      }
    }
    
    // 플래그 설정
    const flagsSet: string[] = [];
    for (const flag of selectedOutcome.setFlags) {
      this.setFlag(context.sessionId, flag.flagName, flag.value);
      flagsSet.push(flag.flagName);
    }
    
    // 이벤트 상태 업데이트
    event.timesTriggered++;
    event.lastTriggeredTurn = context.currentTurn;
    
    // 세션 트리거 기록
    if (!this.sessionTriggeredEvents.has(context.sessionId)) {
      this.sessionTriggeredEvents.set(context.sessionId, new Set());
    }
    this.sessionTriggeredEvents.get(context.sessionId)!.add(eventId);
    
    logger.info('[ScenarioEventService] Event executed', {
      eventId,
      outcomeId: selectedOutcome.outcomeId,
      branchId: selectedBranchId,
      effectsApplied: effectsApplied.length,
    });
    
    this.emit('event:executed', {
      sessionId: context.sessionId,
      eventId,
      outcomeId: selectedOutcome.outcomeId,
      branchId: selectedBranchId,
      effectsApplied,
      flagsSet,
    });
    
    return {
      success: true,
      eventId,
      outcomeId: selectedOutcome.outcomeId,
      branchId: selectedBranchId,
      effectsApplied,
      flagsSet,
      followUpEvents: selectedOutcome.followUpEvents,
    };
  }
  
  /**
   * 효과 적용
   */
  private async applyEffect(effect: ScenarioEventEffect, context: EventExecutionContext): Promise<void> {
    const { type, target, params } = effect;
    
    switch (type) {
      case 'MODIFY_RESOURCE':
        this.emit('effect:modifyResource', { sessionId: context.sessionId, target, params });
        break;
        
      case 'MODIFY_STAT':
        this.emit('effect:modifyStat', { sessionId: context.sessionId, target, params });
        break;
        
      case 'SPAWN_ENTITY':
        this.emit('effect:spawnEntity', { sessionId: context.sessionId, target, params });
        break;
        
      case 'REMOVE_ENTITY':
        this.emit('effect:removeEntity', { sessionId: context.sessionId, target, params });
        break;
        
      case 'CHANGE_OWNER':
        this.emit('effect:changeOwner', { sessionId: context.sessionId, target, params });
        break;
        
      case 'START_BATTLE':
        this.emit('effect:startBattle', { sessionId: context.sessionId, target, params });
        break;
        
      case 'SHOW_DIALOGUE':
        this.emit('effect:dialogue', {
          sessionId: context.sessionId,
          speaker: params.speaker,
          text: params.text,
          portrait: params.portrait,
        });
        break;
        
      case 'SET_FLAG':
        this.setFlag(
          context.sessionId,
          params.flagName as string,
          params.value
        );
        break;
        
      case 'TRIGGER_EVENT':
        // 지연된 이벤트 트리거
        if (params.eventId) {
          setTimeout(async () => {
            await this.executeEvent(params.eventId as string, context);
          }, params.delay ? (params.delay as number) * 1000 : 0);
        }
        break;
        
      case 'CUSTOM':
        this.emit('effect:custom', { sessionId: context.sessionId, target, params });
        break;
        
      default:
        logger.warn('[ScenarioEventService] Unknown effect type', { type });
    }
  }
  
  // ============================================================
  // Event Chain Management
  // ============================================================
  
  /**
   * 체인 진행
   */
  async advanceChain(
    chainId: string,
    context: EventExecutionContext
  ): Promise<{ success: boolean; nextEventId?: string; chainComplete?: boolean }> {
    const chain = this.chains.get(chainId);
    if (!chain) {
      return { success: false };
    }
    
    if (chain.isComplete || chain.isFailed) {
      return { success: false };
    }
    
    const currentEventId = chain.eventIds[chain.currentEventIndex];
    const currentEvent = this.events.get(currentEventId);
    
    if (!currentEvent) {
      if (chain.failOnMissedEvent) {
        chain.isFailed = true;
        this.emit('chain:failed', { chainId, reason: 'event_not_found' });
        return { success: false };
      }
      
      // 다음 이벤트로 스킵
      chain.currentEventIndex++;
    }
    
    // 다음 이벤트 확인
    if (chain.currentEventIndex >= chain.eventIds.length) {
      chain.isComplete = true;
      
      // 완료 보상 적용
      if (chain.completionReward) {
        for (const effect of chain.completionReward.effects) {
          await this.applyEffect(effect, context);
        }
      }
      
      this.emit('chain:completed', { chainId });
      return { success: true, chainComplete: true };
    }
    
    const nextEventId = chain.eventIds[chain.currentEventIndex];
    chain.currentEventIndex++;
    
    return { success: true, nextEventId };
  }
  
  /**
   * 체인 실패 처리
   */
  async failChain(chainId: string, context: EventExecutionContext): Promise<void> {
    const chain = this.chains.get(chainId);
    if (!chain) return;
    
    chain.isFailed = true;
    
    // 실패 결과 적용
    if (chain.failureConsequence) {
      for (const effect of chain.failureConsequence.effects) {
        await this.applyEffect(effect, context);
      }
    }
    
    this.emit('chain:failed', { chainId, reason: 'manual_fail' });
  }
  
  /**
   * 체인 리셋
   */
  resetChain(chainId: string): void {
    const chain = this.chains.get(chainId);
    if (!chain) return;
    
    chain.currentEventIndex = 0;
    chain.isComplete = false;
    chain.isFailed = false;
  }
  
  // ============================================================
  // Flag Management
  // ============================================================
  
  /**
   * 플래그 설정
   */
  setFlag(sessionId: string, flagName: string, value: unknown): void {
    if (!this.sessionFlags.has(sessionId)) {
      this.sessionFlags.set(sessionId, new Map());
    }
    
    this.sessionFlags.get(sessionId)!.set(flagName, value);
    
    this.emit('flag:set', { sessionId, flagName, value });
  }
  
  /**
   * 플래그 조회
   */
  getFlag(sessionId: string, flagName: string): unknown {
    return this.sessionFlags.get(sessionId)?.get(flagName);
  }
  
  /**
   * 플래그 삭제
   */
  removeFlag(sessionId: string, flagName: string): boolean {
    return this.sessionFlags.get(sessionId)?.delete(flagName) || false;
  }
  
  /**
   * 모든 플래그 조회
   */
  getAllFlags(sessionId: string): Record<string, unknown> {
    const flags = this.sessionFlags.get(sessionId);
    if (!flags) return {};
    
    const result: Record<string, unknown> = {};
    flags.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
  
  // ============================================================
  // Periodic Check
  // ============================================================
  
  /**
   * 트리거 가능한 이벤트 체크
   */
  async checkTriggerableEvents(context: EventExecutionContext): Promise<ScenarioEvent[]> {
    const triggerable: ScenarioEvent[] = [];
    
    for (const event of this.events.values()) {
      // 이미 트리거된 비반복 이벤트 스킵
      if (!event.isRepeatable && event.timesTriggered > 0) continue;
      
      // 쿨다운 체크
      if (event.repeatCooldown && event.lastTriggeredTurn) {
        const turnsSinceLastTrigger = context.currentTurn - event.lastTriggeredTurn;
        if (turnsSinceLastTrigger < event.repeatCooldown) continue;
      }
      
      // 선행 이벤트 체크
      if (event.prerequisiteEvents.length > 0) {
        const triggered = this.sessionTriggeredEvents.get(context.sessionId);
        const prerequisitesMet = event.prerequisiteEvents.every(
          preId => triggered?.has(preId)
        );
        if (!prerequisitesMet) continue;
      }
      
      // 조건 체크
      const conditionsMet = await this.checkEventConditions(event, context);
      if (conditionsMet) {
        triggerable.push(event);
      }
    }
    
    // 우선순위로 정렬
    triggerable.sort((a, b) => b.priority - a.priority);
    
    return triggerable;
  }
  
  // ============================================================
  // Query Methods
  // ============================================================
  
  /**
   * 이벤트 조회
   */
  getEvent(eventId: string): ScenarioEvent | undefined {
    return this.events.get(eventId);
  }
  
  /**
   * 체인 조회
   */
  getChain(chainId: string): EventChain | undefined {
    return this.chains.get(chainId);
  }
  
  /**
   * 카테고리별 이벤트 조회
   */
  getEventsByCategory(category: EventCategory): ScenarioEvent[] {
    return Array.from(this.events.values()).filter(e => e.category === category);
  }
  
  /**
   * 시나리오별 이벤트 조회
   */
  getEventsByScenario(scenarioId: string): ScenarioEvent[] {
    return Array.from(this.events.values()).filter(e => e.scenarioId === scenarioId);
  }
  
  /**
   * 분기가 있는 이벤트 조회
   */
  getBranchingEvents(): ScenarioEvent[] {
    return Array.from(this.events.values()).filter(e => e.branches && e.branches.length > 0);
  }
  
  // ============================================================
  // Cleanup
  // ============================================================
  
  /**
   * 세션 정리
   */
  cleanupSession(sessionId: string): void {
    this.sessionFlags.delete(sessionId);
    this.sessionTriggeredEvents.delete(sessionId);
  }
  
  /**
   * 이벤트 삭제
   */
  removeEvent(eventId: string): boolean {
    return this.events.delete(eventId);
  }
  
  /**
   * 체인 삭제
   */
  removeChain(chainId: string): boolean {
    return this.chains.delete(chainId);
  }
  
  /**
   * 전체 초기화
   */
  reset(): void {
    this.events.clear();
    this.chains.clear();
    this.sessionFlags.clear();
    this.sessionTriggeredEvents.clear();
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const scenarioEventService = ScenarioEventService.getInstance();





