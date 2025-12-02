/**
 * 선전포고 (DeclareWar) 커맨드 테스트
 * 
 * PHP che_선전포고 대응
 */

import { che_선전포고 as DeclareWarCommand } from '../declareWar';
import { 
  MockObjects, 
  ConstraintTestHelper, 
  CommandTestHelper 
} from '../../__tests__/test-helpers';

describe('DeclareWarCommand (선전포고)', () => {
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
      expect(DeclareWarCommand).toBeDefined();
    });

    it('getName()이 "선전포고"를 반환해야 함', () => {
      expect(DeclareWarCommand.getName()).toBe('선전포고');
    });

    it('getCategory()가 "nation"을 반환해야 함', () => {
      expect(DeclareWarCommand.getCategory()).toBe('nation');
    });

    it('reqArg가 true여야 함 (인자 필요)', () => {
      expect(DeclareWarCommand.reqArg).toBe(true);
    });
  });

  describe('인스턴스 생성 테스트', () => {
    it('유효한 인자로 인스턴스를 생성할 수 있어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        DeclareWarCommand,
        { nation: 1, officer_level: 5 },
        { nation: 1, supply: 1 },
        { nation: 1 },
        { startyear: 184, year: 185, month: 1 },
        null,
        { destNationID: 2 }
      );

      expect(command).toBeDefined();
      expect(command instanceof DeclareWarCommand).toBe(true);
    });
  });

  describe('argTest 테스트', () => {
    it('유효한 destNationID가 있으면 통과', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        DeclareWarCommand,
        { nation: 1, officer_level: 5 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184 },
        null,
        { destNationID: 2 }
      );

      const result = command['argTest']();
      expect(result).toBe(true);
    });

    it('destNationID가 없으면 실패', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        DeclareWarCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184 },
        null,
        null
      );

      const result = command['argTest']();
      expect(result).toBe(false);
    });

    it('destNationID가 0 이하면 실패', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        DeclareWarCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184 },
        null,
        { destNationID: 0 }
      );

      const result = command['argTest']();
      expect(result).toBe(false);
    });

    it('destNationID가 문자열이면 실패', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        DeclareWarCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184 },
        null,
        { destNationID: '2' }
      );

      const result = command['argTest']();
      expect(result).toBe(false);
    });
  });

  describe('제약 조건 테스트', () => {
    it('minConditionConstraints에 BeChief 포함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        DeclareWarCommand,
        { nation: 1, officer_level: 5 },
        { nation: 1, supply: 1 },
        { nation: 1 },
        { startyear: 184, year: 185 },
        null,
        { destNationID: 2 }
      );

      command['init']();
      
      const constraints = command['minConditionConstraints'];
      expect(Array.isArray(constraints)).toBe(true);
      expect(ConstraintTestHelper.hasConstraint(constraints, 'officer_level')).toBe(true);
    });

    it('minConditionConstraints에 NotBeNeutral 포함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        DeclareWarCommand,
        { nation: 1, officer_level: 5 },
        { nation: 1, supply: 1 },
        { nation: 1 },
        { startyear: 184, year: 185 },
        null,
        { destNationID: 2 }
      );

      command['init']();
      
      const constraints = command['minConditionConstraints'];
      expect(ConstraintTestHelper.hasConstraint(constraints, 'getNationID')).toBe(true);
    });

    it('minConditionConstraints에 SuppliedCity 포함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        DeclareWarCommand,
        { nation: 1, officer_level: 5 },
        { nation: 1, supply: 1 },
        { nation: 1 },
        { startyear: 184, year: 185 },
        null,
        { destNationID: 2 }
      );

      command['init']();
      
      const constraints = command['minConditionConstraints'];
      expect(ConstraintTestHelper.hasConstraint(constraints, 'supply')).toBe(true);
    });

    it('재야 장수는 선전포고 불가', () => {
      const { command, general, city, nation } = CommandTestHelper.prepareNationCommand(
        DeclareWarCommand,
        { nation: 0, officer_level: 0 }, // 재야
        { nation: 0 },
        { nation: 0 },
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

    it('일반 장수(level<5)는 선전포고 불가', () => {
      const { command, general, city, nation } = CommandTestHelper.prepareNationCommand(
        DeclareWarCommand,
        { nation: 1, officer_level: 1 }, // 일반 장수
        { nation: 1, supply: 1 },
        { nation: 1 },
        { startyear: 184, year: 185 },
        null,
        { destNationID: 2 }
      );

      command['init']();
      
      const constraints = command['minConditionConstraints'];
      const input = { general, city, nation };
      const failed = ConstraintTestHelper.findFailedConstraints(constraints, input, {});
      
      expect(failed.some(f => f.reason?.includes('수뇌부'))).toBe(true);
    });
  });

  describe('비용 계산 테스트', () => {
    it('비용이 0이어야 함 (외교 커맨드)', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        DeclareWarCommand,
        { nation: 1, officer_level: 5 },
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
    it('선행 턴이 0이어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        DeclareWarCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184 },
        null,
        { destNationID: 2 }
      );

      expect(command.getPreReqTurn()).toBe(0);
    });

    it('후속 턴이 0이어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        DeclareWarCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184 },
        null,
        { destNationID: 2 }
      );

      expect(command.getPostReqTurn()).toBe(0);
    });
  });

  describe('getBrief 테스트', () => {
    it('명령 요약이 대상 국가명을 포함해야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        DeclareWarCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184 },
        null,
        { destNationID: 2 }
      );

      const brief = command.getBrief();
      expect(brief).toContain('국가2');
      expect(brief).toContain('선전포고');
    });
  });
});




