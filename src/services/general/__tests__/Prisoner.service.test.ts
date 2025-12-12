/**
 * Prisoner.service.test.ts - 포로 시스템 테스트
 */

import { PrisonerService, PRISONER_CONFIG } from '../Prisoner.service';

// Mock repositories
jest.mock('../../../repositories/general.repository', () => ({
  generalRepository: {
    findOneByFilter: jest.fn(),
    findByFilter: jest.fn(),
    deleteByFilter: jest.fn(),
  },
}));

jest.mock('../../../repositories/nation.repository', () => ({
  nationRepository: {
    updateOneByFilter: jest.fn(),
  },
}));

import { generalRepository } from '../../../repositories/general.repository';
import { nationRepository } from '../../../repositories/nation.repository';

// Mock general factory
function createMockGeneral(overrides: any = {}) {
  const data: Record<string, any> = {
    no: 1,
    name: '테스트장수',
    nation: 1,
    city: 1,
    officer_level: 1,
    crew: 100,
    troop: 0,
    prisoner_of: 0,
    captured_at: null,
    loyalty: 70,
    charm: 50,
    intel: 50,
    ...overrides.data,
  };

  return {
    no: data.no,
    name: data.name,
    data,
    getID: () => data.no,
    getName: () => data.name,
    getNationID: () => data.nation,
    getCityID: () => data.city,
    getNPCType: () => data.npc ?? 0,
    getVar: (key: string) => data[key],
    setVar: (key: string, value: any) => { data[key] = value; },
    getCharm: () => data.charm,
    getIntel: () => data.intel,
    isPrisoner: () => (data.prisoner_of ?? 0) > 0,
    getPrisonerOf: () => data.prisoner_of ?? 0,
    setPrisoner: (nationId: number) => {
      data.prisoner_of = nationId;
      data.crew = 0;
      data.troop = 0;
    },
    releasePrisoner: () => {
      data.prisoner_of = 0;
      data.nation = 0;
      data.officer_level = 1;
      data.officer_city = 0;
    },
    kill: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
    getLogger: () => ({
      pushGeneralActionLog: jest.fn(),
      pushGeneralHistoryLog: jest.fn(),
      pushGlobalActionLog: jest.fn(),
      pushGlobalHistoryLog: jest.fn(),
    }),
    ...overrides,
  };
}

// Mock RNG
const createMockRng = (returnValue: boolean) => ({
  nextBool: jest.fn().mockReturnValue(returnValue),
});

describe('PrisonerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('capturePrisoner', () => {
    it('장수를 포로로 전환한다', async () => {
      const general = createMockGeneral({
        data: { no: 1, name: '적장', nation: 2, crew: 500 },
      });

      await PrisonerService.capturePrisoner('test-session', general as any, 1);

      expect(general.data.prisoner_of).toBe(1);
      expect(general.data.crew).toBe(0);
      expect(general.data.troop).toBe(0);
      expect(general.save).toHaveBeenCalled();
    });

    it('원래 국가 장수 수를 감소시킨다', async () => {
      const general = createMockGeneral({
        data: { no: 1, name: '적장', nation: 2 },
      });

      await PrisonerService.capturePrisoner('test-session', general as any, 1);

      expect(nationRepository.updateOneByFilter).toHaveBeenCalledWith(
        { session_id: 'test-session', nation: 2 },
        { $inc: { gennum: -1 } }
      );
    });
  });

  describe('recruitPrisoner', () => {
    it('등용 성공 시 포로를 자국으로 영입한다', async () => {
      const recruiter = createMockGeneral({
        data: { no: 1, name: '등용자', nation: 1, city: 10, charm: 80 },
      });
      const prisoner = createMockGeneral({
        data: { no: 2, name: '포로장수', nation: 0, prisoner_of: 1, loyalty: 30 },
      });

      (generalRepository.findOneByFilter as jest.Mock)
        .mockResolvedValueOnce(recruiter)
        .mockResolvedValueOnce(prisoner);

      const rng = createMockRng(true); // 성공

      const result = await PrisonerService.recruitPrisoner(
        'test-session',
        1,
        2,
        rng
      );

      expect(result.success).toBe(true);
      expect(prisoner.data.prisoner_of).toBe(0);
      expect(prisoner.data.nation).toBe(1);
    });

    it('등용 실패 시 포로 상태가 유지된다', async () => {
      const recruiter = createMockGeneral({
        data: { no: 1, name: '등용자', nation: 1, charm: 30 },
      });
      const prisoner = createMockGeneral({
        data: { no: 2, name: '포로장수', nation: 0, prisoner_of: 1, loyalty: 100 },
      });

      (generalRepository.findOneByFilter as jest.Mock)
        .mockResolvedValueOnce(recruiter)
        .mockResolvedValueOnce(prisoner);

      const rng = createMockRng(false); // 실패

      const result = await PrisonerService.recruitPrisoner(
        'test-session',
        1,
        2,
        rng
      );

      expect(result.success).toBe(false);
      expect(prisoner.data.prisoner_of).toBe(1);
    });

    it('자국 포로가 아니면 실패한다', async () => {
      const recruiter = createMockGeneral({
        data: { no: 1, name: '등용자', nation: 1 },
      });
      const prisoner = createMockGeneral({
        data: { no: 2, name: '포로장수', prisoner_of: 2 }, // 다른 국가의 포로
      });

      (generalRepository.findOneByFilter as jest.Mock)
        .mockResolvedValueOnce(recruiter)
        .mockResolvedValueOnce(prisoner);

      const rng = createMockRng(true);

      const result = await PrisonerService.recruitPrisoner(
        'test-session',
        1,
        2,
        rng
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('자국의 포로만');
    });
  });

  describe('releasePrisoner', () => {
    it('태수 이상이 포로를 해방할 수 있다', async () => {
      const releaser = createMockGeneral({
        data: { no: 1, name: '태수', nation: 1, officer_level: 4 },
      });
      const prisoner = createMockGeneral({
        data: { no: 2, name: '포로장수', prisoner_of: 1 },
      });

      (generalRepository.findOneByFilter as jest.Mock)
        .mockResolvedValueOnce(releaser)
        .mockResolvedValueOnce(prisoner);

      const result = await PrisonerService.releasePrisoner(
        'test-session',
        1,
        2
      );

      expect(result.success).toBe(true);
      expect(prisoner.data.prisoner_of).toBe(0);
      expect(prisoner.data.nation).toBe(0);
    });

    it('일반 장수는 포로를 해방할 수 없다', async () => {
      const releaser = createMockGeneral({
        data: { no: 1, name: '일반장수', nation: 1, officer_level: 1 },
      });
      const prisoner = createMockGeneral({
        data: { no: 2, name: '포로장수', prisoner_of: 1 },
      });

      (generalRepository.findOneByFilter as jest.Mock)
        .mockResolvedValueOnce(releaser)
        .mockResolvedValueOnce(prisoner);

      const result = await PrisonerService.releasePrisoner(
        'test-session',
        1,
        2
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('태수 이상');
    });
  });

  describe('executePrisoner', () => {
    it('군주만 포로를 처형할 수 있다', async () => {
      const executor = createMockGeneral({
        data: { no: 1, name: '군주', nation: 1, officer_level: 12 },
      });
      const prisoner = createMockGeneral({
        data: { no: 2, name: '포로장수', prisoner_of: 1, npc: 2 },
      });

      (generalRepository.findOneByFilter as jest.Mock)
        .mockResolvedValueOnce(executor)
        .mockResolvedValueOnce(prisoner);

      const result = await PrisonerService.executePrisoner(
        'test-session',
        1,
        2
      );

      expect(result.success).toBe(true);
      expect(prisoner.kill).toHaveBeenCalled();
    });

    it('군주가 아니면 처형할 수 없다', async () => {
      const executor = createMockGeneral({
        data: { no: 1, name: '태수', nation: 1, officer_level: 4 },
      });
      const prisoner = createMockGeneral({
        data: { no: 2, name: '포로장수', prisoner_of: 1 },
      });

      (generalRepository.findOneByFilter as jest.Mock)
        .mockResolvedValueOnce(executor)
        .mockResolvedValueOnce(prisoner);

      const result = await PrisonerService.executePrisoner(
        'test-session',
        1,
        2
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('군주만');
    });
  });

  describe('attemptEscape', () => {
    it('탈출 성공 시 재야가 된다', async () => {
      const prisoner = createMockGeneral({
        data: { no: 1, name: '포로장수', prisoner_of: 1, intel: 100 },
      });

      (generalRepository.findOneByFilter as jest.Mock).mockResolvedValue(prisoner);

      const rng = createMockRng(true); // 성공

      const result = await PrisonerService.attemptEscape(
        'test-session',
        1,
        rng
      );

      expect(result.success).toBe(true);
      expect(prisoner.data.prisoner_of).toBe(0);
      expect(prisoner.data.nation).toBe(0);
    });

    it('탈출 실패 시 포로 상태가 유지된다', async () => {
      const prisoner = createMockGeneral({
        data: { no: 1, name: '포로장수', prisoner_of: 1, intel: 10 },
      });

      (generalRepository.findOneByFilter as jest.Mock).mockResolvedValue(prisoner);

      const rng = createMockRng(false); // 실패

      const result = await PrisonerService.attemptEscape(
        'test-session',
        1,
        rng
      );

      expect(result.success).toBe(false);
      expect(prisoner.data.prisoner_of).toBe(1);
    });
  });

  describe('getPrisonersByNation', () => {
    it('국가의 포로 목록을 조회한다', async () => {
      const prisoners = [
        createMockGeneral({ data: { no: 1, name: '포로1', prisoner_of: 1 } }),
        createMockGeneral({ data: { no: 2, name: '포로2', prisoner_of: 1 } }),
      ];

      (generalRepository.findByFilter as jest.Mock).mockResolvedValue(prisoners);

      const result = await PrisonerService.getPrisonersByNation('test-session', 1);

      expect(generalRepository.findByFilter).toHaveBeenCalledWith({
        session_id: 'test-session',
        'data.prisoner_of': 1,
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('isPrisoner', () => {
    it('포로 상태를 확인한다', () => {
      const prisoner = createMockGeneral({ data: { prisoner_of: 1 } });
      const freeGeneral = createMockGeneral({ data: { prisoner_of: 0 } });

      expect(PrisonerService.isPrisoner(prisoner as any)).toBe(true);
      expect(PrisonerService.isPrisoner(freeGeneral as any)).toBe(false);
    });
  });
});

describe('PRISONER_CONFIG', () => {
  it('기본 등용 성공률이 0~1 범위이다', () => {
    expect(PRISONER_CONFIG.BASE_RECRUIT_RATE).toBeGreaterThanOrEqual(0);
    expect(PRISONER_CONFIG.BASE_RECRUIT_RATE).toBeLessThanOrEqual(1);
  });

  it('기본 탈출 성공률이 0~1 범위이다', () => {
    expect(PRISONER_CONFIG.BASE_ESCAPE_RATE).toBeGreaterThanOrEqual(0);
    expect(PRISONER_CONFIG.BASE_ESCAPE_RATE).toBeLessThanOrEqual(1);
  });
});













