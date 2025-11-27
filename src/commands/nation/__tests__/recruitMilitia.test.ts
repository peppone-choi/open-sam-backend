/**
 * 민병대 모집 (RecruitMilitia) 커맨드 테스트
 * 
 * PHP che_민병모집 대응
 */

import { che_민병모집 as RecruitMilitiaCommand } from '../recruitMilitia';
import { 
  MockObjects, 
  ConstraintTestHelper, 
  CommandTestHelper 
} from '../../__tests__/test-helpers';

describe('RecruitMilitiaCommand (민병 모집)', () => {
  describe('기본 구조 테스트', () => {
    it('클래스가 정의되어 있어야 함', () => {
      expect(RecruitMilitiaCommand).toBeDefined();
    });

    it('getName() 메서드가 있어야 함', () => {
      expect(typeof RecruitMilitiaCommand.getName).toBe('function');
      const name = RecruitMilitiaCommand.getName();
      expect(typeof name).toBe('string');
    });

    it('getCategory()가 "nation"을 반환해야 함', () => {
      expect(RecruitMilitiaCommand.getCategory()).toBe('nation');
    });
  });

  describe('인스턴스 생성 테스트', () => {
    it('유효한 인자로 인스턴스를 생성할 수 있어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        RecruitMilitiaCommand,
        { nation: 1, officer_level: 5 },
        { nation: 1, supply: 1 },
        { nation: 1 },
        {},
        null,
        {}
      );

      expect(command).toBeDefined();
    });
  });

  describe('제약 조건 테스트', () => {
    it('minConditionConstraints가 정의되어 있어야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        RecruitMilitiaCommand,
        { nation: 1, officer_level: 5 },
        { nation: 1, supply: 1 },
        { nation: 1 },
        {},
        null,
        {}
      );

      command['init']();
      
      const constraints = command['minConditionConstraints'];
      expect(Array.isArray(constraints)).toBe(true);
    });
  });

  describe('비용 계산 테스트', () => {
    it('getCost()가 [금, 쌀] 배열을 반환해야 함', () => {
      const { command } = CommandTestHelper.prepareNationCommand(
        RecruitMilitiaCommand,
        { nation: 1 },
        { nation: 1 },
        { nation: 1 },
        {},
        null,
        {}
      );

      const cost = command.getCost();
      expect(Array.isArray(cost)).toBe(true);
      expect(cost.length).toBe(2);
    });
  });
});

