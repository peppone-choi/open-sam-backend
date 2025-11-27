/**
 * 몰수 (Confiscate) 커맨드 테스트
 * 
 * PHP che_몰수 대응
 * 장수의 자원을 국고로 몰수합니다.
 */

import { che_몰수 as ConfiscateCommand } from '../confiscate';
import { 
  MockObjects, 
  ConstraintTestHelper, 
  CommandTestHelper 
} from '../../__tests__/test-helpers';

describe('ConfiscateCommand (몰수)', () => {
  describe('기본 구조 테스트', () => {
    it('클래스가 정의되어 있어야 함', () => {
      expect(ConfiscateCommand).toBeDefined();
    });

    it('getName()이 "몰수"를 반환해야 함', () => {
      expect(ConfiscateCommand.getName()).toBe('몰수');
    });

    it('getCategory()가 "nation"을 반환해야 함', () => {
      expect(ConfiscateCommand.getCategory()).toBe('nation');
    });

    it('reqArg가 true여야 함', () => {
      expect(ConfiscateCommand.reqArg).toBe(true);
    });
  });

  describe('인스턴스 생성 테스트', () => {
    it('유효한 인자로 인스턴스를 생성할 수 있어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        ConfiscateCommand,
        { nation: 1, officer_level: 5 },
        { nation: 1, supply: 1 },
        { nation: 1, gold: 100000, rice: 50000 },
        { startyear: 184, year: 186 },
        null,
        { isGold: true, amount: 1000, destGeneralID: 2 }
      );

      expect(command).toBeDefined();
    });
  });

  describe('argTest 테스트', () => {
    it('유효한 인자가 있으면 통과', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        ConfiscateCommand,
        { nation: 1, officer_level: 5 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184, year: 186 },
        null,
        { isGold: true, amount: 1000, destGeneralID: 2 }
      );

      const result = command['argTest']();
      expect(result).toBe(true);
    });

    it('isGold가 없으면 실패', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        ConfiscateCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184, year: 186 },
        null,
        { amount: 1000, destGeneralID: 2 }
      );

      const result = command['argTest']();
      expect(result).toBe(false);
    });

    it('amount가 없으면 실패', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        ConfiscateCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184, year: 186 },
        null,
        { isGold: true, destGeneralID: 2 }
      );

      const result = command['argTest']();
      expect(result).toBe(false);
    });

    it('destGeneralID가 없으면 실패', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        ConfiscateCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184, year: 186 },
        null,
        { isGold: true, amount: 1000 }
      );

      const result = command['argTest']();
      expect(result).toBe(false);
    });

    it('destGeneralID가 0 이하면 실패', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        ConfiscateCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184, year: 186 },
        null,
        { isGold: true, amount: 1000, destGeneralID: 0 }
      );

      const result = command['argTest']();
      expect(result).toBe(false);
    });

    it('isGold가 불리언이 아니면 실패', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        ConfiscateCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184, year: 186 },
        null,
        { isGold: 'true', amount: 1000, destGeneralID: 2 }
      );

      const result = command['argTest']();
      expect(result).toBe(false);
    });

    it('amount가 100 단위로 반올림됨', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        ConfiscateCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184, year: 186 },
        null,
        { isGold: true, amount: 1050, destGeneralID: 2 }
      );

      const result = command['argTest']();
      expect(result).toBe(true);
      expect(command['arg'].amount).toBe(1100);
    });
  });

  describe('제약 조건 테스트', () => {
    it('minConditionConstraints가 정의되어 있어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        ConfiscateCommand,
        { nation: 1, officer_level: 5 },
        { nation: 1, supply: 1 },
        { nation: 1 },
        { startyear: 184, year: 186 },
        null,
        { isGold: true, amount: 1000, destGeneralID: 2 }
      );

      command['init']();
      
      const constraints = command['minConditionConstraints'];
      expect(Array.isArray(constraints)).toBe(true);
      expect(constraints.length).toBeGreaterThan(0);
    });

    it('수뇌부만 몰수 가능', () => {
      const { command, general, city, nation } = CommandTestHelper.prepareNationCommand(
        ConfiscateCommand,
        { nation: 1, officer_level: 1 },
        { nation: 1, supply: 1 },
        { nation: 1 },
        { startyear: 184, year: 186 },
        null,
        { isGold: true, amount: 1000, destGeneralID: 2 }
      );

      command['init']();
      
      const constraints = command['minConditionConstraints'];
      const input = { general, city, nation };
      const failed = ConstraintTestHelper.findFailedConstraints(constraints, input, {});
      
      expect(failed.some(f => f.reason?.includes('수뇌부'))).toBe(true);
    });

    it('재야는 몰수 불가', () => {
      const { command, general, city, nation } = CommandTestHelper.prepareNationCommand(
        ConfiscateCommand,
        { nation: 0, officer_level: 0 },
        { nation: 0 },
        { nation: 0 },
        { startyear: 184, year: 186 },
        null,
        { isGold: true, amount: 1000, destGeneralID: 2 }
      );

      command['init']();
      
      const constraints = command['minConditionConstraints'];
      const input = { general, city, nation };
      const failed = ConstraintTestHelper.findFailedConstraints(constraints, input, {});
      
      expect(failed.some(f => f.reason?.includes('재야'))).toBe(true);
    });
  });

  describe('비용 계산 테스트', () => {
    it('비용이 0이어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        ConfiscateCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184, year: 186 },
        null,
        { isGold: true, amount: 1000, destGeneralID: 2 }
      );

      const [gold, rice] = command.getCost();
      expect(gold).toBe(0);
      expect(rice).toBe(0);
    });
  });

  describe('턴 요구사항 테스트', () => {
    it('선행/후속 턴이 0이어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        ConfiscateCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184, year: 186 },
        null,
        { isGold: true, amount: 1000, destGeneralID: 2 }
      );

      expect(command.getPreReqTurn()).toBe(0);
      expect(command.getPostReqTurn()).toBe(0);
    });
  });
});

