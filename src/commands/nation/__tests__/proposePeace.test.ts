/**
 * 화평 제의 (ProposePeace) 커맨드 테스트
 * 
 * PHP che_화평제의 대응
 */

import { che_화평제의 as ProposePeaceCommand } from '../proposePeace';
import { 
  MockObjects, 
  ConstraintTestHelper, 
  CommandTestHelper 
} from '../../__tests__/test-helpers';

describe('ProposePeaceCommand (화평 제의)', () => {
  // Mock global functions
  beforeAll(() => {
    global.getNationStaticInfo = jest.fn((id: number) => ({
      nation: id,
      name: `국가${id}`,
      color: '#FF0000',
      power: 1000,
    }));
    global.getAllNationStaticInfo = jest.fn(() => [
      { nation: 1, name: '촉', color: '#00FF00', power: 1000 },
      { nation: 2, name: '위', color: '#FF0000', power: 2000 },
    ]);
  });

  describe('기본 구조 테스트', () => {
    it('클래스가 정의되어 있어야 함', () => {
      expect(ProposePeaceCommand).toBeDefined();
    });

    it('getName() 메서드가 있어야 함', () => {
      expect(typeof ProposePeaceCommand.getName).toBe('function');
      const name = ProposePeaceCommand.getName();
      expect(typeof name).toBe('string');
    });

    it('getCategory()가 "nation"을 반환해야 함', () => {
      expect(ProposePeaceCommand.getCategory()).toBe('nation');
    });
  });

  describe('인스턴스 생성 테스트', () => {
    it('유효한 인자로 인스턴스를 생성할 수 있어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        ProposePeaceCommand,
        { nation: 1, officer_level: 5 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184, year: 185, month: 1 },
        null,
        { destNationID: 2 }
      );

      expect(command).toBeDefined();
    });
  });

  describe('제약 조건 테스트', () => {
    it('minConditionConstraints가 정의되어 있어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        ProposePeaceCommand,
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

    it('수뇌부만 화평 제의 가능', () => {
      const { command, general, city, nation } = CommandTestHelper.prepareNationCommand(
        ProposePeaceCommand,
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
    it('getCost()가 [금, 쌀] 배열을 반환해야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        ProposePeaceCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184 },
        null,
        { destNationID: 2 }
      );

      const cost = command.getCost();
      expect(Array.isArray(cost)).toBe(true);
      expect(cost.length).toBe(2);
    });
  });
});

