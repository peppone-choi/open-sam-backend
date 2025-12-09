/**
 * GIN7 Scenario Event Engine - Unit Tests
 * 
 * ScenarioEventEngine의 시스템 연동 기능 테스트
 * - Character 상태 조회
 * - Fleet 위치 조회
 * - Territory 소유권 조회
 * - Resource 수정
 */

import mongoose from 'mongoose';
import { ScenarioEventEngine, TriggerContext } from '../../services/gin7/ScenarioEventEngine';
import { Gin7Character } from '../../models/gin7/Character';
import { Fleet } from '../../models/gin7/Fleet';
import { StarSystem } from '../../models/gin7/StarSystem';
import { Planet } from '../../models/gin7/Planet';
import { ScenarioSession } from '../../models/gin7/ScenarioSession';
import { Scenario } from '../../models/gin7/Scenario';

// Mock 설정
jest.mock('../../models/gin7/Character');
jest.mock('../../models/gin7/Fleet');
jest.mock('../../models/gin7/StarSystem');
jest.mock('../../models/gin7/Planet');
jest.mock('../../models/gin7/ScenarioSession');
jest.mock('../../models/gin7/Scenario');
jest.mock('../../services/gin7/FleetService');

describe('ScenarioEventEngine', () => {
  let engine: ScenarioEventEngine;
  const testSessionId = 'test-session-001';
  
  beforeEach(() => {
    engine = ScenarioEventEngine.getInstance();
    jest.clearAllMocks();
  });

  describe('Character 연동 테스트', () => {
    it('생존한 캐릭터에 대해 CHARACTER_ALIVE 조건이 true를 반환해야 함', async () => {
      // Arrange
      const mockCharacter = {
        characterId: 'reinhard-001',
        sessionId: testSessionId,
        name: '라인하르트 폰 로엔그람',
        state: 'idle',
      };
      
      (Gin7Character.findOne as jest.Mock).mockResolvedValue(mockCharacter);
      
      // Act - private 메서드를 테스트하기 위해 public API를 통해 테스트
      // checkSingleCondition을 직접 호출할 수 없으므로 이벤트 트리거를 통해 간접 테스트
      const result = await (engine as any).checkCharacterAlive(testSessionId, 'reinhard-001');
      
      // Assert
      expect(result).toBe(true);
      expect(Gin7Character.findOne).toHaveBeenCalledWith({
        sessionId: testSessionId,
        characterId: 'reinhard-001',
      });
    });

    it('사망한 캐릭터에 대해 CHARACTER_ALIVE 조건이 false를 반환해야 함', async () => {
      // Arrange
      const mockCharacter = {
        characterId: 'kircheis-001',
        sessionId: testSessionId,
        name: '지크프리드 키르히아이스',
        state: 'dead',
      };
      
      (Gin7Character.findOne as jest.Mock).mockResolvedValue(mockCharacter);
      
      // Act
      const result = await (engine as any).checkCharacterAlive(testSessionId, 'kircheis-001');
      
      // Assert
      expect(result).toBe(false);
    });

    it('존재하지 않는 캐릭터에 대해 false를 반환해야 함', async () => {
      // Arrange
      (Gin7Character.findOne as jest.Mock).mockResolvedValue(null);
      
      // Act
      const result = await (engine as any).checkCharacterAlive(testSessionId, 'unknown-001');
      
      // Assert
      expect(result).toBe(false);
    });
  });

  describe('Fleet 연동 테스트', () => {
    it('함대가 특정 위치에 있을 때 FLEET_AT 조건이 true를 반환해야 함', async () => {
      // Arrange
      const mockFleet = {
        fleetId: 'fleet-reinhard-001',
        sessionId: testSessionId,
        location: {
          type: 'SYSTEM',
          systemId: 'iserlohn',
        },
      };
      
      // FleetService.getFleet mock
      const { FleetService } = require('../../services/gin7/FleetService');
      FleetService.getFleet = jest.fn().mockResolvedValue(mockFleet);
      
      // Act
      const result = await (engine as any).checkFleetAtLocation(
        testSessionId, 
        'fleet-reinhard-001', 
        'iserlohn'
      );
      
      // Assert
      expect(result).toBe(true);
    });

    it('함대가 다른 위치에 있을 때 FLEET_AT 조건이 false를 반환해야 함', async () => {
      // Arrange
      const mockFleet = {
        fleetId: 'fleet-yang-001',
        sessionId: testSessionId,
        location: {
          type: 'SYSTEM',
          systemId: 'heinessen',
        },
      };
      
      const { FleetService } = require('../../services/gin7/FleetService');
      FleetService.getFleet = jest.fn().mockResolvedValue(mockFleet);
      
      // Act
      const result = await (engine as any).checkFleetAtLocation(
        testSessionId, 
        'fleet-yang-001', 
        'iserlohn'
      );
      
      // Assert
      expect(result).toBe(false);
    });
  });

  describe('Territory 연동 테스트', () => {
    it('세력이 성계를 통제할 때 FACTION_CONTROLS 조건이 true를 반환해야 함', async () => {
      // Arrange
      const mockSystem = {
        systemId: 'odin',
        sessionId: testSessionId,
        controllingFactionId: 'empire',
      };
      
      (StarSystem.findOne as jest.Mock).mockResolvedValue(mockSystem);
      
      // Act
      const result = await (engine as any).checkFactionControls(
        testSessionId, 
        'empire', 
        'odin'
      );
      
      // Assert
      expect(result).toBe(true);
    });

    it('다른 세력이 통제할 때 FACTION_CONTROLS 조건이 false를 반환해야 함', async () => {
      // Arrange
      const mockSystem = {
        systemId: 'heinessen',
        sessionId: testSessionId,
        controllingFactionId: 'alliance',
      };
      
      (StarSystem.findOne as jest.Mock).mockResolvedValue(mockSystem);
      
      // Act
      const result = await (engine as any).checkFactionControls(
        testSessionId, 
        'empire', 
        'heinessen'
      );
      
      // Assert
      expect(result).toBe(false);
    });

    it('행성 소유권도 확인해야 함', async () => {
      // Arrange - StarSystem이 없을 때 Planet으로 폴백
      (StarSystem.findOne as jest.Mock).mockResolvedValue(null);
      
      const mockPlanet = {
        planetId: 'heinessen-prime',
        sessionId: testSessionId,
        ownerId: 'alliance',
      };
      
      (Planet.findOne as jest.Mock).mockResolvedValue(mockPlanet);
      
      // Act
      const result = await (engine as any).checkFactionControls(
        testSessionId, 
        'alliance', 
        'heinessen-prime'
      );
      
      // Assert
      expect(result).toBe(true);
    });
  });

  describe('액션 핸들러 테스트', () => {
    it('MODIFY_RESOURCE 액션이 행성 자원을 수정해야 함', async () => {
      // Arrange
      const mockPlanet = {
        planetId: 'odin-prime',
        sessionId: testSessionId,
        resources: {
          food: 1000,
          minerals: 500,
        },
      };
      
      (Planet.findOne as jest.Mock).mockResolvedValue(mockPlanet);
      (Planet.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
      
      const action = {
        type: 'MODIFY_RESOURCE' as const,
        params: {
          targetType: 'PLANET',
          targetId: 'odin-prime',
          resourceType: 'food',
          amount: 500,
          operation: 'ADD',
        },
      };
      
      const context: TriggerContext = {
        sessionId: testSessionId,
        turn: 1,
        gameDate: { year: 796, month: 1, day: 1 },
      };
      
      // Act - 핸들러 직접 실행
      const handler = (engine as any).actionHandlers.get('MODIFY_RESOURCE');
      await handler(action, context);
      
      // Assert
      expect(Planet.updateOne).toHaveBeenCalled();
    });

    it('CHANGE_OWNER 액션이 성계 소유권을 변경해야 함', async () => {
      // Arrange
      const mockSystem = {
        systemId: 'iserlohn',
        sessionId: testSessionId,
        controllingFactionId: 'empire',
      };
      
      (StarSystem.findOne as jest.Mock).mockResolvedValue(mockSystem);
      (StarSystem.updateOne as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
      
      const action = {
        type: 'CHANGE_OWNER' as const,
        params: {
          locationId: 'iserlohn',
          newOwnerId: 'alliance',
        },
      };
      
      const context: TriggerContext = {
        sessionId: testSessionId,
        turn: 1,
        gameDate: { year: 796, month: 1, day: 1 },
      };
      
      // Act
      const handler = (engine as any).actionHandlers.get('CHANGE_OWNER');
      await handler(action, context);
      
      // Assert
      expect(StarSystem.updateOne).toHaveBeenCalledWith(
        { sessionId: testSessionId, systemId: 'iserlohn' },
        { $set: { controllingFactionId: 'alliance' } }
      );
    });
  });

  describe('게임 조건 체크 테스트', () => {
    it('CAPTURE_LOCATION 조건이 올바르게 동작해야 함', async () => {
      // Arrange
      const mockSystem = {
        systemId: 'iserlohn',
        sessionId: testSessionId,
        controllingFactionId: 'alliance',
      };
      
      (StarSystem.findOne as jest.Mock).mockResolvedValue(mockSystem);
      
      const condition = {
        type: 'CAPTURE_LOCATION',
        params: {
          locationId: 'iserlohn',
          factionId: 'alliance',
        },
      };
      
      const context: TriggerContext = {
        sessionId: testSessionId,
        turn: 10,
        gameDate: { year: 796, month: 1, day: 1 },
      };
      
      const mockSession = {
        sessionId: testSessionId,
        flags: new Map(),
      };
      
      // Act
      const result = await (engine as any).checkGameCondition(condition, context, mockSession);
      
      // Assert
      expect(result).toBe(true);
    });

    it('CONTROL_COUNT 조건이 올바르게 동작해야 함', async () => {
      // Arrange
      (StarSystem.countDocuments as jest.Mock).mockResolvedValue(5);
      (Planet.countDocuments as jest.Mock).mockResolvedValue(10);
      
      const condition = {
        type: 'CONTROL_COUNT',
        params: {
          factionId: 'empire',
          count: 10,
        },
      };
      
      const context: TriggerContext = {
        sessionId: testSessionId,
        turn: 10,
        gameDate: { year: 796, month: 1, day: 1 },
      };
      
      const mockSession = {
        sessionId: testSessionId,
        flags: new Map(),
      };
      
      // Act
      const result = await (engine as any).checkGameCondition(condition, context, mockSession);
      
      // Assert
      expect(result).toBe(true); // 5 + 10 = 15 >= 10
    });
  });
});

// 테스트용 시나리오 이벤트 예시
export const testScenarioEvent = {
  id: 'test-event-iserlohn-capture',
  name: '이제르론 함락',
  enabled: true,
  once: true,
  trigger: {
    type: 'ON_PLANET_CAPTURED' as const,
    params: {
      locationId: 'iserlohn',
    },
  },
  conditions: [
    {
      type: 'AND' as const,
      checks: [
        {
          checkType: 'CHARACTER_ALIVE' as const,
          params: { characterId: 'yang-wenli' },
        },
        {
          checkType: 'FLEET_AT' as const,
          params: { fleetId: 'fleet-yang-13th', locationId: 'iserlohn' },
        },
      ],
    },
  ],
  actions: [
    {
      type: 'SHOW_DIALOGUE' as const,
      params: {
        speakerId: 'yang-wenli',
        speakerName: '양 웬리',
        text: '이제르론을 함락시켰습니다. 하지만 이것이 전쟁의 끝은 아닙니다...',
      },
    },
    {
      type: 'SET_FLAG' as const,
      params: {
        flagName: 'iserlohn_captured',
        flagValue: true,
      },
    },
    {
      type: 'CHANGE_OWNER' as const,
      params: {
        locationId: 'iserlohn',
        newOwnerId: 'alliance',
      },
    },
  ],
};










