/**
 * 불가침 수락 (AcceptNonAggression) 커맨드 테스트
 * 
 * PHP che_불가침수락 대응
 */

import { che_불가침수락 as AcceptNonAggressionCommand } from '../acceptNonAggression';
import { 
  MockObjects, 
  ConstraintTestHelper, 
  CommandTestHelper 
} from '../../__tests__/test-helpers';

describe('AcceptNonAggressionCommand (불가침 수락)', () => {
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
      expect(AcceptNonAggressionCommand).toBeDefined();
    });

    it('getName() 메서드가 있어야 함', () => {
      expect(typeof AcceptNonAggressionCommand.getName).toBe('function');
      const name = AcceptNonAggressionCommand.getName();
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });

    it('getCategory()가 "nation"을 반환해야 함', () => {
      expect(AcceptNonAggressionCommand.getCategory()).toBe('nation');
    });
  });

  describe('인스턴스 생성 테스트', () => {
    it('유효한 인자로 인스턴스를 생성할 수 있어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        AcceptNonAggressionCommand,
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
        AcceptNonAggressionCommand,
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

    it('수뇌부만 수락 가능', () => {
      const { command, general, city, nation } = CommandTestHelper.prepareNationCommand(
        AcceptNonAggressionCommand,
        { nation: 1, officer_level: 1 }, // 일반 장수
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
        AcceptNonAggressionCommand,
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

  describe('턴 요구사항 테스트', () => {
    it('선행/후속 턴이 숫자여야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        AcceptNonAggressionCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184 },
        null,
        { destNationID: 2 }
      );

      expect(typeof command.getPreReqTurn()).toBe('number');
      expect(typeof command.getPostReqTurn()).toBe('number');
    });
  });
});




