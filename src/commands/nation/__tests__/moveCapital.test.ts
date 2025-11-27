/**
 * 천도 (MoveCapital) 커맨드 테스트
 * 
 * PHP che_천도 대응
 * 수도를 다른 도시로 이전합니다.
 */

import { che_천도 as MoveCapitalCommand } from '../moveCapital';
import { 
  MockObjects, 
  ConstraintTestHelper, 
  CommandTestHelper 
} from '../../__tests__/test-helpers';

// Mock CityConst
jest.mock('../../../CityConst', () => ({
  CityConst: {
    byID: (id: number) => id > 0 ? { city: id, name: `도시${id}` } : null,
  },
}));

describe('MoveCapitalCommand (천도)', () => {
  describe('기본 구조 테스트', () => {
    it('클래스가 정의되어 있어야 함', () => {
      expect(MoveCapitalCommand).toBeDefined();
    });

    it('getName()이 "천도"를 반환해야 함', () => {
      expect(MoveCapitalCommand.getName()).toBe('천도');
    });

    it('getCategory()가 "nation"을 반환해야 함', () => {
      expect(MoveCapitalCommand.getCategory()).toBe('nation');
    });

    it('reqArg가 true여야 함', () => {
      expect(MoveCapitalCommand.reqArg).toBe(true);
    });
  });

  describe('인스턴스 생성 테스트', () => {
    it('유효한 인자로 인스턴스를 생성할 수 있어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        MoveCapitalCommand,
        { nation: 1, officer_level: 5 },
        { nation: 1, supply: 1 },
        { nation: 1, capital: 1, gold: 100000, rice: 50000 },
        { develcost: 100 },
        null,
        { destCityID: 2 }
      );

      expect(command).toBeDefined();
    });
  });

  describe('argTest 테스트', () => {
    it('유효한 destCityID가 있으면 통과', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        MoveCapitalCommand,
        { nation: 1, officer_level: 5 },
        { nation: 1 },
        { nation: 1, capital: 1 },
        { develcost: 100 },
        null,
        { destCityID: 2 }
      );

      const result = command['argTest']();
      expect(result).toBe(true);
    });

    it('destCityID가 없으면 실패', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        MoveCapitalCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1, capital: 1 },
        { develcost: 100 },
        null,
        null
      );

      const result = command['argTest']();
      expect(result).toBe(false);
    });

    it('destCityID가 유효하지 않으면 실패', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        MoveCapitalCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1, capital: 1 },
        { develcost: 100 },
        null,
        { destCityID: 0 }
      );

      const result = command['argTest']();
      expect(result).toBe(false);
    });
  });

  describe('제약 조건 테스트', () => {
    it('minConditionConstraints가 정의되어 있어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        MoveCapitalCommand,
        { nation: 1, officer_level: 5 },
        { nation: 1, supply: 1 },
        { nation: 1, capital: 1 },
        { develcost: 100 },
        null,
        { destCityID: 2 }
      );

      command['init']();
      
      const constraints = command['minConditionConstraints'];
      expect(Array.isArray(constraints)).toBe(true);
      expect(constraints.length).toBeGreaterThan(0);
    });

    it('수뇌부만 천도 가능', () => {
      const { command, general, city, nation } = CommandTestHelper.prepareNationCommand(
        MoveCapitalCommand,
        { nation: 1, officer_level: 1 }, // 일반 장수
        { nation: 1, supply: 1 },
        { nation: 1, capital: 1 },
        { develcost: 100 },
        null,
        { destCityID: 2 }
      );

      command['init']();
      
      const constraints = command['minConditionConstraints'];
      const input = { general, city, nation };
      const failed = ConstraintTestHelper.findFailedConstraints(constraints, input, {});
      
      expect(failed.some(f => f.reason?.includes('수뇌부'))).toBe(true);
    });

    it('보급 끊긴 도시에서는 천도 불가', () => {
      const { command, general, city, nation } = CommandTestHelper.prepareNationCommand(
        MoveCapitalCommand,
        { nation: 1, officer_level: 5 },
        { nation: 1, supply: 0 }, // 보급 끊김
        { nation: 1, capital: 1 },
        { develcost: 100 },
        null,
        { destCityID: 2 }
      );

      command['init']();
      
      const constraints = command['minConditionConstraints'];
      const input = { general, city, nation };
      const failed = ConstraintTestHelper.findFailedConstraints(constraints, input, {});
      
      expect(failed.some(f => f.reason?.includes('보급'))).toBe(true);
    });
  });

  describe('비용 계산 테스트', () => {
    it('getCost()가 [금, 쌀] 배열을 반환해야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        MoveCapitalCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1, capital: 1 },
        { develcost: 100 },
        null,
        { destCityID: 2 }
      );

      const cost = command.getCost();
      expect(Array.isArray(cost)).toBe(true);
      expect(cost.length).toBe(2);
    });
  });
});

