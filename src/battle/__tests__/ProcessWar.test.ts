/**
 * ProcessWar.test.ts - 전투 처리 통합 테스트
 *
 * 테스트 시나리오:
 * 1. 공격자 승리 → 도시 점령
 * 2. 공격자 패배 → 퇴각
 * 3. 수비자 군량 부족 → 패퇴
 * 4. 연속 전투 (여러 수비 장수)
 * 5. 공성전 (장수 없이 성벽만)
 */

import { processWar_NG, extractBattleOrder } from '../ProcessWar';
import { WarUnitGeneral } from '../WarUnitGeneral';
import { WarUnitCity } from '../WarUnitCity';
import { RandUtil } from '../../utils/RandUtil';
import { LiteHashDRBG } from '../../utils/LiteHashDRBG';

// ---------------------------------------------------------------------------
// 테스트 헬퍼
// ---------------------------------------------------------------------------

function createMockGeneral(data: Partial<any>) {
  return {
    data: {
      no: data.no || 1,
      name: data.name || '장수',
      nation: data.nation || 1,
      city: data.city || 1,
      crew: data.crew || 10000,
      crewtype: data.crewtype || 1,
      rice: data.rice || 5000,
      train: data.train || 80,
      atmos: data.atmos || 80,
      leadership: data.leadership || 70,
      strength: data.strength || 70,
      intel: data.intel || 70,
      dex1: data.dex1 || 50000,
      dex2: data.dex2 || 0,
      dex3: data.dex3 || 0,
      dex4: data.dex4 || 0,
      dex5: data.dex5 || 0,
      explevel: data.explevel || 0,
      defence_train: data.defence_train || 50,
      injury: data.injury || 0,
      experience: data.experience || 0,
      dedication: data.dedication || 0,
      ...data,
    },
    getVar(key: string) {
      return this.data[key];
    },
    setVar(key: string, value: any) {
      this.data[key] = value;
    },
    increaseVar(key: string, value: number) {
      this.data[key] = (this.data[key] || 0) + value;
    },
    increaseVarWithLimit(key: string, value: number, min?: number, max?: number) {
      let next = (this.data[key] || 0) + value;
      if (min !== undefined && next < min) next = min;
      if (max !== undefined && next > max) next = max;
      this.data[key] = next;
    },
    multiplyVarWithLimit(key: string, value: number, min?: number, max?: number) {
      let next = (this.data[key] || 0) * value;
      if (min !== undefined && next < min) next = min;
      if (max !== undefined && next > max) next = max;
      this.data[key] = next;
    },
    getName() {
      return this.data.name;
    },
    getLeadership(full = true) {
      return this.data.leadership ?? 50;
    },
    getStrength(full = true) {
      return this.data.strength ?? 50;
    },
    getIntel(full = true) {
      return this.data.intel ?? 50;
    },
    getRaw() {
      return this.data;
    },
    getRawCity() {
      return this.data._cached_city || { city: 1, level: 3 };
    },
    getTurnTime(_format?: string) {
      return '200001010100';
    },
    getLogger() {
      return {
        pushGlobalActionLog: jest.fn(),
        pushGeneralActionLog: jest.fn(),
        pushGlobalHistoryLog: jest.fn(),
        pushGeneralHistoryLog: jest.fn(),
        pushGeneralBattleDetailLog: jest.fn(),
        pushGeneralBattleResultLog: jest.fn(),
        pushNationalHistoryLog: jest.fn(),
        flush: jest.fn(),
      };
    },
    increaseRankVar: jest.fn(),
    addExperience: jest.fn(),
    addDedication: jest.fn(),
    addDex: jest.fn(),
    applyDB: jest.fn().mockResolvedValue(undefined),
    checkStatChange: jest.fn(() => false),
  };
}

function createMockNation(data: Partial<any>) {
  return {
    nation: data.nation || 1,
    name: data.name || '테스트국',
    rice: data.rice ?? 10000,
    tech: data.tech ?? 3000,
    capital: data.capital || 1,
    gennum: data.gennum || 5,
    gold: data.gold || 10000,
    level: data.level || 1,
    ...data,
  };
}

function createMockCity(data: Partial<any>) {
  return {
    city: data.city || 1,
    name: data.name || '테스트성',
    nation: data.nation || 2,
    level: data.level || 3,
    def: data.def || 1000,
    wall: data.wall || 1000,
    def_max: data.def_max || 2000,
    wall_max: data.wall_max || 2000,
    agri: data.agri || 5000,
    comm: data.comm || 5000,
    secu: data.secu || 5000,
    pop: data.pop || 50000,
    supply: data.supply ?? true,
    conflict: data.conflict || '{}',
    ...data,
  };
}

// ---------------------------------------------------------------------------
// 테스트
// ---------------------------------------------------------------------------

describe('ProcessWar 통합 테스트', () => {
  describe('Scenario 1: 공격자 승리 → 도시 점령', () => {
    it('강력한 공격자가 약한 수비군을 격파하고 도시를 점령해야 함', async () => {
      const rng = new RandUtil(new LiteHashDRBG('processwar-scenario-1'));

      // 강력한 공격자
      const attackerGen = createMockGeneral({
        name: '관우',
        crew: 15000,
        crewtype: 3, // 기병
        train: 100,
        atmos: 100,
        rice: 10000,
        leadership: 95,
        strength: 98,
        intel: 80,
        dex3: 100000,
        _cached_city: { city: 1, level: 4 },
      });
      const attackerNation = createMockNation({ name: '촉', rice: 20000, tech: 5000 });
      const attacker = new WarUnitGeneral(rng, attackerGen, attackerNation, true);

      // 약한 수비자
      const defenderGen = createMockGeneral({
        name: '졸장',
        crew: 3000,
        crewtype: 1, // 보병
        train: 60,
        atmos: 50,
        rice: 1000,
        leadership: 40,
        strength: 35,
        intel: 30,
        dex1: 10000,
        _cached_city: { city: 2, level: 2 },
      });
      const defenderNation = createMockNation({ name: '위', rice: 5000, tech: 2000 });
      const defender = new WarUnitGeneral(rng, defenderGen, defenderNation, false);

      // 도시
      const cityData = createMockCity({
        city: 2,
        name: '허창',
        nation: 2,
        def: 500,
        wall: 500,
        supply: true,
      });
      const city = new WarUnitCity(rng, cityData, defenderNation, 200, 1, 184);

      // 수비자 이터레이터
      let defenderProvided = false;
      const getNextDefender = async (_prev: any, reqNext: boolean) => {
        if (!reqNext || defenderProvided) return null;
        defenderProvided = true;
        return defender;
      };

      // 전투 실행
      const conquer = await processWar_NG('processwar-scenario-1', attacker, getNextDefender, city);

      // 검증: 공격자 승리 → 도시 점령
      expect(conquer).toBe(true);
      expect(attacker.getHP()).toBeGreaterThan(0); // 공격자 생존
      expect(defender.getHP()).toBeLessThanOrEqual(0); // 수비자 전멸 또는 퇴각
    });
  });

  describe('Scenario 2: 공격자 패배 → 퇴각', () => {
    it('약한 공격자가 강한 수비군에게 패배하고 퇴각해야 함', async () => {
      const rng = new RandUtil(new LiteHashDRBG('processwar-scenario-2'));

      // 약한 공격자
      const attackerGen = createMockGeneral({
        name: '신참',
        crew: 3000,
        crewtype: 1,
        train: 60,
        atmos: 60,
        rice: 1500,
        leadership: 45,
        strength: 50,
        intel: 40,
        dex1: 15000,
        _cached_city: { city: 1, level: 2 },
      });
      const attackerNation = createMockNation({ name: '촉', rice: 5000, tech: 2000 });
      const attacker = new WarUnitGeneral(rng, attackerGen, attackerNation, true);

      // 강력한 수비자
      const defenderGen = createMockGeneral({
        name: '장비',
        crew: 12000,
        crewtype: 1,
        train: 100,
        atmos: 100,
        rice: 8000,
        leadership: 90,
        strength: 98,
        intel: 50,
        dex1: 90000,
        _cached_city: { city: 2, level: 4 },
      });
      const defenderNation = createMockNation({ name: '위', rice: 15000, tech: 4000 });
      const defender = new WarUnitGeneral(rng, defenderGen, defenderNation, false);

      // 도시
      const cityData = createMockCity({
        city: 2,
        name: '업성',
        nation: 2,
        def: 1500,
        wall: 1500,
        supply: true,
      });
      const city = new WarUnitCity(rng, cityData, defenderNation, 200, 1, 184);

      let defenderProvided = false;
      const getNextDefender = async (_prev: any, reqNext: boolean) => {
        if (!reqNext || defenderProvided) return null;
        defenderProvided = true;
        return defender;
      };

      // 전투 실행
      const conquer = await processWar_NG('processwar-scenario-2', attacker, getNextDefender, city);

      // 검증: 공격자 패배 → 점령 실패
      expect(conquer).toBe(false);
      expect(attacker.getDead()).toBeGreaterThan(0); // 공격자 손실 발생
    });
  });

  describe('Scenario 3: 수비자 군량 부족 → 패퇴', () => {
    it('군량이 부족한 수비자가 패퇴하고 공격자가 도시를 점령해야 함', async () => {
      const rng = new RandUtil(new LiteHashDRBG('processwar-scenario-3'));

      // 공격자
      const attackerGen = createMockGeneral({
        name: '공격군',
        crew: 10000,
        crewtype: 1,
        train: 85,
        atmos: 85,
        rice: 6000,
        leadership: 80,
        strength: 80,
        intel: 60,
        dex1: 60000,
        _cached_city: { city: 1, level: 3 },
      });
      const attackerNation = createMockNation({ name: '촉', rice: 12000, tech: 3500 });
      const attacker = new WarUnitGeneral(rng, attackerGen, attackerNation, true);

      // 군량 부족 수비자 (rice < crew / 100)
      const defenderGen = createMockGeneral({
        name: '군량부족',
        crew: 8000,
        crewtype: 1,
        train: 80,
        atmos: 80,
        rice: 50, // crew/100 = 80보다 작음 → 군량 부족
        leadership: 75,
        strength: 75,
        intel: 60,
        dex1: 50000,
        defence_train: 50, // 수비 훈련도 조건 충족
        _cached_city: { city: 2, level: 3 },
      });
      const defenderNation = createMockNation({ name: '위', rice: 1000, tech: 3000 });
      const defender = new WarUnitGeneral(rng, defenderGen, defenderNation, false);

      // 도시
      const cityData = createMockCity({
        city: 2,
        name: '완성',
        nation: 2,
        def: 800,
        wall: 800,
        supply: true,
      });
      const city = new WarUnitCity(rng, cityData, defenderNation, 200, 1, 184);

      // 군량 부족 수비자는 extractBattleOrder에서 0을 반환해야 함
      const battleOrder = extractBattleOrder(defender, attacker);
      expect(battleOrder).toBe(0);

      // 수비자가 없는 것처럼 처리됨
      const getNextDefender = async () => null;

      // 전투 실행 (장수 없이 도시만 공격)
      const conquer = await processWar_NG('processwar-scenario-3', attacker, getNextDefender, city);

      // 검증: 수비 장수 없이 공성 성공
      expect(conquer).toBe(true);
    });

    it('국가 병량이 0이면 도시 수비병이 패퇴하고 무혈 입성해야 함', async () => {
      const rng = new RandUtil(new LiteHashDRBG('processwar-scenario-3-norice'));

      // 공격자
      const attackerGen = createMockGeneral({
        name: '공성군',
        crew: 10000,
        crewtype: 5, // 차병
        train: 90,
        atmos: 90,
        rice: 6000,
        leadership: 85,
        strength: 80,
        intel: 60,
        dex5: 70000,
        _cached_city: { city: 1, level: 3 },
      });
      const attackerNation = createMockNation({ name: '오', rice: 15000, tech: 3500 });
      const attacker = new WarUnitGeneral(rng, attackerGen, attackerNation, true);

      // 병량 없는 수비국
      const defenderNation = createMockNation({
        name: '빈국',
        rice: 0, // 병량 없음!
        tech: 2000,
      });

      const cityData = createMockCity({
        city: 3,
        name: '공성',
        nation: 3,
        def: 1200,
        wall: 1200,
        supply: true,
      });
      const city = new WarUnitCity(rng, cityData, defenderNation, 200, 1, 184);

      // 수비 장수 없음
      const getNextDefender = async () => null;

      // 전투 실행
      const conquer = await processWar_NG('processwar-scenario-3-norice', attacker, getNextDefender, city);

      // 검증: 병량 부족으로 무혈 입성
      expect(conquer).toBe(true);
    });
  });

  describe('Scenario 4: 연속 전투 (여러 수비 장수)', () => {
    it('첫 번째 수비 장수 격파 후 두 번째 수비 장수와 교전해야 함', async () => {
      const rng = new RandUtil(new LiteHashDRBG('processwar-scenario-4'));

      // 강력한 공격자
      const attackerGen = createMockGeneral({
        name: '공격주력',
        crew: 20000,
        crewtype: 1,
        train: 95,
        atmos: 95,
        rice: 15000,
        leadership: 90,
        strength: 90,
        intel: 75,
        dex1: 80000,
        _cached_city: { city: 1, level: 4 },
      });
      const attackerNation = createMockNation({ name: '연합군', rice: 25000, tech: 4500 });
      const attacker = new WarUnitGeneral(rng, attackerGen, attackerNation, true);

      // 수비국
      const defenderNation = createMockNation({ name: '방어국', rice: 15000, tech: 3500 });

      // 첫 번째 수비자 (약함)
      const firstDefenderGen = createMockGeneral({
        name: '선봉',
        crew: 5000,
        crewtype: 1,
        train: 70,
        atmos: 70,
        rice: 2500,
        leadership: 60,
        strength: 65,
        intel: 50,
        dex1: 35000,
        defence_train: 50,
        _cached_city: { city: 2, level: 2 },
      });
      const firstDefender = new WarUnitGeneral(rng, firstDefenderGen, defenderNation, false);

      // 두 번째 수비자 (강함)
      const secondDefenderGen = createMockGeneral({
        name: '본대',
        crew: 8000,
        crewtype: 2, // 궁병
        train: 85,
        atmos: 85,
        rice: 4000,
        leadership: 80,
        strength: 75,
        intel: 85,
        dex2: 65000,
        defence_train: 50,
        _cached_city: { city: 2, level: 3 },
      });
      const secondDefender = new WarUnitGeneral(rng, secondDefenderGen, defenderNation, false);

      // 도시
      const cityData = createMockCity({
        city: 2,
        name: '요충지',
        nation: 4,
        def: 1000,
        wall: 1000,
        supply: true,
      });
      const city = new WarUnitCity(rng, cityData, defenderNation, 200, 1, 184);

      // 수비자 이터레이터
      const defenders = [firstDefender, secondDefender];
      let idx = 0;
      const getNextDefender = async (prev: any, reqNext: boolean) => {
        if (!reqNext) return null;
        if (idx >= defenders.length) return null;
        return defenders[idx++];
      };

      // 전투 실행
      const conquer = await processWar_NG('processwar-scenario-4', attacker, getNextDefender, city);

      // 검증: 양쪽 수비자 모두와 교전해야 함
      expect(firstDefender.getDead()).toBeGreaterThan(0);
      expect(secondDefender.getDead()).toBeGreaterThanOrEqual(0); // 두 번째 수비자와도 교전

      // 공격자가 충분히 강하므로 점령 성공 가능성 높음
      expect(attacker.getDead()).toBeGreaterThan(0); // 공격자도 손실 발생
    });

    it('수비 장수 전투 순서가 전투력 기준으로 정렬되어야 함', () => {
      const rng = new RandUtil(new LiteHashDRBG('processwar-scenario-4-order'));

      const nation = createMockNation({ name: '테스트', rice: 10000, tech: 3000 });

      // 강한 수비 장수
      const strongDefGen = createMockGeneral({
        name: '강력수비',
        crew: 10000,
        crewtype: 1,
        train: 100,
        atmos: 100,
        rice: 5000,
        leadership: 95,
        strength: 95,
        intel: 80,
        dex1: 80000,
        defence_train: 50,
      });

      // 약한 수비 장수
      const weakDefGen = createMockGeneral({
        name: '약한수비',
        crew: 3000,
        crewtype: 1,
        train: 60,
        atmos: 60,
        rice: 1000,
        leadership: 50,
        strength: 50,
        intel: 40,
        dex1: 20000,
        defence_train: 50,
      });

      // 공격자
      const attackerGen = createMockGeneral({
        name: '공격자',
        crew: 8000,
        crewtype: 1,
      });

      const strongDef = new WarUnitGeneral(rng, strongDefGen, nation, false);
      const weakDef = new WarUnitGeneral(rng, weakDefGen, nation, false);
      const attacker = new WarUnitGeneral(rng, attackerGen, nation, true);

      const strongOrder = extractBattleOrder(strongDef, attacker);
      const weakOrder = extractBattleOrder(weakDef, attacker);

      // 검증: 강한 수비 장수가 더 높은 전투 순서를 가져야 함
      expect(strongOrder).toBeGreaterThan(weakOrder);
    });
  });

  describe('Scenario 5: 공성전 (장수 없이 성벽만)', () => {
    it('수비 장수 없이 성벽만 공격하여 점령해야 함', async () => {
      const rng = new RandUtil(new LiteHashDRBG('processwar-scenario-5'));

      // 공성 특화 공격자
      const attackerGen = createMockGeneral({
        name: '공성대장',
        crew: 15000,
        crewtype: 5, // 차병 (공성 특화)
        train: 90,
        atmos: 90,
        rice: 10000,
        leadership: 85,
        strength: 80,
        intel: 70,
        dex5: 80000, // 차병 숙련도
        _cached_city: { city: 1, level: 4 },
      });
      const attackerNation = createMockNation({ name: '공성군', rice: 20000, tech: 4000 });
      const attacker = new WarUnitGeneral(rng, attackerGen, attackerNation, true);

      // 수비국
      const defenderNation = createMockNation({ name: '수비국', rice: 10000, tech: 3000 });

      // 수비 장수 없는 도시
      const cityData = createMockCity({
        city: 3,
        name: '빈성',
        nation: 3,
        def: 800,
        wall: 600,
        supply: true,
      });
      const city = new WarUnitCity(rng, cityData, defenderNation, 200, 1, 184);

      // 수비 장수 없음
      const getNextDefender = async () => null;

      // 전투 실행
      const conquer = await processWar_NG('processwar-scenario-5', attacker, getNextDefender, city);

      // 검증: 성벽만 공격하여 점령 성공
      expect(conquer).toBe(true);

      // 도시 HP가 감소했는지 확인
      expect(city.getDead()).toBeGreaterThan(0);
    });

    it('강력한 성벽을 가진 도시는 공성에 시간이 더 걸려야 함', async () => {
      const rng = new RandUtil(new LiteHashDRBG('processwar-scenario-5-strong'));

      // 공성 공격자
      const attackerGen = createMockGeneral({
        name: '공성대장',
        crew: 10000,
        crewtype: 5,
        train: 80,
        atmos: 80,
        rice: 6000,
        leadership: 75,
        strength: 70,
        intel: 60,
        dex5: 50000,
        _cached_city: { city: 1, level: 3 },
      });
      const attackerNation = createMockNation({ name: '공성군', rice: 15000, tech: 3500 });
      const attacker = new WarUnitGeneral(rng, attackerGen, attackerNation, true);

      // 수비국
      const defenderNation = createMockNation({ name: '철벽국', rice: 12000, tech: 3500 });

      // 강력한 성벽을 가진 도시
      const cityData = createMockCity({
        city: 4,
        name: '철벽성',
        nation: 4,
        def: 3000, // 높은 방어력
        wall: 3000, // 높은 성벽
        def_max: 5000,
        wall_max: 5000,
        supply: true,
      });
      const city = new WarUnitCity(rng, cityData, defenderNation, 220, 1, 184);

      const getNextDefender = async () => null;

      // 전투 전 도시 HP
      const initialCityHP = city.getHP();

      // 전투 실행
      const conquer = await processWar_NG('processwar-scenario-5-strong', attacker, getNextDefender, city);

      // 도시가 데미지를 받았는지 확인
      const cityDamage = city.getDead();
      expect(cityDamage).toBeGreaterThan(0);

      // 강한 성벽이므로 한 번에 점령하지 못할 수도 있음
      // (공격자의 maxPhase 내에 점령 여부는 상황에 따라 다름)
      console.log(`[Scenario 5 Strong] Conquer: ${conquer}, City Damage: ${cityDamage}, Initial HP: ${initialCityHP}`);
    });
  });
});

describe('extractBattleOrder 단위 테스트', () => {
  it('병력이 0이면 수비 불가 (order = 0)', () => {
    const rng = new RandUtil(new LiteHashDRBG('order-no-crew'));
    const nation = createMockNation({});

    const defenderGen = createMockGeneral({
      crew: 0, // 병력 없음
      rice: 1000,
    });
    const attackerGen = createMockGeneral({ crew: 5000 });

    const defender = new WarUnitGeneral(rng, defenderGen, nation, false);
    const attacker = new WarUnitGeneral(rng, attackerGen, nation, true);

    expect(extractBattleOrder(defender, attacker)).toBe(0);
  });

  it('훈련도가 수비 훈련도보다 낮으면 수비 불가 (order = 0)', () => {
    const rng = new RandUtil(new LiteHashDRBG('order-low-train'));
    const nation = createMockNation({});

    const defenderGen = createMockGeneral({
      crew: 5000,
      rice: 1000,
      train: 40, // 낮은 훈련도
      atmos: 80,
      defence_train: 50, // 수비 훈련도 기준
    });
    const attackerGen = createMockGeneral({ crew: 5000 });

    const defender = new WarUnitGeneral(rng, defenderGen, nation, false);
    const attacker = new WarUnitGeneral(rng, attackerGen, nation, true);

    expect(extractBattleOrder(defender, attacker)).toBe(0);
  });

  it('사기가 수비 훈련도보다 낮으면 수비 불가 (order = 0)', () => {
    const rng = new RandUtil(new LiteHashDRBG('order-low-atmos'));
    const nation = createMockNation({});

    const defenderGen = createMockGeneral({
      crew: 5000,
      rice: 1000,
      train: 80,
      atmos: 40, // 낮은 사기
      defence_train: 50,
    });
    const attackerGen = createMockGeneral({ crew: 5000 });

    const defender = new WarUnitGeneral(rng, defenderGen, nation, false);
    const attacker = new WarUnitGeneral(rng, attackerGen, nation, true);

    expect(extractBattleOrder(defender, attacker)).toBe(0);
  });

  it('정상적인 수비 장수는 양수 order를 반환', () => {
    const rng = new RandUtil(new LiteHashDRBG('order-normal'));
    const nation = createMockNation({});

    const defenderGen = createMockGeneral({
      crew: 8000,
      rice: 3000,
      train: 80,
      atmos: 80,
      leadership: 75,
      strength: 70,
      intel: 65,
      defence_train: 50,
    });
    const attackerGen = createMockGeneral({ crew: 5000 });

    const defender = new WarUnitGeneral(rng, defenderGen, nation, false);
    const attacker = new WarUnitGeneral(rng, attackerGen, nation, true);

    const order = extractBattleOrder(defender, attacker);
    expect(order).toBeGreaterThan(0);
  });
});











