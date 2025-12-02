/**
 * 깃발 변경 (ChangeFlag) 커맨드 테스트
 * 
 * PHP che_깃발변경 대응
 */

import { che_깃발변경 as ChangeFlagCommand } from '../changeFlag';
import { 
  MockObjects, 
  ConstraintTestHelper, 
  CommandTestHelper 
} from '../../__tests__/test-helpers';

describe('ChangeFlagCommand (깃발 변경)', () => {
  describe('기본 구조 테스트', () => {
    it('클래스가 정의되어 있어야 함', () => {
      expect(ChangeFlagCommand).toBeDefined();
    });

    it('getName() 메서드가 있어야 함', () => {
      expect(typeof ChangeFlagCommand.getName).toBe('function');
      const name = ChangeFlagCommand.getName();
      expect(typeof name).toBe('string');
    });

    it('getCategory()가 "nation"을 반환해야 함', () => {
      expect(ChangeFlagCommand.getCategory()).toBe('nation');
    });
  });

  describe('인스턴스 생성 테스트', () => {
    it('유효한 인자로 인스턴스를 생성할 수 있어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        ChangeFlagCommand,
        { nation: 1, officer_level: 12 }, // 군주
        { nation: 1 },
        { nation: 1 },
        {},
        null,
        { newColor: '#FF0000' }
      );

      expect(command).toBeDefined();
    });
  });

  describe('제약 조건 테스트', () => {
    it('minConditionConstraints가 정의되어 있어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        ChangeFlagCommand,
        { nation: 1, officer_level: 12 },
        { nation: 1 },
        { nation: 1 },
        {},
        null,
        { newColor: '#FF0000' }
      );

      command['init']();
      
      const constraints = command['minConditionConstraints'];
      expect(Array.isArray(constraints)).toBe(true);
    });
  });

  describe('비용 계산 테스트', () => {
    it('getCost()가 [금, 쌀] 배열을 반환해야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        ChangeFlagCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        {},
        null,
        { newColor: '#FF0000' }
      );

      const cost = command.getCost();
      expect(Array.isArray(cost)).toBe(true);
      expect(cost.length).toBe(2);
    });
  });
});




