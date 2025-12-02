/**
 * 시민 동원 (MobilizeCitizens) 커맨드 테스트
 * 
 * PHP che_징집 대응
 * 도시의 시민을 동원하여 병력을 얻습니다.
 */

import { che_징집 as MobilizeCitizensCommand } from '../mobilizeCitizens';
import { 
  MockObjects, 
  ConstraintTestHelper, 
  CommandTestHelper 
} from '../../__tests__/test-helpers';

describe('MobilizeCitizensCommand (징집)', () => {
  describe('기본 구조 테스트', () => {
    it('클래스가 정의되어 있어야 함', () => {
      expect(MobilizeCitizensCommand).toBeDefined();
    });

    it('getName() 메서드가 있어야 함', () => {
      expect(typeof MobilizeCitizensCommand.getName).toBe('function');
      const name = MobilizeCitizensCommand.getName();
      expect(typeof name).toBe('string');
    });

    it('getCategory()가 "nation"을 반환해야 함', () => {
      expect(MobilizeCitizensCommand.getCategory()).toBe('nation');
    });
  });

  describe('인스턴스 생성 테스트', () => {
    it('유효한 인자로 인스턴스를 생성할 수 있어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        MobilizeCitizensCommand,
        { nation: 1, officer_level: 5 },
        { nation: 1, supply: 1, pop: 100000 },
        { nation: 1 },
        {},
        null,
        { amount: 1000 }
      );

      expect(command).toBeDefined();
    });
  });

  describe('제약 조건 테스트', () => {
    it('minConditionConstraints가 정의되어 있어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        MobilizeCitizensCommand,
        { nation: 1, officer_level: 5 },
        { nation: 1, supply: 1 },
        { nation: 1 },
        {},
        null,
        { amount: 1000 }
      );

      command['init']();
      
      const constraints = command['minConditionConstraints'];
      expect(Array.isArray(constraints)).toBe(true);
    });

    it('수뇌부만 징집 가능', () => {
      const { command, general, city, nation } = CommandTestHelper.prepareNationCommand(
        MobilizeCitizensCommand,
        { nation: 1, officer_level: 1 },
        { nation: 1, supply: 1 },
        { nation: 1 },
        {},
        null,
        { amount: 1000 }
      );

      command['init']();
      
      const constraints = command['minConditionConstraints'];
      const input = { general, city, nation };
      const failed = ConstraintTestHelper.findFailedConstraints(constraints, input, {});
      
      expect(failed.some(f => f.reason?.includes('수뇌부'))).toBe(true);
    });
  });

  describe('비용 계산 테스트', () => {
    it('getCost()가 [금, 쌀] 배열을 반환해야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        MobilizeCitizensCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        {},
        null,
        { amount: 1000 }
      );

      const cost = command.getCost();
      expect(Array.isArray(cost)).toBe(true);
      expect(cost.length).toBe(2);
    });
  });
});




