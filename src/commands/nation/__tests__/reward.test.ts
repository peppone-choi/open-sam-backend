/**
 * 포상 (Reward) 커맨드 테스트
 * 
 * PHP che_포상 대응
 */

import { che_포상 as RewardCommand } from '../reward';
import { 
  MockObjects, 
  ConstraintTestHelper, 
  CommandTestHelper 
} from '../../__tests__/test-helpers';

describe('RewardCommand (포상)', () => {
  describe('기본 구조 테스트', () => {
    it('클래스가 정의되어 있어야 함', () => {
      expect(RewardCommand).toBeDefined();
    });

    it('getName() 메서드가 있어야 함', () => {
      expect(typeof RewardCommand.getName).toBe('function');
      const name = RewardCommand.getName();
      expect(typeof name).toBe('string');
    });

    it('getCategory()가 "nation"을 반환해야 함', () => {
      expect(RewardCommand.getCategory()).toBe('nation');
    });
  });

  describe('인스턴스 생성 테스트', () => {
    it('유효한 인자로 인스턴스를 생성할 수 있어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        RewardCommand,
        { nation: 1, officer_level: 5 },
        { nation: 1 },
        { nation: 1, gold: 100000, rice: 50000 },
        { startyear: 184 },
        null,
        { targetGeneralNo: 2, gold: 1000, rice: 500 }
      );

      expect(command).toBeDefined();
    });
  });

  describe('제약 조건 테스트', () => {
    it('minConditionConstraints가 정의되어 있어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        RewardCommand,
        { nation: 1, officer_level: 5 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184 },
        null,
        { targetGeneralNo: 2, gold: 1000, rice: 500 }
      );

      command['init']();
      
      const constraints = command['minConditionConstraints'];
      expect(Array.isArray(constraints)).toBe(true);
    });

    it('수뇌부만 포상 가능', () => {
      const { command, general, city, nation } = CommandTestHelper.prepareNationCommand(
        RewardCommand,
        { nation: 1, officer_level: 1 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184 },
        null,
        { targetGeneralNo: 2, gold: 1000, rice: 500 }
      );

      command['init']();
      
      const constraints = command['minConditionConstraints'];
      const input = { general, city, nation };
      const failed = ConstraintTestHelper.findFailedConstraints(constraints, input, {});
      
      expect(failed.length).toBeGreaterThan(0);
    });
  });

  describe('비용 계산 테스트', () => {
    it('getCost()가 [금, 쌀] 배열을 반환해야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        RewardCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184 },
        null,
        { targetGeneralNo: 2, gold: 1000, rice: 500 }
      );

      const cost = command.getCost();
      expect(Array.isArray(cost)).toBe(true);
      expect(cost.length).toBe(2);
    });
  });
});

