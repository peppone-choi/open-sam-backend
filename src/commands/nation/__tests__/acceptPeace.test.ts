/**
 * 화평 수락 (AcceptPeace) 커맨드 테스트
 * 
 * PHP che_화평수락 대응
 */

import { che_화평수락 as AcceptPeaceCommand } from '../acceptPeace';
import { 
  MockObjects, 
  ConstraintTestHelper, 
  CommandTestHelper 
} from '../../__tests__/test-helpers';

describe('AcceptPeaceCommand (화평 수락)', () => {
  // Mock global functions
  beforeAll(() => {
    global.getNationStaticInfo = jest.fn((id: number) => ({
      nation: id,
      name: `국가${id}`,
      color: '#FF0000',
      power: 1000,
    }));
  });

  describe('기본 구조 테스트', () => {
    it('클래스가 정의되어 있어야 함', () => {
      expect(AcceptPeaceCommand).toBeDefined();
    });

    it('getName() 메서드가 있어야 함', () => {
      expect(typeof AcceptPeaceCommand.getName).toBe('function');
    });

    it('getCategory()가 "nation"을 반환해야 함', () => {
      expect(AcceptPeaceCommand.getCategory()).toBe('nation');
    });
  });

  describe('인스턴스 생성 테스트', () => {
    it('유효한 인자로 인스턴스를 생성할 수 있어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        AcceptPeaceCommand,
        { nation: 1, officer_level: 5 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184 },
        null,
        { destNationID: 2 }
      );

      expect(command).toBeDefined();
    });
  });

  describe('제약 조건 테스트', () => {
    it('minConditionConstraints가 정의되어 있어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        AcceptPeaceCommand,
        { nation: 1, officer_level: 5 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184, year: 185 },
        null,
        { destNationID: 2 }
      );

      command['init']();
      
      const constraints = command['minConditionConstraints'];
      expect(Array.isArray(constraints)).toBe(true);
    });

    it('수뇌부만 화평 수락 가능', () => {
      const { command, general, city, nation } = CommandTestHelper.prepareNationCommand(
        AcceptPeaceCommand,
        { nation: 1, officer_level: 1 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184, year: 185 },
        null,
        { destNationID: 2 }
      );

      command['init']();
      
      const constraints = command['minConditionConstraints'];
      const input = { general, city, nation };
      const failed = ConstraintTestHelper.findFailedConstraints(constraints, input, {});
      
      expect(failed.length).toBeGreaterThan(0);
    });
  });

  describe('비용 계산 테스트', () => {
    it('비용이 0이어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        AcceptPeaceCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184 },
        null,
        { destNationID: 2 }
      );

      const [gold, rice] = command.getCost();
      expect(gold).toBe(0);
      expect(rice).toBe(0);
    });
  });
});




