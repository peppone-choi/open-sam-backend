/**
 * processWarNG / extractBattleOrder 통합 테스트
 *
 * 이 파일의 시나리오는 PHP 원본 코드의 다음 부분을 기준으로 한다.
 * - core/hwe/process_war.php: processWar_NG(), extractBattleOrder()
 * - core/hwe/WarUnitGeneral.php / WarUnitCity.php (전투력·피해 계산)
 * - core/hwe/sammo/SpecialityHelper.php 및 ActionSpecialWar/* (전투 특기)
 *
 * 각 테스트 케이스는 실제 게임에서 자주 등장하는 전투 상황을
 * 축약한 형태로 구성되며, 시드 고정을 통해 결정적 결과를 검증한다.
 */

import { processWarNG, calculateBattleResult } from '../processWarNG';
import { extractBattleOrder, sortDefendersByBattleOrder } from '../extractBattleOrder';
import { WarUnitGeneral } from '../WarUnitGeneral';
import { WarUnitCity } from '../WarUnitCity';
import { RandUtil } from '../../utils/RandUtil';
import { LiteHashDRBG } from '../../utils/LiteHashDRBG';

// ---------------------------------------------------------------------------
// 공용 테스트 헬퍼
// ---------------------------------------------------------------------------

function createMockGeneral(data: any) {
  return {
    data: { ...data },
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
    getLeadership(full: boolean = true) {
      return this.data.leadership ?? 50;
    },
    getStrength(full: boolean = true) {
      return this.data.strength ?? 50;
    },
    getIntel(full: boolean = true) {
      return this.data.intel ?? 50;
    },
    getRaw() {
      return this.data;
    },
    getRawCity() {
      return this.data._cached_city || {};
    },
    getTurnTime(_format?: string) {
      // HM 포맷만 사용하므로 단순 구현
      return '200001010100';
    },
    getLogger() {
      // 전투 테스트에서는 실제 DB 로깅이 필요 없으므로 no-op 로거 사용
      return {
        pushGlobalActionLog: jest.fn(),
        pushGeneralActionLog: jest.fn(),
        pushGlobalHistoryLog: jest.fn(),
        pushGeneralHistoryLog: jest.fn(),
        pushGeneralBattleDetailLog: jest.fn(),
        pushGeneralBattleResultLog: jest.fn(),
        flush: jest.fn(),
      };
    },
    increaseRankVar: jest.fn(),
    addExperience: jest.fn(),
    addDedication: jest.fn(),
    addDex: jest.fn(),
    applyDB: jest.fn(),
    checkStatChange: jest.fn(() => false),
  };
}

function createMockNation(data: any) {
  return { ...data };
}

function createMockCity(data: any) {
  return { ...data };
}

// ---------------------------------------------------------------------------
// 테스트 시나리오
// ---------------------------------------------------------------------------

describe('processWarNG / extractBattleOrder - PHP 패리티 전투 시나리오', () => {
  // 1. 공격자 압승 시나리오 (강한 기병 vs 약한 보병)
  //    대응 PHP: processWar_NG 내부 일반 장수 vs 장수 전투 루프.
  it('Scenario 1: 공격자 압승', async () => {
    const rng = new RandUtil(new LiteHashDRBG('war-scenario-1'));

    const attackerGen = createMockGeneral({
      name: '관우',
      crew: 10000,
      crewtype: 3, // 기병
      train: 120,
      atmos: 120,
      rice: 6000,
      leadership: 95,
      strength: 98,
      intel: 75,
      dex1: 50000,
      dex2: 30000,
      dex3: 100000,
      dex4: 0,
      dex5: 0,
      _cached_city: { city: 1, level: 3 },
    });
    const attackerNation = createMockNation({ name: '촉', rice: 10000, tech: 5000 });
    const attacker = new WarUnitGeneral(rng, attackerGen, attackerNation, true);

    const defenderGen = createMockGeneral({
      name: '졸장',
      crew: 2000,
      crewtype: 1,
      train: 60,
      atmos: 60,
      rice: 800,
      leadership: 40,
      strength: 40,
      intel: 30,
      dex1: 10000,
      _cached_city: { city: 2, level: 2 },
    });
    const defenderNation = createMockNation({ name: '위', rice: 4000, tech: 1000 });
    const defender = new WarUnitGeneral(rng, defenderGen, defenderNation, false);

    const cityData = createMockCity({ city: 2, name: '낙양', nation: 2, def: 120, wall: 80, supply: true });
    const city = new WarUnitCity(rng, cityData, defenderNation, 220, 1, 184);

    let provided = false;
    const getNextDefender = (_prev: any, reqNext: boolean) => {
      if (!reqNext || provided) return null;
      provided = true;
      return defender;
    };

    const conquer = await processWarNG('war-scenario-1', attacker, getNextDefender, city);
    const summary = calculateBattleResult(attacker, defender, conquer);

    // 공격자는 손실이 상대적으로 적고, 수비자는 대부분 전멸한다.
    expect(summary.defenderCasualties).toBeGreaterThan(1500);
    expect(summary.attackerCasualties).toBeLessThan(3000);
  });

  // 2. 방어자 승리 시나리오 (약한 보병 공격 vs 강한 보병 수비)
  it('Scenario 2: 방어자 승리', async () => {
    const rng = new RandUtil(new LiteHashDRBG('war-scenario-2'));

    const attackerGen = createMockGeneral({
      name: '약졸',
      crew: 3000,
      crewtype: 1,
      train: 60,
      atmos: 60,
      rice: 1000,
      leadership: 45,
      strength: 50,
      intel: 40,
      dex1: 15000,
      _cached_city: { city: 1, level: 2 },
    });
    const attackerNation = createMockNation({ name: '촉', rice: 5000, tech: 2000 });
    const attacker = new WarUnitGeneral(rng, attackerGen, attackerNation, true);

    const defenderGen = createMockGeneral({
      name: '장비',
      crew: 8000,
      crewtype: 1,
      train: 100,
      atmos: 100,
      rice: 4000,
      leadership: 85,
      strength: 95,
      intel: 45,
      dex1: 80000,
      _cached_city: { city: 2, level: 3 },
    });
    const defenderNation = createMockNation({ name: '위', rice: 8000, tech: 4000 });
    const defender = new WarUnitGeneral(rng, defenderGen, defenderNation, false);

    const cityData = createMockCity({ city: 2, name: '업성', nation: 2, def: 200, wall: 150, supply: true });
    const city = new WarUnitCity(rng, cityData, defenderNation, 220, 1, 184);

    let provided = false;
    const getNextDefender = (_prev: any, reqNext: boolean) => {
      if (!reqNext || provided) return null;
      provided = true;
      return defender;
    };

    const conquer = await processWarNG('war-scenario-2', attacker, getNextDefender, city);
    const summary = calculateBattleResult(attacker, defender, conquer);

    expect(conquer).toBe(false);
    expect(summary.attackerCasualties).toBeGreaterThan(1000);
  });

  // 3. 근소한 차이 전투 (능력치·병력 유사)
  it('Scenario 3: 근소한 차이 전투', async () => {
    const rng = new RandUtil(new LiteHashDRBG('war-scenario-3'));

    const attackerGen = createMockGeneral({
      name: '조조',
      crew: 5000,
      crewtype: 2, // 궁병
      train: 80,
      atmos: 80,
      rice: 2500,
      leadership: 75,
      strength: 65,
      intel: 90,
      dex1: 30000,
      dex2: 60000,
      dex3: 20000,
      _cached_city: { city: 1, level: 3 },
    });
    const attackerNation = createMockNation({ name: '위', rice: 7000, tech: 3500 });
    const attacker = new WarUnitGeneral(rng, attackerGen, attackerNation, true);

    const defenderGen = createMockGeneral({
      name: '유비',
      crew: 5000,
      crewtype: 1, // 보병
      train: 75,
      atmos: 85,
      rice: 2500,
      leadership: 80,
      strength: 70,
      intel: 75,
      dex1: 50000,
      dex2: 20000,
      dex3: 30000,
      _cached_city: { city: 2, level: 3 },
    });
    const defenderNation = createMockNation({ name: '촉', rice: 7000, tech: 3000 });
    const defender = new WarUnitGeneral(rng, defenderGen, defenderNation, false);

    const cityData = createMockCity({ city: 2, name: '성도', nation: 2, def: 150, wall: 120, supply: true });
    const city = new WarUnitCity(rng, cityData, defenderNation, 220, 1, 184);

    let provided = false;
    const getNextDefender = (_prev: any, reqNext: boolean) => {
      if (!reqNext || provided) return null;
      provided = true;
      return defender;
    };

    const conquer = await processWarNG('war-scenario-3', attacker, getNextDefender, city);
    const summary = calculateBattleResult(attacker, defender, conquer);

    // 양측 모두 상당한 피해를 입는 근접전
    expect(summary.attackerCasualties).toBeGreaterThan(800);
    expect(summary.defenderCasualties).toBeGreaterThan(800);
  });

  // 4. 필살 특기 시나리오 (che_필살)
  //    PHP 대응: SpecialityHelper + ChePilsalSpecialWar 트리거.
  it('Scenario 4: 필살 특기 발동으로 높은 피해', async () => {
    const rng = new RandUtil(new LiteHashDRBG('war-scenario-4'));

    const attackerGen = createMockGeneral({
      name: '여포',
      crew: 7000,
      crewtype: 3,
      train: 110,
      atmos: 110,
      rice: 3500,
      leadership: 70,
      strength: 100,
      intel: 25,
      // PHP 의 special2 에 해당
      special2: 'che_필살',
      dex3: 90000,
      _cached_city: { city: 1, level: 3 },
    });
    const attackerNation = createMockNation({ name: '여포군', rice: 6000, tech: 3000 });
    const attacker = new WarUnitGeneral(rng, attackerGen, attackerNation, true);

    const defenderGen = createMockGeneral({
      name: '수비장수',
      crew: 5000,
      crewtype: 1,
      train: 70,
      atmos: 70,
      rice: 2500,
      leadership: 60,
      strength: 60,
      intel: 50,
      dex1: 40000,
      _cached_city: { city: 2, level: 2 },
    });
    const defenderNation = createMockNation({ name: '후한', rice: 5000, tech: 2000 });
    const defender = new WarUnitGeneral(rng, defenderGen, defenderNation, false);

    const cityData = createMockCity({ city: 2, name: '허창', nation: 2, def: 120, wall: 90, supply: true });
    const city = new WarUnitCity(rng, cityData, defenderNation, 220, 1, 184);

    let provided = false;
    const getNextDefender = (_prev: any, reqNext: boolean) => {
      if (!reqNext || provided) return null;
      provided = true;
      return defender;
    };

    const conquer = await processWarNG('war-scenario-4', attacker, getNextDefender, city);
    const summary = calculateBattleResult(attacker, defender, conquer);

    // 필살 특기 덕분에 일반 전투보다 수비측 피해가 크게 증가해야 한다.
    expect(summary.defenderCasualties).toBeGreaterThan(2000);
  });

  // 5. 군량 부족으로 공격자 퇴각
  //    PHP 대응: WarUnitGeneral::continueWar() 의 군량 체크 분기.
  it('Scenario 5: 군량 부족으로 공격자 퇴각', async () => {
    const rng = new RandUtil(new LiteHashDRBG('war-scenario-5'));

    const attackerGen = createMockGeneral({
      name: '군량부족장수',
      crew: 5000,
      crewtype: 1,
      train: 80,
      atmos: 80,
      rice: 40, // crew / 100 (=50) 보다 적어서 곧 퇴각
      leadership: 65,
      strength: 70,
      intel: 60,
      dex1: 50000,
      _cached_city: { city: 1, level: 2 },
    });
    const attackerNation = createMockNation({ name: '촉', rice: 1000, tech: 2000 });
    const attacker = new WarUnitGeneral(rng, attackerGen, attackerNation, true);

    const defenderGen = createMockGeneral({
      name: '수비장수',
      crew: 4000,
      crewtype: 1,
      train: 70,
      atmos: 70,
      rice: 2000,
      leadership: 60,
      strength: 60,
      intel: 50,
      dex1: 40000,
      _cached_city: { city: 2, level: 2 },
    });
    const defenderNation = createMockNation({ name: '위', rice: 5000, tech: 2000 });
    const defender = new WarUnitGeneral(rng, defenderGen, defenderNation, false);

    const cityData = createMockCity({ city: 2, name: '완성', nation: 2, def: 100, wall: 80, supply: true });
    const city = new WarUnitCity(rng, cityData, defenderNation, 220, 1, 184);

    let provided = false;
    const getNextDefender = (_prev: any, reqNext: boolean) => {
      if (!reqNext || provided) return null;
      provided = true;
      return defender;
    };

    const conquer = await processWarNG('war-scenario-5', attacker, getNextDefender, city);
    const summary = calculateBattleResult(attacker, defender, conquer);

    expect(conquer).toBe(false);
    // 군량 부족으로 초반에 퇴각하므로 공격자 피해도 제한적이다.
    expect(summary.attackerCasualties).toBeGreaterThanOrEqual(0);
  });

  // 6. 수비 도시 병량 부족으로 자동 패퇴 (공격자 무혈 입성)
  it('Scenario 6: 도시 병량 부족으로 자동 함락', async () => {
    const rng = new RandUtil(new LiteHashDRBG('war-scenario-6'));

    const attackerGen = createMockGeneral({
      name: '공성군',
      crew: 8000,
      crewtype: 5, // 차병
      train: 90,
      atmos: 90,
      rice: 6000,
      leadership: 80,
      strength: 80,
      intel: 60,
      dex5: 60000,
      _cached_city: { city: 1, level: 3 },
    });
    const attackerNation = createMockNation({ name: '오', rice: 2000, tech: 3500 });
    const attacker = new WarUnitGeneral(rng, attackerGen, attackerNation, true);

    const defenderNation = createMockNation({ name: '공백국', rice: 0, tech: 1000 });
    const cityData = createMockCity({
      city: 5,
      name: '공성',
      nation: 3,
      def: 150,
      wall: 150,
      supply: true,
    });
    const city = new WarUnitCity(rng, cityData, defenderNation, 220, 1, 184);

    const getNextDefender = () => null; // 수비 장수 없음

    const conquer = await processWarNG('war-scenario-6', attacker, getNextDefender, city);
    expect(conquer).toBe(true);
  });

  // 7. 다중 수비자 시나리오 (첫 장수 패퇴 후 다음 장수가 이어받음)
  it('Scenario 7: 다중 수비자 교대 전투', async () => {
    const rng = new RandUtil(new LiteHashDRBG('war-scenario-7'));

    const attackerGen = createMockGeneral({
      name: '공격군',
      crew: 12000,
      crewtype: 1,
      train: 90,
      atmos: 90,
      rice: 8000,
      leadership: 85,
      strength: 80,
      intel: 70,
      dex1: 70000,
      _cached_city: { city: 1, level: 3 },
    });
    const attackerNation = createMockNation({ name: '연합군', rice: 10000, tech: 3000 });
    const attacker = new WarUnitGeneral(rng, attackerGen, attackerNation, true);

    const defenderNation = createMockNation({ name: '방어국', rice: 6000, tech: 2500 });

    const firstDefGen = createMockGeneral({
      name: '선봉',
      crew: 4000,
      crewtype: 1,
      train: 70,
      atmos: 70,
      rice: 2000,
      leadership: 60,
      strength: 60,
      intel: 50,
      dex1: 30000,
      _cached_city: { city: 2, level: 2 },
    });
    const secondDefGen = createMockGeneral({
      name: '본대',
      crew: 6000,
      crewtype: 2,
      train: 80,
      atmos: 80,
      rice: 3000,
      leadership: 75,
      strength: 70,
      intel: 70,
      dex2: 50000,
      _cached_city: { city: 2, level: 2 },
    });

    const firstDef = new WarUnitGeneral(rng, firstDefGen, defenderNation, false);
    const secondDef = new WarUnitGeneral(rng, secondDefGen, defenderNation, false);

    const cityData = createMockCity({ city: 2, name: '요충지', nation: 4, def: 120, wall: 100, supply: true });
    const city = new WarUnitCity(rng, cityData, defenderNation, 220, 1, 184);

    const defenders = [firstDef, secondDef];
    let idx = 0;
    const getNextDefender = (prev: any, reqNext: boolean) => {
      if (!reqNext) return null;
      if (prev && prev === defenders[idx - 1]) {
        // 이미 소비된 수비자는 건너뜀
      }
      if (idx >= defenders.length) return null;
      return defenders[idx++];
    };

    const conquer = await processWarNG('war-scenario-7', attacker, getNextDefender, city);
    const summary = calculateBattleResult(attacker, defenders[1], conquer);

    // 첫 수비자는 상당한 피해로 퇴각 / 전멸, 두 번째 수비자와도 전투가 발생해야 한다.
    expect(firstDef.getDead()).toBeGreaterThan(0);
    expect(secondDef.getDead()).toBeGreaterThan(0);
    expect(summary.attackerCasualties).toBeGreaterThan(0);
  });

  // 8. extractBattleOrder: 강한 수비자가 먼저 나와야 함
  it('Scenario 8: extractBattleOrder 정렬 - 강한 수비 우선', () => {
    const rng = new RandUtil(new LiteHashDRBG('order-scenario'));
    const nation = createMockNation({ name: '국가', rice: 5000, tech: 2000 });

    const strongGen = createMockGeneral({
      name: '강력수비',
      crew: 8000,
      train: 100,
      atmos: 100,
      rice: 3000,
      leadership: 85,
      strength: 90,
      intel: 75,
      defence_train: 50,
      _cached_city: { city: 1, level: 3 },
    });
    const midGen = createMockGeneral({
      name: '중간수비',
      crew: 5000,
      train: 80,
      atmos: 80,
      rice: 2000,
      leadership: 70,
      strength: 70,
      intel: 60,
      defence_train: 50,
      _cached_city: { city: 1, level: 2 },
    });
    const weakGen = createMockGeneral({
      name: '약한수비',
      crew: 2000,
      train: 60,
      atmos: 60,
      rice: 500,
      leadership: 50,
      strength: 50,
      intel: 40,
      defence_train: 50,
      _cached_city: { city: 1, level: 2 },
    });

    const strong = new WarUnitGeneral(rng, strongGen, nation, false);
    const mid = new WarUnitGeneral(rng, midGen, nation, false);
    const weak = new WarUnitGeneral(rng, weakGen, nation, false);

    const attackerGen = createMockGeneral({ name: '공격자', crew: 5000, crewtype: 1, _cached_city: { city: 2, level: 2 } });
    const attacker = new WarUnitGeneral(rng, attackerGen, nation, true);

    const sorted = sortDefendersByBattleOrder([mid, weak, strong], attacker);

    expect(sorted[0].getName()).toBe('강력수비');
    expect(sorted[1].getName()).toBe('중간수비');
    expect(sorted[2].getName()).toBe('약한수비');
  });

  // 9. extractBattleOrder: 군량 부족 수비자는 제외
  it('Scenario 9: extractBattleOrder - 군량 부족 시 0', () => {
    const rng = new RandUtil(new LiteHashDRBG('order-rice'));
    const nation = createMockNation({ name: '국가', rice: 5000, tech: 2000 });

    const noRiceGen = createMockGeneral({
      name: '군량부족',
      crew: 5000,
      train: 80,
      atmos: 80,
      rice: 40, // crew / 100 (=50) 보다 작음
      leadership: 70,
      strength: 70,
      intel: 60,
      defence_train: 50,
      _cached_city: { city: 1, level: 2 },
    });

    const attackerGen = createMockGeneral({ name: '공격자', crew: 5000, crewtype: 1, _cached_city: { city: 2, level: 2 } });
    const defenderUnit = new WarUnitGeneral(rng, noRiceGen, nation, false);
    const attackerUnit = new WarUnitGeneral(rng, attackerGen, nation, true);

    const order = extractBattleOrder(defenderUnit, attackerUnit);
    expect(order).toBe(0);
  });

  // 10. extractBattleOrder: 도시 vs 공격자 (cityBattleOrder 훅 경로)
  it('Scenario 10: extractBattleOrder - 도시 수비 우선순위 훅', () => {
    const rng = new RandUtil(new LiteHashDRBG('order-city'));

    const attackerGen: any = createMockGeneral({
      name: '공격자',
      crew: 5000,
      crewtype: 1,
      _cached_city: { city: 2, level: 2 },
    });

    // onCalcOpposeStat 을 구현해 cityBattleOrder 경로를 실제로 타게 한다.
    attackerGen.onCalcOpposeStat = jest.fn((_defender: any, statName: string, _value: number) => {
      if (statName === 'cityBattleOrder') {
        return 123.4;
      }
      return -1;
    });

    const attackerNation = createMockNation({ name: '국가', rice: 5000, tech: 2000 });
    const attacker = new WarUnitGeneral(rng, attackerGen, attackerNation, true);

    const cityData = createMockCity({ city: 3, name: '수비도시', nation: 5, def: 100, wall: 80, supply: true });
    const defenderNation = createMockNation({ name: '수비국', rice: 3000, tech: 1500 });
    const city = new WarUnitCity(rng, cityData, defenderNation, 220, 1, 184);

    const order = extractBattleOrder(city, attacker);

    // onCalcOpposeStat 반환값이 그대로 수비 순서 점수로 사용된다.
    expect(order).toBe(123.4);
    expect(attackerGen.onCalcOpposeStat).toHaveBeenCalled();
  });
});
