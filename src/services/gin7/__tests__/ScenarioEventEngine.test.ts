/**
 * ScenarioEventEngine 테스트
 * 
 * 테스트 케이스:
 * 1. 이벤트 조건 체크 (AND, OR, NOT)
 * 2. 이벤트 트리거
 * 3. 이벤트 체인 실행
 * 4. 분기 처리 (선택지)
 * 5. 승리/패배 조건 체크
 */

import ScenarioEventEngine, { TriggerContext, EventExecutionResult } from '../ScenarioEventEngine';
import { ScenarioSession, IScenarioSession } from '../../../models/gin7/ScenarioSession';
import { Scenario, IScenario } from '../../../models/gin7/Scenario';
import { Gin7Character } from '../../../models/gin7/Character';
import { Fleet } from '../../../models/gin7/Fleet';
import { StarSystem } from '../../../models/gin7/StarSystem';
import { Planet } from '../../../models/gin7/Planet';
import { FleetService } from '../FleetService';
import { ScenarioEvent, EventCondition } from '../../../types/gin7/scenario.types';

// MongoDB 모킹
jest.mock('../../../models/gin7/ScenarioSession');
jest.mock('../../../models/gin7/Scenario');
jest.mock('../../../models/gin7/Character');
jest.mock('../../../models/gin7/Fleet');
jest.mock('../../../models/gin7/StarSystem');
jest.mock('../../../models/gin7/Planet');
jest.mock('../FleetService');

describe('ScenarioEventEngine', () => {
  const sessionId = 'TEST-SESSION-001';
  let engine: ScenarioEventEngine;
  
  beforeEach(() => {
    jest.clearAllMocks();
    // 싱글톤 리셋을 위해 private 인스턴스 접근
    (ScenarioEventEngine as any).instance = undefined;
    engine = ScenarioEventEngine.getInstance();
  });
  
  // ============================================================
  // 1. 이벤트 조건 체크 테스트
  // ============================================================
  
  describe('이벤트 조건 체크', () => {
    const mockSession: Partial<IScenarioSession> = {
      sessionId,
      scenarioId: 'SCENARIO-001',
      status: 'active',
      currentTurn: 10,
      gameDate: { year: 796, month: 5, day: 1 },
      triggeredEvents: [],
      flags: new Map([['battle_started', true], ['alliance_formed', false]]),
      pendingChoices: [],
      activeEvents: [],
      satisfiedConditions: [],
    };
    
    const baseContext: TriggerContext = {
      sessionId,
      turn: 10,
      gameDate: { year: 796, month: 5, day: 1 },
    };
    
    it('AND 조건: 모든 조건이 만족되어야 true를 반환한다', async () => {
      // Given: 캐릭터 생존 확인 모킹
      (Gin7Character.findOne as jest.Mock).mockResolvedValue({
        characterId: 'YANG_WENLI',
        state: 'idle',
      });
      
      const conditions: EventCondition[] = [{
        type: 'AND',
        checks: [
          { checkType: 'TURN_GTE', params: { turn: 5 } },
          { checkType: 'CHARACTER_ALIVE', params: { characterId: 'YANG_WENLI' } },
        ],
      }];
      
      // When: 조건 체크
      const result = await (engine as any).checkConditions(conditions, baseContext, mockSession);
      
      // Then: 모든 조건 만족 시 true
      expect(result).toBe(true);
    });
    
    it('AND 조건: 하나라도 실패하면 false를 반환한다', async () => {
      // Given: 턴 조건 실패 (현재 턴 10, 필요 턴 15)
      const conditions: EventCondition[] = [{
        type: 'AND',
        checks: [
          { checkType: 'TURN_GTE', params: { turn: 15 } }, // 실패
          { checkType: 'FLAG_SET', params: { flagName: 'battle_started' } },
        ],
      }];
      
      // When
      const result = await (engine as any).checkConditions(conditions, baseContext, mockSession);
      
      // Then
      expect(result).toBe(false);
    });
    
    it('OR 조건: 하나라도 만족하면 true를 반환한다', async () => {
      // Given: 하나는 만족, 하나는 실패
      const conditions: EventCondition[] = [{
        type: 'OR',
        checks: [
          { checkType: 'TURN_GTE', params: { turn: 15 } }, // 실패
          { checkType: 'FLAG_SET', params: { flagName: 'battle_started' } }, // 성공
        ],
      }];
      
      // When
      const result = await (engine as any).checkConditions(conditions, baseContext, mockSession);
      
      // Then
      expect(result).toBe(true);
    });
    
    it('NOT 조건: 모든 조건이 false여야 true를 반환한다', async () => {
      // Given: 플래그가 설정되지 않음
      const conditions: EventCondition[] = [{
        type: 'NOT',
        checks: [
          { checkType: 'FLAG_SET', params: { flagName: 'game_over' } }, // 미설정
        ],
      }];
      
      // When
      const result = await (engine as any).checkConditions(conditions, baseContext, mockSession);
      
      // Then
      expect(result).toBe(true);
    });
    
    it('FLEET_AT 조건: 함대가 특정 위치에 있는지 확인한다', async () => {
      // Given
      (FleetService.getFleet as jest.Mock).mockResolvedValue({
        fleetId: 'FLEET-001',
        location: { systemId: 'ISERLOHN', planetId: null },
      });
      
      // When
      const result = await (engine as any).checkFleetAtLocation(sessionId, 'FLEET-001', 'ISERLOHN');
      
      // Then
      expect(result).toBe(true);
    });
    
    it('FACTION_CONTROLS 조건: 세력이 위치를 통제하는지 확인한다', async () => {
      // Given
      (StarSystem.findOne as jest.Mock).mockResolvedValue({
        systemId: 'ODIN',
        controllingFactionId: 'EMPIRE',
      });
      
      // When
      const result = await (engine as any).checkFactionControls(sessionId, 'EMPIRE', 'ODIN');
      
      // Then
      expect(result).toBe(true);
    });
  });
  
  // ============================================================
  // 2. 이벤트 트리거 테스트
  // ============================================================
  
  describe('이벤트 트리거', () => {
    const mockEvent: ScenarioEvent = {
      id: 'EVT-001',
      name: '이제르론 함락',
      enabled: true,
      trigger: {
        type: 'ON_TURN',
        params: { turn: 10 },
      },
      actions: [
        { type: 'SET_FLAG', params: { flagName: 'iserlohn_fallen', flagValue: true } },
      ],
      once: true,
    };
    
    const mockScenario: Partial<IScenario> = {
      meta: { id: 'SCENARIO-001', name: '아스타르테 회전' } as any,
      events: [mockEvent],
      victoryConditions: [],
      defeatConditions: [],
    };
    
    const mockSession: Partial<IScenarioSession> = {
      sessionId: 'TEST-SESSION-001',
      scenarioId: 'SCENARIO-001',
      status: 'active',
      currentTurn: 10,
      gameDate: { year: 796, month: 5, day: 1 },
      triggeredEvents: [],
      flags: new Map(),
    };
    
    it('트리거 타입이 매칭되면 이벤트가 실행된다', async () => {
      // Given
      (ScenarioSession.findOne as jest.Mock).mockResolvedValue(mockSession);
      (Scenario.findOne as jest.Mock).mockResolvedValue(mockScenario);
      (ScenarioSession.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
      
      const context: TriggerContext = {
        sessionId: 'TEST-SESSION-001',
        turn: 10,
        gameDate: { year: 796, month: 5, day: 1 },
      };
      
      // When
      const results = await engine.checkTriggersForType('ON_TURN', context);
      
      // Then
      expect(results.length).toBe(1);
      expect(results[0].success).toBe(true);
      expect(results[0].eventId).toBe('EVT-001');
    });
    
    it('이미 트리거된 once 이벤트는 다시 실행되지 않는다', async () => {
      // Given: 이미 트리거된 이벤트
      const triggeredSession = {
        ...mockSession,
        triggeredEvents: ['EVT-001'],
      };
      (ScenarioSession.findOne as jest.Mock).mockResolvedValue(triggeredSession);
      (Scenario.findOne as jest.Mock).mockResolvedValue(mockScenario);
      
      const context: TriggerContext = {
        sessionId: 'TEST-SESSION-001',
        turn: 10,
        gameDate: { year: 796, month: 5, day: 1 },
      };
      
      // When
      const results = await engine.checkTriggersForType('ON_TURN', context);
      
      // Then
      expect(results.length).toBe(0);
    });
    
    it('ON_TURN_RANGE 트리거가 범위 내에서 동작한다', () => {
      // Given
      const trigger = {
        type: 'ON_TURN_RANGE' as const,
        params: { turnMin: 5, turnMax: 15 },
      };
      
      const contextInRange: TriggerContext = {
        sessionId,
        turn: 10,
        gameDate: { year: 796, month: 5, day: 1 },
      };
      
      const contextOutOfRange: TriggerContext = {
        sessionId,
        turn: 20,
        gameDate: { year: 796, month: 5, day: 1 },
      };
      
      // When & Then
      expect((engine as any).checkTriggerParams(trigger, contextInRange)).toBe(true);
      expect((engine as any).checkTriggerParams(trigger, contextOutOfRange)).toBe(false);
    });
    
    it('ON_BATTLE_START 트리거가 위치/함대 조건을 확인한다', () => {
      // Given
      const trigger = {
        type: 'ON_BATTLE_START' as const,
        params: { locationId: 'ISERLOHN', fleetId: 'FLEET-001' },
      };
      
      const matchingContext: TriggerContext = {
        sessionId,
        turn: 10,
        gameDate: { year: 796, month: 5, day: 1 },
        locationId: 'ISERLOHN',
        fleetId: 'FLEET-001',
      };
      
      const nonMatchingContext: TriggerContext = {
        sessionId,
        turn: 10,
        gameDate: { year: 796, month: 5, day: 1 },
        locationId: 'ODIN',
        fleetId: 'FLEET-002',
      };
      
      // When & Then
      expect((engine as any).checkTriggerParams(trigger, matchingContext)).toBe(true);
      expect((engine as any).checkTriggerParams(trigger, nonMatchingContext)).toBe(false);
    });
  });
  
  // ============================================================
  // 3. 이벤트 체인 실행 테스트
  // ============================================================
  
  describe('이벤트 체인 실행', () => {
    it('TRIGGER_EVENT 액션이 연쇄 이벤트를 트리거한다', async () => {
      // Given
      const chainedEvent: ScenarioEvent = {
        id: 'EVT-CHAINED',
        name: '연쇄 이벤트',
        enabled: true,
        trigger: {
          type: 'ON_EVENT_TRIGGERED',
          params: { eventId: 'EVT-001' },
        },
        actions: [
          { type: 'SHOW_DIALOGUE', params: { speakerName: 'Yang', text: '연쇄 이벤트 발동!' } },
        ],
        once: false,
      };
      
      const mockScenario = {
        meta: { id: 'SCENARIO-001' },
        events: [chainedEvent],
        victoryConditions: [],
        defeatConditions: [],
      };
      
      const mockSession = {
        sessionId,
        scenarioId: 'SCENARIO-001',
        status: 'active',
        currentTurn: 10,
        gameDate: { year: 796, month: 5, day: 1 },
        triggeredEvents: [],
        flags: new Map(),
      };
      
      (ScenarioSession.findOne as jest.Mock).mockResolvedValue(mockSession);
      (Scenario.findOne as jest.Mock).mockResolvedValue(mockScenario);
      (ScenarioSession.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
      
      const context: TriggerContext = {
        sessionId,
        turn: 10,
        gameDate: { year: 796, month: 5, day: 1 },
        customData: { triggeredEventId: 'EVT-001' },
      };
      
      // When
      const results = await engine.checkTriggersForType('ON_EVENT_TRIGGERED', context);
      
      // Then
      expect(results.length).toBe(1);
      expect(results[0].eventId).toBe('EVT-CHAINED');
    });
    
    it('액션이 순차적으로 실행된다', async () => {
      // Given
      const executionOrder: string[] = [];
      
      // 커스텀 액션 핸들러 등록
      engine.registerActionHandler('SET_FLAG', async (action) => {
        executionOrder.push(`SET_FLAG:${action.params.flagName}`);
      });
      
      engine.registerActionHandler('SHOW_DIALOGUE', async (action) => {
        executionOrder.push(`SHOW_DIALOGUE:${action.params.speakerName}`);
      });
      
      const event: ScenarioEvent = {
        id: 'EVT-MULTI',
        name: '다중 액션 이벤트',
        enabled: true,
        trigger: { type: 'ON_TURN', params: { turn: 1 } },
        actions: [
          { type: 'SET_FLAG', params: { flagName: 'first' } },
          { type: 'SHOW_DIALOGUE', params: { speakerName: 'Narrator' } },
          { type: 'SET_FLAG', params: { flagName: 'last' } },
        ],
        once: false,
      };
      
      const mockSession = {
        sessionId,
        triggeredEvents: [],
        flags: new Map(),
      };
      
      const context: TriggerContext = {
        sessionId,
        turn: 1,
        gameDate: { year: 796, month: 1, day: 1 },
      };
      
      (ScenarioSession.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
      
      // When
      await engine.executeEvent(event, context, mockSession as any);
      
      // Then
      expect(executionOrder).toEqual([
        'SET_FLAG:first',
        'SHOW_DIALOGUE:Narrator',
        'SET_FLAG:last',
      ]);
    });
  });
  
  // ============================================================
  // 4. 분기 처리 (선택지) 테스트
  // ============================================================
  
  describe('분기 처리 (선택지)', () => {
    it('선택지가 있는 이벤트는 대기 상태로 전환된다', async () => {
      // Given
      const eventWithChoices: ScenarioEvent = {
        id: 'EVT-CHOICE',
        name: '선택 이벤트',
        enabled: true,
        trigger: { type: 'ON_TURN', params: { turn: 5 } },
        actions: [],
        choices: [
          {
            id: 'CHOICE-A',
            text: '공격한다',
            actions: [{ type: 'SET_FLAG', params: { flagName: 'attacked' } }],
          },
          {
            id: 'CHOICE-B',
            text: '협상한다',
            actions: [{ type: 'SET_FLAG', params: { flagName: 'negotiated' } }],
          },
        ],
        once: false,
      };
      
      const mockSession = {
        sessionId,
        triggeredEvents: [],
        pendingChoices: [],
        activeEvents: [],
        flags: new Map(),
      };
      
      const context: TriggerContext = {
        sessionId,
        turn: 5,
        gameDate: { year: 796, month: 5, day: 1 },
      };
      
      (ScenarioSession.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
      
      // When
      const result = await engine.executeEvent(eventWithChoices, context, mockSession as any);
      
      // Then
      expect(result.success).toBe(true);
      expect(result.choicesPending).toBe(true);
      expect(result.actionsExecuted).toBe(0);
    });
    
    it('선택지 선택 시 해당 액션이 실행된다', async () => {
      // Given
      const mockSession = {
        sessionId,
        scenarioId: 'SCENARIO-001',
        currentTurn: 5,
        gameDate: { year: 796, month: 5, day: 1 },
        pendingChoices: [{ eventId: 'EVT-CHOICE', choiceIds: ['CHOICE-A', 'CHOICE-B'] }],
        activeEvents: ['EVT-CHOICE'],
      };
      
      const mockScenario = {
        meta: { id: 'SCENARIO-001' },
        events: [{
          id: 'EVT-CHOICE',
          name: '선택 이벤트',
          choices: [
            {
              id: 'CHOICE-A',
              text: '공격한다',
              actions: [{ type: 'SET_FLAG', params: { flagName: 'attacked', flagValue: true } }],
            },
            {
              id: 'CHOICE-B',
              text: '협상한다',
              actions: [{ type: 'SET_FLAG', params: { flagName: 'negotiated', flagValue: true } }],
            },
          ],
        }],
      };
      
      (ScenarioSession.findOne as jest.Mock).mockResolvedValue(mockSession);
      (Scenario.findOne as jest.Mock).mockResolvedValue(mockScenario);
      (ScenarioSession.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
      
      // When
      const result = await engine.processChoice(sessionId, 'EVT-CHOICE', 'CHOICE-A');
      
      // Then
      expect(result.success).toBe(true);
      expect(result.actionsExecuted).toBe(1);
    });
    
    it('존재하지 않는 선택지는 에러를 반환한다', async () => {
      // Given
      const mockSession = {
        sessionId,
        scenarioId: 'SCENARIO-001',
        currentTurn: 5,
        gameDate: { year: 796, month: 5, day: 1 },
      };
      
      const mockScenario = {
        meta: { id: 'SCENARIO-001' },
        events: [{
          id: 'EVT-CHOICE',
          choices: [
            { id: 'CHOICE-A', text: '선택지 A', actions: [] },
          ],
        }],
      };
      
      (ScenarioSession.findOne as jest.Mock).mockResolvedValue(mockSession);
      (Scenario.findOne as jest.Mock).mockResolvedValue(mockScenario);
      
      // When
      const result = await engine.processChoice(sessionId, 'EVT-CHOICE', 'INVALID-CHOICE');
      
      // Then
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
  
  // ============================================================
  // 5. 승리/패배 조건 체크 테스트
  // ============================================================
  
  describe('승리/패배 조건 체크', () => {
    it('SURVIVE_TURNS 조건이 올바르게 체크된다', async () => {
      // Given
      const mockSession = {
        sessionId,
        scenarioId: 'SCENARIO-001',
        status: 'active',
        currentTurn: 20,
        gameDate: { year: 796, month: 5, day: 1 },
        flags: new Map(),
      };
      
      const mockScenario = {
        meta: { id: 'SCENARIO-001' },
        events: [],
        victoryConditions: [
          { id: 'VICTORY-1', type: 'SURVIVE_TURNS', params: { turns: 15 } },
        ],
        defeatConditions: [],
      };
      
      (ScenarioSession.findOne as jest.Mock).mockResolvedValue(mockSession);
      (Scenario.findOne as jest.Mock).mockResolvedValue(mockScenario);
      (ScenarioSession.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
      
      // When
      const result = await engine.checkGameConditions(sessionId);
      
      // Then
      expect(result.victory).toBe(true);
      expect(result.satisfiedConditions).toContain('VICTORY-1');
    });
    
    it('CAPTURE_LOCATION 승리 조건이 체크된다', async () => {
      // Given
      const mockSession = {
        sessionId,
        scenarioId: 'SCENARIO-001',
        status: 'active',
        currentTurn: 10,
        gameDate: { year: 796, month: 5, day: 1 },
        flags: new Map(),
      };
      
      const mockScenario = {
        meta: { id: 'SCENARIO-001' },
        events: [],
        victoryConditions: [
          { 
            id: 'VICTORY-CAPTURE', 
            type: 'CAPTURE_LOCATION', 
            params: { locationId: 'ISERLOHN', factionId: 'ALLIANCE' } 
          },
        ],
        defeatConditions: [],
      };
      
      (ScenarioSession.findOne as jest.Mock).mockResolvedValue(mockSession);
      (Scenario.findOne as jest.Mock).mockResolvedValue(mockScenario);
      (StarSystem.findOne as jest.Mock).mockResolvedValue({
        systemId: 'ISERLOHN',
        controllingFactionId: 'ALLIANCE',
      });
      (ScenarioSession.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
      
      // When
      const result = await engine.checkGameConditions(sessionId);
      
      // Then
      expect(result.victory).toBe(true);
    });
    
    it('CHARACTER_DEATH 패배 조건이 체크된다', async () => {
      // Given
      const mockSession = {
        sessionId,
        scenarioId: 'SCENARIO-001',
        status: 'active',
        currentTurn: 10,
        gameDate: { year: 796, month: 5, day: 1 },
        flags: new Map(),
      };
      
      const mockScenario = {
        meta: { id: 'SCENARIO-001' },
        events: [],
        victoryConditions: [],
        defeatConditions: [
          { 
            id: 'DEFEAT-DEATH', 
            type: 'CHARACTER_DEATH', 
            params: { characterId: 'YANG_WENLI' } 
          },
        ],
      };
      
      (ScenarioSession.findOne as jest.Mock).mockResolvedValue(mockSession);
      (Scenario.findOne as jest.Mock).mockResolvedValue(mockScenario);
      (Gin7Character.findOne as jest.Mock).mockResolvedValue({
        characterId: 'YANG_WENLI',
        state: 'dead', // 캐릭터 사망
      });
      (ScenarioSession.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
      
      // When
      const result = await engine.checkGameConditions(sessionId);
      
      // Then
      expect(result.defeat).toBe(true);
      expect(result.satisfiedConditions).toContain('DEFEAT-DEATH');
    });
    
    it('DESTROY_FLEET 조건이 체크된다', async () => {
      // Given
      const mockSession = {
        sessionId,
        scenarioId: 'SCENARIO-001',
        status: 'active',
        currentTurn: 10,
        gameDate: { year: 796, month: 5, day: 1 },
        flags: new Map(),
      };
      
      const mockScenario = {
        meta: { id: 'SCENARIO-001' },
        events: [],
        victoryConditions: [
          { 
            id: 'VICTORY-DESTROY', 
            type: 'DESTROY_FLEET', 
            params: { fleetId: 'ENEMY-FLEET' } 
          },
        ],
        defeatConditions: [],
      };
      
      (ScenarioSession.findOne as jest.Mock).mockResolvedValue(mockSession);
      (Scenario.findOne as jest.Mock).mockResolvedValue(mockScenario);
      (FleetService.getFleet as jest.Mock).mockResolvedValue({
        fleetId: 'ENEMY-FLEET',
        status: 'DESTROYED',
      });
      (ScenarioSession.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
      
      // When
      const result = await engine.checkGameConditions(sessionId);
      
      // Then
      expect(result.victory).toBe(true);
    });
    
    it('CONTROL_COUNT 조건이 올바르게 계산된다', async () => {
      // Given
      const mockSession = {
        sessionId,
        scenarioId: 'SCENARIO-001',
        status: 'active',
        currentTurn: 10,
        gameDate: { year: 796, month: 5, day: 1 },
        flags: new Map(),
      };
      
      const mockScenario = {
        meta: { id: 'SCENARIO-001' },
        events: [],
        victoryConditions: [
          { 
            id: 'VICTORY-CONTROL', 
            type: 'CONTROL_COUNT', 
            params: { factionId: 'EMPIRE', count: 5 } 
          },
        ],
        defeatConditions: [],
      };
      
      (ScenarioSession.findOne as jest.Mock).mockResolvedValue(mockSession);
      (Scenario.findOne as jest.Mock).mockResolvedValue(mockScenario);
      (StarSystem.countDocuments as jest.Mock).mockResolvedValue(3);
      (Planet.countDocuments as jest.Mock).mockResolvedValue(4);
      (ScenarioSession.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
      
      // When
      const result = await engine.checkGameConditions(sessionId);
      
      // Then: 3 + 4 = 7 >= 5
      expect(result.victory).toBe(true);
    });
  });
  
  // ============================================================
  // 통합 테스트
  // ============================================================
  
  describe('통합 테스트', () => {
    it('복합 시나리오: 이벤트 트리거 → 조건 체크 → 액션 실행', async () => {
      // Given: 복합 이벤트 설정
      const complexEvent: ScenarioEvent = {
        id: 'EVT-COMPLEX',
        name: '복합 이벤트',
        enabled: true,
        trigger: {
          type: 'ON_TURN',
          params: { turn: 10 },
        },
        conditions: [
          {
            type: 'AND',
            checks: [
              { checkType: 'TURN_GTE', params: { turn: 5 } },
              { checkType: 'CHARACTER_ALIVE', params: { characterId: 'REINHARD' } },
            ],
          },
        ],
        actions: [
          { type: 'SET_FLAG', params: { flagName: 'campaign_started', flagValue: true } },
          { type: 'SHOW_DIALOGUE', params: { speakerName: 'Reinhard', text: '진격하라!' } },
        ],
        once: true,
      };
      
      const mockScenario = {
        meta: { id: 'SCENARIO-001' },
        events: [complexEvent],
        victoryConditions: [],
        defeatConditions: [],
      };
      
      const mockSession = {
        sessionId,
        scenarioId: 'SCENARIO-001',
        status: 'active',
        currentTurn: 10,
        gameDate: { year: 796, month: 5, day: 1 },
        triggeredEvents: [],
        flags: new Map(),
      };
      
      (ScenarioSession.findOne as jest.Mock).mockResolvedValue(mockSession);
      (Scenario.findOne as jest.Mock).mockResolvedValue(mockScenario);
      (Gin7Character.findOne as jest.Mock).mockResolvedValue({
        characterId: 'REINHARD',
        state: 'idle',
      });
      (ScenarioSession.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
      
      const context: TriggerContext = {
        sessionId,
        turn: 10,
        gameDate: { year: 796, month: 5, day: 1 },
      };
      
      // When
      const results = await engine.checkTriggersForType('ON_TURN', context);
      
      // Then
      expect(results.length).toBe(1);
      expect(results[0].success).toBe(true);
      expect(results[0].actionsExecuted).toBe(2);
    });
  });
});










