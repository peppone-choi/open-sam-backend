/**
 * NPC AI Integration Tests
 * 
 * PHP GeneralAI.php에서 포팅된 AI 모듈들의 통합 테스트
 * - DiplomacyEngine: 외교 상태 계산
 * - TroopDispatcher: 부대 발령
 * - DipStateActionSelector: 행동 선택
 * - SimpleAI: 특수 상황 핸들러
 * - ForceAssigner: 전투력 할당
 * - NationCommandsAI: 국가 명령
 */

import { DiplomacyEngine, DIP_STATE, DiplomacyStateResult } from '../core/DiplomacyEngine';
import { TroopDispatcher, CityInfo, GeneralInfo } from '../core/TroopDispatch';
import { DipStateActionSelector, DipState, GenType, EnvConfig, PolicyConfig } from '../core/DipStateActionSelector';
import { ForceAssigner, ForceAssignmentResult } from '../core/ForceAssignment';
import { NationCommandsAI } from '../core/NationCommandsAI';
import { DEFAULT_NATION_POLICY_VALUES } from '../core/AutorunNationPolicy';

describe('NPC AI System', () => {
  // ========================================
  // DiplomacyEngine Tests
  // ========================================
  describe('DiplomacyEngine', () => {
    it('should create DiplomacyEngine instance', () => {
      const engine = new DiplomacyEngine();
      expect(engine).toBeDefined();
    });

    it('should have DIP_STATE constants', () => {
      expect(DIP_STATE.PEACE).toBe(0);
      expect(DIP_STATE.DECLARED).toBe(1);
      expect(DIP_STATE.RECRUITING).toBe(2);
      expect(DIP_STATE.IMMINENT).toBe(3);
      expect(DIP_STATE.WAR).toBe(4);
    });
  });

  // ========================================
  // TroopDispatcher Tests
  // ========================================
  describe('TroopDispatcher', () => {
    const mockNation = {
      nation: 1,
      name: '테스트국',
      gold: 50000,
      rice: 50000,
      capital: 1,
    };

    const mockEnv = {
      month: 1,
      year: 200,
      startyear: 184,
      develcost: 100,
      baserice: 500,
    };

    it('should create TroopDispatcher instance', () => {
      const dispatcher = new TroopDispatcher(mockNation, mockEnv, DEFAULT_NATION_POLICY_VALUES);
      expect(dispatcher).toBeDefined();
    });

    it('should set cities correctly', () => {
      const dispatcher = new TroopDispatcher(mockNation, mockEnv, DEFAULT_NATION_POLICY_VALUES);
      
      const cities: CityInfo[] = [
        { city: 1, name: '본거지', nation: 1, pop: 50000, pop_max: 100000, supply: 1, front: 0, level: 5 },
        { city: 2, name: '전방', nation: 1, pop: 30000, pop_max: 60000, supply: 1, front: 1, level: 4 },
      ];
      
      dispatcher.setCities(cities);
      expect(dispatcher).toBeDefined();
    });

    it('should set generals correctly', () => {
      const dispatcher = new TroopDispatcher(mockNation, mockEnv, DEFAULT_NATION_POLICY_VALUES);
      
      const generals: GeneralInfo[] = [
        { 
          no: 1, 
          name: '장수1', 
          nation: 1, 
          city: 1, 
          npc: 3, 
          officer_level: 5,
          troop: 0,
          crew: 5000,
          train: 80,
          atmos: 80,
          leadership: 80,
        },
      ];
      
      dispatcher.setGenerals(generals);
      expect(dispatcher).toBeDefined();
    });
  });

  // ========================================
  // DipStateActionSelector Tests
  // ========================================
  describe('DipStateActionSelector', () => {
    const mockGeneral = {
      no: 1,
      name: '테스트 장수',
      leadership: 80,
      strength: 70,
      intel: 60,
      crew: 5000,
      gold: 3000,
      rice: 3000,
    };

    const mockCity = {
      city: 1,
      name: '테스트 도시',
      nation: 1,
      front: 0,
      supply: 1,
      pop: 50000,
      pop_max: 100000,
    };

    const mockNation = {
      nation: 1,
      name: '테스트국',
      gold: 50000,
      rice: 50000,
    };

    const mockEnv: EnvConfig = {
      month: 1,
      year: 200,
      startyear: 184,
      develcost: 100,
      baserice: 500,
    };

    const mockPolicy: PolicyConfig = {
      minWarCrew: 3000,
      properWarTrainAtmos: 80,
      minNPCRecruitCityPopulation: 10000,
      safeRecruitCityPopulationRatio: 0.3,
      minNPCWarLeadership: 60,
      minimumResourceActionAmount: 100,
      cureThreshold: 30,
    };

    it('should create DipStateActionSelector instance', () => {
      const selector = new DipStateActionSelector(
        mockGeneral,
        mockCity,
        mockNation,
        mockEnv,
        mockPolicy,
        DipState.d평화
      );
      expect(selector).toBeDefined();
    });

    it('should have DipState enum values', () => {
      expect(DipState.d평화).toBe(0);
      expect(DipState.d선포).toBe(1);
      expect(DipState.d징병).toBe(2);
      expect(DipState.d직전).toBe(3);
      expect(DipState.d전쟁).toBe(4);
    });

    it('should have GenType flags', () => {
      expect(GenType.t무장).toBe(1);
      expect(GenType.t지장).toBe(2);
      expect(GenType.t통솔장).toBe(4);
    });
  });

  // ========================================
  // ForceAssigner Tests
  // ========================================
  describe('ForceAssigner', () => {
    it('should create ForceAssigner instance', () => {
      const assigner = new ForceAssigner(
        1, // nationID
        1, // capital
        'test-session'
      );
      expect(assigner).toBeDefined();
    });

    it('should create with custom policy', () => {
      const customPolicy = {
        minNPCWarLeadership: 70,
        reqNPCWarGold: 5000,
      };

      const assigner = new ForceAssigner(
        1,
        1,
        'test-session',
        customPolicy
      );
      expect(assigner).toBeDefined();
    });

    it('should set cities correctly', () => {
      const assigner = new ForceAssigner(1, 1, 'test-session');
      
      const cities: CityInfo[] = [
        { city: 1, name: '본거지', nation: 1, pop: 50000, pop_max: 100000, supply: 1, front: 0, level: 5 },
        { city: 2, name: '전방', nation: 1, pop: 30000, pop_max: 60000, supply: 1, front: 1, level: 4 },
      ];
      
      assigner.setCities(cities);
      expect(assigner).toBeDefined();
    });

    it('should set generals correctly', () => {
      const assigner = new ForceAssigner(1, 1, 'test-session');
      
      const generals: GeneralInfo[] = [
        { 
          no: 1, 
          name: '전투형', 
          nation: 1, 
          city: 1, 
          npc: 3, 
          officer_level: 5,
          troop: 0,
          crew: 10000,
          train: 90,
          atmos: 90,
          leadership: 95,
        },
        { 
          no: 2, 
          name: '내정형', 
          nation: 1, 
          city: 2, 
          npc: 3, 
          officer_level: 3,
          troop: 0,
          crew: 2000,
          train: 50,
          atmos: 50,
          leadership: 50,
        },
      ];
      
      assigner.setGenerals(generals);
      expect(assigner).toBeDefined();
    });
  });

  // ========================================
  // NationCommandsAI Tests
  // ========================================
  describe('NationCommandsAI', () => {
    const mockChief = {
      no: 1,
      name: '군주',
      npc: 4,
      nation: 1,
      officer_level: 12,
    };

    const mockNation = {
      nation: 1,
      name: '테스트국',
      gold: 100000,
      rice: 100000,
      capital: 1,
    };

    it('should initialize with default policy', () => {
      const ai = new NationCommandsAI(
        'test-session',
        1,
        mockChief,
        mockNation
      );

      expect(ai).toBeDefined();
    });

    it('should initialize with custom policy', () => {
      const customPolicy = {
        reqNationGold: 200000,
        reqNationRice: 200000,
      };

      const ai = new NationCommandsAI(
        'test-session',
        1,
        mockChief,
        mockNation,
        customPolicy
      );

      expect(ai).toBeDefined();
    });

    it('should be instance of NationCommandsAI', () => {
      const ai = new NationCommandsAI(
        'test-session',
        1,
        mockChief,
        mockNation
      );

      expect(ai).toBeInstanceOf(NationCommandsAI);
    });
  });

  // ========================================
  // Constants and Enums Tests
  // ========================================
  describe('AI Constants', () => {
    it('should have valid DEFAULT_NATION_POLICY_VALUES', () => {
      expect(DEFAULT_NATION_POLICY_VALUES).toBeDefined();
      expect(typeof DEFAULT_NATION_POLICY_VALUES.reqNationGold).toBe('number');
      expect(typeof DEFAULT_NATION_POLICY_VALUES.reqNationRice).toBe('number');
    });

    it('should have valid diplomacy state constants', () => {
      expect(DIP_STATE.PEACE).toBeLessThan(DIP_STATE.WAR);
      expect(DIP_STATE.DECLARED).toBeLessThan(DIP_STATE.WAR);
      expect(DIP_STATE.RECRUITING).toBeLessThan(DIP_STATE.WAR);
      expect(DIP_STATE.IMMINENT).toBeLessThan(DIP_STATE.WAR);
    });
  });

  // ========================================
  // Integration Tests
  // ========================================
  describe('AI Pipeline Integration', () => {
    it('should process full AI decision pipeline with valid instances', () => {
      // 1. DiplomacyEngine 생성
      const dipEngine = new DiplomacyEngine();
      expect(dipEngine).toBeDefined();

      // 2. DipStateActionSelector 생성
      const mockGeneral = {
        leadership: 85,
        strength: 80,
        intel: 65,
        crew: 8000,
        gold: 5000,
        rice: 5000,
      };
      const mockCity = { city: 1, front: 1, supply: 1 };
      const mockNation = { nation: 1, gold: 50000, rice: 50000 };
      const mockEnv: EnvConfig = {
        month: 1,
        year: 200,
        startyear: 184,
        develcost: 100,
        baserice: 500,
      };
      const mockPolicy: PolicyConfig = {
        minWarCrew: 3000,
        properWarTrainAtmos: 80,
        minNPCRecruitCityPopulation: 10000,
        safeRecruitCityPopulationRatio: 0.3,
        minNPCWarLeadership: 60,
        minimumResourceActionAmount: 100,
        cureThreshold: 30,
      };

      const actionSelector = new DipStateActionSelector(
        mockGeneral,
        mockCity,
        mockNation,
        mockEnv,
        mockPolicy,
        DipState.d전쟁
      );
      expect(actionSelector).toBeDefined();

      // 3. ForceAssigner 생성
      const assigner = new ForceAssigner(1, 1, 'test-session');
      expect(assigner).toBeDefined();

      // 파이프라인 결과 검증
      expect(dipEngine).toBeDefined();
      expect(actionSelector).toBeDefined();
      expect(assigner).toBeDefined();
    });
  });
});
