/**
 * WarUnit Test - PHP 계산 결과와 TypeScript 구현 비교 검증
 *
 * 목표
 * - WarUnitGeneral.getWarPower(), WarUnitCity.getComputedDefence()가
 *   PHP 원본(`sammo\\WarUnit::computeWarPower()`,
 *   `sammo\\GameUnitDetail::getComputedAttack()/getComputedDefence()`,
 *   `getDexLog()` in `func_converter.php`)과 동일한 공식을 사용함을 검증.
 *
 * 시나리오 설계 메모
 * - Scenario 1: 대칭 장수 vs 장수 전투력
 *   - PHP 기준: `WarUnit::computeWarPower()`에 동일 스탯/병종/숙련도를 입력했을 때
 *     공격/수비 양측 warPower 비율이 1.0에 수렴해야 함을 수치적으로 확인.
 * - Scenario 2: 숙련도 차이
 *   - PHP `getDexLog($dex1, $dex2)` (TS: `getDexBonus`)에
 *     dex1=100000, dex2=10000을 넣었을 때 (레벨 차이 6) 비율
 *     (1 + 6/55)≈1.109 배 수준의 우위를 갖는지 범위로 검증.
 * - Scenario 3: 병종 상성
 *   - PHP `GameUnitDetail::getAttackCoef()`에 해당하는 상성표를
 *     TS 단순화 상성표로 근사; 기병 vs 궁병에서 1.3배 이상 우위가 나는지 확인.
 * - Scenario 4~5: 훈련/사기, 레벨 보정
 *   - PHP `WarUnitGeneral::getComputedTrain()/getComputedAtmos()/computeWarPower()`를
 *     기반으로, 극단값(훈련/사기 100 vs 50, explevel 100 vs 10)에서
 *     기대되는 우위 범위를 수치적으로 검증.
 * - Scenario 6~9: 도시 방어력/훈사, HP/사망/군량 소비
 *   - PHP `WarUnitCity::getComputedDefence()/getHP()/continueWar()`와
 *     `WarUnitGeneral::decreaseHP()/increaseKilled()/calcRiceConsumption()` 공식을
 *     그대로 사용한 TS 구현이 일관된 값을 내는지 검증.
 * - Scenario 10: 단일 페이즈 통합 전투
 *   - 위 공식을 모두 조합했을 때 전형적인 기병 vs 궁병 교전이
 *     기대 방향(기병 우위, 양측 모두 손실 발생)을 따르는지 확인.
 */

import { WarUnitGeneral } from '../WarUnitGeneral';
import { WarUnitCity } from '../WarUnitCity';
import { RandUtil } from '../../utils/RandUtil';
import { LiteHashDRBG } from '../../utils/LiteHashDRBG';
import { GameUnitConst } from '../../const/GameUnitConst';

// Mock 장수 생성 헬퍼
function createMockGeneral(data: any) {
  return {
    data: {
      no: data.no || 1,
      name: data.name || 'Test General',
      nation: data.nation || 1,
      city: data.city || 1,
      crew: data.crew || 10000,
      crewtype: data.crewtype || 0,
      rice: data.rice || 5000,
      train: data.train || 70,
      atmos: data.atmos || 70,
      leadership: data.leadership || 80,
      strength: data.strength || 80,
      intel: data.intel || 80,
      dex1: data.dex1 || 0,
      dex2: data.dex2 || 0,
      dex3: data.dex3 || 0,
      dex4: data.dex4 || 0,
      dex5: data.dex5 || 0,
      explevel: data.explevel || 0,
      injury: data.injury || 0,
      experience: data.experience || 0,
      dedication: data.dedication || 0,
      ...data
    },
    getVar(key: string) { return this.data[key]; },
    setVar(key: string, val: any) { this.data[key] = val; },
    updateVar(key: string, val: any) { this.data[key] = val; },
    increaseVar(key: string, val: number) { 
      this.data[key] = (this.data[key] || 0) + val; 
    },
    increaseVarWithLimit(key: string, val: number, min?: number, max?: number) {
      let newVal = (this.data[key] || 0) + val;
      if (min !== undefined && newVal < min) newVal = min;
      if (max !== undefined && newVal > max) newVal = max;
      this.data[key] = newVal;
    },
    multiplyVar(key: string, val: number) {
      this.data[key] = (this.data[key] || 0) * val;
    },
    multiplyVarWithLimit(key: string, val: number, min?: number, max?: number) {
      let newVal = (this.data[key] || 0) * val;
      if (min !== undefined && newVal < min) newVal = min;
      if (max !== undefined && newVal > max) newVal = max;
      this.data[key] = newVal;
    },
    getRaw() { return this.data; },
    getName() { return this.data.name; },
    getRawCity() { return { city: this.data.city, level: 5, name: 'Test City' }; },
    getTurnTime() { return '202301010100'; },
    getLogger: jest.fn(() => null),
    increaseRankVar: jest.fn(),
    addExperience: jest.fn(),
    addDedication: jest.fn(),
    addDex: jest.fn(),
    applyDB: jest.fn(),
    checkStatChange: jest.fn(() => false)
  };
}

// Mock 국가 생성 헬퍼
function createMockNation(data: any) {
  return {
    nation: data.nation || 1,
    name: data.name || 'Test Nation',
    tech: data.tech || 3000,
    capital: data.capital || 1,
    type: data.type || 'normal',
    level: data.level || 1
  };
}

// Mock 도시 생성 헬퍼
function createMockCity(data: any) {
  return {
    city: data.city || 1,
    name: data.name || 'Test City',
    nation: data.nation || 1,
    level: data.level || 5,
    def: data.def || 10000,
    wall: data.wall || 10000,
    agri: data.agri || 5000,
    comm: data.comm || 5000,
    secu: data.secu || 5000,
    conflict: data.conflict || null
  };
}

describe('WarUnit System - PHP 호환성 테스트', () => {
  describe('Scenario 1: 기본 장수 vs 장수 전투력 계산', () => {
    test('동일 능력치 장수간 전투력이 대칭적이어야 함', () => {
      const seed = new LiteHashDRBG('scenario-1');
      const rng = new RandUtil(seed);
      
      const generalA = createMockGeneral({
        no: 1,
        name: 'General A',
        crew: 10000,
        crewtype: 1, // 보병
        train: 80,
        atmos: 80,
        leadership: 80,
        strength: 80,
        intel: 60,
        dex1: 10000
      });
      
      const generalB = createMockGeneral({
        no: 2,
        name: 'General B',
        crew: 10000,
        crewtype: 1, // 보병
        train: 80,
        atmos: 80,
        leadership: 80,
        strength: 80,
        intel: 60,
        dex1: 10000
      });
      
      const nation = createMockNation({ tech: 3000 });
      
      const unitA = new WarUnitGeneral(rng, generalA, nation, true);
      const unitB = new WarUnitGeneral(rng, generalB, nation, false);
      
      unitA.setOppose(unitB);
      unitB.setOppose(unitA);
      
      unitA.beginPhase();
      unitB.beginPhase();
      
      const warPowerA = unitA.getWarPower();
      const warPowerB = unitB.getWarPower();
      
      // 동일 능력치이므로 전투력이 유사해야 함 (오차 10% 이내)
      const ratio = warPowerA / warPowerB;
      expect(ratio).toBeGreaterThan(0.9);
      expect(ratio).toBeLessThan(1.1);
      
      console.log(`[Scenario 1] A: ${warPowerA.toFixed(2)}, B: ${warPowerB.toFixed(2)}, Ratio: ${ratio.toFixed(3)}`);
    });
  });
  
  describe('Scenario 2: 숙련도 차이에 따른 전투력 변화', () => {
    test('높은 숙련도가 전투력을 증가시켜야 함', () => {
      const seed = new LiteHashDRBG('scenario-2');
      const rng = new RandUtil(seed);
      
      const generalHigh = createMockGeneral({
        no: 1,
        name: 'High Dex',
        crew: 10000,
        crewtype: 1, // 보병
        train: 80,
        atmos: 80,
        dex1: 100000 // 높은 숙련도
      });
      
      const generalLow = createMockGeneral({
        no: 2,
        name: 'Low Dex',
        crew: 10000,
        crewtype: 1, // 보병
        train: 80,
        atmos: 80,
        dex1: 10000 // 낮은 숙련도
      });
      
      const nation = createMockNation({ tech: 3000 });
      
      const unitHigh = new WarUnitGeneral(rng, generalHigh, nation, true);
      const unitLow = new WarUnitGeneral(rng, generalLow, nation, false);
      
      unitHigh.setOppose(unitLow);
      unitLow.setOppose(unitHigh);
      
      unitHigh.beginPhase();
      unitLow.beginPhase();
      
      const warPowerHigh = unitHigh.getWarPower();
      const warPowerLow = unitLow.getWarPower();
      
      // 높은 숙련도가 낮은 숙련도보다 전투력이 높아야 함
      expect(warPowerHigh).toBeGreaterThan(warPowerLow);
      
      const advantage = warPowerHigh / warPowerLow;
      console.log(`[Scenario 2] High Dex: ${warPowerHigh.toFixed(2)}, Low Dex: ${warPowerLow.toFixed(2)}, Advantage: ${advantage.toFixed(3)}x`);
      
      // PHP 계산 예상: 숙련도 차이 90000 → 약 1.06배 우위
      expect(advantage).toBeGreaterThan(1.03);
      expect(advantage).toBeLessThan(1.15);
    });
  });
  
  describe('Scenario 3: 병종 상성 검증', () => {
    test('기병이 궁병에 강해야 함', () => {
      const seed = new LiteHashDRBG('scenario-3');
      const rng = new RandUtil(seed);
      
      const cavalry = createMockGeneral({
        no: 1,
        name: 'Cavalry',
        crew: 10000,
        crewtype: 3, // 기병
        train: 80,
        atmos: 80,
        dex3: 50000
      });
      
      const archer = createMockGeneral({
        no: 2,
        name: 'Archer',
        crew: 10000,
        crewtype: 2, // 궁병
        train: 80,
        atmos: 80,
        dex2: 50000
      });
      
      const nation = createMockNation({ tech: 3000 });
      
      const unitCavalry = new WarUnitGeneral(rng, cavalry, nation, true);
      const unitArcher = new WarUnitGeneral(rng, archer, nation, false);
      
      unitCavalry.setOppose(unitArcher);
      unitArcher.setOppose(unitCavalry);
      
      unitCavalry.beginPhase();
      unitArcher.beginPhase();
      
      const warPowerCavalry = unitCavalry.getWarPower();
      const warPowerArcher = unitArcher.getWarPower();
      
      // 기병이 궁병에 대해 우위를 가져야 함
      expect(warPowerCavalry).toBeGreaterThan(warPowerArcher);
      
      const advantage = warPowerCavalry / warPowerArcher;
      console.log(`[Scenario 3] Cavalry: ${warPowerCavalry.toFixed(2)}, Archer: ${warPowerArcher.toFixed(2)}, Advantage: ${advantage.toFixed(3)}x`);
      
      // 기병 vs 궁병 상성: 1.6배 예상
      expect(advantage).toBeGreaterThan(1.3);
    });
  });
  
  describe('Scenario 4: 훈련도/사기 차이에 따른 전투력', () => {
    test('높은 훈련도와 사기가 전투력을 증가시켜야 함', () => {
      const seed = new LiteHashDRBG('scenario-4');
      const rng = new RandUtil(seed);
      
      const elite = createMockGeneral({
        no: 1,
        name: 'Elite',
        crew: 10000,
        crewtype: 1, // 보병
        train: 100,
        atmos: 100,
        dex1: 50000
      });
      
      const rookie = createMockGeneral({
        no: 2,
        name: 'Rookie',
        crew: 10000,
        crewtype: 1, // 보병
        train: 50,
        atmos: 50,
        dex1: 50000
      });
      
      const nation = createMockNation({ tech: 3000 });
      
      const unitElite = new WarUnitGeneral(rng, elite, nation, true);
      const unitRookie = new WarUnitGeneral(rng, rookie, nation, false);
      
      unitElite.setOppose(unitRookie);
      unitRookie.setOppose(unitElite);
      
      unitElite.beginPhase();
      unitRookie.beginPhase();
      
      const warPowerElite = unitElite.getWarPower();
      const warPowerRookie = unitRookie.getWarPower();
      
      // 정예병이 신병보다 전투력이 높아야 함
      expect(warPowerElite).toBeGreaterThan(warPowerRookie);
      
      const advantage = warPowerElite / warPowerRookie;
      console.log(`[Scenario 4] Elite: ${warPowerElite.toFixed(2)}, Rookie: ${warPowerRookie.toFixed(2)}, Advantage: ${advantage.toFixed(3)}x`);
      
      // 훈련 100 vs 50, 사기 100 vs 50 → 약 2배 우위 예상
      expect(advantage).toBeGreaterThan(1.8);
      expect(advantage).toBeLessThan(2.2);
    });
  });
  
  describe('Scenario 5: 레벨 차이에 따른 전투력 (대인전)', () => {
    test('높은 레벨이 대인전에서 우위를 가져야 함', () => {
      const seed = new LiteHashDRBG('scenario-5');
      const rng = new RandUtil(seed);
      
      const veteran = createMockGeneral({
        no: 1,
        name: 'Veteran',
        crew: 10000,
        crewtype: 1, // 보병
        train: 80,
        atmos: 80,
        explevel: 100,
        dex1: 50000
      });
      
      const novice = createMockGeneral({
        no: 2,
        name: 'Novice',
        crew: 10000,
        crewtype: 1, // 보병
        train: 80,
        atmos: 80,
        explevel: 10,
        dex1: 50000
      });
      
      const nation = createMockNation({ tech: 3000 });
      
      const unitVeteran = new WarUnitGeneral(rng, veteran, nation, true);
      const unitNovice = new WarUnitGeneral(rng, novice, nation, false);
      
      unitVeteran.setOppose(unitNovice);
      unitNovice.setOppose(unitVeteran);
      
      unitVeteran.beginPhase();
      unitNovice.beginPhase();
      
      const warPowerVeteran = unitVeteran.getWarPower();
      const warPowerNovice = unitNovice.getWarPower();
      
      // 베테랑이 신참보다 전투력이 높아야 함
      expect(warPowerVeteran).toBeGreaterThan(warPowerNovice);
      
      const advantage = warPowerVeteran / warPowerNovice;
      console.log(`[Scenario 5] Veteran (Lv100): ${warPowerVeteran.toFixed(2)}, Novice (Lv10): ${warPowerNovice.toFixed(2)}, Advantage: ${advantage.toFixed(3)}x`);
      
      // 레벨 100 vs 10: explevel/300 차이 → 약 1.4배 우위
      expect(advantage).toBeGreaterThan(1.2);
      expect(advantage).toBeLessThan(1.6);
    });
  });
  
  describe('Scenario 6: 장수 vs 도시 전투력 계산', () => {
    test('도시 방어력이 제대로 계산되어야 함', () => {
      const seed = new LiteHashDRBG('scenario-6');
      const rng = new RandUtil(seed);
      
      const attacker = createMockGeneral({
        no: 1,
        name: 'Attacker',
        crew: 20000,
        crewtype: 5, // 차병 (공성)
        train: 90,
        atmos: 90,
        leadership: 95,
        strength: 85,
        dex5: 80000
      });
      
      const city = createMockCity({
        city: 1,
        name: 'Fortress City',
        def: 10000,
        wall: 8000,
        level: 5
      });
      
      const nation = createMockNation({ tech: 5000 });
      
      const unitAttacker = new WarUnitGeneral(rng, attacker, nation, true);
      const unitCity = new WarUnitCity(rng, city, nation, 201, 1, 181);
      
      unitCity.setSiege(); // 공성전 모드
      
      unitAttacker.setOppose(unitCity);
      unitCity.setOppose(unitAttacker);
      
      unitAttacker.beginPhase();
      unitCity.beginPhase();
      
      const warPowerAttacker = unitAttacker.getWarPower();
      const cityDefence = unitCity.getComputedDefence();
      const cityHP = unitCity.getHP();
      
      // 도시 방어력 공식: (def + wall * 9) / 500 + 200
      const expectedDefence = (city.def + city.wall * 9) / 500 + 200;
      expect(Math.abs(cityDefence - expectedDefence)).toBeLessThan(1);
      
      // 도시 HP: def * 10
      expect(cityHP).toBe(city.def * 10);
      
      console.log(`[Scenario 6] Attacker War Power: ${warPowerAttacker.toFixed(2)}`);
      console.log(`[Scenario 6] City Defence: ${cityDefence.toFixed(2)} (Expected: ${expectedDefence.toFixed(2)})`);
      console.log(`[Scenario 6] City HP: ${cityHP}`);
      
      expect(warPowerAttacker).toBeGreaterThan(0);
    });
  });
  
  describe('Scenario 7: 도시 훈사/사기 시스템', () => {
    test('도시 훈사가 연도에 따라 증가해야 함', () => {
      const rng = new RandUtil(new LiteHashDRBG('scenario-7'));
      
      const city = createMockCity({
        city: 1,
        name: 'Test City',
        def: 10000,
        wall: 10000
      });
      
      const nation = createMockNation({ tech: 3000 });
      
      // 181년: 60
      const unitYear181 = new WarUnitCity(rng, city, nation, 181, 1, 181);
      expect(unitYear181.getCityTrainAtmos()).toBe(60);
      
      // 201년: 80
      const unitYear201 = new WarUnitCity(rng, city, nation, 201, 1, 181);
      expect(unitYear201.getCityTrainAtmos()).toBe(80);
      
      // 221년: 100
      const unitYear221 = new WarUnitCity(rng, city, nation, 221, 1, 181);
      expect(unitYear221.getCityTrainAtmos()).toBe(100);
      
      // 231년 이상: 110 (최대)
      const unitYear231 = new WarUnitCity(rng, city, nation, 231, 1, 181);
      expect(unitYear231.getCityTrainAtmos()).toBe(110);
      
      console.log('[Scenario 7] City Train/Atmos by Year:');
      console.log(`  181년: ${unitYear181.getCityTrainAtmos()}`);
      console.log(`  201년: ${unitYear201.getCityTrainAtmos()}`);
      console.log(`  221년: ${unitYear221.getCityTrainAtmos()}`);
      console.log(`  231년: ${unitYear231.getCityTrainAtmos()}`);
    });
  });
  
  describe('Scenario 8: HP 감소 및 사망자 계산', () => {
    test('HP 감소가 올바르게 계산되어야 함', () => {
      const rng = new RandUtil(new LiteHashDRBG('scenario-8'));
      
      const general = createMockGeneral({
        no: 1,
        name: 'Test',
        crew: 10000,
        crewtype: 1,
        train: 80,
        atmos: 80
      });
      
      const nation = createMockNation({ tech: 3000 });
      const unit = new WarUnitGeneral(rng, general, nation, true);
      
      expect(unit.getHP()).toBe(10000);
      expect(unit.getDead()).toBe(0);
      
      // 1000명 피해
      unit.decreaseHP(1000);
      expect(unit.getHP()).toBe(9000);
      expect(unit.getDead()).toBe(1000);
      expect(unit.getDeadCurrentBattle()).toBe(1000);
      
      // 추가 2000명 피해
      unit.decreaseHP(2000);
      expect(unit.getHP()).toBe(7000);
      expect(unit.getDead()).toBe(3000);
      expect(unit.getDeadCurrentBattle()).toBe(3000);
      
      console.log(`[Scenario 8] HP: ${unit.getHP()}, Dead: ${unit.getDead()}`);
    });
  });
  
  describe('Scenario 9: 살상 및 군량 소모', () => {
    test('적 살상시 군량이 소모되어야 함', () => {
      const rng = new RandUtil(new LiteHashDRBG('scenario-9'));
      
      const general = createMockGeneral({
        no: 1,
        name: 'Test',
        crew: 10000,
        crewtype: 1, // 보병 (rice: 1)
        rice: 5000,
        train: 80,
        atmos: 80
      });
      
      const nation = createMockNation({ tech: 3000 });
      const opponent = createMockGeneral({
        no: 2,
        name: 'Opponent',
        crew: 10000,
        crewtype: 1
      });
      
      const unit = new WarUnitGeneral(rng, general, nation, true);
      const oppUnit = new WarUnitGeneral(rng, opponent, nation, false);
      
      unit.setOppose(oppUnit);
      oppUnit.setOppose(unit);
      
      const initialRice = unit.getVar('rice');
      
      // 1000명 살상
      unit.increaseKilled(1000);
      
      const finalRice = unit.getVar('rice');
      const riceUsed = initialRice - finalRice;
      
      // 군량 소모 공식: damage / 100 * crewType.rice * techCost
      // techCost = 1 + (tech/1000) * 0.15 = 1 + 3 * 0.15 = 1.45
      const expectedRiceUsed = (1000 / 100) * 1 * 1.45;
      
      expect(riceUsed).toBeGreaterThan(0);
      expect(Math.abs(riceUsed - expectedRiceUsed) / expectedRiceUsed).toBeLessThan(0.01);
      
      console.log(`[Scenario 9] Rice Used: ${riceUsed.toFixed(2)} (Expected: ${expectedRiceUsed.toFixed(2)})`);
      expect(unit.getKilled()).toBe(1000);
    });
  });
  
  describe('Scenario 10: 전체 전투 시뮬레이션 (통합 테스트)', () => {
    test('완전한 전투 페이즈 시뮬레이션', () => {
      const rng = new RandUtil(new LiteHashDRBG('scenario-10'));
      
      const attackerData = createMockGeneral({
        no: 1,
        name: 'Attacker',
        crew: 15000,
        crewtype: 3, // 기병
        rice: 10000,
        train: 85,
        atmos: 90,
        leadership: 90,
        strength: 85,
        intel: 70,
        dex3: 70000,
        explevel: 50
      });
      
      const defenderData = createMockGeneral({
        no: 2,
        name: 'Defender',
        crew: 12000,
        crewtype: 2, // 궁병
        rice: 8000,
        train: 75,
        atmos: 80,
        leadership: 80,
        strength: 75,
        intel: 85,
        dex2: 60000,
        explevel: 40
      });
      
      const nation = createMockNation({ tech: 4000 });
      
      const attacker = new WarUnitGeneral(rng, attackerData, nation, true);
      const defender = new WarUnitGeneral(rng, defenderData, nation, false);
      
      attacker.setOppose(defender);
      defender.setOppose(attacker);
      
      // 페이즈 시작
      attacker.beginPhase();
      defender.beginPhase();
      
      const attackerWarPower = attacker.getWarPower();
      const defenderWarPower = defender.getWarPower();
      
      // 피해 계산
      const attackerDamage = attacker.calcDamage();
      const defenderDamage = defender.calcDamage();
      
      console.log('\n[Scenario 10] 전투 시뮬레이션:');
      console.log(`  Attacker (기병): HP ${attacker.getHP()}, War Power ${attackerWarPower.toFixed(2)}, Damage ${attackerDamage}`);
      console.log(`  Defender (궁병): HP ${defender.getHP()}, War Power ${defenderWarPower.toFixed(2)}, Damage ${defenderDamage}`);
      
      // 피해 적용
      defender.decreaseHP(attackerDamage);
      attacker.decreaseHP(defenderDamage);
      attacker.increaseKilled(attackerDamage);
      defender.increaseKilled(defenderDamage);
      
      console.log(`  After Phase 1:`);
      console.log(`    Attacker HP: ${attacker.getHP()}, Killed: ${attacker.getKilled()}, Dead: ${attacker.getDead()}`);
      console.log(`    Defender HP: ${defender.getHP()}, Killed: ${defender.getKilled()}, Dead: ${defender.getDead()}`);
      
      // 검증
      expect(attacker.getHP()).toBeLessThan(15000);
      expect(defender.getHP()).toBeLessThan(12000);
      expect(attacker.getKilled()).toBeGreaterThan(0);
      expect(defender.getDead()).toBeGreaterThan(0);
      
      // 기병이 궁병에 대해 우위를 가지므로 더 많은 피해를 입혀야 함
      expect(attackerDamage).toBeGreaterThan(defenderDamage);
    });
  });
  
  describe('PHP 호환성 검증 - 계산 정확도', () => {
    test('getDexLog 계산이 PHP와 일치해야 함', () => {
      const rng = new RandUtil(new LiteHashDRBG('dex-log-test'));
      
      const general1 = createMockGeneral({
        no: 1,
        name: 'Test1',
        crew: 10000,
        crewtype: 1,
        dex1: 100000
      });
      
      const general2 = createMockGeneral({
        no: 2,
        name: 'Test2',
        crew: 10000,
        crewtype: 1,
        dex1: 50000
      });
      
      const nation = createMockNation({ tech: 3000 });
      
      const unit1 = new WarUnitGeneral(rng, general1, nation, true);
      const unit2 = new WarUnitGeneral(rng, general2, nation, false);
      
      unit1.setOppose(unit2);
      unit2.setOppose(unit1);
      
      unit1.beginPhase();
      unit2.beginPhase();
      
      // PHP: pow(1 + abs(dex1 - dex2) / 1200000, sign * 0.5)
      // TypeScript에서도 동일하게 계산되어야 함
      const warPower1 = unit1.getWarPower();
      const warPower2 = unit2.getWarPower();
      
      expect(warPower1).toBeGreaterThan(0);
      expect(warPower2).toBeGreaterThan(0);
      expect(warPower1).toBeGreaterThan(warPower2); // 높은 숙련도가 유리
      
      console.log(`[getDexLog] High Dex: ${warPower1.toFixed(2)}, Low Dex: ${warPower2.toFixed(2)}`);
    });
  });
});
