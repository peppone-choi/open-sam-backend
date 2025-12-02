/**
 * 불가침 제의 (ProposeNonAggression) 커맨드 테스트
 * 
 * PHP che_불가침제의 대응
 */

import { che_불가침제의 as ProposeNonAggressionCommand } from '../proposeNonAggression';
import { 
  MockObjects, 
  ConstraintTestHelper, 
  CommandTestHelper 
} from '../../__tests__/test-helpers';

describe('ProposeNonAggressionCommand (불가침 제의)', () => {
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
      { nation: 3, name: '오', color: '#0000FF', power: 1500 },
    ]);
  });

  describe('기본 구조 테스트', () => {
    it('클래스가 정의되어 있어야 함', () => {
      expect(ProposeNonAggressionCommand).toBeDefined();
    });

    it('getName()이 "불가침 제의"를 반환해야 함', () => {
      expect(ProposeNonAggressionCommand.getName()).toBe('불가침 제의');
    });

    it('getCategory()가 "nation"을 반환해야 함', () => {
      expect(ProposeNonAggressionCommand.getCategory()).toBe('nation');
    });

    it('reqArg가 true여야 함', () => {
      expect(ProposeNonAggressionCommand.reqArg).toBe(true);
    });
  });

  describe('인스턴스 생성 테스트', () => {
    it('유효한 인자로 인스턴스를 생성할 수 있어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        ProposeNonAggressionCommand,
        { nation: 1, officer_level: 5 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184, year: 185, month: 1 },
        null,
        { destNationID: 2, year: 186, month: 1 }
      );

      expect(command).toBeDefined();
    });
  });

  describe('argTest 테스트', () => {
    it('유효한 인자가 있으면 통과', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        ProposeNonAggressionCommand,
        { nation: 1, officer_level: 5 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184, year: 185, month: 1 },
        null,
        { destNationID: 2, year: 186, month: 1 }
      );

      const result = command['argTest']();
      expect(result).toBe(true);
    });

    it('destNationID가 없으면 실패', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        ProposeNonAggressionCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184, year: 185, month: 1 },
        null,
        { year: 186, month: 1 }
      );

      const result = command['argTest']();
      expect(result).toBe(false);
    });

    it('year가 없으면 실패', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        ProposeNonAggressionCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184, year: 185, month: 1 },
        null,
        { destNationID: 2, month: 1 }
      );

      const result = command['argTest']();
      expect(result).toBe(false);
    });

    it('month가 없으면 실패', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        ProposeNonAggressionCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184, year: 185, month: 1 },
        null,
        { destNationID: 2, year: 186 }
      );

      const result = command['argTest']();
      expect(result).toBe(false);
    });

    it('month가 1-12 범위 밖이면 실패', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        ProposeNonAggressionCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184, year: 185, month: 1 },
        null,
        { destNationID: 2, year: 186, month: 13 }
      );

      const result = command['argTest']();
      expect(result).toBe(false);
    });

    it('year가 시작연도 미만이면 실패', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        ProposeNonAggressionCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184, year: 185, month: 1 },
        null,
        { destNationID: 2, year: 183, month: 1 }
      );

      const result = command['argTest']();
      expect(result).toBe(false);
    });
  });

  describe('제약 조건 테스트', () => {
    it('minConditionConstraints에 BeChief 포함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        ProposeNonAggressionCommand,
        { nation: 1, officer_level: 5 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184, year: 185, month: 1 },
        null,
        { destNationID: 2, year: 186, month: 1 }
      );

      command['init']();
      
      const constraints = command['minConditionConstraints'];
      expect(Array.isArray(constraints)).toBe(true);
      expect(constraints.length).toBeGreaterThan(0);
    });

    it('재야 장수는 불가침 제의 불가', () => {
      const { command, general, city, nation } = CommandTestHelper.prepareNationCommand(
        ProposeNonAggressionCommand,
        { nation: 0, officer_level: 0 },
        { nation: 0 },
        { nation: 0 },
        { startyear: 184, year: 185, month: 1 },
        null,
        { destNationID: 2, year: 186, month: 1 }
      );

      command['init']();
      
      const constraints = command['minConditionConstraints'];
      const input = { general, city, nation };
      const failed = ConstraintTestHelper.findFailedConstraints(constraints, input, {});
      
      expect(failed.length).toBeGreaterThan(0);
    });

    it('일반 장수는 불가침 제의 불가', () => {
      const { command, general, city, nation } = CommandTestHelper.prepareNationCommand(
        ProposeNonAggressionCommand,
        { nation: 1, officer_level: 1 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184, year: 185, month: 1 },
        null,
        { destNationID: 2, year: 186, month: 1 }
      );

      command['init']();
      
      const constraints = command['minConditionConstraints'];
      const input = { general, city, nation };
      const failed = ConstraintTestHelper.findFailedConstraints(constraints, input, {});
      
      expect(failed.some(f => f.reason?.includes('수뇌부'))).toBe(true);
    });
  });

  describe('비용 계산 테스트', () => {
    it('비용이 0이어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        ProposeNonAggressionCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184 },
        null,
        { destNationID: 2, year: 186, month: 1 }
      );

      const [gold, rice] = command.getCost();
      expect(gold).toBe(0);
      expect(rice).toBe(0);
    });
  });

  describe('getBrief 테스트', () => {
    it('명령 요약이 대상 국가명과 기한을 포함해야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        ProposeNonAggressionCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184 },
        null,
        { destNationID: 2, year: 186, month: 6 }
      );

      const brief = command.getBrief();
      expect(brief).toContain('국가2');
      expect(brief).toContain('186년');
      expect(brief).toContain('6월');
      expect(brief).toContain('불가침 제의');
    });
  });
});




