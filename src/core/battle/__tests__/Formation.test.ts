/**
 * Formation 시스템 테스트
 */

import {
  Formation,
  LoghFormation,
  CombatStance,
  FORMATION_STATS,
  LOGH_FORMATION_STATS,
  COMBAT_STANCE_STATS,
  getFormationStats,
  getFormationCounter,
  getLoghFormationStats,
  getCombatStanceStats,
  applyFormationModifier,
  applyLoghFormationModifier,
  applyCombatStanceModifier,
  canChangeFormation,
  canChangeLoghFormation,
  FORMATION_CHANGE_COST,
  LOGH_FORMATION_CHANGE_COST,
} from '../interfaces/Formation';

describe('Formation System', () => {
  // ==========================================================================
  // 삼국지 진형 테스트
  // ==========================================================================
  describe('Samgukji Formations', () => {
    describe('FORMATION_STATS', () => {
      test('어린진 (fishScale) - 공격 중시', () => {
        const stats = FORMATION_STATS.fishScale;

        expect(stats.attack).toBeGreaterThan(1.0);
        expect(stats.defense).toBeLessThan(1.0);
      });

      test('방원진 (circular) - 방어 중시', () => {
        const stats = FORMATION_STATS.circular;

        expect(stats.attack).toBeLessThan(1.0);
        expect(stats.defense).toBeGreaterThan(1.0);
      });

      test('봉시진 (arrowhead) - 돌파', () => {
        const stats = FORMATION_STATS.arrowhead;

        expect(stats.attack).toBeGreaterThan(1.0);
        expect(stats.speed).toBeGreaterThan(1.0);
      });

      test('장사진 (longSnake) - 기동력', () => {
        const stats = FORMATION_STATS.longSnake;

        expect(stats.speed).toBeGreaterThan(1.0);
      });

      test('모든 진형이 정의되어 있음', () => {
        const formations: Formation[] = [
          'fishScale', 'craneWing', 'circular', 'arrowhead', 'longSnake',
          'yenWing', 'square', 'hook'
        ];

        formations.forEach(formation => {
          expect(FORMATION_STATS[formation]).toBeDefined();
          expect(FORMATION_STATS[formation].attack).toBeGreaterThan(0);
          expect(FORMATION_STATS[formation].defense).toBeGreaterThan(0);
        });
      });
    });

    describe('getFormationStats', () => {
      test('유효한 진형 조회', () => {
        const stats = getFormationStats('fishScale');

        expect(stats).toEqual(FORMATION_STATS.fishScale);
      });

      test('기본 진형 조회 (undefined)', () => {
        const stats = getFormationStats(undefined);

        expect(stats.attack).toBe(1.0);
        expect(stats.defense).toBe(1.0);
      });
    });

    describe('getFormationCounter', () => {
      test('어린진의 카운터 진형', () => {
        const counter = getFormationCounter('fishScale');

        // 어린진은 학익진에 약함
        expect(counter).toBe('craneWing');
      });

      test('방원진의 카운터 진형', () => {
        const counter = getFormationCounter('circular');

        // 방원진은 봉시진에 약함
        expect(counter).toBe('arrowhead');
      });
    });

    describe('applyFormationModifier', () => {
      test('공격력 보정 적용', () => {
        const baseAttack = 100;
        const modifiedAttack = applyFormationModifier(baseAttack, 'fishScale', 'attack');

        expect(modifiedAttack).toBe(baseAttack * FORMATION_STATS.fishScale.attack);
      });

      test('방어력 보정 적용', () => {
        const baseDefense = 100;
        const modifiedDefense = applyFormationModifier(baseDefense, 'circular', 'defense');

        expect(modifiedDefense).toBe(baseDefense * FORMATION_STATS.circular.defense);
      });
    });

    describe('canChangeFormation', () => {
      test('충분한 사기로 진형 변경 가능', () => {
        const currentMorale = 100;
        const targetFormation: Formation = 'craneWing';

        const result = canChangeFormation(currentMorale, targetFormation);

        expect(result.canChange).toBe(true);
      });

      test('사기 부족으로 진형 변경 불가', () => {
        const currentMorale = 10;
        const targetFormation: Formation = 'craneWing';

        const result = canChangeFormation(currentMorale, targetFormation);

        expect(result.canChange).toBe(false);
        expect(result.reason).toContain('사기');
      });
    });
  });

  // ==========================================================================
  // 은하영웅전설 진형 테스트
  // ==========================================================================
  describe('LOGH Formations', () => {
    describe('LOGH_FORMATION_STATS', () => {
      test('돌격 진형 (assault) - 공격 중시', () => {
        const stats = LOGH_FORMATION_STATS.assault;

        expect(stats.attack).toBeGreaterThan(1.0);
        expect(stats.defense).toBeLessThan(1.0);
      });

      test('방어 진형 (defensive) - 방어 중시', () => {
        const stats = LOGH_FORMATION_STATS.defensive;

        expect(stats.defense).toBeGreaterThan(1.0);
      });

      test('모든 LOGH 진형이 정의되어 있음', () => {
        const formations: LoghFormation[] = [
          'standard', 'assault', 'defensive', 'wedge', 'envelopment',
          'echelon', 'retreat', 'pursuit'
        ];

        formations.forEach(formation => {
          expect(LOGH_FORMATION_STATS[formation]).toBeDefined();
        });
      });
    });

    describe('getLoghFormationStats', () => {
      test('유효한 LOGH 진형 조회', () => {
        const stats = getLoghFormationStats('assault');

        expect(stats).toEqual(LOGH_FORMATION_STATS.assault);
      });
    });

    describe('applyLoghFormationModifier', () => {
      test('공격력 보정 적용', () => {
        const baseAttack = 1000;
        const modifiedAttack = applyLoghFormationModifier(baseAttack, 'assault', 'attack');

        expect(modifiedAttack).toBe(baseAttack * LOGH_FORMATION_STATS.assault.attack);
      });
    });

    describe('canChangeLoghFormation', () => {
      test('충분한 사기로 LOGH 진형 변경 가능', () => {
        const currentMorale = 80;
        const targetFormation: LoghFormation = 'assault';

        const result = canChangeLoghFormation(currentMorale, targetFormation);

        expect(result.canChange).toBe(true);
      });
    });
  });

  // ==========================================================================
  // 전투 자세 테스트
  // ==========================================================================
  describe('Combat Stance', () => {
    describe('COMBAT_STANCE_STATS', () => {
      test('공격 자세 (aggressive)', () => {
        const stats = COMBAT_STANCE_STATS.aggressive;

        expect(stats.attack).toBeGreaterThan(1.0);
        expect(stats.defense).toBeLessThan(1.0);
      });

      test('방어 자세 (defensive)', () => {
        const stats = COMBAT_STANCE_STATS.defensive;

        expect(stats.attack).toBeLessThan(1.0);
        expect(stats.defense).toBeGreaterThan(1.0);
      });

      test('균형 자세 (balanced)', () => {
        const stats = COMBAT_STANCE_STATS.balanced;

        expect(stats.attack).toBe(1.0);
        expect(stats.defense).toBe(1.0);
      });

      test('모든 자세가 정의되어 있음', () => {
        const stances: CombatStance[] = [
          'aggressive', 'balanced', 'defensive', 'evasive', 'focused'
        ];

        stances.forEach(stance => {
          expect(COMBAT_STANCE_STATS[stance]).toBeDefined();
        });
      });
    });

    describe('getCombatStanceStats', () => {
      test('유효한 자세 조회', () => {
        const stats = getCombatStanceStats('aggressive');

        expect(stats).toEqual(COMBAT_STANCE_STATS.aggressive);
      });
    });

    describe('applyCombatStanceModifier', () => {
      test('공격력 보정 적용', () => {
        const baseAttack = 500;
        const modifiedAttack = applyCombatStanceModifier(baseAttack, 'aggressive', 'attack');

        expect(modifiedAttack).toBe(baseAttack * COMBAT_STANCE_STATS.aggressive.attack);
      });

      test('방어력 보정 적용', () => {
        const baseDefense = 500;
        const modifiedDefense = applyCombatStanceModifier(baseDefense, 'defensive', 'defense');

        expect(modifiedDefense).toBe(baseDefense * COMBAT_STANCE_STATS.defensive.defense);
      });
    });
  });

  // ==========================================================================
  // 진형 변경 비용 테스트
  // ==========================================================================
  describe('Formation Change Cost', () => {
    test('삼국지 진형 변경 비용 정의', () => {
      expect(FORMATION_CHANGE_COST.fishScale).toBeDefined();
      expect(FORMATION_CHANGE_COST.fishScale.morale).toBeGreaterThan(0);
      expect(FORMATION_CHANGE_COST.fishScale.turns).toBeGreaterThan(0);
    });

    test('LOGH 진형 변경 비용 정의', () => {
      expect(LOGH_FORMATION_CHANGE_COST.assault).toBeDefined();
      expect(LOGH_FORMATION_CHANGE_COST.assault.morale).toBeGreaterThan(0);
      expect(LOGH_FORMATION_CHANGE_COST.assault.time).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 복합 테스트
  // ==========================================================================
  describe('Combined Effects', () => {
    test('진형 + 자세 복합 보정', () => {
      const baseAttack = 100;
      
      // 어린진 + 공격 자세
      const formationMod = applyFormationModifier(baseAttack, 'fishScale', 'attack');
      const combinedMod = applyCombatStanceModifier(formationMod, 'aggressive', 'attack');

      // 두 보정이 모두 적용됨
      expect(combinedMod).toBeGreaterThan(baseAttack);
      expect(combinedMod).toBeGreaterThan(formationMod);
    });

    test('방어 진형 + 방어 자세', () => {
      const baseDefense = 100;
      
      // 방원진 + 방어 자세
      const formationMod = applyFormationModifier(baseDefense, 'circular', 'defense');
      const combinedMod = applyCombatStanceModifier(formationMod, 'defensive', 'defense');

      expect(combinedMod).toBeGreaterThan(baseDefense);
      expect(combinedMod).toBeGreaterThan(formationMod);
    });
  });
});

