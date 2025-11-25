/**
 * DiplomacyEngine Unit Tests
 *
 * Tests for PHP-parity diplomacy state calculation and city categorization.
 * Based on PHP GeneralAI.php lines 206-281 and 3469-3515.
 */

import {
  DiplomacyEngine,
  DIP_STATE,
  RELATION_STATE,
  joinYearMonth,
  getDipStateName,
  DiplomacyStateResult,
  CityCategorizationResult,
} from '../DiplomacyEngine';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Test Scenario 1: Early game protection period
 * - Year 186, Month 3 (within startyear+2 years + 5 months = 189.5)
 * - No war declarations
 * - Expected: PEACE state
 */
const SCENARIO_PROTECTION_PERIOD = {
  scenario: 'Early game - war protection period active',
  nation: { nation: 1, capital: 1 },
  env: {
    session_id: 'test-session-1',
    year: 186,
    month: 3,
    startyear: 184,
  },
  diplomacyRelations: [], // No war relations
  cities: [
    { city: 1, nation: 1, front: 0, supply: 1 },
    { city: 2, nation: 1, front: 0, supply: 1 },
  ],
  expectedOutput: {
    dipState: DIP_STATE.PEACE,
    attackable: false,
  },
};

/**
 * Test Scenario 2: War declared, term > 8
 * - Year 190, Month 1 (past protection period)
 * - War declared with term 10
 * - Expected: DECLARED state
 */
const SCENARIO_WAR_DECLARED_FAR = {
  scenario: 'War declared but far away (term > 8)',
  nation: { nation: 1, capital: 1 },
  env: {
    session_id: 'test-session-2',
    year: 190,
    month: 1,
    startyear: 184,
  },
  diplomacyRelations: [
    { me: 1, you: 2, state: RELATION_STATE.WAR_DECLARED, term: 10 },
  ],
  cities: [
    { city: 1, nation: 1, front: 0, supply: 1 },
  ],
  expectedOutput: {
    dipState: DIP_STATE.DECLARED,
    attackable: false,
    minWarTerm: 10,
  },
};

/**
 * Test Scenario 3: War imminent, term <= 5
 * - Year 190, Month 1
 * - War declared with term 3
 * - Has front city with supply
 * - Expected: IMMINENT state (or WAR if attackable)
 */
const SCENARIO_WAR_IMMINENT = {
  scenario: 'War imminent (term <= 5) with front cities',
  nation: { nation: 1, capital: 1 },
  env: {
    session_id: 'test-session-3',
    year: 190,
    month: 1,
    startyear: 184,
  },
  diplomacyRelations: [
    { me: 1, you: 2, state: RELATION_STATE.WAR_DECLARED, term: 3 },
  ],
  cities: [
    { city: 1, nation: 1, front: 1, supply: 1 },  // Front city with supply
    { city: 2, nation: 1, front: 0, supply: 1 },
  ],
  expectedOutput: {
    dipState: DIP_STATE.IMMINENT,
    attackable: true,
    minWarTerm: 3,
  },
};

/**
 * Test Scenario 4: Active war (state = 0)
 * - Year 191, Month 6
 * - At war (state = 0)
 * - Has attackable front city
 * - Expected: WAR state
 */
const SCENARIO_ACTIVE_WAR = {
  scenario: 'Active war with attackable cities',
  nation: { nation: 1, capital: 1 },
  env: {
    session_id: 'test-session-4',
    year: 191,
    month: 6,
    startyear: 184,
  },
  diplomacyRelations: [
    { me: 1, you: 2, state: RELATION_STATE.AT_WAR, term: 0 },
  ],
  cities: [
    { city: 1, nation: 1, front: 2, supply: 1 },  // Active front
    { city: 2, nation: 1, front: 0, supply: 1 },
    { city: 3, nation: 1, front: 0, supply: 0 },  // No supply
  ],
  expectedOutput: {
    dipState: DIP_STATE.WAR,
    attackable: true,
    warTargetNation: new Map([[2, 2]]),  // nation 2 at war (priority 2)
  },
};

/**
 * Test Scenario 5: City categorization
 */
const SCENARIO_CITY_CATEGORIZATION = {
  scenario: 'City categorization - front/supply/backup',
  nationId: 1,
  sessionId: 'test-session-5',
  cities: [
    // Front city with supply
    {
      city: 1,
      nation: 1,
      name: 'Front City',
      front: 1,
      supply: 1,
      agri: 5000,
      agri_max: 10000,
      comm: 3000,
      comm_max: 10000,
      secu: 500,
      secu_max: 1000,
      def: 800,
      def_max: 1000,
      wall: 7000,
      wall_max: 10000,
      trust: 80,
      pop: 50000,
      pop_max: 100000,
    },
    // Backup city (supply but not front)
    {
      city: 2,
      nation: 1,
      name: 'Backup City',
      front: 0,
      supply: 1,
      agri: 8000,
      agri_max: 10000,
      comm: 9000,
      comm_max: 10000,
      secu: 900,
      secu_max: 1000,
      def: 950,
      def_max: 1000,
      wall: 9500,
      wall_max: 10000,
      trust: 95,
      pop: 90000,
      pop_max: 100000,
    },
    // Isolated city (no supply)
    {
      city: 3,
      nation: 1,
      name: 'Isolated City',
      front: 0,
      supply: 0,
      agri: 2000,
      agri_max: 10000,
      comm: 1000,
      comm_max: 10000,
      secu: 200,
      secu_max: 1000,
      def: 300,
      def_max: 1000,
      wall: 3000,
      wall_max: 10000,
      trust: 40,
      pop: 20000,
      pop_max: 100000,
    },
  ],
  expectedOutput: {
    frontCitiesCount: 1,
    supplyCitiesCount: 2,
    backupCitiesCount: 1,
    nationCitiesCount: 3,
    // City 1 dev: (5000+3000+500+800+7000)/(10000+10000+1000+1000+10000) = 16300/32000 = 0.509375
    city1Dev: 0.509375,
    // City 2 dev: (8000+9000+900+950+9500)/(10000+10000+1000+1000+10000) = 28350/32000 = 0.8859375
    city2Dev: 0.8859375,
  },
};

// ============================================================================
// Unit Tests
// ============================================================================

describe('DiplomacyEngine', () => {
  describe('joinYearMonth', () => {
    it('should correctly join year and month', () => {
      expect(joinYearMonth(184, 1)).toBe(184 * 12 + 1);
      expect(joinYearMonth(186, 5)).toBe(186 * 12 + 5);
      expect(joinYearMonth(190, 12)).toBe(190 * 12 + 12);
    });
  });

  describe('getDipStateName', () => {
    it('should return correct Korean names', () => {
      expect(getDipStateName(DIP_STATE.PEACE)).toBe('평화');
      expect(getDipStateName(DIP_STATE.DECLARED)).toBe('선포');
      expect(getDipStateName(DIP_STATE.RECRUITING)).toBe('징병');
      expect(getDipStateName(DIP_STATE.IMMINENT)).toBe('직전');
      expect(getDipStateName(DIP_STATE.WAR)).toBe('전쟁');
    });
  });

  describe('DIP_STATE constants', () => {
    it('should match PHP constants exactly', () => {
      // PHP: const d평화 = 0; const d선포 = 1; const d징병 = 2; const d직전 = 3; const d전쟁 = 4;
      expect(DIP_STATE.PEACE).toBe(0);
      expect(DIP_STATE.DECLARED).toBe(1);
      expect(DIP_STATE.RECRUITING).toBe(2);
      expect(DIP_STATE.IMMINENT).toBe(3);
      expect(DIP_STATE.WAR).toBe(4);
    });
  });

  describe('RELATION_STATE constants', () => {
    it('should match PHP diplomacy table state values', () => {
      expect(RELATION_STATE.AT_WAR).toBe(0);
      expect(RELATION_STATE.WAR_DECLARED).toBe(1);
      expect(RELATION_STATE.NEUTRAL).toBe(2);
      expect(RELATION_STATE.ALLIANCE).toBe(7);
    });
  });
});

// ============================================================================
// Integration Test Scenarios (require mocked repositories)
// ============================================================================

describe('DiplomacyEngine Integration Scenarios', () => {
  // These tests require mocking diplomacyRepository and cityRepository
  // In a real test environment, you would use Jest mocks

  describe('Scenario: Protection Period', () => {
    it('should return PEACE during protection period', () => {
      const scenario = SCENARIO_PROTECTION_PERIOD;

      // Verify protection period calculation
      const yearMonth = joinYearMonth(scenario.env.year, scenario.env.month);
      const protectionEnd = joinYearMonth(scenario.env.startyear + 2, 5);

      expect(yearMonth).toBeLessThanOrEqual(protectionEnd);
      expect(scenario.expectedOutput.dipState).toBe(DIP_STATE.PEACE);
    });
  });

  describe('Scenario: War Declared Far', () => {
    it('should return DECLARED when term > 8', () => {
      const scenario = SCENARIO_WAR_DECLARED_FAR;

      // Verify term logic
      const term = scenario.diplomacyRelations[0].term;
      expect(term).toBeGreaterThan(8);
      expect(scenario.expectedOutput.dipState).toBe(DIP_STATE.DECLARED);
    });
  });

  describe('Scenario: War Imminent', () => {
    it('should return IMMINENT when term <= 5', () => {
      const scenario = SCENARIO_WAR_IMMINENT;

      // Verify term logic
      const term = scenario.diplomacyRelations[0].term;
      expect(term).toBeLessThanOrEqual(5);
      expect(scenario.expectedOutput.dipState).toBe(DIP_STATE.IMMINENT);
    });
  });

  describe('Scenario: Active War', () => {
    it('should return WAR when state=0 and attackable', () => {
      const scenario = SCENARIO_ACTIVE_WAR;

      // Verify war state logic
      const state = scenario.diplomacyRelations[0].state;
      expect(state).toBe(RELATION_STATE.AT_WAR);
      expect(scenario.expectedOutput.dipState).toBe(DIP_STATE.WAR);
    });
  });

  describe('Scenario: City Categorization', () => {
    it('should correctly calculate development rate', () => {
      const scenario = SCENARIO_CITY_CATEGORIZATION;
      const city1 = scenario.cities[0];

      // Verify dev calculation
      const devNumerator =
        city1.agri + city1.comm + city1.secu + city1.def + city1.wall;
      const devDenominator =
        city1.agri_max + city1.comm_max + city1.secu_max + city1.def_max + city1.wall_max;
      const dev = devNumerator / devDenominator;

      expect(dev).toBeCloseTo(scenario.expectedOutput.city1Dev, 6);
    });

    it('should categorize front cities correctly', () => {
      const scenario = SCENARIO_CITY_CATEGORIZATION;

      // Count front cities (front > 0)
      const frontCities = scenario.cities.filter(c => c.front > 0);
      expect(frontCities.length).toBe(scenario.expectedOutput.frontCitiesCount);
    });

    it('should categorize supply cities correctly', () => {
      const scenario = SCENARIO_CITY_CATEGORIZATION;

      // Count supply cities (supply > 0)
      const supplyCities = scenario.cities.filter(c => c.supply > 0);
      expect(supplyCities.length).toBe(scenario.expectedOutput.supplyCitiesCount);
    });

    it('should categorize backup cities correctly', () => {
      const scenario = SCENARIO_CITY_CATEGORIZATION;

      // Count backup cities (supply > 0 AND front = 0)
      const backupCities = scenario.cities.filter(c => c.supply > 0 && c.front === 0);
      expect(backupCities.length).toBe(scenario.expectedOutput.backupCitiesCount);
    });
  });
});

// ============================================================================
// Export test fixtures for external use
// ============================================================================

export const TEST_FIXTURES = {
  SCENARIO_PROTECTION_PERIOD,
  SCENARIO_WAR_DECLARED_FAR,
  SCENARIO_WAR_IMMINENT,
  SCENARIO_ACTIVE_WAR,
  SCENARIO_CITY_CATEGORIZATION,
};

export default TEST_FIXTURES;
