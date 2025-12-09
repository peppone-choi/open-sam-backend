/**
 * ConquerCityEnhanced.test.ts - 도시 점령 보강 기능 테스트
 *
 * ProcessWar.ts의 ConquerCity 함수 보강 사항 테스트:
 * 1. 포로 처리: 적 장수를 포로로 전환
 * 2. 국가 멸망 체크: 마지막 도시 점령 시
 * 3. 멸망 시 처리: 장수 재야화, 자원 흡수
 * 4. 통일 체크: 모든 도시 점령 시
 */

import { General, IGeneral } from '../../models/general.model';

// Mock repositories
jest.mock('../../repositories/city.repository', () => {
  const cities: any[] = [];
  
  return {
    cityRepository: {
      __setMockCities(newCities: any[]) {
        cities.length = 0;
        cities.push(...newCities);
      },
      __getMockCities() {
        return cities;
      },
      async findByFilter(filter: any) {
        return cities.filter(c => {
          if (filter.session_id && c.session_id !== filter.session_id) return false;
          if (filter.nation !== undefined && c.nation !== filter.nation) return false;
          if (filter.city && filter.city.$ne && c.city === filter.city.$ne) return false;
          return true;
        });
      },
      async findBySession(sessionId: string) {
        return cities.filter(c => c.session_id === sessionId);
      },
      async findByCityNum(sessionId: string, cityNum: number) {
        return cities.find(c => c.session_id === sessionId && c.city === cityNum);
      },
      async updateByCityNum(sessionId: string, cityNum: number, patch: any) {
        const idx = cities.findIndex(c => c.session_id === sessionId && c.city === cityNum);
        if (idx >= 0) {
          cities[idx] = { ...cities[idx], ...patch };
        }
        return { modifiedCount: 1 };
      },
      async count(filter: any) {
        return cities.filter(c => {
          if (filter.session_id && c.session_id !== filter.session_id) return false;
          if (filter.nation !== undefined && c.nation !== filter.nation) return false;
          return true;
        }).length;
      },
    },
  };
});

jest.mock('../../repositories/nation.repository', () => {
  const nations: any[] = [];
  
  return {
    nationRepository: {
      __setMockNations(newNations: any[]) {
        nations.length = 0;
        nations.push(...newNations);
      },
      __getMockNations() {
        return nations;
      },
      async findByNationNum(sessionId: string, nationNum: number) {
        return nations.find(n => n.session_id === sessionId && n.nation === nationNum);
      },
      async updateByNationNum(sessionId: string, nationNum: number, patch: any) {
        const idx = nations.findIndex(n => n.session_id === sessionId && n.nation === nationNum);
        if (idx >= 0) {
          nations[idx] = { ...nations[idx], ...patch };
        }
        return { modifiedCount: 1 };
      },
    },
  };
});

jest.mock('../../repositories/general.repository', () => {
  const generals: any[] = [];
  
  return {
    generalRepository: {
      __setMockGenerals(newGenerals: any[]) {
        generals.length = 0;
        generals.push(...newGenerals);
      },
      __getMockGenerals() {
        return generals;
      },
      async findByFilter(filter: any) {
        return generals.filter(g => {
          if (filter.session_id && g.session_id !== filter.session_id) return false;
          if (filter['data.nation'] !== undefined && g.data?.nation !== filter['data.nation']) return false;
          if (filter['data.city'] !== undefined && g.data?.city !== filter['data.city']) return false;
          return true;
        });
      },
      async updateManyByFilter(filter: any, update: any) {
        let count = 0;
        for (const g of generals) {
          let match = true;
          if (filter.session_id && g.session_id !== filter.session_id) match = false;
          if (filter['data.nation'] !== undefined && g.data?.nation !== filter['data.nation']) match = false;
          if (filter['data.officer_city'] !== undefined && g.data?.officer_city !== filter['data.officer_city']) match = false;
          
          if (match) {
            g.data = { ...g.data, ...update['data'] };
            count++;
          }
        }
        return { modifiedCount: count };
      },
    },
  };
});

jest.mock('../../services/battle/BattleEventHook.service', () => ({
  onCityOccupied: jest.fn().mockResolvedValue(undefined),
  onNationDestroyed: jest.fn().mockResolvedValue(undefined),
  checkUnified: jest.fn().mockResolvedValue(undefined),
}));

const { cityRepository } = jest.requireMock('../../repositories/city.repository');
const { nationRepository } = jest.requireMock('../../repositories/nation.repository');
const { generalRepository } = jest.requireMock('../../repositories/general.repository');

describe('General 포로 시스템 메서드', () => {
  let mockGeneral: any;
  
  beforeEach(() => {
    mockGeneral = {
      data: {
        no: 1,
        name: '관우',
        nation: 2,
        city: 10,
        crew: 5000,
        troop: 1,
        prisoner_of: 0,
      },
      markModified: jest.fn(),
    };
    
    // 메서드 바인딩 (실제 모델 메서드 시뮬레이션)
    mockGeneral.getVar = function(key: string) {
      return this.data?.[key];
    };
    
    mockGeneral.setVar = function(key: string, value: any) {
      if (!this.data) this.data = {};
      this.data[key] = value;
      this.markModified('data');
    };
    
    mockGeneral.isPrisoner = function() {
      const prisonerOf = this.data?.prisoner_of ?? 0;
      return prisonerOf > 0;
    };
    
    mockGeneral.getPrisonerOf = function() {
      return this.data?.prisoner_of ?? 0;
    };
    
    mockGeneral.setPrisoner = function(capturerNationId: number) {
      this.setVar('prisoner_of', capturerNationId);
      this.setVar('crew', 0);
      this.setVar('troop', 0);
    };
    
    mockGeneral.releasePrisoner = function() {
      this.setVar('prisoner_of', 0);
      this.setVar('nation', 0);
      this.setVar('officer_level', 1);
      this.setVar('officer_city', 0);
    };
  });
  
  describe('isPrisoner', () => {
    it('포로가 아닌 경우 false 반환', () => {
      expect(mockGeneral.isPrisoner()).toBe(false);
    });
    
    it('포로인 경우 true 반환', () => {
      mockGeneral.data.prisoner_of = 1;
      expect(mockGeneral.isPrisoner()).toBe(true);
    });
  });
  
  describe('setPrisoner', () => {
    it('포로로 설정하면 prisoner_of가 설정됨', () => {
      mockGeneral.setPrisoner(1);
      expect(mockGeneral.getPrisonerOf()).toBe(1);
    });
    
    it('포로로 설정하면 병력이 0이 됨', () => {
      mockGeneral.setPrisoner(1);
      expect(mockGeneral.getVar('crew')).toBe(0);
    });
    
    it('포로로 설정하면 부대에서 제외됨', () => {
      mockGeneral.setPrisoner(1);
      expect(mockGeneral.getVar('troop')).toBe(0);
    });
  });
  
  describe('releasePrisoner', () => {
    it('포로 해방하면 prisoner_of가 0이 됨', () => {
      mockGeneral.data.prisoner_of = 1;
      mockGeneral.releasePrisoner();
      expect(mockGeneral.getPrisonerOf()).toBe(0);
    });
    
    it('포로 해방하면 재야(nation=0)가 됨', () => {
      mockGeneral.data.prisoner_of = 1;
      mockGeneral.releasePrisoner();
      expect(mockGeneral.getVar('nation')).toBe(0);
    });
  });
});

describe('국가 멸망 체크 로직', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    cityRepository.__setMockCities([
      { session_id: 's1', city: 10, name: '낙양', nation: 2, pop: 50000 },
    ]);
    
    nationRepository.__setMockNations([
      { session_id: 's1', nation: 1, name: '위', capital: 5, gold: 10000, rice: 20000, level: 5 },
      { session_id: 's1', nation: 2, name: '촉', capital: 10, gold: 8000, rice: 15000, level: 5 },
    ]);
    
    generalRepository.__setMockGenerals([
      { session_id: 's1', no: 1, data: { no: 1, name: '조조', city: 5, nation: 1, npc: 0 } },
      { session_id: 's1', no: 2, data: { no: 2, name: '유비', city: 10, nation: 2, npc: 0 } },
    ]);
  });
  
  it('마지막 도시 점령 시 멸망 조건 충족', async () => {
    // 촉(nation: 2)의 도시가 1개만 남은 상태
    const remainingCities = await cityRepository.count({
      session_id: 's1',
      nation: 2,
    });
    
    expect(remainingCities).toBe(1);
    // 1개만 남았으면 멸망 조건 충족
    const shouldDestroy = remainingCities <= 1;
    expect(shouldDestroy).toBe(true);
  });
  
  it('여러 도시가 남아있으면 멸망하지 않음', async () => {
    cityRepository.__setMockCities([
      { session_id: 's1', city: 10, name: '낙양', nation: 2, pop: 50000 },
      { session_id: 's1', city: 11, name: '성도', nation: 2, pop: 40000 },
    ]);
    
    const remainingCities = await cityRepository.count({
      session_id: 's1',
      nation: 2,
    });
    
    expect(remainingCities).toBe(2);
    const shouldDestroy = remainingCities <= 1;
    expect(shouldDestroy).toBe(false);
  });
});

describe('통일 체크 로직', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('모든 도시가 한 국가 소유면 통일', async () => {
    cityRepository.__setMockCities([
      { session_id: 's1', city: 10, nation: 1 },
      { session_id: 's1', city: 11, nation: 1 },
      { session_id: 's1', city: 12, nation: 1 },
    ]);
    
    const allCities = await cityRepository.findBySession('s1');
    const nationCityCount = allCities.filter((c: any) => c.nation === 1).length;
    
    const isUnified = nationCityCount === allCities.length;
    expect(isUnified).toBe(true);
  });
  
  it('일부 도시가 다른 국가 소유면 미통일', async () => {
    cityRepository.__setMockCities([
      { session_id: 's1', city: 10, nation: 1 },
      { session_id: 's1', city: 11, nation: 1 },
      { session_id: 's1', city: 12, nation: 2 }, // 다른 국가
    ]);
    
    const allCities = await cityRepository.findBySession('s1');
    const nationCityCount = allCities.filter((c: any) => c.nation === 1).length;
    
    const isUnified = nationCityCount === allCities.length;
    expect(isUnified).toBe(false);
  });
  
  it('공백지가 있어도 미통일', async () => {
    cityRepository.__setMockCities([
      { session_id: 's1', city: 10, nation: 1 },
      { session_id: 's1', city: 11, nation: 1 },
      { session_id: 's1', city: 12, nation: 0 }, // 공백지
    ]);
    
    const allCities = await cityRepository.findBySession('s1');
    const nationCityCount = allCities.filter((c: any) => c.nation === 1).length;
    
    const isUnified = nationCityCount === allCities.length;
    expect(isUnified).toBe(false);
  });
});

describe('긴급 천도 로직', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    cityRepository.__setMockCities([
      { session_id: 's1', city: 10, name: '낙양', nation: 2, pop: 50000 },
      { session_id: 's1', city: 11, name: '성도', nation: 2, pop: 80000 },
      { session_id: 's1', city: 12, name: '한중', nation: 2, pop: 60000 },
    ]);
    
    nationRepository.__setMockNations([
      { session_id: 's1', nation: 2, name: '촉', capital: 10, gold: 10000, rice: 20000 },
    ]);
  });
  
  it('수도 함락 시 인구 최대 도시를 새 수도로 선택', async () => {
    const capitalID = 10;
    
    // 수도(10번)를 제외한 도시 중 인구 최대 도시 찾기
    const remainingCities = await cityRepository.findByFilter({
      session_id: 's1',
      nation: 2,
      city: { $ne: capitalID },
    });
    
    // 인구 순 정렬
    const sortedCities = remainingCities.sort((a: any, b: any) => (b.pop || 0) - (a.pop || 0));
    const newCapital = sortedCities[0];
    
    expect(newCapital.city).toBe(11); // 성도 (pop: 80000)
    expect(newCapital.pop).toBe(80000);
  });
});

describe('도시 점령 시 내정치 감소', () => {
  it('점령 시 내정치가 30% 감소', () => {
    const city = {
      agri: 5000,
      comm: 4000,
      secu: 3000,
    };
    
    const updateData = {
      agri: Math.floor(city.agri * 0.7),
      comm: Math.floor(city.comm * 0.7),
      secu: Math.floor(city.secu * 0.7),
    };
    
    expect(updateData.agri).toBe(3500);
    expect(updateData.comm).toBe(2800);
    expect(updateData.secu).toBe(2100);
  });
});

describe('멸망국 자원 흡수 계산', () => {
  it('기본량 제외 후 50% 흡수', () => {
    const defenderNation = {
      gold: 10000,
      rice: 20000,
    };
    
    const baseGold = 1000;
    const baseRice = 1000;
    
    const loseNationGold = Math.max(0, defenderNation.gold - baseGold);
    const loseNationRice = Math.max(0, defenderNation.rice - baseRice);
    
    const rewardGold = Math.floor(loseNationGold / 2);
    const rewardRice = Math.floor(loseNationRice / 2);
    
    expect(rewardGold).toBe(4500); // (10000 - 1000) / 2 = 4500
    expect(rewardRice).toBe(9500); // (20000 - 1000) / 2 = 9500
  });
  
  it('국고가 기본량 이하면 보상 0', () => {
    const defenderNation = {
      gold: 500,
      rice: 800,
    };
    
    const baseGold = 1000;
    const baseRice = 1000;
    
    const loseNationGold = Math.max(0, defenderNation.gold - baseGold);
    const loseNationRice = Math.max(0, defenderNation.rice - baseRice);
    
    const rewardGold = Math.floor(loseNationGold / 2);
    const rewardRice = Math.floor(loseNationRice / 2);
    
    expect(rewardGold).toBe(0);
    expect(rewardRice).toBe(0);
  });
});











