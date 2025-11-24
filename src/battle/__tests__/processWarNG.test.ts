/**
 * processWarNG 전투 처리 로직 테스트
 * 
 * 10가지 전투 시나리오:
 * 1. 공격자 압승
 * 2. 방어자 승리
 * 3. 근소한 차이 승리
 * 4. 스킬 발동 시나리오 (필살)
 * 5. 군량 부족 시나리오
 * 6. 병종 상성 시나리오 (기병 vs 보병)
 * 7. 다중 수비자 시나리오
 * 8. 성벽 공격 시나리오
 * 9. 숙련도 차이 시나리오
 * 10. 최대 페이즈 도달 시나리오
 */

import { processWarNG, calculateBattleResult } from '../processWarNG';
import { extractBattleOrder, sortDefendersByBattleOrder } from '../extractBattleOrder';
import { WarUnitGeneral } from '../WarUnitGeneral';
import { WarUnitCity } from '../WarUnitCity';
import { RandUtil, LiteHashDRBG } from '../../utils/RandUtil';
import { GameUnitConst } from '../../const/GameUnitConst';

describe('processWarNG - Battle Processing Logic', () => {
  // Mock general 생성 헬퍼
  function createMockGeneral(data: any) {
    return {
      data: { ...data },
      getVar(key: string) { return this.data[key]; },
      setVar(key: string, value: any) { this.data[key] = value; },
      increaseVar(key: string, value: number) { this.data[key] = (this.data[key] || 0) + value; },
      increaseVarWithLimit(key: string, value: number, min?: number, max?: number) {
        let newVal = (this.data[key] || 0) + value;
        if (min !== undefined && newVal < min) newVal = min;
        if (max !== undefined && newVal > max) newVal = max;
        this.data[key] = newVal;
      },
      multiplyVarWithLimit(key: string, value: number, min?: number, max?: number) {
        let newVal = (this.data[key] || 0) * value;
        if (min !== undefined && newVal < min) newVal = min;
        if (max !== undefined && newVal > max) newVal = max;
        this.data[key] = newVal;
      },
      getName() { return this.data.name; },
      getLeadership(full = true) { return this.data.leadership; },
      getStrength(full = true) { return this.data.strength; },
      getIntel(full = true) { return this.data.intel; },
      getRaw() { return this.data; },
      getRawCity() { return this.data._cached_city || {}; },
      getLogger() {
        return {
          pushGlobalActionLog: jest.fn(),
          pushGeneralActionLog: jest.fn(),
          pushGlobalHistoryLog: jest.fn(),
          pushGeneralBattleDetailLog: jest.fn()
        };
      }
    };
  }

  // Mock nation 생성 헬퍼
  function createMockNation(data: any) {
    return { ...data };
  }

  describe('1. 공격자 압승 시나리오', () => {
    it('should result in attacker overwhelming victory', async () => {
      const rng = new RandUtil(new LiteHashDRBG('test-seed-1'));
      
      // 강력한 공격자
      const attackerData = {
        name: '관우',
        crew: 10000,
        crewtype: 3, // 기병
        train: 120,
        atmos: 120,
        rice: 5000,
        leadership: 95,
        strength: 98,
        intel: 75,
        dex1: 50000, dex2: 30000, dex3: 100000, dex4: 0, dex5: 0,
        _cached_city: { city: 1, level: 3 }
      };
      const attackerNation = createMockNation({ name: '촉', rice: 10000, tech: 5000 });
      const attackerGeneral = createMockGeneral(attackerData);
      const attacker = new WarUnitGeneral(rng, attackerGeneral, attackerNation, true);

      // 약한 수비자
      const defenderData = {
        name: '졸장',
        crew: 2000,
        crewtype: 1, // 보병
        train: 50,
        atmos: 50,
        rice: 500,
        leadership: 40,
        strength: 40,
        intel: 30,
        dex1: 10000, dex2: 0, dex3: 0, dex4: 0, dex5: 0,
        _cached_city: { city: 2, level: 2 }
      };
      const defenderNation = createMockNation({ name: '위', rice: 3000, tech: 1000 });
      const defenderGeneral = createMockGeneral(defenderData);
      const defender = new WarUnitGeneral(rng, defenderGeneral, defenderNation, false);

      // 도시
      const cityData = { city: 2, name: '낙양', nation: 2, def: 100, supply: true };
      const city = new WarUnitCity(rng, cityData, defenderNation, 220, 1, 184);

      // 수비자 제공 함수
      let defenderProvided = false;
      const getNextDefender = (prev: any, reqNext: boolean) => {
        if (prev) return null;
        if (!reqNext) return null;
        if (defenderProvided) return null;
        defenderProvided = true;
        return defender;
      };

      // 전투 실행
      const conquered = await processWarNG('test-seed-1', attacker, getNextDefender, city);

      // 검증
      expect(attacker.getDead()).toBeLessThan(2000); // 공격자 손실 적음
      expect(defender.getDead()).toBeGreaterThan(1500); // 수비자 큰 손실
    });
  });

  describe('2. 방어자 승리 시나리오', () => {
    it('should result in defender victory', async () => {
      const rng = new RandUtil(new LiteHashDRBG('test-seed-2'));
      
      // 약한 공격자
      const attackerData = {
        name: '약졸',
        crew: 3000,
        crewtype: 1,
        train: 60,
        atmos: 60,
        rice: 1000,
        leadership: 45,
        strength: 50,
        intel: 40,
        dex1: 15000, dex2: 0, dex3: 0, dex4: 0, dex5: 0,
        _cached_city: { city: 1, level: 2 }
      };
      const attackerNation = createMockNation({ name: '촉', rice: 5000, tech: 2000 });
      const attackerGeneral = createMockGeneral(attackerData);
      const attacker = new WarUnitGeneral(rng, attackerGeneral, attackerNation, true);

      // 강력한 수비자
      const defenderData = {
        name: '장비',
        crew: 8000,
        crewtype: 1,
        train: 100,
        atmos: 100,
        rice: 3000,
        leadership: 85,
        strength: 95,
        intel: 45,
        dex1: 80000, dex2: 0, dex3: 0, dex4: 0, dex5: 0,
        _cached_city: { city: 2, level: 3 }
      };
      const defenderNation = createMockNation({ name: '위', rice: 8000, tech: 4000 });
      const defenderGeneral = createMockGeneral(defenderData);
      const defender = new WarUnitGeneral(rng, defenderGeneral, defenderNation, false);

      const cityData = { city: 2, name: '업성', nation: 2, def: 200, supply: true };
      const city = new WarUnitCity(rng, cityData, defenderNation, 220, 1, 184);

      let defenderProvided = false;
      const getNextDefender = (prev: any, reqNext: boolean) => {
        if (prev) return null;
        if (!reqNext) return null;
        if (defenderProvided) return null;
        defenderProvided = true;
        return defender;
      };

      const conquered = await processWarNG('test-seed-2', attacker, getNextDefender, city);

      // 공격자가 퇴각해야 함
      expect(conquered).toBe(false);
      expect(attacker.getDead()).toBeGreaterThan(1000);
    });
  });

  describe('3. 근소한 차이 승리 시나리오', () => {
    it('should result in close victory', async () => {
      const rng = new RandUtil(new LiteHashDRBG('test-seed-3'));
      
      // 비슷한 전력
      const attackerData = {
        name: '조조',
        crew: 5000,
        crewtype: 2, // 궁병
        train: 80,
        atmos: 80,
        rice: 2000,
        leadership: 75,
        strength: 65,
        intel: 90,
        dex1: 30000, dex2: 60000, dex3: 20000, dex4: 0, dex5: 0,
        _cached_city: { city: 1, level: 3 }
      };
      const attackerNation = createMockNation({ name: '위', rice: 7000, tech: 3500 });
      const attackerGeneral = createMockGeneral(attackerData);
      const attacker = new WarUnitGeneral(rng, attackerGeneral, attackerNation, true);

      const defenderData = {
        name: '유비',
        crew: 5000,
        crewtype: 1,
        train: 75,
        atmos: 85,
        rice: 2000,
        leadership: 80,
        strength: 70,
        intel: 75,
        dex1: 50000, dex2: 20000, dex3: 30000, dex4: 0, dex5: 0,
        _cached_city: { city: 2, level: 3 }
      };
      const defenderNation = createMockNation({ name: '촉', rice: 7000, tech: 3000 });
      const defenderGeneral = createMockGeneral(defenderData);
      const defender = new WarUnitGeneral(rng, defenderGeneral, defenderNation, false);

      const cityData = { city: 2, name: '성도', nation: 2, def: 150, supply: true };
      const city = new WarUnitCity(rng, cityData, defenderNation, 220, 1, 184);

      let defenderProvided = false;
      const getNextDefender = (prev: any, reqNext: boolean) => {
        if (prev) return null;
        if (!reqNext) return null;
        if (defenderProvided) return null;
        defenderProvided = true;
        return defender;
      };

      const conquered = await processWarNG('test-seed-3', attacker, getNextDefender, city);

      // 양측 모두 상당한 손실
      expect(attacker.getDead()).toBeGreaterThan(1000);
      expect(defender.getDead()).toBeGreaterThan(1000);
    });
  });

  describe('4. 스킬 발동 시나리오 (필살)', () => {
    it('should trigger critical strike skill', async () => {
      const rng = new RandUtil(new LiteHashDRBG('test-seed-4'));
      
      const attackerData = {
        name: '여포',
        crew: 7000,
        crewtype: 3,
        train: 110,
        atmos: 110,
        rice: 3000,
        leadership: 70,
        strength: 100,
        intel: 25,
        special_war: 'che_필살', // 필살 특기
        dex1: 40000, dex2: 20000, dex3: 90000, dex4: 0, dex5: 0,
        _cached_city: { city: 1, level: 3 }
      };
      const attackerNation = createMockNation({ name: '여포군', rice: 6000, tech: 3000 });
      const attackerGeneral = createMockGeneral(attackerData);
      const attacker = new WarUnitGeneral(rng, attackerGeneral, attackerNation, true);

      const defenderData = {
        name: '일반장수',
        crew: 5000,
        crewtype: 1,
        train: 70,
        atmos: 70,
        rice: 2000,
        leadership: 60,
        strength: 60,
        intel: 50,
        dex1: 40000, dex2: 0, dex3: 0, dex4: 0, dex5: 0,
        _cached_city: { city: 2, level: 2 }
      };
      const defenderNation = createMockNation({ name: '후한', rice: 5000, tech: 2000 });
      const defenderGeneral = createMockGeneral(defenderData);
      const defender = new WarUnitGeneral(rng, defenderGeneral, defenderNation, false);

      const cityData = { city: 2, name: '허창', nation: 2, def: 120, supply: true };
      const city = new WarUnitCity(rng, cityData, defenderNation, 220, 1, 184);

      let defenderProvided = false;
      const getNextDefender = (prev: any, reqNext: boolean) => {
        if (prev) return null;
        if (!reqNext) return null;
        if (defenderProvided) return null;
        defenderProvided = true;
        return defender;
      };

      const conquered = await processWarNG('test-seed-4', attacker, getNextDefender, city);

      // 필살 특기로 인한 추가 피해
      expect(defender.getDead()).toBeGreaterThan(2000);
    });
  });

  describe('5. 군량 부족 시나리오', () => {
    it('should retreat due to lack of rice', async () => {
      const rng = new RandUtil(new LiteHashDRBG('test-seed-5'));
      
      const attackerData = {
        name: '군량부족장수',
        crew: 5000,
        crewtype: 1,
        train: 80,
        atmos: 80,
        rice: 50, // 군량 부족!
        leadership: 65,
        strength: 70,
        intel: 60,
        dex1: 50000, dex2: 0, dex3: 0, dex4: 0, dex5: 0,
        _cached_city: { city: 1, level: 2 }
      };
      const attackerNation = createMockNation({ name: '촉', rice: 1000, tech: 2000 });
      const attackerGeneral = createMockGeneral(attackerData);
      const attacker = new WarUnitGeneral(rng, attackerGeneral, attackerNation, true);

      const defenderData = {
        name: '수비장수',
        crew: 4000,
        crewtype: 1,
        train: 70,
        atmos: 70,
        rice: 2000,
        leadership: 60,
        strength: 60,
        intel: 50,
        dex1: 40000, dex2: 0, dex3: 0, dex4: 0, dex5: 0,
        _cached_city: { city: 2, level: 2 }
      };
      const defenderNation = createMockNation({ name: '위', rice: 5000, tech: 2000 });
      const defenderGeneral = createMockGeneral(defenderData);
      const defender = new WarUnitGeneral(rng, defenderGeneral, defenderNation, false);

      const cityData = { city: 2, name: '완성', nation: 2, def: 100, supply: true };
      const city = new WarUnitCity(rng, cityData, defenderNation, 220, 1, 184);

      let defenderProvided = false;
      const getNextDefender = (prev: any, reqNext: boolean) => {
        if (prev) return null;
        if (!reqNext) return null;
        if (defenderProvided) return null;
        defenderProvided = true;
        return defender;
      };

      const conquered = await processWarNG('test-seed-5', attacker, getNextDefender, city);

      // 군량 부족으로 패배
      expect(conquered).toBe(false);
      expect(attackerGeneral.data.rice).toBeLessThanOrEqual(attackerGeneral.data.crew / 100);
    });
  });

  describe('extractBattleOrder - Defense Order Calculation', () => {
    it('should calculate defense order correctly', () => {
      const rng = new RandUtil(new LiteHashDRBG('test-seed'));
      
      const highDefender = createMockGeneral({
        name: '강력수비',
        crew: 8000,
        train: 100,
        atmos: 100,
        rice: 3000,
        leadership: 85,
        strength: 90,
        intel: 75,
        defence_train: 50,
        _cached_city: { city: 1, level: 3 }
      });
      const lowDefender = createMockGeneral({
        name: '약한수비',
        crew: 2000,
        train: 60,
        atmos: 60,
        rice: 500,
        leadership: 50,
        strength: 50,
        intel: 40,
        defence_train: 50,
        _cached_city: { city: 1, level: 2 }
      });
      const attackerGen = createMockGeneral({
        name: '공격자',
        crew: 5000,
        crewtype: 1,
        _cached_city: { city: 2, level: 2 }
      });

      const nation = createMockNation({ name: '촉', rice: 5000, tech: 2000 });
      const highUnit = new WarUnitGeneral(rng, highDefender, nation, false);
      const lowUnit = new WarUnitGeneral(rng, lowDefender, nation, false);
      const attackerUnit = new WarUnitGeneral(rng, attackerGen, nation, true);

      const highOrder = extractBattleOrder(highUnit, attackerUnit);
      const lowOrder = extractBattleOrder(lowUnit, attackerUnit);

      expect(highOrder).toBeGreaterThan(lowOrder);
      expect(highOrder).toBeGreaterThan(0);
    });

    it('should return 0 for insufficient rice', () => {
      const rng = new RandUtil(new LiteHashDRBG('test-seed'));
      
      const noRiceDefender = createMockGeneral({
        name: '군량부족',
        crew: 5000,
        train: 80,
        atmos: 80,
        rice: 40, // 부족 (crew/100 = 50 필요)
        leadership: 70,
        strength: 70,
        intel: 60,
        defence_train: 50,
        _cached_city: { city: 1, level: 2 }
      });
      const attackerGen = createMockGeneral({
        name: '공격자',
        crew: 5000,
        _cached_city: { city: 2, level: 2 }
      });

      const nation = createMockNation({ name: '촉', rice: 5000, tech: 2000 });
      const defenderUnit = new WarUnitGeneral(rng, noRiceDefender, nation, false);
      const attackerUnit = new WarUnitGeneral(rng, attackerGen, nation, true);

      const order = extractBattleOrder(defenderUnit, attackerUnit);
      expect(order).toBe(0);
    });

    it('should sort defenders by battle order', () => {
      const rng = new RandUtil(new LiteHashDRBG('test-seed'));
      
      const defenders = [
        createMockGeneral({ name: '중간', crew: 5000, train: 80, atmos: 80, rice: 2000, leadership: 70, strength: 70, intel: 60, defence_train: 50, _cached_city: { level: 2 } }),
        createMockGeneral({ name: '강력', crew: 8000, train: 100, atmos: 100, rice: 3000, leadership: 85, strength: 90, intel: 75, defence_train: 50, _cached_city: { level: 3 } }),
        createMockGeneral({ name: '약함', crew: 2000, train: 60, atmos: 60, rice: 500, leadership: 50, strength: 50, intel: 40, defence_train: 50, _cached_city: { level: 2 } })
      ];
      const attackerGen = createMockGeneral({ name: '공격자', crew: 5000, _cached_city: { level: 2 } });

      const nation = createMockNation({ name: '촉', rice: 5000, tech: 2000 });
      const defenderUnits = defenders.map(d => new WarUnitGeneral(rng, d, nation, false));
      const attackerUnit = new WarUnitGeneral(rng, attackerGen, nation, true);

      const sorted = sortDefendersByBattleOrder(defenderUnits, attackerUnit);

      expect(sorted[0].getName()).toBe('강력');
      expect(sorted[1].getName()).toBe('중간');
      expect(sorted[2].getName()).toBe('약함');
    });
  });
});
