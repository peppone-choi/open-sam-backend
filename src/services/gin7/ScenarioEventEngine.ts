/**
 * GIN7 Scenario Event Engine
 * 
 * 이벤트 트리거 감지 및 액션 실행
 * 시나리오 진행 중 동적 이벤트 처리
 * 
 * @see agents/gin7-agents/gin7-scenario-script/CHECKLIST.md
 */

import { EventEmitter } from 'events';
import { ScenarioSession, IScenarioSession } from '../../models/gin7/ScenarioSession';
import { Scenario, IScenario } from '../../models/gin7/Scenario';
import {
  ScenarioEvent,
  EventTrigger,
  EventTriggerType,
  EventAction,
  EventActionType,
  EventCondition,
  ConditionCheck,
  EventChoice,
  GameDate,
} from '../../types/gin7/scenario.types';
import { TimeEngine, GIN7_EVENTS, DayStartPayload, MonthStartPayload } from '../../core/gin7/TimeEngine';
import { logger } from '../../common/logger';

// 연동 서비스 및 모델 import
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { Fleet, IFleet } from '../../models/gin7/Fleet';
import { StarSystem, IStarSystem } from '../../models/gin7/StarSystem';
import { Planet, IPlanet } from '../../models/gin7/Planet';
import { FleetService } from './FleetService';
import { WarehouseService } from './WarehouseService';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

export interface EventExecutionResult {
  success: boolean;
  eventId: string;
  actionsExecuted: number;
  choicesPending?: boolean;
  error?: string;
}

export interface TriggerContext {
  sessionId: string;
  turn?: number;
  gameDate: GameDate;
  
  // 트리거 관련 데이터
  battleId?: string;
  fleetId?: string;
  characterId?: string;
  locationId?: string;
  factionId?: string;
  
  // 추가 컨텍스트
  customData?: Record<string, unknown>;
}

// ============================================================================
// Service Implementation
// ============================================================================

export class ScenarioEventEngine extends EventEmitter {
  private static instance: ScenarioEventEngine;
  private isSubscribed: boolean = false;
  
  // 액션 핸들러 맵
  private actionHandlers: Map<EventActionType, (action: EventAction, context: TriggerContext) => Promise<void>> = new Map();
  
  private constructor() {
    super();
    this.registerDefaultHandlers();
  }
  
  public static getInstance(): ScenarioEventEngine {
    if (!ScenarioEventEngine.instance) {
      ScenarioEventEngine.instance = new ScenarioEventEngine();
    }
    return ScenarioEventEngine.instance;
  }
  
  // ==========================================================================
  // TimeEngine Integration
  // ==========================================================================
  
  /**
   * TimeEngine 이벤트 구독
   */
  public subscribe(): void {
    if (this.isSubscribed) return;
    
    const timeEngine = TimeEngine.getInstance();
    
    timeEngine.on(GIN7_EVENTS.DAY_START, this.handleDayStart.bind(this));
    timeEngine.on(GIN7_EVENTS.MONTH_START, this.handleMonthStart.bind(this));
    
    this.isSubscribed = true;
    logger.info('[ScenarioEventEngine] Subscribed to TimeEngine');
  }
  
  public unsubscribe(): void {
    if (!this.isSubscribed) return;
    
    const timeEngine = TimeEngine.getInstance();
    
    timeEngine.off(GIN7_EVENTS.DAY_START, this.handleDayStart.bind(this));
    timeEngine.off(GIN7_EVENTS.MONTH_START, this.handleMonthStart.bind(this));
    
    this.isSubscribed = false;
  }
  
  private async handleDayStart(payload: DayStartPayload): Promise<void> {
    await this.checkTriggersForType('ON_DAY_START', {
      sessionId: payload.sessionId,
      gameDate: { year: payload.year, month: payload.month, day: payload.day },
    });
  }
  
  private async handleMonthStart(payload: MonthStartPayload): Promise<void> {
    await this.checkTriggersForType('ON_MONTH_START', {
      sessionId: payload.sessionId,
      gameDate: { year: payload.year, month: payload.month, day: 1 },
    });
  }
  
  // ==========================================================================
  // Event Trigger Detection
  // ==========================================================================
  
  /**
   * 특정 타입의 트리거 체크
   */
  async checkTriggersForType(
    triggerType: EventTriggerType,
    context: TriggerContext
  ): Promise<EventExecutionResult[]> {
    const results: EventExecutionResult[] = [];
    
    // 세션에서 시나리오 조회
    const session = await ScenarioSession.findOne({ sessionId: context.sessionId });
    if (!session || session.status !== 'active') return results;
    
    const scenario = await Scenario.findOne({ 'meta.id': session.scenarioId });
    if (!scenario) return results;
    
    // 활성화된 이벤트 중 트리거 타입 매칭
    for (const event of scenario.events) {
      if (!event.enabled) continue;
      if (event.trigger.type !== triggerType) continue;
      
      // 이미 트리거된 1회성 이벤트 스킵
      if (event.once && session.triggeredEvents.includes(event.id)) continue;
      
      // 트리거 조건 체크
      if (!this.checkTriggerParams(event.trigger, context)) continue;
      
      // 추가 조건 체크
      if (event.conditions) {
        const conditionsMet = await this.checkConditions(event.conditions, context, session);
        if (!conditionsMet) continue;
      }
      
      // 이벤트 실행
      const result = await this.executeEvent(event, context, session);
      results.push(result);
    }
    
    return results;
  }
  
  /**
   * 트리거 파라미터 체크
   */
  private checkTriggerParams(trigger: EventTrigger, context: TriggerContext): boolean {
    const params = trigger.params;
    
    switch (trigger.type) {
      case 'ON_TURN':
        return params.turn === context.turn;
        
      case 'ON_TURN_RANGE':
        return context.turn >= (params.turnMin || 0) && context.turn <= (params.turnMax || Infinity);
        
      case 'ON_BATTLE_START':
      case 'ON_BATTLE_END':
        if (params.locationId && params.locationId !== context.locationId) return false;
        if (params.fleetId && params.fleetId !== context.fleetId) return false;
        return true;
        
      case 'ON_PLANET_CAPTURED':
      case 'ON_FLEET_ARRIVED':
        if (params.locationId && params.locationId !== context.locationId) return false;
        if (params.factionId && params.factionId !== context.factionId) return false;
        return true;
        
      case 'ON_CHARACTER_DEATH':
      case 'ON_CHARACTER_CAPTURED':
        if (params.characterId && params.characterId !== context.characterId) return false;
        return true;
        
      case 'ON_EVENT_TRIGGERED':
        // 다른 이벤트에 의해 트리거됨
        return params.eventId === context.customData?.triggeredEventId;
        
      case 'ON_DAY_START':
      case 'ON_MONTH_START':
        return true;
        
      default:
        return true;
    }
  }
  
  /**
   * 조건 체크
   */
  private async checkConditions(
    conditions: EventCondition[],
    context: TriggerContext,
    session: IScenarioSession
  ): Promise<boolean> {
    for (const condition of conditions) {
      const results = await Promise.all(
        condition.checks.map(check => this.checkSingleCondition(check, context, session))
      );
      
      switch (condition.type) {
        case 'AND':
          if (!results.every(r => r)) return false;
          break;
        case 'OR':
          if (!results.some(r => r)) return false;
          break;
        case 'NOT':
          if (results.some(r => r)) return false;
          break;
      }
    }
    
    return true;
  }
  
  /**
   * 단일 조건 체크
   */
  private async checkSingleCondition(
    check: ConditionCheck,
    context: TriggerContext,
    session: IScenarioSession
  ): Promise<boolean> {
    const params = check.params;
    
    switch (check.checkType) {
      case 'TURN_GTE':
        return context.turn >= (params.turn as number);
        
      case 'FLAG_SET':
        return session.flags.get(params.flagName as string) !== undefined;
        
      case 'CHARACTER_ALIVE':
        return this.checkCharacterAlive(context.sessionId, params.characterId as string);
        
      case 'FLEET_AT':
        return this.checkFleetAtLocation(
          context.sessionId, 
          params.fleetId as string, 
          params.locationId as string
        );
        
      case 'FACTION_CONTROLS':
        return this.checkFactionControls(
          context.sessionId, 
          params.factionId as string, 
          params.locationId as string
        );
        
      case 'CUSTOM':
        // 커스텀 체크는 스크립트로 처리
        return true;
        
      default:
        return true;
    }
  }
  
  // ==========================================================================
  // Condition Check Helpers
  // ==========================================================================
  
  /**
   * 캐릭터 생존 여부 확인
   */
  private async checkCharacterAlive(sessionId: string, characterId: string): Promise<boolean> {
    if (!characterId) return true;
    
    const character = await Gin7Character.findOne({ 
      sessionId, 
      characterId 
    });
    
    if (!character) {
      logger.warn('[ScenarioEventEngine] Character not found', { sessionId, characterId });
      return false;
    }
    
    // 'dead' 상태가 아니면 살아있음
    return character.state !== 'dead';
  }
  
  /**
   * 함대 위치 확인
   */
  private async checkFleetAtLocation(
    sessionId: string, 
    fleetId: string, 
    locationId: string
  ): Promise<boolean> {
    if (!fleetId || !locationId) return true;
    
    const fleet = await FleetService.getFleet(sessionId, fleetId);
    
    if (!fleet) {
      logger.warn('[ScenarioEventEngine] Fleet not found', { sessionId, fleetId });
      return false;
    }
    
    // 시스템 또는 행성 ID와 비교
    return fleet.location.systemId === locationId || fleet.location.planetId === locationId;
  }
  
  /**
   * 세력 영토 통제 확인
   */
  private async checkFactionControls(
    sessionId: string, 
    factionId: string, 
    locationId: string
  ): Promise<boolean> {
    if (!factionId || !locationId) return true;
    
    // 먼저 StarSystem에서 확인
    const system = await StarSystem.findOne({ 
      sessionId, 
      systemId: locationId 
    });
    
    if (system) {
      return system.controllingFactionId === factionId;
    }
    
    // Planet에서 확인
    const planet = await Planet.findOne({ 
      sessionId, 
      planetId: locationId 
    });
    
    if (planet) {
      return planet.ownerId === factionId;
    }
    
    logger.warn('[ScenarioEventEngine] Location not found', { sessionId, locationId });
    return false;
  }
  
  // ==========================================================================
  // Event Execution
  // ==========================================================================
  
  /**
   * 이벤트 실행
   */
  async executeEvent(
    event: ScenarioEvent,
    context: TriggerContext,
    session: IScenarioSession
  ): Promise<EventExecutionResult> {
    logger.info('[ScenarioEventEngine] Executing event', {
      eventId: event.id,
      eventName: event.name,
      sessionId: context.sessionId,
    });
    
    try {
      // 이벤트 트리거 기록
      if (!session.triggeredEvents.includes(event.id)) {
        await ScenarioSession.updateOne(
          { sessionId: context.sessionId },
          { $push: { triggeredEvents: event.id } }
        );
      }
      
      // 선택지가 있는 경우 대기 상태로
      if (event.choices && event.choices.length > 0) {
        await ScenarioSession.updateOne(
          { sessionId: context.sessionId },
          {
            $push: {
              pendingChoices: {
                eventId: event.id,
                choiceIds: event.choices.map(c => c.id),
              }
            },
            $addToSet: { activeEvents: event.id }
          }
        );
        
        this.emit('event:choiceRequired', {
          sessionId: context.sessionId,
          eventId: event.id,
          eventName: event.name,
          choices: event.choices,
        });
        
        return {
          success: true,
          eventId: event.id,
          actionsExecuted: 0,
          choicesPending: true,
        };
      }
      
      // 액션 실행
      let actionsExecuted = 0;
      for (const action of event.actions) {
        await this.executeAction(action, context);
        actionsExecuted++;
      }
      
      this.emit('event:executed', {
        sessionId: context.sessionId,
        eventId: event.id,
        eventName: event.name,
        actionsExecuted,
      });
      
      return {
        success: true,
        eventId: event.id,
        actionsExecuted,
      };
    } catch (error) {
      logger.error('[ScenarioEventEngine] Event execution failed', {
        eventId: event.id,
        error,
      });
      
      return {
        success: false,
        eventId: event.id,
        actionsExecuted: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * 선택지 처리
   */
  async processChoice(
    sessionId: string,
    eventId: string,
    choiceId: string
  ): Promise<EventExecutionResult> {
    const session = await ScenarioSession.findOne({ sessionId });
    if (!session) {
      return { success: false, eventId, actionsExecuted: 0, error: 'Session not found' };
    }
    
    const scenario = await Scenario.findOne({ 'meta.id': session.scenarioId });
    if (!scenario) {
      return { success: false, eventId, actionsExecuted: 0, error: 'Scenario not found' };
    }
    
    // 이벤트 찾기
    const event = scenario.events.find(e => e.id === eventId);
    if (!event || !event.choices) {
      return { success: false, eventId, actionsExecuted: 0, error: 'Event or choices not found' };
    }
    
    // 선택지 찾기
    const choice = event.choices.find(c => c.id === choiceId);
    if (!choice) {
      return { success: false, eventId, actionsExecuted: 0, error: 'Choice not found' };
    }
    
    const context: TriggerContext = {
      sessionId,
      turn: session.currentTurn,
      gameDate: session.gameDate,
    };
    
    try {
      // 선택지 액션 실행
      let actionsExecuted = 0;
      for (const action of choice.actions) {
        await this.executeAction(action, context);
        actionsExecuted++;
      }
      
      // 대기 중인 선택지 제거
      await ScenarioSession.updateOne(
        { sessionId },
        {
          $pull: { 
            pendingChoices: { eventId },
            activeEvents: eventId,
          }
        }
      );
      
      this.emit('event:choiceProcessed', {
        sessionId,
        eventId,
        choiceId,
        actionsExecuted,
      });
      
      return {
        success: true,
        eventId,
        actionsExecuted,
      };
    } catch (error) {
      logger.error('[ScenarioEventEngine] Choice processing failed', { error });
      return {
        success: false,
        eventId,
        actionsExecuted: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  // ==========================================================================
  // Action Execution
  // ==========================================================================
  
  /**
   * 액션 실행
   */
  private async executeAction(action: EventAction, context: TriggerContext): Promise<void> {
    // 딜레이 처리
    if (action.delay && action.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, action.delay));
    }
    
    const handler = this.actionHandlers.get(action.type);
    
    if (handler) {
      await handler(action, context);
    } else {
      logger.warn('[ScenarioEventEngine] No handler for action type', { type: action.type });
    }
  }
  
  /**
   * 기본 액션 핸들러 등록
   */
  private registerDefaultHandlers(): void {
    // SHOW_DIALOGUE
    this.actionHandlers.set('SHOW_DIALOGUE', async (action, context) => {
      this.emit('action:dialogue', {
        sessionId: context.sessionId,
        speakerId: action.params.speakerId,
        speakerName: action.params.speakerName,
        text: action.params.text,
        portrait: action.params.portrait,
        duration: action.params.duration,
      });
    });
    
    // SET_FLAG
    this.actionHandlers.set('SET_FLAG', async (action, context) => {
      const { flagName, flagValue } = action.params;
      if (flagName) {
        await ScenarioSession.updateOne(
          { sessionId: context.sessionId },
          { $set: { [`flags.${flagName}`]: flagValue ?? true } }
        );
      }
    });
    
    // MODIFY_RESOURCE
    this.actionHandlers.set('MODIFY_RESOURCE', async (action, context) => {
      const { targetType, targetId, resourceType, amount, operation } = action.params;
      
      try {
        if (targetType === 'PLANET') {
          const planet = await Planet.findOne({ 
            sessionId: context.sessionId, 
            planetId: targetId as string 
          });
          
          if (planet && resourceType) {
            const key = resourceType as keyof typeof planet.resources;
            const currentValue = planet.resources[key] || 0;
            let newValue = currentValue;
            
            if (operation === 'add' || !operation) {
              newValue = currentValue + (amount as number || 0);
            } else if (operation === 'set') {
              newValue = amount as number || 0;
            } else if (operation === 'subtract') {
              newValue = Math.max(0, currentValue - (amount as number || 0));
            }
            
            await Planet.updateOne(
              { sessionId: context.sessionId, planetId: targetId },
              { $set: { [`resources.${resourceType}`]: newValue } }
            );
            
            logger.info('[ScenarioEventEngine] Resource modified', { 
              targetId, resourceType, oldValue: currentValue, newValue 
            });
          }
        } else if (targetType === 'CHARACTER') {
          const character = await Gin7Character.findOne({ 
            sessionId: context.sessionId, 
            characterId: targetId as string 
          });
          
          if (character && resourceType) {
            const currentValue = character.resources[resourceType as string] || 0;
            let newValue = currentValue;
            
            if (operation === 'add' || !operation) {
              newValue = currentValue + (amount as number || 0);
            } else if (operation === 'set') {
              newValue = amount as number || 0;
            } else if (operation === 'subtract') {
              newValue = Math.max(0, currentValue - (amount as number || 0));
            }
            
            await Gin7Character.updateOne(
              { sessionId: context.sessionId, characterId: targetId },
              { $set: { [`resources.${resourceType}`]: newValue } }
            );
          }
        }
      } catch (error) {
        logger.error('[ScenarioEventEngine] Failed to modify resource', { error, action });
      }
      
      this.emit('action:modifyResource', {
        sessionId: context.sessionId,
        ...action.params,
      });
    });
    
    // SPAWN_FLEET
    this.actionHandlers.set('SPAWN_FLEET', async (action, context) => {
      const fleetData = action.params.fleetData as {
        commanderId?: string;
        factionId?: string;
        name?: string;
        callsign?: string;
        locationSystemId?: string;
        locationPlanetId?: string;
        units?: Array<{ shipClass: string; count: number }>;
      };
      
      if (fleetData) {
        try {
          const newFleet = await FleetService.createFleet({
            sessionId: context.sessionId,
            commanderId: fleetData.commanderId || 'npc-commander',
            factionId: fleetData.factionId || 'neutral',
            name: fleetData.name || `Fleet-${uuidv4().slice(0, 4)}`,
            callsign: fleetData.callsign,
            location: {
              type: fleetData.locationPlanetId ? 'PLANET' : 'SYSTEM',
              systemId: fleetData.locationSystemId,
              planetId: fleetData.locationPlanetId,
            },
            units: fleetData.units as any,
          });
          
          logger.info('[ScenarioEventEngine] Fleet spawned', { 
            fleetId: newFleet.fleetId, name: newFleet.name 
          });
        } catch (error) {
          logger.error('[ScenarioEventEngine] Failed to spawn fleet', { error, fleetData });
        }
      }
      
      this.emit('action:spawnFleet', {
        sessionId: context.sessionId,
        fleetData: action.params.fleetData,
      });
    });
    
    // SPAWN_CHARACTER
    this.actionHandlers.set('SPAWN_CHARACTER', async (action, context) => {
      const characterData = action.params.characterData as {
        characterId?: string;
        ownerId?: string;
        name?: string;
        stats?: Record<string, number>;
        traits?: string[];
        location?: { systemId?: string; planetId?: string; x?: number; y?: number };
      };
      
      if (characterData) {
        try {
          const newCharacter = new Gin7Character({
            characterId: characterData.characterId || `CHAR-${uuidv4().slice(0, 8)}`,
            sessionId: context.sessionId,
            ownerId: characterData.ownerId || 'npc',
            name: characterData.name || 'Unknown',
            stats: characterData.stats || {
              command: 50,
              might: 50,
              intellect: 50,
              politics: 50,
              charm: 50,
            },
            traits: characterData.traits || [],
            state: 'idle',
            location: characterData.location || {},
          });
          
          await newCharacter.save();
          
          logger.info('[ScenarioEventEngine] Character spawned', { 
            characterId: newCharacter.characterId, name: newCharacter.name 
          });
        } catch (error) {
          logger.error('[ScenarioEventEngine] Failed to spawn character', { error, characterData });
        }
      }
      
      this.emit('action:spawnCharacter', {
        sessionId: context.sessionId,
        characterData: action.params.characterData,
      });
    });
    
    // MOVE_FLEET
    this.actionHandlers.set('MOVE_FLEET', async (action, context) => {
      const { fleetId, targetLocationId, targetLocationType } = action.params;
      
      if (fleetId && targetLocationId) {
        try {
          const locationType = (targetLocationType as string) || 'SYSTEM';
          const updateData: Record<string, unknown> = {
            status: 'MOVING',
          };
          
          if (locationType === 'PLANET') {
            updateData['location.planetId'] = targetLocationId;
          } else {
            updateData['location.systemId'] = targetLocationId;
            updateData['location.planetId'] = null;
          }
          updateData['location.type'] = locationType;
          
          await Fleet.updateOne(
            { sessionId: context.sessionId, fleetId: fleetId as string },
            { $set: updateData }
          );
          
          // 이동 완료 후 상태를 IDLE로 변경 (실제로는 WarpNavigationService 사용 권장)
          await Fleet.updateOne(
            { sessionId: context.sessionId, fleetId: fleetId as string },
            { $set: { status: 'IDLE' } }
          );
          
          logger.info('[ScenarioEventEngine] Fleet moved', { 
            fleetId, targetLocationId, locationType 
          });
        } catch (error) {
          logger.error('[ScenarioEventEngine] Failed to move fleet', { error, action });
        }
      }
      
      this.emit('action:moveFleet', {
        sessionId: context.sessionId,
        fleetId: action.params.fleetId,
        targetLocationId: action.params.targetLocationId,
      });
    });
    
    // TRIGGER_EVENT
    this.actionHandlers.set('TRIGGER_EVENT', async (action, context) => {
      if (action.params.eventId) {
        await this.checkTriggersForType('ON_EVENT_TRIGGERED', {
          ...context,
          customData: { triggeredEventId: action.params.eventId },
        });
      }
    });
    
    // START_BATTLE
    this.actionHandlers.set('START_BATTLE', async (action, context) => {
      this.emit('action:startBattle', {
        sessionId: context.sessionId,
        attackerFleetId: action.params.attackerFleetId,
        defenderFleetId: action.params.defenderFleetId,
        battleType: action.params.battleType,
        specialRules: action.params.specialRules,
      });
    });
    
    // CHANGE_OWNER
    this.actionHandlers.set('CHANGE_OWNER', async (action, context) => {
      const { locationId, newOwnerId, locationType } = action.params;
      
      if (locationId && newOwnerId) {
        try {
          // 먼저 StarSystem인지 확인
          const system = await StarSystem.findOne({ 
            sessionId: context.sessionId, 
            systemId: locationId as string 
          });
          
          if (system || locationType === 'system') {
            await StarSystem.updateOne(
              { sessionId: context.sessionId, systemId: locationId as string },
              { $set: { controllingFactionId: newOwnerId as string } }
            );
            
            logger.info('[ScenarioEventEngine] StarSystem owner changed', { 
              locationId, newOwnerId 
            });
          } else {
            // Planet으로 처리
            await Planet.updateOne(
              { sessionId: context.sessionId, planetId: locationId as string },
              { $set: { ownerId: newOwnerId as string } }
            );
            
            logger.info('[ScenarioEventEngine] Planet owner changed', { 
              locationId, newOwnerId 
            });
          }
        } catch (error) {
          logger.error('[ScenarioEventEngine] Failed to change owner', { error, action });
        }
      }
      
      this.emit('action:changeOwner', {
        sessionId: context.sessionId,
        locationId: action.params.locationId,
        newOwnerId: action.params.newOwnerId,
      });
    });
    
    // PLAY_SOUND
    this.actionHandlers.set('PLAY_SOUND', async (action, context) => {
      this.emit('action:playSound', {
        sessionId: context.sessionId,
        ...action.params,
      });
    });
    
    // CAMERA_FOCUS
    this.actionHandlers.set('CAMERA_FOCUS', async (action, context) => {
      this.emit('action:cameraFocus', {
        sessionId: context.sessionId,
        ...action.params,
      });
    });
    
    // DELAY
    this.actionHandlers.set('DELAY', async (action) => {
      if (action.params.duration) {
        await new Promise(resolve => setTimeout(resolve, action.params.duration as number));
      }
    });
  }
  
  /**
   * 커스텀 액션 핸들러 등록
   */
  registerActionHandler(
    type: EventActionType,
    handler: (action: EventAction, context: TriggerContext) => Promise<void>
  ): void {
    this.actionHandlers.set(type, handler);
  }
  
  // ==========================================================================
  // Condition Checking (External Trigger)
  // ==========================================================================
  
  /**
   * 승리/패배 조건 체크
   */
  async checkGameConditions(sessionId: string): Promise<{
    victory: boolean;
    defeat: boolean;
    satisfiedConditions: string[];
  }> {
    const session = await ScenarioSession.findOne({ sessionId });
    if (!session || session.status !== 'active') {
      return { victory: false, defeat: false, satisfiedConditions: [] };
    }
    
    const scenario = await Scenario.findOne({ 'meta.id': session.scenarioId });
    if (!scenario) {
      return { victory: false, defeat: false, satisfiedConditions: [] };
    }
    
    const context: TriggerContext = {
      sessionId,
      turn: session.currentTurn,
      gameDate: session.gameDate,
    };
    
    const satisfiedConditions: string[] = [];
    
    // 승리 조건 체크
    let victory = false;
    for (const condition of scenario.victoryConditions) {
      const satisfied = await this.checkGameCondition(condition, context, session);
      if (satisfied) {
        satisfiedConditions.push(condition.id);
        victory = true;
        break;
      }
    }
    
    // 패배 조건 체크
    let defeat = false;
    if (!victory) {
      for (const condition of scenario.defeatConditions) {
        const satisfied = await this.checkGameCondition(condition, context, session);
        if (satisfied) {
          satisfiedConditions.push(condition.id);
          defeat = true;
          break;
        }
      }
    }
    
    // 조건 상태 업데이트
    if (satisfiedConditions.length > 0) {
      await ScenarioSession.updateOne(
        { sessionId },
        { $addToSet: { satisfiedConditions: { $each: satisfiedConditions } } }
      );
    }
    
    return { victory, defeat, satisfiedConditions };
  }
  
  /**
   * 개별 게임 조건 체크
   */
  private async checkGameCondition(
    condition: any,
    context: TriggerContext,
    session: IScenarioSession
  ): Promise<boolean> {
    const params = condition.params || {};
    
    switch (condition.type) {
      case 'SURVIVE_TURNS':
        return context.turn >= (params.turns || 0);
        
      case 'CAPTURE_LOCATION':
        // 특정 위치 점령 조건
        if (params.locationId && params.factionId) {
          return this.checkFactionControls(
            context.sessionId, 
            params.factionId, 
            params.locationId
          );
        }
        return false;
        
      case 'DESTROY_FLEET':
        // 특정 함대 격파 조건 (fleet이 없으면 격파됨)
        if (params.fleetId) {
          const fleet = await FleetService.getFleet(context.sessionId, params.fleetId);
          return !fleet;
        }
        return false;
        
      case 'CHARACTER_DEATH':
        // 특정 캐릭터 사망 조건
        if (params.characterId) {
          const isAlive = await this.checkCharacterAlive(context.sessionId, params.characterId);
          return !isAlive;
        }
        return false;
        
      case 'CHARACTER_ALIVE':
        // 특정 캐릭터 생존 조건
        if (params.characterId) {
          return this.checkCharacterAlive(context.sessionId, params.characterId);
        }
        return true;
        
      case 'CONTROL_COUNT':
        // N개 이상의 영토 통제 조건
        if (params.factionId && params.count) {
          const systems = await StarSystem.countDocuments({
            sessionId: context.sessionId,
            controllingFactionId: params.factionId,
          });
          const planets = await Planet.countDocuments({
            sessionId: context.sessionId,
            ownerId: params.factionId,
          });
          const total = (params.countType === 'PLANET') ? planets : 
                        (params.countType === 'SYSTEM') ? systems : 
                        systems + planets;
          return total >= params.count;
        }
        return false;
        
      case 'FLEET_COUNT':
        // N개 이상의 함대 보유 조건
        if (params.factionId && params.count) {
          const fleets = await Fleet.countDocuments({
            sessionId: context.sessionId,
            factionId: params.factionId,
            status: { $ne: 'DESTROYED' },
          });
          return fleets >= params.count;
        }
        return false;
        
      case 'CUSTOM':
        // 플래그 기반 체크
        if (params.flagName) {
          return session.flags.get(params.flagName) === params.flagValue;
        }
        return false;
        
      default:
        logger.warn('[ScenarioEventEngine] Unknown condition type', { type: condition.type });
        return false;
    }
  }
}

export default ScenarioEventEngine;




