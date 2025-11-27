/**
 * Join Service 테스트
 * 
 * 새로운 장수를 생성하고 게임에 등록하는 서비스 테스트
 */

import { JoinService } from '../Join.service';

// Mock repositories
jest.mock('../../../repositories/general.repository', () => ({
  generalRepository: {
    findBySessionAndOwner: jest.fn(),
    findBySessionAndName: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockResolvedValue({ no: 1 }),
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

jest.mock('../../../repositories/city.repository', () => ({
  cityRepository: {
    findBySessionId: jest.fn().mockResolvedValue([]),
    findBySessionAndCityNum: jest.fn().mockResolvedValue({ city: 1, nation: 0 }),
  },
}));

jest.mock('../../../repositories/general-record.repository', () => ({
  generalRecordRepository: {
    create: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../../../repositories/general-turn.repository', () => ({
  generalTurnRepository: {
    create: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../../../utils/KVStorage', () => ({
  KVStorage: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
  },
}));

describe('JoinService (장수 가입)', () => {
  describe('입력 검증', () => {
    it('userId가 없으면 실패', async () => {
      const result = await JoinService.execute({
        session_id: 'test_session',
        name: '테스트장수',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('로그인');
    });

    it('이름이 없으면 실패', async () => {
      const result = await JoinService.execute(
        {
          session_id: 'test_session',
          name: '',
          leadership: 70,
          strength: 70,
          intel: 70,
          politics: 60,
          charm: 60,
          character: 1,
          pic: 1,
        },
        { userId: 1 }
      );

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/이름|장수명/);
    });

    it('이름이 공백만 있으면 실패', async () => {
      const result = await JoinService.execute(
        {
          session_id: 'test_session',
          name: '   ',
          leadership: 70,
          strength: 70,
          intel: 70,
          politics: 60,
          charm: 60,
          character: 1,
          pic: 1,
        },
        { userId: 1 }
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('장수명');
    });
  });

  describe('validateInput 메서드', () => {
    it('validateInput이 정의되어 있어야 함', () => {
      expect(typeof JoinService['validateInput']).toBe('function');
    });
  });

  describe('sanitizeName 메서드', () => {
    it('sanitizeName이 정의되어 있어야 함', () => {
      expect(typeof JoinService['sanitizeName']).toBe('function');
    });

    it('특수문자가 제거되어야 함', () => {
      const result = JoinService['sanitizeName']('테스트<script>장수');
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });
  });

  describe('checkBlockCreate 메서드', () => {
    it('checkBlockCreate가 정의되어 있어야 함', () => {
      expect(typeof JoinService['checkBlockCreate']).toBe('function');
    });
  });

  describe('checkDuplicates 메서드', () => {
    it('checkDuplicates가 정의되어 있어야 함', () => {
      expect(typeof JoinService['checkDuplicates']).toBe('function');
    });
  });
});

