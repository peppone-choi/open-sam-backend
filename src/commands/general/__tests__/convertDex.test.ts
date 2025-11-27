/**
 * 숙련전환 (ConvertDex) 커맨드 테스트
 * 
 * PHP che_숙련전환 대응
 * 한 병과의 숙련도를 다른 병과로 전환합니다.
 */

import { ConvertDexCommand } from '../convertDex';
import { 
  MockObjects, 
  ConstraintTestHelper, 
  CommandTestHelper 
} from '../../__tests__/test-helpers';

// Mock GameUnitConst
jest.mock('../../../constants/GameUnitConst', () => ({
  GameUnitConst: {
    allType: () => ({
      0: { id: 0, name: '보병', armType: 0 },
      1: { id: 1, name: '궁병', armType: 1 },
      2: { id: 2, name: '기병', armType: 2 },
    }),
    getTypeByArmType: (armType: number) => ({
      id: armType,
      name: ['보병', '궁병', '기병'][armType] || '알 수 없음',
      armType,
    }),
  },
}));

describe('ConvertDexCommand (숙련전환)', () => {
  describe('기본 구조 테스트', () => {
    it('클래스가 정의되어 있어야 함', () => {
      expect(ConvertDexCommand).toBeDefined();
    });

    it('reqArg가 true여야 함', () => {
      expect(ConvertDexCommand.reqArg).toBe(true);
    });

    it('decreaseCoeff가 0.4여야 함', () => {
      expect(ConvertDexCommand.decreaseCoeff).toBe(0.4);
    });

    it('convertCoeff가 0.9여야 함', () => {
      expect(ConvertDexCommand.convertCoeff).toBe(0.9);
    });
  });

  describe('인스턴스 생성 테스트', () => {
    it('유효한 인자로 인스턴스를 생성할 수 있어야 함', () => {
      const general = MockObjects.createMockGeneral({ 
        nation: 1,
        dex0: 1000, // 보병 숙련
        dex1: 500,  // 궁병 숙련
      });
      const city = MockObjects.createMockCity({ nation: 1 });
      const nation = MockObjects.createMockNation({ nation: 1 });
      const env = MockObjects.createMockEnv();

      general._cached_city = city;
      general._cached_nation = nation;

      const command = new ConvertDexCommand(general, env, { srcArmType: 0, destArmType: 1 });

      expect(command).toBeDefined();
    });
  });

  describe('argTest 테스트', () => {
    it('유효한 srcArmType과 destArmType이 있으면 통과', () => {
      const general = MockObjects.createMockGeneral({ nation: 1 });
      const env = MockObjects.createMockEnv();
      const command = new ConvertDexCommand(general, env, { srcArmType: 0, destArmType: 1 });

      const result = command['argTest']();
      expect(result).toBe(true);
    });

    it('srcArmType이 없으면 실패', () => {
      const general = MockObjects.createMockGeneral({ nation: 1 });
      const env = MockObjects.createMockEnv();
      const command = new ConvertDexCommand(general, env, { destArmType: 1 });

      const result = command['argTest']();
      expect(result).toBe(false);
    });

    it('destArmType이 없으면 실패', () => {
      const general = MockObjects.createMockGeneral({ nation: 1 });
      const env = MockObjects.createMockEnv();
      const command = new ConvertDexCommand(general, env, { srcArmType: 0 });

      const result = command['argTest']();
      expect(result).toBe(false);
    });

    it('srcArmType과 destArmType이 같으면 실패', () => {
      const general = MockObjects.createMockGeneral({ nation: 1 });
      const env = MockObjects.createMockEnv();
      const command = new ConvertDexCommand(general, env, { srcArmType: 0, destArmType: 0 });

      const result = command['argTest']();
      expect(result).toBe(false);
    });

    it('arg가 null이면 실패', () => {
      const general = MockObjects.createMockGeneral({ nation: 1 });
      const env = MockObjects.createMockEnv();
      const command = new ConvertDexCommand(general, env, null);

      const result = command['argTest']();
      expect(result).toBe(false);
    });

    it('srcArmType이 문자열이면 실패', () => {
      const general = MockObjects.createMockGeneral({ nation: 1 });
      const env = MockObjects.createMockEnv();
      const command = new ConvertDexCommand(general, env, { srcArmType: '0', destArmType: 1 });

      const result = command['argTest']();
      expect(result).toBe(false);
    });
  });

  describe('비용 계산 테스트', () => {
    it('getCost()가 [금, 쌀] 배열을 반환해야 함', () => {
      const general = MockObjects.createMockGeneral({ nation: 1 });
      const env = MockObjects.createMockEnv();
      const command = new ConvertDexCommand(general, env, { srcArmType: 0, destArmType: 1 });

      const cost = command.getCost();
      expect(Array.isArray(cost)).toBe(true);
      expect(cost.length).toBe(2);
    });
  });

  describe('턴 요구사항 테스트', () => {
    it('getPreReqTurn()이 숫자를 반환해야 함', () => {
      const general = MockObjects.createMockGeneral({ nation: 1 });
      const env = MockObjects.createMockEnv();
      const command = new ConvertDexCommand(general, env, { srcArmType: 0, destArmType: 1 });

      expect(typeof command.getPreReqTurn()).toBe('number');
    });

    it('getPostReqTurn()이 숫자를 반환해야 함', () => {
      const general = MockObjects.createMockGeneral({ nation: 1 });
      const env = MockObjects.createMockEnv();
      const command = new ConvertDexCommand(general, env, { srcArmType: 0, destArmType: 1 });

      expect(typeof command.getPostReqTurn()).toBe('number');
    });
  });
});

