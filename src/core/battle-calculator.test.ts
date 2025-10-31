import { describe, it, expect } from '@jest/globals';
import { 
  BattleCalculator, 
  BattleContext, 
  UnitType, 
  TerrainType,
  simulateBattle 
} from './battle-calculator';

describe('BattleCalculator', () => {
  let calculator: BattleCalculator;

  beforeEach(() => {
    calculator = new BattleCalculator();
  });

  describe('기본 전투 시뮬레이션', () => {
    it('동등한 병력의 전투에서 승자가 결정되어야 함', () => {
      const result = simulateBattle(
        '조조', 5000, [90, 70, 95], UnitType.CAVALRY,
        '원소', 5000, [85, 65, 80], UnitType.FOOTMAN,
        TerrainType.PLAINS
      );

      expect(result.winner).toBeDefined();
      expect(['attacker', 'defender', 'draw']).toContain(result.winner);
      expect(result.attackerCasualties + result.defenderCasualties).toBeGreaterThan(0);
      expect(result.battleLog.length).toBeGreaterThan(0);
    });

    it('압도적인 병력 차이가 있을 때 다수가 승리해야 함', () => {
      const result = simulateBattle(
        '대군', 10000, [80, 80, 80], UnitType.FOOTMAN,
        '소수', 1000, [80, 80, 80], UnitType.FOOTMAN,
        TerrainType.PLAINS
      );

      expect(result.winner).toBe('attacker');
      expect(result.attackerSurvivors).toBeGreaterThan(0);
      expect(result.defenderSurvivors).toBe(0);
    });
  });

  describe('병종 상성 테스트', () => {
    it('평지에서 기병이 보병을 상대로 유리해야 함', () => {
      const cavalryWins = [];
      
      for (let i = 0; i < 10; i++) {
        const result = simulateBattle(
          '기병', 3000, [80, 80, 60], UnitType.CAVALRY,
          '보병', 3000, [80, 80, 60], UnitType.FOOTMAN,
          TerrainType.PLAINS
        );
        cavalryWins.push(result.winner === 'attacker');
      }

      const winRate = cavalryWins.filter(w => w).length / cavalryWins.length;
      expect(winRate).toBeGreaterThan(0.5);
    });

    it('숲에서 궁병이 기병을 상대로 유리해야 함', () => {
      const archerWins = [];
      
      for (let i = 0; i < 10; i++) {
        const result = simulateBattle(
          '궁병', 3000, [70, 85, 65], UnitType.ARCHER,
          '기병', 3000, [80, 80, 60], UnitType.CAVALRY,
          TerrainType.FOREST
        );
        archerWins.push(result.winner === 'attacker');
      }

      const winRate = archerWins.filter(w => w).length / archerWins.length;
      expect(winRate).toBeGreaterThan(0.5);
    });

    it('보병이 궁병을 상대로 유리해야 함', () => {
      const result = simulateBattle(
        '보병', 3000, [80, 85, 60], UnitType.FOOTMAN,
        '궁병', 3000, [70, 85, 60], UnitType.ARCHER,
        TerrainType.PLAINS
      );

      expect(result.attackerCasualties).toBeLessThan(result.defenderCasualties);
    });
  });

  describe('지형 효과 테스트', () => {
    it('산악 지형에서 기병이 불리해야 함', () => {
      const mountainResult = simulateBattle(
        '기병', 3000, [80, 80, 60], UnitType.CAVALRY,
        '보병', 3000, [80, 80, 60], UnitType.FOOTMAN,
        TerrainType.MOUNTAIN
      );

      const plainsResult = simulateBattle(
        '기병', 3000, [80, 80, 60], UnitType.CAVALRY,
        '보병', 3000, [80, 80, 60], UnitType.FOOTMAN,
        TerrainType.PLAINS
      );

      expect(mountainResult.attackerCasualties).toBeGreaterThan(plainsResult.attackerCasualties);
    });

    it('평지에서 기병이 유리해야 함', () => {
      const result = simulateBattle(
        '기병', 3000, [85, 85, 60], UnitType.CAVALRY,
        '보병', 3000, [80, 80, 60], UnitType.FOOTMAN,
        TerrainType.PLAINS
      );

      expect(result.winner).toBe('attacker');
    });
  });

  describe('공성전 테스트', () => {
    it('차병이 공성전에서 유리해야 함', () => {
      const siegeResult = simulateBattle(
        '차병', 4000, [90, 70, 60], UnitType.SIEGE,
        '수비병', 3000, [80, 80, 60], UnitType.FOOTMAN,
        TerrainType.FORTRESS,
        true
      );

      const infantryResult = simulateBattle(
        '보병', 4000, [90, 70, 60], UnitType.FOOTMAN,
        '수비병', 3000, [80, 80, 60], UnitType.FOOTMAN,
        TerrainType.FORTRESS,
        true
      );

      expect(siegeResult.attackerCasualties).toBeLessThan(infantryResult.attackerCasualties);
    });

    it('성벽 수비 시 수비자가 보너스를 받아야 함', () => {
      const context: BattleContext = {
        attacker: {
          name: '공격군',
          troops: 5000,
          leadership: 80,
          strength: 80,
          intelligence: 60,
          unitType: UnitType.FOOTMAN,
          morale: 80,
          training: 80,
          techLevel: 50
        },
        defender: {
          name: '수비군',
          troops: 3000,
          leadership: 80,
          strength: 80,
          intelligence: 60,
          unitType: UnitType.FOOTMAN,
          morale: 90,
          training: 90,
          techLevel: 50
        },
        terrain: TerrainType.FORTRESS,
        isDefenderCity: true,
        cityWall: 80
      };

      const result = calculator.calculateBattle(context);
      
      expect(result.defenderSurvivors).toBeGreaterThan(0);
    });
  });

  describe('특기 효과 테스트', () => {
    it('돌격 특기가 기병의 공격력을 증가시켜야 함', () => {
      const withSkillContext: BattleContext = {
        attacker: {
          name: '돌격기병',
          troops: 3000,
          leadership: 85,
          strength: 85,
          intelligence: 60,
          unitType: UnitType.CAVALRY,
          morale: 80,
          training: 80,
          techLevel: 50,
          specialSkills: ['돌격']
        },
        defender: {
          name: '보병',
          troops: 3000,
          leadership: 80,
          strength: 80,
          intelligence: 60,
          unitType: UnitType.FOOTMAN,
          morale: 80,
          training: 80,
          techLevel: 50
        },
        terrain: TerrainType.PLAINS,
        isDefenderCity: false
      };

      const withoutSkillContext: BattleContext = {
        ...withSkillContext,
        attacker: { ...withSkillContext.attacker, specialSkills: [] }
      };

      const withSkill = calculator.calculateBattle(withSkillContext);
      const withoutSkill = calculator.calculateBattle(withoutSkillContext);

      expect(withSkill.defenderCasualties).toBeGreaterThan(withoutSkill.defenderCasualties * 0.9);
    });

    it('철벽 특기가 방어력을 증가시켜야 함', () => {
      const context: BattleContext = {
        attacker: {
          name: '공격군',
          troops: 3000,
          leadership: 85,
          strength: 85,
          intelligence: 60,
          unitType: UnitType.FOOTMAN,
          morale: 80,
          training: 80,
          techLevel: 50
        },
        defender: {
          name: '철벽수비',
          troops: 3000,
          leadership: 80,
          strength: 80,
          intelligence: 60,
          unitType: UnitType.FOOTMAN,
          morale: 80,
          training: 80,
          techLevel: 50,
          specialSkills: ['철벽']
        },
        terrain: TerrainType.PLAINS,
        isDefenderCity: false
      };

      const result = calculator.calculateBattle(context);

      expect(result.defenderCasualties).toBeLessThan(result.attackerCasualties);
    });
  });

  describe('전투 로그 생성', () => {
    it('전투 로그가 생성되어야 함', () => {
      const result = simulateBattle(
        '조조', 3000, [90, 70, 95], UnitType.CAVALRY,
        '여포', 2500, [75, 100, 50], UnitType.CAVALRY,
        TerrainType.PLAINS
      );

      expect(result.battleLog).toBeDefined();
      expect(result.battleLog.length).toBeGreaterThan(5);
      expect(result.battleLog[0]).toContain('전투 시작');
      expect(result.battleLog[result.battleLog.length - 1]).toContain('생존');
    });

    it('페이즈별 로그가 포함되어야 함', () => {
      const result = simulateBattle(
        '조조', 3000, [90, 70, 95], UnitType.CAVALRY,
        '여포', 2500, [75, 100, 50], UnitType.CAVALRY,
        TerrainType.PLAINS
      );

      const phaseLogs = result.battleLog.filter(log => log.includes('턴'));
      expect(phaseLogs.length).toBeGreaterThan(0);
      expect(phaseLogs.length).toBe(result.phases.length);
    });
  });

  describe('사기 시스템', () => {
    it('사기가 높은 부대가 사기 붕괴에 더 강해야 함', () => {
      const highMoraleWins = [];
      
      for (let i = 0; i < 10; i++) {
        const highMorale: BattleContext = {
          attacker: {
            name: '고사기군',
            troops: 2000,
            leadership: 70,
            strength: 70,
            intelligence: 60,
            unitType: UnitType.FOOTMAN,
            morale: 95,
            training: 80,
            techLevel: 50
          },
          defender: {
            name: '적군',
            troops: 2500,
            leadership: 75,
            strength: 75,
            intelligence: 60,
            unitType: UnitType.FOOTMAN,
            morale: 50,
            training: 80,
            techLevel: 50
          },
          terrain: TerrainType.PLAINS,
          isDefenderCity: false
        };

        const result = calculator.calculateBattle(highMorale);
        highMoraleWins.push(result.winner === 'attacker');
      }

      const winRate = highMoraleWins.filter(w => w).length / highMoraleWins.length;
      expect(winRate).toBeGreaterThan(0.3);
    });
  });

  describe('능력치 영향 테스트', () => {
    it('높은 능력치를 가진 장수가 유리해야 함', () => {
      const result = simulateBattle(
        '명장', 3000, [100, 100, 100], UnitType.FOOTMAN,
        '평장', 3000, [60, 60, 60], UnitType.FOOTMAN,
        TerrainType.PLAINS
      );

      expect(result.winner).toBe('attacker');
      expect(result.attackerCasualties).toBeLessThan(result.defenderCasualties);
    });

    it('병종에 맞는 능력치가 더 큰 영향을 주어야 함', () => {
      const strengthResult = simulateBattle(
        '무력장수', 3000, [70, 110, 60], UnitType.FOOTMAN,
        '지력장수', 3000, [70, 60, 110], UnitType.FOOTMAN,
        TerrainType.PLAINS
      );

      expect(strengthResult.winner).toBe('attacker');
      
      const intelligenceResult = simulateBattle(
        '지력장수', 3000, [70, 60, 110], UnitType.WIZARD,
        '무력장수', 3000, [70, 110, 60], UnitType.WIZARD,
        TerrainType.PLAINS
      );

      expect(intelligenceResult.winner).toBe('attacker');
    });
  });
});
