import { ConstraintHelper } from './ConstraintHelper';

describe('ConstraintHelper', () => {
  describe('Resource Constraints', () => {
    test('HasGold checks general gold', () => {
      const constraint = ConstraintHelper.HasGold(100);
      // Robust access check
      expect(constraint.test({ general: { gold: 100 } }, {})).toBeNull();
      expect(constraint.test({ general: { getVar: (k: string) => k === 'gold' ? 100 : 0 } }, {})).toBeNull();
      expect(constraint.test({ general: { gold: 99 } }, {})).toContain('자금이 부족합니다');
    });

    test('HasRice checks general rice', () => {
      const constraint = ConstraintHelper.HasRice(100);
      expect(constraint.test({ general: { rice: 100 } }, {})).toBeNull();
      expect(constraint.test({ general: { rice: 99 } }, {})).toContain('군량이 부족합니다');
    });

    test('HasTroops checks general crew > 0', () => {
      const constraint = ConstraintHelper.HasTroops();
      expect(constraint.test({ general: { crew: 100 } }, {})).toBeNull();
      expect(constraint.test({ general: { crew: 0 } }, {})).toContain('병사가 없습니다');
    });
  });

  describe('State Constraints', () => {
    test('NotInjured checks injury < 1', () => {
      const constraint = ConstraintHelper.NotInjured();
      expect(constraint.test({ general: { injury: 0 } }, {})).toBeNull();
      expect(constraint.test({ general: { injury: 10 } }, {})).toContain('부상');
    });

    test('HasMorale checks atmos >= min', () => {
      const constraint = ConstraintHelper.HasMorale(80);
      expect(constraint.test({ general: { atmos: 80 } }, {})).toBeNull();
      expect(constraint.test({ general: { atmos: 79 } }, {})).toContain('사기');
    });
  });

  describe('Relationship Constraints', () => {
    test('IsOfficer checks officer_level > 0', () => {
      const constraint = ConstraintHelper.IsOfficer();
      expect(constraint.test({ general: { officer_level: 1 } }, {})).toBeNull();
      expect(constraint.test({ general: { officer_level: 0 } }, {})).toContain('관직');
    });

    test('BelongsToNation checks nation != 0', () => {
      const constraint = ConstraintHelper.BelongsToNation();
      expect(constraint.test({ general: { nation: 1 } }, {})).toBeNull();
      expect(constraint.test({ general: { nation: 0 } }, {})).toContain('국가에 소속');
    });

    test('InSameNation checks general and destGeneral nations', () => {
      const constraint = ConstraintHelper.InSameNation();
      expect(constraint.test({ general: { nation: 1 }, destGeneral: { nation: 1 } }, {})).toBeNull();
      expect(constraint.test({ general: { nation: 1 }, destGeneral: { nation: 2 } }, {})).toContain('같은 국가');
    });
  });

  describe('Time/Geo Constraints', () => {
    test('AfterTurn checks env.turn', () => {
      const constraint = ConstraintHelper.AfterTurn(10);
      expect(constraint.test({}, { turn: 10 })).toBeNull();
      expect(constraint.test({}, { turn: 9 })).toContain('10턴 이후');
    });

    test('BeforeTurn checks env.turn', () => {
      const constraint = ConstraintHelper.BeforeTurn(10);
      expect(constraint.test({}, { turn: 9 })).toBeNull();
      expect(constraint.test({}, { turn: 10 })).toContain('10턴 이전');
    });

    test('InCity checks general city presence', () => {
      const constraint = ConstraintHelper.InCity();
      expect(constraint.test({ general: { city: 101 } }, {})).toBeNull();
      expect(constraint.test({ general: { city: 0 } }, {})).toContain('도시에 있지 않습니다');
    });
  });

  describe('Helper Robustness', () => {
    test('getGenVar handles Mongoose-like objects', () => {
      const constraint = ConstraintHelper.HasGold(100);
      const mockGeneral = {
        data: { gold: 100 },
        getVar: undefined
      };
      expect(constraint.test({ general: mockGeneral }, {})).toBeNull();
    });
  });
});



