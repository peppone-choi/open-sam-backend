/**
 * 부대 재배치 (ReassignUnit) 커맨드 테스트
 * 
 * PHP che_부대재배치 대응
 */

import { ReassignUnitCommand } from '../reassignUnit';
import { 
  MockObjects, 
  ConstraintTestHelper, 
  CommandTestHelper 
} from '../../__tests__/test-helpers';

describe('ReassignUnitCommand (부대 재배치)', () => {
  describe('기본 구조 테스트', () => {
    it('클래스가 정의되어 있어야 함', () => {
      expect(ReassignUnitCommand).toBeDefined();
    });
  });

  describe('인스턴스 생성 테스트', () => {
    it('인스턴스를 생성할 수 있어야 함', () => {
      const general = MockObjects.createMockGeneral({ 
        nation: 1,
        officer_level: 5,
      });
      const city = MockObjects.createMockCity({ nation: 1 });
      const nation = MockObjects.createMockNation({ nation: 1 });
      const env = MockObjects.createMockEnv();

      general._cached_city = city;
      general._cached_nation = nation;

      const command = new ReassignUnitCommand(general, env, { targetGeneralNo: 2 });

      expect(command).toBeDefined();
    });
  });

  describe('비용 계산 테스트', () => {
    it('getCost()가 [금, 쌀] 배열을 반환해야 함', () => {
      const general = MockObjects.createMockGeneral({ nation: 1 });
      const env = MockObjects.createMockEnv();
      const command = new ReassignUnitCommand(general, env, { targetGeneralNo: 2 });

      const cost = command.getCost();
      expect(Array.isArray(cost)).toBe(true);
      expect(cost.length).toBe(2);
    });
  });

  describe('턴 요구사항 테스트', () => {
    it('getPreReqTurn()이 숫자를 반환해야 함', () => {
      const general = MockObjects.createMockGeneral({ nation: 1 });
      const env = MockObjects.createMockEnv();
      const command = new ReassignUnitCommand(general, env, { targetGeneralNo: 2 });

      expect(typeof command.getPreReqTurn()).toBe('number');
    });

    it('getPostReqTurn()이 숫자를 반환해야 함', () => {
      const general = MockObjects.createMockGeneral({ nation: 1 });
      const env = MockObjects.createMockEnv();
      const command = new ReassignUnitCommand(general, env, { targetGeneralNo: 2 });

      expect(typeof command.getPostReqTurn()).toBe('number');
    });
  });
});

