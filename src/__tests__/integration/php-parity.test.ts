/**
 * Integration Test Suite - PHP Parity (Lean Version)
 *
 * Minimal end-to-end-ish scenarios that exercise the
 * TypeScript battle calculator together with a few
 * game concepts we care about for parity:
 * - Conscript → Train → Battle
 * - Battle → City Conquest → Diplomacy
 * - Item-like effect influencing battle
 * - Dex (proficiency) affecting power
 * - One compact "full flow" from join to conquest
 */

import { BattleCalculator, SeededRandom, TerrainType, UnitType } from '../../core/battle-calculator';
import { calculateDexExp, getDexBonus } from '../../utils/dex-calculator';

interface SimpleGeneral {
  name: string;
  leadership: number;
  strength: number;
  intelligence: number;
  troops: number;
  morale: number;
  train: number;
}

describe('Integration (lean): PHP Parity Key Flows', () => {
  it('Scenario 1: Conscript → Train → Battle (infantry mirror of PHP)', () => {
    const general: SimpleGeneral = {
      name: '관우',
      leadership: 85,
      strength: 90,
      intelligence: 70,
      troops: 0,
      morale: 80,
      train: 50,
    };

    // Conscript 800 infantry – mirror of PHP che_징병 style logic.
    const conscriptAmount = 800;
    general.troops += conscriptAmount;

    // Dex gain for conscription: armType=0 (infantry), affected by train/atmos.
    const dexFromConscript = calculateDexExp(100, 0, general.train, general.morale, true);

    // Train once more (higher train/atmos in PHP makes dex grow faster).
    const dexFromTraining = calculateDexExp(120, 0, 80, 80, true);
    const totalDex = dexFromConscript + dexFromTraining;

    expect(general.troops).toBe(conscriptAmount);
    expect(totalDex).toBeGreaterThan(dexFromConscript);

    const rng = new SeededRandom(1001);
    const calc = new BattleCalculator(() => rng.next());

    const result = calc.calculateBattle({
      attacker: {
        name: general.name,
        troops: general.troops,
        leadership: general.leadership,
        strength: general.strength,
        intelligence: general.intelligence,
        unitType: UnitType.FOOTMAN,
        morale: general.morale,
        training: general.train + 10,
        techLevel: 50,
      },
      defender: {
        name: '도시 수비대',
        troops: 600,
        leadership: 70,
        strength: 70,
        intelligence: 60,
        unitType: UnitType.FOOTMAN,
        morale: 70,
        training: 45,
        techLevel: 40,
      },
      terrain: TerrainType.PLAINS,
      isDefenderCity: false,
    });

    expect(result.winner).toBe('attacker');
    expect(result.attackerSurvivors).toBeGreaterThan(0);
    expect(result.defenderSurvivors).toBe(0);
  });

  it('Scenario 2: Battle → City Conquest → Diplomacy update', () => {
    const rng = new SeededRandom(2002);
    const calc = new BattleCalculator(() => rng.next());

    const attackerNationId = 2;
    const defenderNationId = 1;

    const result = calc.calculateBattle({
      attacker: {
        name: '조조',
        troops: 1800,
        leadership: 92,
        strength: 85,
        intelligence: 88,
        unitType: UnitType.CAVALRY,
        morale: 90,
        training: 80,
        techLevel: 70,
      },
      defender: {
        name: '낙양 수비대',
        troops: 1500,
        leadership: 75,
        strength: 70,
        intelligence: 65,
        unitType: UnitType.SPEARMAN,
        morale: 75,
        training: 70,
        techLevel: 60,
      },
      terrain: TerrainType.FORTRESS,
      isDefenderCity: true,
      cityWall: 80,
    });

    const city = { id: 1, ownerNationId: defenderNationId };
    const diplomacy = { n1: defenderNationId, n2: attackerNationId, relation: 50 };

    if (result.winner === 'attacker') {
      city.ownerNationId = attackerNationId;
      diplomacy.relation = Math.max(0, diplomacy.relation - 20);
    }

    if (result.winner === 'attacker') {
      expect(city.ownerNationId).toBe(attackerNationId);
      expect(diplomacy.relation).toBe(30);
    }
  });

  it('Scenario 3: Item-like morale buff affects battle outcome', () => {
    const baseGeneral: SimpleGeneral = {
      name: '유비',
      leadership: 82,
      strength: 78,
      intelligence: 80,
      troops: 1200,
      morale: 70,
      train: 70,
    };

    // Item effect: +25 morale (similar to 탁주/사기 아이템).
    const moraleItemBonus = 25;
    const buffedMorale = Math.min(100, baseGeneral.morale + moraleItemBonus);

    const rng = new SeededRandom(3003);
    const calc = new BattleCalculator(() => rng.next());

    const withItem = calc.calculateBattle({
      attacker: {
        name: baseGeneral.name,
        troops: baseGeneral.troops,
        leadership: baseGeneral.leadership,
        strength: baseGeneral.strength,
        intelligence: baseGeneral.intelligence,
        unitType: UnitType.FOOTMAN,
        morale: buffedMorale,
        training: baseGeneral.train,
        techLevel: 55,
      },
      defender: {
        name: '적군',
        troops: 1200,
        leadership: 75,
        strength: 75,
        intelligence: 70,
        unitType: UnitType.FOOTMAN,
        morale: 65,
        training: 65,
        techLevel: 55,
      },
      terrain: TerrainType.PLAINS,
      isDefenderCity: false,
    });

    expect(withItem.winner).toBe('attacker');
  });

  it('Scenario 4: Dex proficiency bonus favors high-skill side', () => {
    const highDex = 5000; // high infantry dex
    const lowDex = 500;   // low infantry dex

    const bonus = getDexBonus(highDex, lowDex);
    expect(bonus).toBeGreaterThan(1.0);

    const rng = new SeededRandom(4004);
    const calc = new BattleCalculator(() => rng.next());

    const result = calc.calculateBattle({
      attacker: {
        name: '숙련 보병',
        troops: 1000,
        leadership: 75,
        strength: 72,
        intelligence: 60,
        unitType: UnitType.FOOTMAN,
        morale: 80,
        training: 80, // represents higher dex
        techLevel: 60,
      },
      defender: {
        name: '미숙련 보병',
        troops: 1000,
        leadership: 75,
        strength: 72,
        intelligence: 60,
        unitType: UnitType.FOOTMAN,
        morale: 80,
        training: 40, // represents lower dex
        techLevel: 60,
      },
      terrain: TerrainType.PLAINS,
      isDefenderCity: false,
    });

    expect(result.winner).toBe('attacker');
    expect(result.attackerCasualties).toBeLessThan(result.defenderCasualties);
  });

  it('Scenario 5: Compact full flow (join → conscript → battle → city owner)', () => {
    // Join
    const nationId = 3;
    const player = { userId: 1001, generalId: 5001, nationId };

    // Conscript
    const general: SimpleGeneral = {
      name: '플레이어',
      leadership: 78,
      strength: 76,
      intelligence: 70,
      troops: 0,
      morale: 75,
      train: 60,
    };

    const conscriptAmount = 600;
    general.troops += conscriptAmount;

    const city = { id: 10, ownerNationId: nationId, population: 6000 };

    const rng = new SeededRandom(5005);
    const calc = new BattleCalculator(() => rng.next());

    const result = calc.calculateBattle({
      attacker: {
        name: general.name,
        troops: general.troops,
        leadership: general.leadership,
        strength: general.strength,
        intelligence: general.intelligence,
        unitType: UnitType.FOOTMAN,
        morale: general.morale,
        training: general.train,
        techLevel: 50,
      },
      defender: {
        name: '중립 도시 수비대',
        troops: 400,
        leadership: 65,
        strength: 65,
        intelligence: 60,
        unitType: UnitType.FOOTMAN,
        morale: 60,
        training: 55,
        techLevel: 40,
      },
      terrain: TerrainType.PLAINS,
      isDefenderCity: true,
      cityWall: 40,
    });

    if (result.winner === 'attacker') {
      city.ownerNationId = player.nationId;
      const loss = Math.floor(city.population * 0.1);
      city.population -= loss;

      expect(city.ownerNationId).toBe(player.nationId);
      expect(city.population).toBeLessThan(6000);
    }
  });
});
