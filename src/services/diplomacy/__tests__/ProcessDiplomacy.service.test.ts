/**
 * ProcessDiplomacy Service 테스트
 * 
 * 외교 서한 처리 서비스 테스트 (동맹 체결, 전쟁 선포 등)
 */

import { ProcessDiplomacyService } from '../ProcessDiplomacy.service';

// Mock repositories
jest.mock('../../../repositories/general.repository', () => ({
  generalRepository: {
    findBySessionAndOwner: jest.fn(),
  },
}));

jest.mock('../../../repositories/nation.repository', () => ({
  nationRepository: {
    findByNationNum: jest.fn(),
    updateOne: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../../../repositories/ng-diplomacy.repository', () => ({
  ngDiplomacyRepository: {
    findByLetterNo: jest.fn(),
    updateOne: jest.fn().mockResolvedValue({}),
  },
}));

import { generalRepository } from '../../../repositories/general.repository';
import { nationRepository } from '../../../repositories/nation.repository';
import { ngDiplomacyRepository } from '../../../repositories/ng-diplomacy.repository';

describe('ProcessDiplomacyService (외교 처리)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('필수 파라미터 검증', () => {
    it('letterNo가 없으면 실패', async () => {
      const result = await ProcessDiplomacyService.execute({
        session_id: 'test_session',
        action: 'alliance',
      });

      expect(result.success).toBe(false);
      expect(result.reason).toContain('필수 파라미터');
    });

    it('action이 없으면 실패', async () => {
      const result = await ProcessDiplomacyService.execute({
        session_id: 'test_session',
        letterNo: 1,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toContain('필수 파라미터');
    });
  });

  describe('외교 서한 검증', () => {
    it('서한이 없으면 실패', async () => {
      (ngDiplomacyRepository.findByLetterNo as jest.Mock).mockResolvedValue(null);

      const result = await ProcessDiplomacyService.execute(
        {
          session_id: 'test_session',
          letterNo: 999,
          action: 'alliance',
        },
        { userId: 1 }
      );

      expect(result.success).toBe(false);
      expect(result.reason).toContain('서한을 찾을 수 없습니다');
    });

    it('이미 처리된 서한은 실패', async () => {
      (ngDiplomacyRepository.findByLetterNo as jest.Mock).mockResolvedValue({
        letterNo: 1,
        data: { state: 'processed' },
      });

      const result = await ProcessDiplomacyService.execute(
        {
          session_id: 'test_session',
          letterNo: 1,
          action: 'alliance',
        },
        { userId: 1 }
      );

      expect(result.success).toBe(false);
      expect(result.reason).toContain('이미 처리');
    });
  });

  describe('권한 검증', () => {
    it('장수가 없으면 실패', async () => {
      (ngDiplomacyRepository.findByLetterNo as jest.Mock).mockResolvedValue({
        letterNo: 1,
        data: { state: 'proposed' },
      });
      (generalRepository.findBySessionAndOwner as jest.Mock).mockResolvedValue(null);

      const result = await ProcessDiplomacyService.execute(
        {
          session_id: 'test_session',
          letterNo: 1,
          action: 'alliance',
        },
        { userId: 1 }
      );

      expect(result.success).toBe(false);
      expect(result.reason).toContain('장수를 찾을 수 없습니다');
    });

    it('수뇌부가 아니면 실패', async () => {
      (ngDiplomacyRepository.findByLetterNo as jest.Mock).mockResolvedValue({
        letterNo: 1,
        data: { state: 'proposed' },
      });
      (generalRepository.findBySessionAndOwner as jest.Mock).mockResolvedValue({
        no: 1,
        data: { officer_level: 1, nation: 1 },
      });

      const result = await ProcessDiplomacyService.execute(
        {
          session_id: 'test_session',
          letterNo: 1,
          action: 'alliance',
        },
        { userId: 1 }
      );

      expect(result.success).toBe(false);
      expect(result.reason).toContain('권한이 부족');
    });
  });

  describe('동맹 처리', () => {
    it('수뇌부가 동맹 수락 시 성공', async () => {
      (ngDiplomacyRepository.findByLetterNo as jest.Mock).mockResolvedValue({
        letterNo: 1,
        data: { state: 'proposed', type: 'alliance', srcNationId: 1, destNationId: 2 },
      });
      (generalRepository.findBySessionAndOwner as jest.Mock).mockResolvedValue({
        no: 1,
        data: { officer_level: 5, nation: 2 },
      });
      (nationRepository.findByNationNum as jest.Mock).mockResolvedValue({
        nation: 1,
        data: { allies: [] },
      });

      const result = await ProcessDiplomacyService.execute(
        {
          session_id: 'test_session',
          letterNo: 1,
          action: 'alliance',
        },
        { userId: 1 }
      );

      // 동맹 처리 로직이 실행됨
      expect(nationRepository.findByNationNum).toHaveBeenCalled();
    });
  });
});

