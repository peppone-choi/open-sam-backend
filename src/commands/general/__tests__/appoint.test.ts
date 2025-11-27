/**
 * 임관 (Appoint) 커맨드 테스트
 * 
 * PHP che_임관 대응
 * 재야 장수가 지정한 국가에 임관합니다.
 */

import { AppointCommand } from '../appoint';
import { 
  MockObjects, 
  ConstraintTestHelper, 
  CommandTestHelper 
} from '../../__tests__/test-helpers';

describe('AppointCommand (임관)', () => {
  // Mock global functions
  beforeAll(() => {
    global.getNationStaticInfo = jest.fn((id: number) => ({
      nation: id,
      name: `국가${id}`,
      color: '#FF0000',
      power: 1000,
      gennum: 5,
      scout: 10,
    }));
    global.getAllNationStaticInfo = jest.fn(() => [
      { nation: 1, name: '촉', color: '#00FF00', power: 1000, gennum: 5 },
      { nation: 2, name: '위', color: '#FF0000', power: 2000, gennum: 10 },
    ]);
  });

  describe('기본 구조 테스트', () => {
    it('클래스가 정의되어 있어야 함', () => {
      expect(AppointCommand).toBeDefined();
    });

    it('reqArg가 true여야 함', () => {
      expect(AppointCommand.reqArg).toBe(true);
    });
  });

  describe('인스턴스 생성 테스트', () => {
    it('유효한 인자로 인스턴스를 생성할 수 있어야 함', () => {
      const general = MockObjects.createMockGeneral({ nation: 0 }); // 재야
      const city = MockObjects.createMockCity();
      const nation = MockObjects.createMockNation({ nation: 0 });
      const env = MockObjects.createMockEnv({
        startyear: 184,
        year: 185,
        join_mode: 'normal',
      });

      general._cached_city = city;
      general._cached_nation = nation;

      const command = new AppointCommand(general, env, { destNationID: 1 });

      expect(command).toBeDefined();
    });
  });

  describe('argTest 테스트', () => {
    it('유효한 destNationID가 있으면 통과', () => {
      const general = MockObjects.createMockGeneral({ nation: 0 });
      const env = MockObjects.createMockEnv({ startyear: 184, join_mode: 'normal' });
      const command = new AppointCommand(general, env, { destNationID: 1 });

      const result = command['argTest']();
      expect(result).toBe(true);
    });

    it('destNationID가 없으면 실패', () => {
      const general = MockObjects.createMockGeneral({ nation: 0 });
      const env = MockObjects.createMockEnv({ startyear: 184, join_mode: 'normal' });
      const command = new AppointCommand(general, env, null);

      const result = command['argTest']();
      expect(result).toBe(false);
    });

    it('destNationID가 0 이하면 실패', () => {
      const general = MockObjects.createMockGeneral({ nation: 0 });
      const env = MockObjects.createMockEnv({ startyear: 184, join_mode: 'normal' });
      const command = new AppointCommand(general, env, { destNationID: 0 });

      const result = command['argTest']();
      expect(result).toBe(false);
    });

    it('destNationID가 문자열이면 실패', () => {
      const general = MockObjects.createMockGeneral({ nation: 0 });
      const env = MockObjects.createMockEnv({ startyear: 184, join_mode: 'normal' });
      const command = new AppointCommand(general, env, { destNationID: '1' });

      const result = command['argTest']();
      expect(result).toBe(false);
    });
  });

  describe('비용 계산 테스트', () => {
    it('getCost()가 [금, 쌀] 배열을 반환해야 함', () => {
      const general = MockObjects.createMockGeneral({ nation: 0 });
      const env = MockObjects.createMockEnv({ startyear: 184, join_mode: 'normal' });
      const command = new AppointCommand(general, env, { destNationID: 1 });

      const cost = command.getCost();
      expect(Array.isArray(cost)).toBe(true);
      expect(cost.length).toBe(2);
      expect(typeof cost[0]).toBe('number');
      expect(typeof cost[1]).toBe('number');
    });
  });

  describe('턴 요구사항 테스트', () => {
    it('getPreReqTurn()이 숫자를 반환해야 함', () => {
      const general = MockObjects.createMockGeneral({ nation: 0 });
      const env = MockObjects.createMockEnv({ startyear: 184, join_mode: 'normal' });
      const command = new AppointCommand(general, env, { destNationID: 1 });

      expect(typeof command.getPreReqTurn()).toBe('number');
    });

    it('getPostReqTurn()이 숫자를 반환해야 함', () => {
      const general = MockObjects.createMockGeneral({ nation: 0 });
      const env = MockObjects.createMockEnv({ startyear: 184, join_mode: 'normal' });
      const command = new AppointCommand(general, env, { destNationID: 1 });

      expect(typeof command.getPostReqTurn()).toBe('number');
    });
  });
});

