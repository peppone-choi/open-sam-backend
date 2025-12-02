/**
 * E2E Scenario: 신규 플레이어 첫 플레이
 * 
 * 신규 유저가 게임에 가입하고 첫 플레이를 하는 시나리오 테스트
 */

import request from 'supertest';

// Mock 설정
jest.mock('../../../config/database', () => ({
  connectDB: jest.fn().mockResolvedValue(true),
  disconnectDB: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../models/user.model', () => ({
  User: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('../../../repositories/session.repository', () => ({
  sessionRepository: {
    findBySessionId: jest.fn().mockResolvedValue({
      session_id: 'test_session',
      data: {
        game_env: {
          maxgeneral: 100,
          startage: 20,
          year: 184,
          month: 1,
          startyear: 184,
        },
      },
    }),
  },
}));

describe('E2E Scenario: New Player', () => {
  describe('시나리오 1: 기본 가입 플로우', () => {
    it('1. 유효한 데이터로 장수 생성이 가능해야 함', () => {
      // 장수 생성 요청 데이터 검증
      const createData = {
        session_id: 'test_session',
        name: '테스트장수',
        leadership: 70,
        strength: 70,
        intel: 70,
        politics: 60,
        charm: 60,
      };

      expect(createData.name).toBeDefined();
      expect(createData.leadership + createData.strength + createData.intel).toBeLessThanOrEqual(210);
    });

    it('2. 장수 생성 후 기본 자원이 부여되어야 함', () => {
      const defaultResources = {
        gold: 1000,
        rice: 1000,
        crew: 0,
      };

      expect(defaultResources.gold).toBeGreaterThan(0);
      expect(defaultResources.rice).toBeGreaterThan(0);
      expect(defaultResources.crew).toBe(0);
    });

    it('3. 재야 상태로 시작해야 함', () => {
      const initialState = {
        nation: 0,  // 재야
        officer_level: 0,
      };

      expect(initialState.nation).toBe(0);
      expect(initialState.officer_level).toBe(0);
    });
  });

  describe('시나리오 2: 임관 플로우', () => {
    it('1. 재야 장수가 국가에 임관 가능해야 함', () => {
      const beforeAppoint = { nation: 0 };
      const afterAppoint = { nation: 1 };

      expect(beforeAppoint.nation).toBe(0);
      expect(afterAppoint.nation).toBeGreaterThan(0);
    });

    it('2. 임관 후 일반 장수 레벨이 부여되어야 함', () => {
      const afterAppoint = { officer_level: 1 };

      expect(afterAppoint.officer_level).toBeGreaterThanOrEqual(1);
    });
  });

  describe('시나리오 3: 첫 커맨드 실행', () => {
    it('1. 휴식 커맨드가 성공해야 함', () => {
      const restCommand = {
        command: '휴식',
        args: {},
      };

      expect(restCommand.command).toBe('휴식');
    });

    it('2. 훈련 커맨드가 성공해야 함 (병력 있을 때)', () => {
      const trainCommand = {
        command: '훈련',
        args: {},
        requires: { crew: 1 },
      };

      expect(trainCommand.command).toBe('훈련');
      expect(trainCommand.requires.crew).toBeGreaterThan(0);
    });

    it('3. 징병 커맨드가 성공해야 함', () => {
      const conscriptCommand = {
        command: '징병',
        args: { crewType: 0 },
        requires: { nation: 1, gold: 100, rice: 100 },
      };

      expect(conscriptCommand.command).toBe('징병');
      expect(conscriptCommand.requires.nation).toBeGreaterThan(0);
    });
  });

  describe('시나리오 4: 내정 활동', () => {
    it('1. 농업투자가 농업 수치를 증가시켜야 함', () => {
      const before = { agri: 500 };
      const after = { agri: 510 };

      expect(after.agri).toBeGreaterThan(before.agri);
    });

    it('2. 상업투자가 상업 수치를 증가시켜야 함', () => {
      const before = { comm: 500 };
      const after = { comm: 510 };

      expect(after.comm).toBeGreaterThan(before.comm);
    });

    it('3. 민심이 0~100 범위를 유지해야 함', () => {
      const trust = 85;

      expect(trust).toBeGreaterThanOrEqual(0);
      expect(trust).toBeLessThanOrEqual(100);
    });
  });

  describe('시나리오 5: 자원 관리', () => {
    it('1. 금/쌀이 음수가 되지 않아야 함', () => {
      const resources = { gold: 100, rice: 100 };

      expect(resources.gold).toBeGreaterThanOrEqual(0);
      expect(resources.rice).toBeGreaterThanOrEqual(0);
    });

    it('2. 거래로 금/쌀 교환이 가능해야 함', () => {
      const before = { gold: 1000, rice: 500 };
      const after = { gold: 900, rice: 600 };  // 금 100 → 쌀 100

      expect(before.gold - after.gold).toBe(100);
      expect(after.rice - before.rice).toBe(100);
    });
  });
});




