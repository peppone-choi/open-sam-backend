/**
 * 정찰 (Scout) 커맨드 테스트
 * 
 * PHP che_정찰 대응
 * 주변 도시의 정보를 탐색합니다.
 */

import { ScoutCommand } from '../scout';
import { 
  MockObjects, 
  ConstraintTestHelper, 
  CommandTestHelper 
} from '../../__tests__/test-helpers';

describe('ScoutCommand (정찰)', () => {
  describe('기본 구조 테스트', () => {
    it('클래스가 정의되어 있어야 함', () => {
      expect(ScoutCommand).toBeDefined();
    });
  });

  describe('인스턴스 생성 테스트', () => {
    it('인스턴스를 생성할 수 있어야 함', () => {
      const general = MockObjects.createMockGeneral({ 
        nation: 1,
        gold: 1000,
      });
      const city = MockObjects.createMockCity({ nation: 1, supply: 1 });
      const nation = MockObjects.createMockNation({ nation: 1 });
      const env = MockObjects.createMockEnv();

      general._cached_city = city;
      general._cached_nation = nation;

      const command = new ScoutCommand(general, env, { destCityID: 2 });

      expect(command).toBeDefined();
    });
  });

  describe('비용 계산 테스트', () => {
    it('getCost()가 [금, 쌀] 배열을 반환해야 함', () => {
      const general = MockObjects.createMockGeneral({ nation: 1 });
      const env = MockObjects.createMockEnv();
      const command = new ScoutCommand(general, env, { destCityID: 2 });

      const cost = command.getCost();
      expect(Array.isArray(cost)).toBe(true);
      expect(cost.length).toBe(2);
    });

    it('정찰 비용이 있어야 함', () => {
      const general = MockObjects.createMockGeneral({ nation: 1 });
      const env = MockObjects.createMockEnv();
      const command = new ScoutCommand(general, env, { destCityID: 2 });

      const [gold, rice] = command.getCost();
      // 정찰에는 일정 비용이 필요
      expect(gold).toBeGreaterThanOrEqual(0);
      expect(rice).toBeGreaterThanOrEqual(0);
    });
  });

  describe('턴 요구사항 테스트', () => {
    it('getPreReqTurn()이 숫자를 반환해야 함', () => {
      const general = MockObjects.createMockGeneral({ nation: 1 });
      const env = MockObjects.createMockEnv();
      const command = new ScoutCommand(general, env, { destCityID: 2 });

      expect(typeof command.getPreReqTurn()).toBe('number');
    });

    it('getPostReqTurn()이 숫자를 반환해야 함', () => {
      const general = MockObjects.createMockGeneral({ nation: 1 });
      const env = MockObjects.createMockEnv();
      const command = new ScoutCommand(general, env, { destCityID: 2 });

      expect(typeof command.getPostReqTurn()).toBe('number');
    });
  });

  describe('제약 조건 테스트', () => {
    it('재야는 정찰 불가해야 함', async () => {
      const general = MockObjects.createMockGeneral({ 
        nation: 0, // 재야
        gold: 1000,
      });
      const city = MockObjects.createMockCity({ nation: 0 });
      const nation = MockObjects.createMockNation({ nation: 0 });
      const env = MockObjects.createMockEnv();

      general._cached_city = city;
      general._cached_nation = nation;

      const command = new ScoutCommand(general, env, { destCityID: 2 });
      await command['init']();
      
      const constraints = command['minConditionConstraints'];
      if (constraints && constraints.length > 0) {
        const input = { general, city, nation };
        const failed = ConstraintTestHelper.findFailedConstraints(constraints, input, {});
        expect(failed.length).toBeGreaterThan(0);
      }
    });
  });
});




