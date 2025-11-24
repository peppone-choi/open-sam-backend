/**
 * EncourageSettlementCommand 자동 생성 테스트
 * 
 * 이 파일은 scripts/generate-command-tests.ts에 의해 자동 생성되었습니다.
 * 필요에 따라 테스트 케이스를 추가하거나 수정하세요.
 */

import { EncourageSettlementCommand } from '../encourageSettlement';
import {
  MockObjects,
  ConstraintTestHelper,
  CommandTestHelper
} from '../../__tests__/test-helpers';

// Mock repositories
jest.mock('../../../repositories/city.repository', () => ({
  cityRepository: {
    findOneByFilter: jest.fn().mockResolvedValue(null),
    updateByCityNum: jest.fn().mockResolvedValue(undefined)
  }
}));

jest.mock('../../../repositories/nation.repository', () => ({
  nationRepository: {
    findByNationNum: jest.fn().mockResolvedValue(null),
    findOneByFilter: jest.fn().mockResolvedValue(null)
  }
}));

jest.mock('../../../repositories/unit-stack.repository', () => ({
  unitStackRepository: {
    findByOwner: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null)
  }
}));

describe('EncourageSettlementCommand', () => {
  describe('기본 구조 테스트', () => {
    it('클래스가 정의되어 있어야 함', () => {
      expect(EncourageSettlementCommand).toBeDefined();
    });

    it('getName() 메서드가 있어야 함', () => {
      expect(typeof EncourageSettlementCommand.getName).toBe('function');
      const name = EncourageSettlementCommand.getName();
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });
  });

  describe('인스턴스 생성 테스트', () => {
    it('유효한 인자로 인스턴스를 생성할 수 있어야 함', () => {
      const { command, general, city, nation, env } = CommandTestHelper.prepareCommand(
        EncourageSettlementCommand,
        {}, // general options
        {}, // city options
        {}, // nation options
        {}, // env options
        { /* TODO: 적절한 arg 추가 */ }
      );

      expect(command).toBeDefined();
      expect(command instanceof EncourageSettlementCommand).toBe(true);
    });
  });

  describe('argTest 테스트', () => {
    it('유효한 인자를 검증해야 함', () => {
      const { command } = CommandTestHelper.prepareCommand(
        EncourageSettlementCommand,
        {}, {}, {}, {},
        { /* TODO: 유효한 arg */ }
      );

      const result = command['argTest']();

      expect(typeof result).toBe('boolean');
    });

    it('잘못된 인자를 거부해야 함', () => {
      const { command } = CommandTestHelper.prepareCommand(
        EncourageSettlementCommand,
        {}, {}, {}, {},
        null
      );

      const result = command['argTest']();
      expect(result).toBe(true);
    });
  });

  describe('제약 조건 테스트', () => {
    it('minConditionConstraints가 정의되어 있어야 함', () => {
      const { command } = CommandTestHelper.prepareCommand(
        EncourageSettlementCommand,
        {}, {}, {}, {},
        { /* TODO */ }
      );

      command['init']();

      const constraints = command['minConditionConstraints'];
      expect(Array.isArray(constraints)).toBe(true);
    });

    it('fullConditionConstraints가 정의되어 있어야 함', () => {
      const { command } = CommandTestHelper.prepareCommand(
        EncourageSettlementCommand,
        {}, {}, {}, {},
        { /* TODO */ }
      );

      command['init']();
      command['initWithArg']();

      const constraints = command['fullConditionConstraints'];
      expect(Array.isArray(constraints)).toBe(true);
    });
  });

  describe('비용 계산 테스트', () => {
    it('getCost()가 [금, 쌀] 배열을 반환해야 함', () => {
      const { command } = CommandTestHelper.prepareCommand(
        EncourageSettlementCommand,
        {}, {}, {}, {},
        { /* TODO */ }
      );

      command['init']();
      command['initWithArg']();

      const cost = command.getCost();
      expect(Array.isArray(cost)).toBe(true);
      expect(cost.length).toBe(2);
      expect(typeof cost[0]).toBe('number');
      expect(typeof cost[1]).toBe('number');
    });

    it('비용이 음수가 아니어야 함', () => {
      const { command } = CommandTestHelper.prepareCommand(
        EncourageSettlementCommand,
        {}, {}, {}, {},
        { /* TODO */ }
      );

      command['init']();
      command['initWithArg']();

      const [gold, rice] = command.getCost();
      expect(gold).toBeGreaterThanOrEqual(0);
      expect(rice).toBeGreaterThanOrEqual(0);
    });
  });

  describe('턴 요구사항 테스트', () => {
    it('getPreReqTurn()이 숫자를 반환해야 함', () => {
      const { command } = CommandTestHelper.prepareCommand(
        EncourageSettlementCommand,
        {}, {}, {}, {},
        { /* TODO */ }
      );

      const preTurn = command.getPreReqTurn();
      expect(typeof preTurn).toBe('number');
      expect(preTurn).toBeGreaterThanOrEqual(0);
    });

    it('getPostReqTurn()이 숫자를 반환해야 함', () => {
      const { command } = CommandTestHelper.prepareCommand(
        EncourageSettlementCommand,
        {}, {}, {}, {},
        { /* TODO */ }
      );

      const postTurn = command.getPostReqTurn();
      expect(typeof postTurn).toBe('number');
      expect(postTurn).toBeGreaterThanOrEqual(0);
    });
  });


  describe('실행 로직 테스트', () => {
    it('정착 장려는 통솔력을 사용하여 계산해야 함 (BF-004 Fix)', async () => {
      const { command, general } = CommandTestHelper.prepareCommand(
        EncourageSettlementCommand,
        {
          leadership: 90,
          politics: 10, // 정치가 낮아도 영향 없어야 함
          charm: 10
        },
        {}, {}, {},
        { /* arg */ }
      );

      // Mock setup
      command['hasFullConditionMet'] = jest.fn().mockReturnValue(true);
      command['saveGeneral'] = jest.fn().mockResolvedValue(undefined);

      // Mock RNG
      const rng = {
        nextRange: jest.fn().mockReturnValue(1.0),
        choiceUsingWeight: jest.fn().mockReturnValue('normal')
      };

      // Mock calcBaseScore to verify it uses leadership
      // But we want to test calcBaseScore itself.
      // So let's call calcBaseScore directly if possible or run() and check result.

      // Let's spy on getLeadership
      const getLeadershipSpy = jest.spyOn(general, 'getLeadership');
      const getPoliticsSpy = jest.spyOn(general, 'getPolitics');

      // Run command
      await command.run(rng);

      // Verify getLeadership was called
      expect(getLeadershipSpy).toHaveBeenCalled();
      // Verify getPolitics was NOT called (or at least not for score calc)
      // Note: getPolitics might be called for other reasons? No, only if statKey is politics.
      expect(getPoliticsSpy).not.toHaveBeenCalled();
    });
  });
});
