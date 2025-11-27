/**
 * 해산 (Dissolve) 커맨드 테스트
 * 
 * PHP che_해산 대응
 * 유랑 국가(wandering nation)를 해산합니다.
 */

import { DissolveCommand } from '../dissolve';
import { 
  MockObjects, 
  ConstraintTestHelper, 
  CommandTestHelper 
} from '../../__tests__/test-helpers';

describe('DissolveCommand (해산)', () => {
  describe('기본 구조 테스트', () => {
    it('클래스가 정의되어 있어야 함', () => {
      expect(DissolveCommand).toBeDefined();
    });
  });

  describe('인스턴스 생성 테스트', () => {
    it('인스턴스를 생성할 수 있어야 함', () => {
      const general = MockObjects.createMockGeneral({ 
        nation: 1,
        officer_level: 12, // 군주
      });
      const city = MockObjects.createMockCity({ nation: 1 });
      const nation = MockObjects.createMockNation({ nation: 1, type: 1 }); // 유랑 세력
      const env = MockObjects.createMockEnv();

      general._cached_city = city;
      general._cached_nation = nation;

      const command = new DissolveCommand(general, env, {});

      expect(command).toBeDefined();
    });
  });

  describe('argTest 테스트', () => {
    it('항상 통과해야 함 (arg 불필요)', () => {
      const general = MockObjects.createMockGeneral({ nation: 1, officer_level: 12 });
      const env = MockObjects.createMockEnv();
      const command = new DissolveCommand(general, env, {});

      const result = command['argTest']();
      expect(result).toBe(true);
    });

    it('null arg도 통과', () => {
      const general = MockObjects.createMockGeneral({ nation: 1, officer_level: 12 });
      const env = MockObjects.createMockEnv();
      const command = new DissolveCommand(general, env, null);

      const result = command['argTest']();
      expect(result).toBe(true);
    });
  });

  describe('비용 계산 테스트', () => {
    it('비용이 0이어야 함', () => {
      const general = MockObjects.createMockGeneral({ nation: 1, officer_level: 12 });
      const env = MockObjects.createMockEnv();
      const command = new DissolveCommand(general, env, {});

      const [gold, rice] = command.getCost();
      expect(gold).toBe(0);
      expect(rice).toBe(0);
    });
  });

  describe('턴 요구사항 테스트', () => {
    it('선행 턴이 0이어야 함', () => {
      const general = MockObjects.createMockGeneral({ nation: 1, officer_level: 12 });
      const env = MockObjects.createMockEnv();
      const command = new DissolveCommand(general, env, {});

      expect(command.getPreReqTurn()).toBe(0);
    });

    it('후속 턴이 0이어야 함', () => {
      const general = MockObjects.createMockGeneral({ nation: 1, officer_level: 12 });
      const env = MockObjects.createMockEnv();
      const command = new DissolveCommand(general, env, {});

      expect(command.getPostReqTurn()).toBe(0);
    });
  });

  describe('제약 조건 테스트 (ConstraintHelper 직접 테스트)', () => {
    // Note: init()이 DB 접근을 하므로 ConstraintHelper를 직접 테스트

    it('군주만 해산 가능 (BeLord constraint)', () => {
      const { ConstraintHelper } = require('../../../constraints/ConstraintHelper');
      const constraint = ConstraintHelper.BeLord();
      
      // 수뇌부 (군주 아님)
      const general1 = MockObjects.createMockGeneral({ officer_level: 5 });
      expect(constraint.test({ general: general1 }, {})).toBe('군주만 가능합니다.');
      
      // 군주
      const general2 = MockObjects.createMockGeneral({ officer_level: 12 });
      expect(constraint.test({ general: general2 }, {})).toBeNull();
    });

    it('유랑 세력만 해산 가능 (WanderingNation constraint)', () => {
      const { ConstraintHelper } = require('../../../constraints/ConstraintHelper');
      const constraint = ConstraintHelper.WanderingNation();
      
      // 일반 국가
      const nation1 = MockObjects.createMockNation({ type: 0 });
      expect(constraint.test({ nation: nation1 }, {})).toBe('유랑 세력만 가능합니다.');
      
      // 유랑 세력
      const nation2 = MockObjects.createMockNation({ type: 1 });
      expect(constraint.test({ nation: nation2 }, {})).toBeNull();
    });

    it('군주이고 유랑 세력이면 모든 제약 통과', () => {
      const { ConstraintHelper } = require('../../../constraints/ConstraintHelper');
      
      const general = MockObjects.createMockGeneral({ officer_level: 12 });
      const nation = MockObjects.createMockNation({ type: 1 });
      const input = { general, nation };
      
      const beLord = ConstraintHelper.BeLord();
      const wandering = ConstraintHelper.WanderingNation();
      
      expect(beLord.test(input, {})).toBeNull();
      expect(wandering.test(input, {})).toBeNull();
    });
  });
});

