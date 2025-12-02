/**
 * 인구 이동 (RelocatePopulation) 커맨드 테스트
 * 
 * PHP che_인구이동 대응
 * 도시 간 인구를 이동시킵니다.
 */

import { che_인구이동 as RelocatePopulationCommand } from '../relocatePopulation';
import { 
  MockObjects, 
  ConstraintTestHelper, 
  CommandTestHelper 
} from '../../__tests__/test-helpers';

describe('RelocatePopulationCommand (인구 이동)', () => {
  describe('기본 구조 테스트', () => {
    it('클래스가 정의되어 있어야 함', () => {
      expect(RelocatePopulationCommand).toBeDefined();
    });

    it('getName() 메서드가 있어야 함', () => {
      expect(typeof RelocatePopulationCommand.getName).toBe('function');
      const name = RelocatePopulationCommand.getName();
      expect(typeof name).toBe('string');
    });

    it('getCategory()가 "nation"을 반환해야 함', () => {
      expect(RelocatePopulationCommand.getCategory()).toBe('nation');
    });
  });

  describe('인스턴스 생성 테스트', () => {
    it('유효한 인자로 인스턴스를 생성할 수 있어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        RelocatePopulationCommand,
        { nation: 1, officer_level: 5 },
        { nation: 1, supply: 1, pop: 100000 },
        { nation: 1 },
        {},
        null,
        { srcCityID: 1, destCityID: 2, amount: 10000 }
      );

      expect(command).toBeDefined();
    });
  });

  describe('제약 조건 테스트', () => {
    it('minConditionConstraints가 정의되어 있어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        RelocatePopulationCommand,
        { nation: 1, officer_level: 5 },
        { nation: 1, supply: 1 },
        { nation: 1 },
        {},
        null,
        { srcCityID: 1, destCityID: 2, amount: 10000 }
      );

      command['init']();
      
      const constraints = command['minConditionConstraints'];
      expect(Array.isArray(constraints)).toBe(true);
    });

    it('수뇌부만 인구 이동 가능', () => {
      const { command, general, city, nation } = CommandTestHelper.prepareNationCommand(
        RelocatePopulationCommand,
        { nation: 1, officer_level: 1 },
        { nation: 1, supply: 1 },
        { nation: 1 },
        {},
        null,
        { srcCityID: 1, destCityID: 2, amount: 10000 }
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
        RelocatePopulationCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        {},
        null,
        { srcCityID: 1, destCityID: 2, amount: 10000 }
      );

      const cost = command.getCost();
      expect(Array.isArray(cost)).toBe(true);
      expect(cost.length).toBe(2);
    });
  });
});




