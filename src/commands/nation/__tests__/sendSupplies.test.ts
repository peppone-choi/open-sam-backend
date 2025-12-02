/**
 * 원조 (SendSupplies) 커맨드 테스트
 * 
 * PHP che_물자원조 대응
 * 다른 국가에 금/쌀을 원조합니다.
 */

import { che_물자원조 as SendSuppliesCommand } from '../sendSupplies';
import { 
  MockObjects, 
  ConstraintTestHelper, 
  CommandTestHelper 
} from '../../__tests__/test-helpers';

describe('SendSuppliesCommand (원조)', () => {
  // Mock global functions
  beforeAll(() => {
    global.getNationStaticInfo = jest.fn((id: number) => ({
      nation: id,
      name: `국가${id}`,
      color: '#FF0000',
    }));
  });

  describe('기본 구조 테스트', () => {
    it('클래스가 정의되어 있어야 함', () => {
      expect(SendSuppliesCommand).toBeDefined();
    });

    it('getName()이 "원조"를 반환해야 함', () => {
      expect(SendSuppliesCommand.getName()).toBe('원조');
    });

    it('getCategory()가 "nation"을 반환해야 함', () => {
      expect(SendSuppliesCommand.getCategory()).toBe('nation');
    });

    it('reqArg가 true여야 함', () => {
      expect(SendSuppliesCommand.reqArg).toBe(true);
    });
  });

  describe('인스턴스 생성 테스트', () => {
    it('유효한 인자로 인스턴스를 생성할 수 있어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        SendSuppliesCommand,
        { nation: 1, officer_level: 5 },
        { nation: 1, supply: 1 },
        { nation: 1, gold: 100000, rice: 50000, level: 5, surlimit: 0 },
        {},
        null,
        { destNationID: 2, amountList: [10000, 5000] }
      );

      expect(command).toBeDefined();
    });
  });

  describe('argTest 테스트', () => {
    it('유효한 인자가 있으면 통과', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        SendSuppliesCommand,
        { nation: 1, officer_level: 5 },
        { nation: 1 },
        { nation: 1, level: 5, surlimit: 0 },
        {},
        null,
        { destNationID: 2, amountList: [10000, 5000] }
      );

      const result = command['argTest']();
      expect(result).toBe(true);
    });

    it('destNationID가 없으면 실패', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        SendSuppliesCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        {},
        null,
        { amountList: [10000, 5000] }
      );

      const result = command['argTest']();
      expect(result).toBe(false);
    });

    it('amountList가 없으면 실패', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        SendSuppliesCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        {},
        null,
        { destNationID: 2 }
      );

      const result = command['argTest']();
      expect(result).toBe(false);
    });

    it('amountList가 배열이 아니면 실패', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        SendSuppliesCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        {},
        null,
        { destNationID: 2, amountList: 10000 }
      );

      const result = command['argTest']();
      expect(result).toBe(false);
    });

    it('amountList 길이가 2가 아니면 실패', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        SendSuppliesCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        {},
        null,
        { destNationID: 2, amountList: [10000] }
      );

      const result = command['argTest']();
      expect(result).toBe(false);
    });

    it('금, 쌀 모두 0이면 실패', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        SendSuppliesCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        {},
        null,
        { destNationID: 2, amountList: [0, 0] }
      );

      const result = command['argTest']();
      expect(result).toBe(false);
    });

    it('음수 값은 실패', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        SendSuppliesCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        {},
        null,
        { destNationID: 2, amountList: [-1000, 5000] }
      );

      const result = command['argTest']();
      expect(result).toBe(false);
    });
  });

  describe('제약 조건 테스트', () => {
    it('minConditionConstraints가 정의되어 있어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        SendSuppliesCommand,
        { nation: 1, officer_level: 5 },
        { nation: 1, supply: 1 },
        { nation: 1, surlimit: 0 },
        {},
        null,
        { destNationID: 2, amountList: [10000, 5000] }
      );

      command['init']();
      
      const constraints = command['minConditionConstraints'];
      expect(Array.isArray(constraints)).toBe(true);
      expect(constraints.length).toBeGreaterThan(0);
    });

    it('수뇌부만 원조 가능', () => {
      const { command, general, city, nation } = CommandTestHelper.prepareNationCommand(
        SendSuppliesCommand,
        { nation: 1, officer_level: 1 },
        { nation: 1, supply: 1 },
        { nation: 1, surlimit: 0 },
        {},
        null,
        { destNationID: 2, amountList: [10000, 5000] }
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
        SendSuppliesCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        {},
        null,
        { destNationID: 2, amountList: [10000, 5000] }
      );

      const [gold, rice] = command.getCost();
      expect(gold).toBe(0);
      expect(rice).toBe(0);
    });
  });

  describe('턴 요구사항 테스트', () => {
    it('선행 턴이 0이어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        SendSuppliesCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        {},
        null,
        { destNationID: 2, amountList: [10000, 5000] }
      );

      expect(command.getPreReqTurn()).toBe(0);
    });

    it('후속 턴이 12여야 함 (외교 제한)', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        SendSuppliesCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        {},
        null,
        { destNationID: 2, amountList: [10000, 5000] }
      );

      expect(command.getPostReqTurn()).toBe(12);
    });
  });
});




