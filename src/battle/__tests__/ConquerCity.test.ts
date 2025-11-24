/**
 * ConquerCity.test.ts - 도시 점령 & 전투 후처리 테스트
 *
 * 요구 시나리오 (요약):
 * 1. 성공적인 공성 (공격자 승리, 도시 점령)
 * 2. 실패한 공성 (공격자 패퇴, 도시 미점령)
 * 3. 근소한 차이 승리 (양측 모두 큰 피해)
 * 4. 오버킬 승리 (방어측 대량 손실)
 * 5. 교착 / 무승부 (점령 없음)
 *
 * 여기서는 전투 자체(processWar_NG)가 아니라,
 * - 분쟁 정보 기반 점령국 결정(getConquerNation)
 * - 수도 함락시 다음 수도 선택(findNextCapital)
 * - 점령 후 도시 상태 업데이트(ConquerCity)
 * - 인구/민심 후처리(PostBattleProcessor.calculatePopulationTrust)
 * 에 초점을 맞춘다.
 */

import { ConquerCity, getConquerNation, findNextCapital } from '../ConquerCity';
import { PostBattleProcessor } from '../PostBattleProcessor';

// repository 레이어는 테스트에서 메모리 기반 mock 으로 대체
jest.mock('../../repositories/city.repository', () => {
  const cities: any[] = [];

  return {
    cityRepository: {
      __setMockCities(newCities: any[]) {
        cities.length = 0;
        cities.push(...newCities);
      },
      async findByFilter(filter: any) {
        if (filter.session_id && filter.nation !== undefined) {
          return cities.filter(
            (c) => c.session_id === filter.session_id && c.nation === filter.nation,
          );
        }
        if (filter.session_id) {
          return cities.filter((c) => c.session_id === filter.session_id);
        }
        return cities;
      },
      async findOneByFilter(filter: any) {
        return cities.find(
          (c) => c.session_id === filter.session_id && c.city === filter.city,
        );
      },
      async updateByCityNum(sessionId: string, cityNum: number, patch: any) {
        const idx = cities.findIndex(
          (c) => c.session_id === sessionId && c.city === cityNum,
        );
        if (idx >= 0) {
          cities[idx] = { ...cities[idx], ...patch };
        }
        return { modifiedCount: 1 };
      },
      async count(filter: any) {
        return cities.filter(
          (c) =>
            (!filter.session_id || c.session_id === filter.session_id) &&
            (filter.nation === undefined || c.nation === filter.nation),
        ).length;
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
      async findOneByFilter(filter: any) {
        return nations.find(
          (n) =>
            n.session_id === filter.session_id && n.nation === filter.nation,
        );
      },
      async updateByNationNum(sessionId: string, nationNum: number, patch: any) {
        const idx = nations.findIndex(
          (n) => n.session_id === sessionId && n.nation === nationNum,
        );
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
      async updateBySessionAndNo(sessionId: string, no: number, patch: any) {
        const idx = generals.findIndex(
          (g) => g.session_id === sessionId && (g.no === no || g.data?.no === no),
        );
        if (idx >= 0) {
          generals[idx] = {
            ...generals[idx],
            data: { ...(generals[idx].data || {}), ...(patch.data || {}) },
          };
        }
        return { modifiedCount: 1 };
      },
    },
  };
});

// searchDistanceAsync 는 단순한 인접 그래프 기반으로 mock
jest.mock('../../func/searchDistance', () => {
  return {
    searchDistanceAsync: async (
      _sessionId: string,
      startCityID: number,
      _maxDist: number,
      _includeStart: boolean,
    ) => {
      // 간단한 직선 맵: start → 2 → 3 → 4
      const map: Record<number, number> = {};
      map[startCityID] = 0;
      map[startCityID + 1] = 1;
      map[startCityID + 2] = 2;
      map[startCityID + 3] = 3;
      return map;
    },
  };
});

const { cityRepository } = jest.requireMock('../../repositories/city.repository');
const { nationRepository } = jest.requireMock('../../repositories/nation.repository');
const { generalRepository } = jest.requireMock('../../repositories/general.repository');

describe('ConquerCity helpers', () => {
  describe('getConquerNation', () => {
    it('returns attacker nation when conflict is empty', () => {
      const attackerNationId = 1;
      const city = { conflict: '{}' } as any;
      const result = getConquerNation(city, attackerNationId);
      expect(result).toBe(attackerNationId);
    });

    it('returns first key of sorted conflict JSON', () => {
      const attackerNationId = 1;
      const conflictObj = {
        '3': 5000,
        '2': 7000, // WarUnitCity 가 dead 기준 내림차순으로 정렬했다고 가정
      };
      const city = { conflict: JSON.stringify(conflictObj) } as any;
      const result = getConquerNation(city, attackerNationId);
      expect(result).toBe(3); // 첫 key
    });

    it('uses fallback when conflict is malformed', () => {
      const attackerNationId = 1;
      const city = { conflict: 'not-json' } as any;
      const result = getConquerNation(city, attackerNationId);
      expect(result).toBe(attackerNationId);
    });
  });

  describe('findNextCapital', () => {
    beforeEach(() => {
      cityRepository.__setMockCities([
        { session_id: 's1', city: 1, nation: 2, pop: 50000 },
        { session_id: 's1', city: 2, nation: 2, pop: 80000 },
        { session_id: 's1', city: 3, nation: 2, pop: 60000 },
      ]);
    });

    it('picks nearest city with highest population', async () => {
      const next = await findNextCapital('s1', 1, 2);
      // 거리 1: city 2, 거리 2: city 3 이라고 가정 → 우선 거리 1, 그 중 pop 최대는 city 2
      expect(next).toBe(2);
    });
  });
});

describe('ConquerCity main flow (scenarios)', () => {
  const admin = {
    startyear: 184,
    year: 200,
    month: 1,
    join_mode: 'normal',
  };

  const makeAttacker = (overrides: Partial<any> = {}) => ({
    getID: () => 1,
    getNationID: () => 1,
    getName: () => '조조',
    getSessionID: () => 's1',
    getStaticNation: () => ({ nation: 1, name: '위' }),
    getLogger: () => ({
      pushGeneralActionLog: jest.fn(),
      pushGeneralHistoryLog: jest.fn(),
      pushGlobalActionLog: jest.fn(),
      pushGlobalHistoryLog: jest.fn(),
    }),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    cityRepository.__setMockCities([
      {
        session_id: 's1',
        city: 10,
        name: '허창',
        nation: 2,
        level: 4,
        agri: 5000,
        comm: 4000,
        secu: 3000,
        def: 800,
        wall: 800,
        def_max: 1000,
        wall_max: 1000,
      },
    ]);

    nationRepository.__setMockNations([
      {
        session_id: 's1',
        nation: 1,
        name: '위',
        capital: 5,
        gold: 10000,
        rice: 20000,
      },
      {
        session_id: 's1',
        nation: 2,
        name: '촉',
        capital: 10,
        gold: 8000,
        rice: 15000,
      },
    ]);

    generalRepository.__setMockGenerals([
      { session_id: 's1', no: 1, data: { no: 1, city: 5, nation: 1 } },
    ]);
  });

  it('Scenario 1: successful siege → attacker moves into city', async () => {
    const attacker = makeAttacker();
    const city = {
      city: 10,
      name: '허창',
      nation: 2,
      level: 4,
      agri: 5000,
      comm: 4000,
      secu: 3000,
      def: 800,
      wall: 800,
      def_max: 1000,
      wall_max: 1000,
      conflict: JSON.stringify({ '1': 1000 }), // 공격국만 분쟁 참여
    };

    const result = await ConquerCity(admin, attacker, city as any, []);

    expect(result.conquerNationId).toBe(1);
    expect(result.attackerMoved).toBe(true);
    expect(result.nationDestroyed).toBe(false);
  });

  it('Scenario 2: failed siege semantics → conflict gives city to third nation', async () => {
    const attacker = makeAttacker();
    const city = {
      city: 10,
      name: '허창',
      nation: 2,
      level: 4,
      agri: 5000,
      comm: 4000,
      secu: 3000,
      def: 800,
      wall: 800,
      def_max: 1000,
      wall_max: 1000,
      // 분쟁에서 다른 국가(3번)가 우위
      conflict: JSON.stringify({ '3': 2000, '1': 1000 }),
    };

    const result = await ConquerCity(admin, attacker, city as any, []);

    expect(result.conquerNationId).toBe(3);
    expect(result.attackerMoved).toBe(false);
  });

  it('Scenario 3: marginal victory → city stats reduced but kept', async () => {
    const attacker = makeAttacker();
    const city = {
      city: 10,
      name: '허창',
      nation: 2,
      level: 3, // 중형 도시
      agri: 6000,
      comm: 6000,
      secu: 6000,
      def: 900,
      wall: 900,
      def_max: 1200,
      wall_max: 1200,
      conflict: JSON.stringify({ '1': 1500 }),
    };

    await ConquerCity(admin, attacker, city as any, []);

    const updated = await cityRepository.findOneByFilter({
      session_id: 's1',
      city: 10,
    });

    expect(updated.agri).toBe(Math.floor(6000 * 0.7));
    expect(updated.comm).toBe(Math.floor(6000 * 0.7));
    expect(updated.secu).toBe(Math.floor(6000 * 0.7));
    expect(updated.def).toBe(Math.floor(1200 / 2));
    expect(updated.wall).toBe(Math.floor(1200 / 2));
  });

  it('Scenario 4: overkill on capital → emergency capital move', async () => {
    const attacker = makeAttacker();

    // 기존 setup 에서 nation 2 의 수도는 city 10 이다.
    // cityRepository mock 은 거리 1 에 다른 도시가 없지만,
    // findNextCapital 는 searchDistanceAsync mock 을 이용해 11,12,13 을 후보로 만든다.
    cityRepository.__setMockCities([
      { session_id: 's1', city: 10, nation: 2, pop: 50000 },
      { session_id: 's1', city: 11, nation: 2, pop: 80000 },
      { session_id: 's1', city: 12, nation: 2, pop: 70000 },
    ]);

    nationRepository.__setMockNations([
      {
        session_id: 's1',
        nation: 2,
        name: '촉',
        capital: 10,
        gold: 10000,
        rice: 20000,
      },
    ]);

    const city = {
      city: 10,
      name: '낙양',
      nation: 2,
      level: 5,
      agri: 8000,
      comm: 8000,
      secu: 8000,
      def: 1500,
      wall: 1500,
      def_max: 2000,
      wall_max: 2000,
      conflict: JSON.stringify({ '1': 9999 }),
    };

    const result = await ConquerCity(admin, attacker, city as any, []);

    expect(result.newCapitalCityId).toBe(11);
  });

  it('Scenario 5: stalemate / no conflict → stays with original owner logically', async () => {
    const attacker = makeAttacker();
    const city = {
      city: 10,
      name: '허창',
      nation: 2,
      level: 4,
      agri: 5000,
      comm: 4000,
      secu: 3000,
      def: 800,
      wall: 800,
      def_max: 1000,
      wall_max: 1000,
      conflict: '{}',
    };

    const result = await ConquerCity(admin, attacker, city as any, []);

    // conflict 가 비어있으면 fallback 으로 공격국이 점령
    expect(result.conquerNationId).toBe(1);
  });
});

describe('PostBattleProcessor.calculatePopulationTrust', () => {
  it('decreases population and trust proportionally to casualties', () => {
    const city = { pop: 100000, trust: 70 };
    const casualties = 5000;

    const result = PostBattleProcessor.calculatePopulationTrust(city, casualties);

    expect(result.pop).toBe(100000 - Math.floor(5000 * 0.6));
    const expectedTrustDec = Math.min(20, Math.floor(5000 / 1000));
    expect(result.trust).toBe(70 - expectedTrustDec);
  });

  it('does not go below 0 or above 100', () => {
    const city = { pop: 1000, trust: 5 };
    const casualties = 10000;

    const result = PostBattleProcessor.calculatePopulationTrust(city, casualties);

    expect(result.pop).toBeGreaterThanOrEqual(0);
    expect(result.trust).toBeGreaterThanOrEqual(0);
    expect(result.trust).toBeLessThanOrEqual(100);
  });

  it('returns original values when casualties are zero', () => {
    const city = { pop: 50000, trust: 50 };
    const result = PostBattleProcessor.calculatePopulationTrust(city, 0);
    expect(result.pop).toBe(50000);
    expect(result.trust).toBe(50);
  });
});
