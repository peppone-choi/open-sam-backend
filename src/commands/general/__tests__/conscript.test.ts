/**
 * 징병 커맨드 테스트
 * 
 * PHP 원본 기준 (che_징병.php):
 * - 보급 연결 제약 없음 (SuppliedCity 없음)
 * - 점령한 도시에서만 징병 가능
 * - 주민 수, 신뢰도 제약 확인
 * - 병종 제약 확인
 * - Rice 계산: maxCrew / 100 (고정, 기술 영향 없음)
 */

import { ConscriptCommand } from '../conscript';
import { ConstraintHelper } from '../../../constraints/ConstraintHelper';

describe('ConscriptCommand', () => {
  let mockGeneral: any;
  let mockEnv: any;
  let command: ConscriptCommand;

  beforeEach(() => {
    // Mock 장수 객체
    mockGeneral = {
      getVar: jest.fn((key: string) => {
        const values: Record<string, any> = {
          'gold': 10000,
          'rice': 5000,
          'crew': 5000,
          'leadership': 80,
          'charm': 70,
          'crewtype': 0,
          'officer_level': 5,
          'city': 1
        };
        return values[key] || 0;
      }),
      setVar: jest.fn(),
      increaseVar: jest.fn(),
      increaseVarWithLimit: jest.fn(),
      getNationID: jest.fn(() => 1),
      getLeadership: jest.fn(() => 80),
      getCharm: jest.fn(() => 70),
      getCrewTypeObj: jest.fn(() => ({ id: 0, name: '보병', armType: 0 })),
      onCalcDomestic: jest.fn((action, key, value) => value),
      addExperience: jest.fn(),
      addDedication: jest.fn(),
      checkStatChange: jest.fn(),
      setAuxVar: jest.fn(),
      addDex: jest.fn(),
      getLogger: jest.fn(() => ({
        pushGeneralActionLog: jest.fn(),
        flush: jest.fn()
      })),
      getCityID: jest.fn(() => 1),
      _cached_city: null,
      _cached_nation: null
    };

    // Mock 환경 객체
    mockEnv = {
      year: 184,
      month: 1,
      session_id: 'test_session',
      scenario_id: 'sangokushi',
      ownedCities: [
        { city: 1, name: '낙양', nation: 1, level: 5 }
      ]
    };
  });

  describe('보급 제약 (PHP 원본: 없음)', () => {
    it('PHP 원본과 동일하게 SuppliedCity 제약이 없어야 함', () => {
      const arg = { crewType: 0, amount: 1000 };
      command = new ConscriptCommand(mockGeneral, mockEnv, arg);

      // 보급이 끊긴 도시에서도 징병 가능해야 함 (PHP 원본 기준)
      mockGeneral._cached_city = {
        city: 1,
        name: '낙양',
        nation: 1,
        supply: 0, // 보급 끊김
        pop: 100000,
        trust: 80
      };

      mockGeneral._cached_nation = {
        nation: 1,
        tech: 100,
        aux: {}
      };

      command['init']();
      command['initWithArg']();

      const constraints = command['fullConditionConstraints'];
      
      // SuppliedCity 제약이 없어야 함
      const suppliedCityConstraint = constraints.find(
        c => c.test.toString().includes('보급이 끊긴')
      );

      expect(suppliedCityConstraint).toBeUndefined();
    });
  });

  describe('점령 도시 제약 (OccupiedCity)', () => {
    it('적국 도시에서는 징병이 불가능해야 함', () => {
      const arg = { crewType: 0, amount: 1000 };
      command = new ConscriptCommand(mockGeneral, mockEnv, arg);

      mockGeneral._cached_city = {
        city: 2,
        name: '허창',
        nation: 2, // 적국
        supply: 1,
        pop: 100000,
        trust: 80
      };

      command['init']();

      const constraints = command['minConditionConstraints'];
      const occupiedCityConstraint = constraints.find(
        c => c.test.toString().includes('아국 도시가 아닙니다')
      );

      expect(occupiedCityConstraint).toBeDefined();
      
      const result = occupiedCityConstraint!.test(
        { 
          general: mockGeneral, 
          city: mockGeneral._cached_city 
        }, 
        mockEnv
      );
      
      expect(result).toBe('아국 도시가 아닙니다.');
    });
  });

  describe('주민 수 제약', () => {
    it('주민이 부족하면 징병이 불가능해야 함', () => {
      const arg = { crewType: 0, amount: 1000 };
      command = new ConscriptCommand(mockGeneral, mockEnv, arg);

      mockGeneral._cached_city = {
        city: 1,
        name: '낙양',
        nation: 1,
        supply: 1,
        pop: 500, // 주민 부족 (필요: 100 + 1000)
        trust: 80
      };

      mockGeneral._cached_nation = {
        nation: 1,
        tech: 100,
        aux: {}
      };

      command['init']();
      command['initWithArg']();

      const constraints = command['fullConditionConstraints'];
      const popConstraint = constraints.find(
        c => c.test.toString().includes('주민')
      );

      expect(popConstraint).toBeDefined();
    });
  });

  describe('argTest', () => {
    it('유효한 인자를 받아야 함', () => {
      const validArg = { crewType: 0, amount: 1000 };
      command = new ConscriptCommand(mockGeneral, mockEnv, validArg);
      
      const result = command['argTest']();
      expect(result).toBe(true);
    });

    it('병종 ID가 없으면 실패해야 함', () => {
      const invalidArg = { amount: 1000 };
      command = new ConscriptCommand(mockGeneral, mockEnv, invalidArg as any);
      
      const result = command['argTest']();
      expect(result).toBe(false);
    });

    it('병사 수가 없으면 실패해야 함', () => {
      const invalidArg = { crewType: 0 };
      command = new ConscriptCommand(mockGeneral, mockEnv, invalidArg as any);
      
      const result = command['argTest']();
      expect(result).toBe(false);
    });

    it('음수 병사 수는 실패해야 함', () => {
      const invalidArg = { crewType: 0, amount: -100 };
      command = new ConscriptCommand(mockGeneral, mockEnv, invalidArg);
      
      const result = command['argTest']();
      expect(result).toBe(false);
    });
  });

  describe('getCost', () => {
    it('병사 수에 따라 비용을 계산해야 함', () => {
      const arg = { crewType: 0, amount: 1000 };
      command = new ConscriptCommand(mockGeneral, mockEnv, arg);

      mockGeneral._cached_nation = {
        nation: 1,
        tech: 100,
        aux: {}
      };

      command['argTest']();
      command['init']();
      command['initWithArg']();

      const [gold, rice] = command.getCost();
      
      expect(gold).toBeGreaterThan(0);
      expect(rice).toBeGreaterThan(0);
    });

    it('PHP 원본과 동일하게 rice는 maxCrew/100으로 계산되어야 함', () => {
      const arg = { crewType: 0, amount: 1000 };
      command = new ConscriptCommand(mockGeneral, mockEnv, arg);

      mockGeneral._cached_nation = {
        nation: 1,
        tech: 5000, // 높은 기술 레벨 (techLevel = 5)
        aux: {}
      };

      command['argTest']();
      command['init']();
      command['initWithArg']();

      const [gold, rice] = command.getCost();
      
      // PHP 원본: rice = maxCrew / 100 (기술 레벨 영향 없음)
      // 1000명 징병 -> rice = 10
      expect(rice).toBe(10);
    });
  });
});
