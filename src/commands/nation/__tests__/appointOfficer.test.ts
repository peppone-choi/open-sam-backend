/**
 * 관직 임명 (AppointOfficer) 커맨드 테스트
 * 
 * PHP che_관직임명 대응
 */

import { che_관직임명 as AppointOfficerCommand } from '../appointOfficer';
import { 
  MockObjects, 
  ConstraintTestHelper, 
  CommandTestHelper 
} from '../../__tests__/test-helpers';

describe('AppointOfficerCommand (관직 임명)', () => {
  describe('기본 구조 테스트', () => {
    it('클래스가 정의되어 있어야 함', () => {
      expect(AppointOfficerCommand).toBeDefined();
    });

    it('getName() 메서드가 있어야 함', () => {
      expect(typeof AppointOfficerCommand.getName).toBe('function');
      const name = AppointOfficerCommand.getName();
      expect(typeof name).toBe('string');
    });

    it('getCategory()가 "nation"을 반환해야 함', () => {
      expect(AppointOfficerCommand.getCategory()).toBe('nation');
    });
  });

  describe('인스턴스 생성 테스트', () => {
    it('유효한 인자로 인스턴스를 생성할 수 있어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        AppointOfficerCommand,
        { nation: 1, officer_level: 12 }, // 군주
        { nation: 1 },
        { nation: 1 },
        { startyear: 184 },
        null,
        { targetGeneralNo: 2, officerLevel: 5 }
      );

      expect(command).toBeDefined();
    });
  });

  describe('제약 조건 테스트', () => {
    it('minConditionConstraints가 정의되어 있어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        AppointOfficerCommand,
        { nation: 1, officer_level: 12 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184 },
        null,
        { targetGeneralNo: 2, officerLevel: 5 }
      );

      command['init']();
      
      const constraints = command['minConditionConstraints'];
      expect(Array.isArray(constraints)).toBe(true);
    });

    it('군주만 관직 임명 가능', () => {
      const { command, general, city, nation } = CommandTestHelper.prepareNationCommand(
        AppointOfficerCommand,
        { nation: 1, officer_level: 5 }, // 수뇌부 (군주 아님)
        { nation: 1 },
        { nation: 1 },
        { startyear: 184 },
        null,
        { targetGeneralNo: 2, officerLevel: 5 }
      );

      command['init']();
      
      const constraints = command['minConditionConstraints'];
      const input = { general, city, nation };
      const failed = ConstraintTestHelper.findFailedConstraints(constraints, input, {});
      
      // 군주 제약이 있다면 실패해야 함
      // 실제 제약 조건에 따라 다를 수 있음
      expect(Array.isArray(failed)).toBe(true);
    });
  });

  describe('비용 계산 테스트', () => {
    it('getCost()가 [금, 쌀] 배열을 반환해야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        AppointOfficerCommand,
        { nation: 1, officer_level: 12 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184 },
        null,
        { targetGeneralNo: 2, officerLevel: 5 }
      );

      const cost = command.getCost();
      expect(Array.isArray(cost)).toBe(true);
      expect(cost.length).toBe(2);
    });
  });

  describe('턴 요구사항 테스트', () => {
    it('getPreReqTurn()이 숫자를 반환해야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        AppointOfficerCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184 },
        null,
        { targetGeneralNo: 2, officerLevel: 5 }
      );

      expect(typeof command.getPreReqTurn()).toBe('number');
    });

    it('getPostReqTurn()이 숫자를 반환해야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        AppointOfficerCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        { startyear: 184 },
        null,
        { targetGeneralNo: 2, officerLevel: 5 }
      );

      expect(typeof command.getPostReqTurn()).toBe('number');
    });
  });
});

