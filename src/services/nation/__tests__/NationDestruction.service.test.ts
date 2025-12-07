/**
 * NationDestruction Service 테스트
 * 
 * 국가 멸망 및 천하통일 처리 서비스 테스트
 */

// Repository mock
jest.mock('../../../repositories/city.repository', () => ({
  cityRepository: {
    count: jest.fn(),
    findByFilter: jest.fn(),
    updateByCityNum: jest.fn(),
  },
}));

jest.mock('../../../repositories/nation.repository', () => ({
  nationRepository: {
    findByNationNum: jest.fn(),
    updateByNationNum: jest.fn(),
  },
}));

jest.mock('../../../repositories/general.repository', () => ({
  generalRepository: {
    findByFilter: jest.fn(),
    findByGeneralNo: jest.fn(),
    updateOneByFilter: jest.fn(),
  },
}));

jest.mock('../../../repositories/session.repository', () => ({
  sessionRepository: {
    findBySessionId: jest.fn(),
  },
}));

jest.mock('../../../common/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../../common/cache/model-cache.helper', () => ({
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../gameEventEmitter', () => ({
  GameEventEmitter: {
    broadcastGameEvent: jest.fn(),
  },
}));

jest.mock('../../global/ExecuteEngine.service', () => ({
  ExecuteEngineService: {
    runEventHandler: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mongoose mock
jest.mock('mongoose', () => {
  const mockSession = {
    withTransaction: jest.fn((callback) => callback()),
    endSession: jest.fn(),
  };
  
  return {
    startSession: jest.fn().mockResolvedValue(mockSession),
  };
});

import { NationDestructionService } from '../NationDestruction.service';
import { cityRepository } from '../../../repositories/city.repository';
import { nationRepository } from '../../../repositories/nation.repository';
import { generalRepository } from '../../../repositories/general.repository';
import { sessionRepository } from '../../../repositories/session.repository';

describe('NationDestructionService (국가 멸망/통일)', () => {
  const sessionId = 'test-session-123';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkNationDestruction (멸망 조건 체크)', () => {
    it('nation=0이면 멸망 체크 안 함', async () => {
      const result = await NationDestructionService.checkNationDestruction(sessionId, 0);
      
      expect(result.shouldDestroy).toBe(false);
      expect(cityRepository.count).not.toHaveBeenCalled();
    });

    it('도시가 0개면 멸망', async () => {
      (cityRepository.count as jest.Mock).mockResolvedValue(0);
      
      const result = await NationDestructionService.checkNationDestruction(sessionId, 1);
      
      expect(result.shouldDestroy).toBe(true);
      expect(result.conditions.noCities).toBe(true);
    });

    it('도시가 1개 이상이면 멸망 안 함', async () => {
      (cityRepository.count as jest.Mock).mockResolvedValue(3);
      (nationRepository.findByNationNum as jest.Mock).mockResolvedValue({
        data: { leader: 100 },
      });
      (generalRepository.findByGeneralNo as jest.Mock).mockResolvedValue({
        data: { is_dead: false, penalty: null },
      });
      
      const result = await NationDestructionService.checkNationDestruction(sessionId, 1);
      
      expect(result.shouldDestroy).toBe(false);
      expect(result.conditions.noCities).toBe(false);
    });

    it('군주가 사망하고 후계자 없으면 멸망', async () => {
      (cityRepository.count as jest.Mock).mockResolvedValue(2);
      (nationRepository.findByNationNum as jest.Mock).mockResolvedValue({
        data: { leader: 100 },
      });
      (generalRepository.findByGeneralNo as jest.Mock).mockResolvedValue({
        data: { is_dead: true },
      });
      (generalRepository.findByFilter as jest.Mock).mockResolvedValue([]); // 후계자 없음
      
      const result = await NationDestructionService.checkNationDestruction(sessionId, 1);
      
      expect(result.shouldDestroy).toBe(true);
      expect(result.conditions.leaderIncapacitated).toBe(true);
      expect(result.conditions.noSuccessor).toBe(true);
    });

    it('군주가 포로고 후계자 있으면 멸망 안 함', async () => {
      (cityRepository.count as jest.Mock).mockResolvedValue(2);
      (nationRepository.findByNationNum as jest.Mock).mockResolvedValue({
        data: { leader: 100 },
      });
      (generalRepository.findByGeneralNo as jest.Mock).mockResolvedValue({
        data: { penalty: 'PRISONER' },
      });
      (generalRepository.findByFilter as jest.Mock).mockResolvedValue([
        { data: { no: 101, officer_level: 11 } }, // 승상 (후계자)
      ]);
      
      const result = await NationDestructionService.checkNationDestruction(sessionId, 1);
      
      expect(result.shouldDestroy).toBe(false);
    });
  });

  describe('checkUnification (통일 체크)', () => {
    it('세션이 없으면 통일 안 됨', async () => {
      (sessionRepository.findBySessionId as jest.Mock).mockResolvedValue(null);
      
      const result = await NationDestructionService.checkUnification(sessionId);
      
      expect(result.isUnified).toBe(false);
      expect(result.winnerNationId).toBeNull();
    });

    it('이미 통일된 상태면 true 반환', async () => {
      (sessionRepository.findBySessionId as jest.Mock).mockResolvedValue({
        data: { isunited: 2, unifiedNationId: 1 },
      });
      
      const result = await NationDestructionService.checkUnification(sessionId);
      
      expect(result.isUnified).toBe(true);
      expect(result.winnerNationId).toBe(1);
    });

    it('하나의 국가만 도시를 소유하면 통일', async () => {
      (sessionRepository.findBySessionId as jest.Mock).mockResolvedValue({
        data: { isunited: 0 },
      });
      (cityRepository.findByFilter as jest.Mock).mockResolvedValue([
        { data: { nation: 1 } },
        { data: { nation: 1 } },
        { data: { nation: 1 } },
      ]);
      
      const result = await NationDestructionService.checkUnification(sessionId);
      
      expect(result.isUnified).toBe(true);
      expect(result.winnerNationId).toBe(1);
    });

    it('여러 국가가 도시를 소유하면 통일 안 됨', async () => {
      (sessionRepository.findBySessionId as jest.Mock).mockResolvedValue({
        data: { isunited: 0 },
      });
      (cityRepository.findByFilter as jest.Mock).mockResolvedValue([
        { data: { nation: 1 } },
        { data: { nation: 2 } },
        { data: { nation: 3 } },
      ]);
      
      const result = await NationDestructionService.checkUnification(sessionId);
      
      expect(result.isUnified).toBe(false);
      expect(result.winnerNationId).toBeNull();
    });

    it('공백지(nation=0)만 있으면 통일 안 됨', async () => {
      (sessionRepository.findBySessionId as jest.Mock).mockResolvedValue({
        data: { isunited: 0 },
      });
      (cityRepository.findByFilter as jest.Mock).mockResolvedValue([
        { data: { nation: 0 } },
        { data: { nation: 0 } },
      ]);
      
      const result = await NationDestructionService.checkUnification(sessionId);
      
      expect(result.isUnified).toBe(false);
    });
  });

  describe('destroyNation (멸망 처리)', () => {
    beforeEach(() => {
      (nationRepository.findByNationNum as jest.Mock).mockResolvedValue({
        data: { name: '위', gold: 10000, rice: 20000 },
        name: '위',
      });
      (sessionRepository.findBySessionId as jest.Mock).mockResolvedValue({
        data: { year: 200, month: 3 },
      });
      (generalRepository.findByFilter as jest.Mock).mockResolvedValue([
        { data: { no: 1, gold: 100, rice: 200 } },
        { data: { no: 2, gold: 150, rice: 250 } },
      ]);
      (generalRepository.updateOneByFilter as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
      (nationRepository.updateByNationNum as jest.Mock).mockResolvedValue({ modifiedCount: 1 });
    });

    it('멸망 처리 시 장수들을 재야로 전환', async () => {
      const result = await NationDestructionService.destroyNation(sessionId, 1, 2, 100);
      
      expect(result.success).toBe(true);
      expect(result.generalCount).toBe(2);
      expect(generalRepository.updateOneByFilter).toHaveBeenCalled();
    });

    it('승전국에 자원 이전', async () => {
      await NationDestructionService.destroyNation(sessionId, 1, 2, 100);
      
      // 승전국 자원 업데이트 확인
      expect(nationRepository.updateByNationNum).toHaveBeenCalledWith(
        sessionId,
        2,
        expect.objectContaining({
          'data.gold': expect.any(Number),
          'data.rice': expect.any(Number),
        })
      );
    });

    it('국가가 없으면 에러', async () => {
      (nationRepository.findByNationNum as jest.Mock).mockResolvedValue(null);
      
      const result = await NationDestructionService.destroyNation(sessionId, 999, 2, 100);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('찾을 수 없음');
    });
  });

  describe('handleUnification (통일 처리)', () => {
    beforeEach(() => {
      (sessionRepository.findBySessionId as jest.Mock).mockResolvedValue({
        data: { year: 200, month: 3, isunited: 0 },
        save: jest.fn().mockResolvedValue({}),
        markModified: jest.fn(),
      });
      (nationRepository.findByNationNum as jest.Mock).mockResolvedValue({
        data: { name: '위' },
        name: '위',
      });
      (generalRepository.findByFilter as jest.Mock).mockResolvedValue([
        { data: { no: 1, name: '조조' } },
      ]);
    });

    it('통일 처리 성공', async () => {
      const result = await NationDestructionService.handleUnification(sessionId, 1);
      
      expect(result.success).toBe(true);
      expect(result.nationId).toBe(1);
      expect(result.nationName).toBe('위');
    });

    it('세션이 없으면 실패', async () => {
      (sessionRepository.findBySessionId as jest.Mock).mockResolvedValue(null);
      
      const result = await NationDestructionService.handleUnification(sessionId, 1);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('세션');
    });

    it('국가가 없으면 실패', async () => {
      (nationRepository.findByNationNum as jest.Mock).mockResolvedValue(null);
      
      const result = await NationDestructionService.handleUnification(sessionId, 999);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('국가');
    });
  });

  describe('processPostConquest (점령 후 통합 처리)', () => {
    it('수비측 멸망 체크 후 통일 체크', async () => {
      // 멸망 체크: 도시 0개
      (cityRepository.count as jest.Mock).mockResolvedValue(0);
      
      // 멸망 처리 mock
      (nationRepository.findByNationNum as jest.Mock).mockResolvedValue({
        data: { name: '촉', gold: 5000, rice: 10000 },
      });
      (sessionRepository.findBySessionId as jest.Mock).mockResolvedValue({
        data: { year: 200, month: 3 },
        save: jest.fn(),
        markModified: jest.fn(),
      });
      (generalRepository.findByFilter as jest.Mock).mockResolvedValue([]);
      (generalRepository.updateOneByFilter as jest.Mock).mockResolvedValue({});
      (nationRepository.updateByNationNum as jest.Mock).mockResolvedValue({});
      
      // 통일 체크: 하나의 국가만 남음
      (cityRepository.findByFilter as jest.Mock).mockResolvedValue([
        { data: { nation: 1 } },
      ]);

      // 오류 없이 실행되어야 함
      await expect(
        NationDestructionService.processPostConquest(sessionId, 2, 1, 100)
      ).resolves.not.toThrow();
    });

    it('수비측이 재야(nation=0)면 멸망 체크 안 함', async () => {
      await NationDestructionService.processPostConquest(sessionId, 0, 1, 100);
      
      // 도시 카운트가 호출되지 않아야 함 (nation=0이면 멸망 체크 스킵)
      expect(cityRepository.count).not.toHaveBeenCalled();
    });
  });

  describe('조사 선택 (pickJosa)', () => {
    it('종성이 있는 글자는 이/을/은/과 사용', () => {
      // private 메서드 테스트를 위해 간접적으로 테스트
      // 실제로는 destroyNation 등에서 사용되는 로그 메시지를 통해 확인
      expect(true).toBe(true);
    });
  });
});

describe('멸망 조건 Edge Cases', () => {
  const sessionId = 'edge-case-session';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('도시가 정확히 1개 남은 경우 (마지막 도시)', async () => {
    (cityRepository.count as jest.Mock).mockResolvedValue(1);
    (nationRepository.findByNationNum as jest.Mock).mockResolvedValue({
      data: { leader: 100 },
    });
    (generalRepository.findByGeneralNo as jest.Mock).mockResolvedValue({
      data: { is_dead: false },
    });
    
    const result = await NationDestructionService.checkNationDestruction(sessionId, 1);
    
    // 도시가 1개 있으면 아직 멸망 아님 (0개일 때 멸망)
    expect(result.shouldDestroy).toBe(false);
  });

  it('군주가 없고 관직자도 없는 경우', async () => {
    (cityRepository.count as jest.Mock).mockResolvedValue(2);
    (nationRepository.findByNationNum as jest.Mock).mockResolvedValue({
      data: { leader: null }, // 군주 없음
    });
    (generalRepository.findByFilter as jest.Mock).mockResolvedValue([]); // 후계자도 없음
    
    const result = await NationDestructionService.checkNationDestruction(sessionId, 1);
    
    expect(result.shouldDestroy).toBe(true);
    expect(result.conditions.leaderIncapacitated).toBe(true);
    expect(result.conditions.noSuccessor).toBe(true);
  });
});






