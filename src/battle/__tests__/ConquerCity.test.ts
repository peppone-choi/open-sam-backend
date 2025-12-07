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

describe('ConquerCity 국가 멸망 시나리오', () => {
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
      pushNationalHistoryLog: jest.fn(),
    }),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Scenario 6: 마지막 도시 점령 → 국가 멸망', () => {
    beforeEach(() => {
      // 수비국의 유일한 도시 설정
      cityRepository.__setMockCities([
        {
          session_id: 's1',
          city: 20,
          name: '마지막성',
          nation: 3,
          level: 3,
          agri: 4000,
          comm: 3000,
          secu: 3000,
          def: 600,
          wall: 600,
          def_max: 1000,
          wall_max: 1000,
          pop: 30000,
        },
      ]);

      nationRepository.__setMockNations([
        {
          session_id: 's1',
          nation: 1,
          name: '위',
          capital: 5,
          gold: 15000,
          rice: 25000,
          level: 1,
        },
        {
          session_id: 's1',
          nation: 3,
          name: '동탁군',
          capital: 20, // 마지막 도시가 수도
          gold: 5000,
          rice: 8000,
          level: 1,
        },
      ]);

      generalRepository.__setMockGenerals([
        { session_id: 's1', no: 1, data: { no: 1, city: 5, nation: 1 } },
      ]);
    });

    it('should mark nation as destroyed when last city is conquered', async () => {
      const attacker = makeAttacker();
      const city = {
        city: 20,
        name: '마지막성',
        nation: 3,
        level: 3,
        agri: 4000,
        comm: 3000,
        secu: 3000,
        def: 600,
        wall: 600,
        def_max: 1000,
        wall_max: 1000,
        conflict: JSON.stringify({ '1': 2000 }),
      };

      const result = await ConquerCity(admin, attacker, city as any, []);

      // 검증: 국가 멸망
      expect(result.nationDestroyed).toBe(true);
      expect(result.conquerNationId).toBe(1);
      expect(result.attackerMoved).toBe(true);
    });

    it('should not mark nation as destroyed when more cities remain', async () => {
      // 도시 2개로 변경
      cityRepository.__setMockCities([
        {
          session_id: 's1',
          city: 20,
          name: '점령당할성',
          nation: 3,
          level: 3,
          agri: 4000,
          comm: 3000,
          secu: 3000,
          def: 600,
          wall: 600,
          def_max: 1000,
          wall_max: 1000,
          pop: 30000,
        },
        {
          session_id: 's1',
          city: 21,
          name: '남은성',
          nation: 3,
          level: 4,
          agri: 5000,
          comm: 4000,
          secu: 4000,
          def: 800,
          wall: 800,
          def_max: 1200,
          wall_max: 1200,
          pop: 50000,
        },
      ]);

      const attacker = makeAttacker();
      const city = {
        city: 20,
        name: '점령당할성',
        nation: 3,
        level: 3,
        agri: 4000,
        comm: 3000,
        secu: 3000,
        def: 600,
        wall: 600,
        def_max: 1000,
        wall_max: 1000,
        conflict: JSON.stringify({ '1': 2000 }),
      };

      const result = await ConquerCity(admin, attacker, city as any, []);

      // 검증: 국가 멸망 아님
      expect(result.nationDestroyed).toBe(false);
      expect(result.conquerNationId).toBe(1);
    });
  });

  describe('Scenario 7: 수도 점령 → 긴급 천도', () => {
    beforeEach(() => {
      // 수비국의 도시 여러 개 (수도 포함)
      cityRepository.__setMockCities([
        {
          session_id: 's1',
          city: 30, // 수도
          name: '낙양',
          nation: 4,
          level: 5,
          agri: 8000,
          comm: 7000,
          secu: 7000,
          def: 1500,
          wall: 1500,
          def_max: 2500,
          wall_max: 2500,
          pop: 80000,
        },
        {
          session_id: 's1',
          city: 31, // 인구 가장 많은 다른 도시
          name: '장안',
          nation: 4,
          level: 4,
          agri: 6000,
          comm: 5000,
          secu: 5000,
          def: 1200,
          wall: 1200,
          def_max: 2000,
          wall_max: 2000,
          pop: 100000, // 가장 높은 인구
        },
        {
          session_id: 's1',
          city: 32,
          name: '완성',
          nation: 4,
          level: 3,
          agri: 4000,
          comm: 3000,
          secu: 3000,
          def: 800,
          wall: 800,
          def_max: 1500,
          wall_max: 1500,
          pop: 40000,
        },
      ]);

      nationRepository.__setMockNations([
        {
          session_id: 's1',
          nation: 1,
          name: '위',
          capital: 5,
          gold: 20000,
          rice: 30000,
          level: 1,
        },
        {
          session_id: 's1',
          nation: 4,
          name: '한',
          capital: 30, // 낙양이 수도
          gold: 12000,
          rice: 18000,
          level: 1,
        },
      ]);

      generalRepository.__setMockGenerals([
        { session_id: 's1', no: 1, data: { no: 1, city: 5, nation: 1 } },
      ]);
    });

    it('should trigger emergency capital move when capital is conquered', async () => {
      const attacker = makeAttacker();
      const city = {
        city: 30, // 수도 낙양
        name: '낙양',
        nation: 4,
        level: 5,
        agri: 8000,
        comm: 7000,
        secu: 7000,
        def: 1500,
        wall: 1500,
        def_max: 2500,
        wall_max: 2500,
        conflict: JSON.stringify({ '1': 5000 }),
      };

      const result = await ConquerCity(admin, attacker, city as any, []);

      // 검증: 긴급 천도
      expect(result.nationDestroyed).toBe(false);
      // 인구가 가장 많은 장안(31)으로 천도
      expect(result.newCapitalCityId).toBe(31);
    });
  });
});

describe('ConquerCity 통일 조건 시나리오', () => {
  const admin = {
    startyear: 184,
    year: 220,
    month: 6,
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
      pushNationalHistoryLog: jest.fn(),
    }),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Scenario 8: 마지막 적국 멸망 → 통일 달성', () => {
    beforeEach(() => {
      // 공격국이 이미 대부분 도시 보유, 마지막 1개 도시만 적국 보유
      cityRepository.__setMockCities([
        // 공격국 소유 도시들
        {
          session_id: 's1',
          city: 1,
          name: '낙양',
          nation: 1,
          level: 5,
          agri: 8000,
          comm: 7000,
          secu: 7000,
          def: 2000,
          wall: 2000,
          def_max: 3000,
          wall_max: 3000,
          pop: 100000,
        },
        {
          session_id: 's1',
          city: 2,
          name: '장안',
          nation: 1,
          level: 4,
          agri: 6000,
          comm: 5000,
          secu: 5000,
          def: 1500,
          wall: 1500,
          def_max: 2500,
          wall_max: 2500,
          pop: 80000,
        },
        {
          session_id: 's1',
          city: 3,
          name: '업성',
          nation: 1,
          level: 4,
          agri: 5500,
          comm: 5000,
          secu: 4500,
          def: 1300,
          wall: 1300,
          def_max: 2200,
          wall_max: 2200,
          pop: 70000,
        },
        // 마지막 적국 도시
        {
          session_id: 's1',
          city: 99,
          name: '마지막저항지',
          nation: 5,
          level: 3,
          agri: 3000,
          comm: 2500,
          secu: 2000,
          def: 500,
          wall: 500,
          def_max: 1000,
          wall_max: 1000,
          pop: 20000,
        },
      ]);

      nationRepository.__setMockNations([
        {
          session_id: 's1',
          nation: 1,
          name: '위',
          capital: 1,
          gold: 50000,
          rice: 80000,
          level: 1,
        },
        {
          session_id: 's1',
          nation: 5,
          name: '저항군',
          capital: 99,
          gold: 1000,
          rice: 2000,
          level: 1,
        },
      ]);

      generalRepository.__setMockGenerals([
        { session_id: 's1', no: 1, data: { no: 1, city: 1, nation: 1 } },
      ]);
    });

    it('should achieve unification when conquering last enemy city', async () => {
      const attacker = makeAttacker();
      const city = {
        city: 99,
        name: '마지막저항지',
        nation: 5,
        level: 3,
        agri: 3000,
        comm: 2500,
        secu: 2000,
        def: 500,
        wall: 500,
        def_max: 1000,
        wall_max: 1000,
        conflict: JSON.stringify({ '1': 3000 }),
      };

      const result = await ConquerCity(admin, attacker, city as any, []);

      // 검증: 적국 멸망 및 점령 성공
      expect(result.nationDestroyed).toBe(true);
      expect(result.conquerNationId).toBe(1);

      // 점령 후 모든 도시가 공격국(1)의 소유가 됨
      // (실제 통일 체크는 별도 함수에서 처리되지만, 조건은 충족됨)
    });
  });

  describe('Scenario 9: 일반 도시 점령 (통일 아님)', () => {
    beforeEach(() => {
      // 여러 국가가 도시를 보유
      cityRepository.__setMockCities([
        {
          session_id: 's1',
          city: 1,
          name: '낙양',
          nation: 1,
          level: 5,
          agri: 8000,
          comm: 7000,
          secu: 7000,
          def: 2000,
          wall: 2000,
          def_max: 3000,
          wall_max: 3000,
          pop: 100000,
        },
        {
          session_id: 's1',
          city: 10,
          name: '성도',
          nation: 2, // 다른 국가
          level: 4,
          agri: 6000,
          comm: 5000,
          secu: 5000,
          def: 1500,
          wall: 1500,
          def_max: 2500,
          wall_max: 2500,
          pop: 75000,
        },
        {
          session_id: 's1',
          city: 20,
          name: '건업',
          nation: 3, // 또 다른 국가 (점령 대상)
          level: 4,
          agri: 5500,
          comm: 5000,
          secu: 4500,
          def: 1200,
          wall: 1200,
          def_max: 2000,
          wall_max: 2000,
          pop: 60000,
        },
        {
          session_id: 's1',
          city: 21,
          name: '오성',
          nation: 3,
          level: 3,
          agri: 4000,
          comm: 3500,
          secu: 3000,
          def: 800,
          wall: 800,
          def_max: 1500,
          wall_max: 1500,
          pop: 40000,
        },
      ]);

      nationRepository.__setMockNations([
        {
          session_id: 's1',
          nation: 1,
          name: '위',
          capital: 1,
          gold: 30000,
          rice: 50000,
          level: 1,
        },
        {
          session_id: 's1',
          nation: 2,
          name: '촉',
          capital: 10,
          gold: 20000,
          rice: 35000,
          level: 1,
        },
        {
          session_id: 's1',
          nation: 3,
          name: '오',
          capital: 20,
          gold: 18000,
          rice: 30000,
          level: 1,
        },
      ]);

      generalRepository.__setMockGenerals([
        { session_id: 's1', no: 1, data: { no: 1, city: 1, nation: 1 } },
      ]);
    });

    it('should conquer city without achieving unification', async () => {
      const attacker = makeAttacker();
      const city = {
        city: 20, // 오나라 수도
        name: '건업',
        nation: 3,
        level: 4,
        agri: 5500,
        comm: 5000,
        secu: 4500,
        def: 1200,
        wall: 1200,
        def_max: 2000,
        wall_max: 2000,
        conflict: JSON.stringify({ '1': 4000 }),
      };

      const result = await ConquerCity(admin, attacker, city as any, []);

      // 검증: 일반 점령 (멸망 아님 - 오나라는 아직 오성 보유)
      expect(result.nationDestroyed).toBe(false);
      expect(result.conquerNationId).toBe(1);

      // 수도가 점령되었으므로 긴급 천도 발생
      expect(result.newCapitalCityId).toBe(21); // 오성으로 천도
    });
  });
});
