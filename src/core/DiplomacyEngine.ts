/**
 * DiplomacyEngine.ts - Diplomacy State and City Classification Engine
 *
 * Ported from PHP GeneralAI.php:
 * - calcDiplomacyState() (lines 206-281)
 * - categorizeNationCities() (lines 3469-3515)
 *
 * PHP Diplomacy States (exact same values):
 * - d평화 = 0 (Peace)
 * - d선포 = 1 (War Declared)
 * - d징병 = 2 (Recruiting/Mobilizing)
 * - d직전 = 3 (War Imminent)
 * - d전쟁 = 4 (At War)
 */

import { diplomacyRepository } from '../repositories/diplomacy.repository';
import { cityRepository } from '../repositories/city.repository';

// ============================================================================
// Constants - Exact PHP Parity
// ============================================================================

/**
 * Diplomacy state constants (exact PHP values)
 * PHP: const d평화 = 0; const d선포 = 1; const d징병 = 2; const d직전 = 3; const d전쟁 = 4;
 */
export const DIP_STATE = {
  PEACE: 0,          // d평화: No war, no declarations
  DECLARED: 1,       // d선포: War declared but term > 8
  RECRUITING: 2,     // d징병: War declared, term 6-8 (time to recruit)
  IMMINENT: 3,       // d직전: War declared, term <= 5 (war about to start)
  WAR: 4,            // d전쟁: Active war (state=0 in diplomacy table)
} as const;

export type DiplomacyStateValue = typeof DIP_STATE[keyof typeof DIP_STATE];

/**
 * Diplomacy relation states in the database
 * PHP diplomacy.state values:
 * - 0: At war (교전 중)
 * - 1: War declared (선전포고 - countdown to war)
 * - 2: Neutral (중립)
 * - 7: Alliance/Non-aggression (동맹/불가침)
 */
export const RELATION_STATE = {
  AT_WAR: 0,
  WAR_DECLARED: 1,
  NEUTRAL: 2,
  ALLIANCE: 7,
} as const;

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Result of diplomacy state calculation
 */
export interface DiplomacyStateResult {
  /** Diplomacy state (0-4) - exact PHP parity */
  dipState: DiplomacyStateValue;

  /** Whether nation has attackable cities (front cities with supply) */
  attackable: boolean;

  /**
   * War target nations map
   * Key: nation ID (0 = any attackable nation)
   * Value: priority (1 = war declared, 2 = at war)
   */
  warTargetNation: Map<number, number>;

  /** Minimum war term (months until war starts) */
  minWarTerm: number | null;

  /** Debug info for testing */
  debug?: {
    onWar: number;
    onWarReady: number;
    onWarYet: number;
    yearMonth: number;
    protectionEndYearMonth: number;
    frontStatus: number;
  };
}

/**
 * Categorized city for AI decision making
 */
export interface CategorizedCity {
  /** City ID */
  city: number;

  /** City name */
  name: string;

  /** Nation ID */
  nation: number;

  /** Population */
  pop: number;
  pop_max: number;

  /** Development values */
  agri: number;
  agri_max: number;
  comm: number;
  comm_max: number;
  secu: number;
  secu_max: number;
  def: number;
  def_max: number;
  wall: number;
  wall_max: number;

  /** Trust (민심) */
  trust: number;

  /** Front status (0 = not front, 1+ = front line) */
  front: number;

  /** Supply status (0 = no supply, 1 = has supply) */
  supply: number;

  /**
   * Development rate (0-1)
   * PHP: (agri + comm + secu + def + wall) / (agri_max + comm_max + secu_max + def_max + wall_max)
   */
  dev: number;

  /** Importance flag (always 1 in PHP) */
  important: number;

  /** List of generals in this city */
  generals: any[];

  /** Raw city data */
  raw?: Record<string, any>;
}

/**
 * Result of city categorization
 */
export interface CityCategorizationResult {
  /** All cities owned by the nation */
  nationCities: Map<number, CategorizedCity>;

  /** Front-line cities (adjacent to enemy) */
  frontCities: Map<number, CategorizedCity>;

  /** Cities with supply lines */
  supplyCities: Map<number, CategorizedCity>;

  /** Backup cities (has supply but not front) */
  backupCities: Map<number, CategorizedCity>;
}

/**
 * Environment data for diplomacy calculations
 */
export interface DiplomacyEnv {
  session_id?: string;
  sessionId?: string;
  year: number;
  month: number;
  startyear: number;
  startYear?: number;
}

/**
 * Nation data for diplomacy calculations
 */
export interface DiplomacyNation {
  nation: number;
  capital?: number;
  war?: number;
  aux?: Record<string, any>;
  data?: {
    nation?: number;
    capital?: number;
    war?: number;
    aux?: Record<string, any>;
    last_attackable?: number;
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Join year and month into a single number (PHP Util::joinYearMonth)
 * @example joinYearMonth(190, 5) => 1905
 */
export function joinYearMonth(year: number, month: number): number {
  return year * 12 + month;
}

/**
 * Get session ID from env object (handles multiple property names)
 */
function getSessionId(env: DiplomacyEnv): string | null {
  return env.session_id || env.sessionId || null;
}

/**
 * Get nation ID from nation object (handles nested data)
 */
function getNationId(nation: DiplomacyNation): number {
  return nation?.nation ?? nation?.data?.nation ?? 0;
}

/**
 * Get start year from env (handles multiple property names)
 */
function getStartYear(env: DiplomacyEnv): number {
  return env.startyear ?? env.startYear ?? 184;
}

// ============================================================================
// Main Engine Class
// ============================================================================

/**
 * DiplomacyEngine - Calculates diplomacy state and categorizes cities
 *
 * This is a direct port of PHP GeneralAI methods for diplomacy handling.
 * All state values and logic match PHP exactly for game parity.
 */
export class DiplomacyEngine {
  // Cache for diplomacy state (per session:nation)
  private static diplomacyCache = new Map<string, {
    result: DiplomacyStateResult;
    expiresAt: number;
  }>();

  // Cache TTL in milliseconds
  private static readonly CACHE_TTL_MS = 30_000; // 30 seconds

  /**
   * Calculate diplomacy state for a nation
   *
   * This is a direct port of PHP GeneralAI::calcDiplomacyState() (lines 206-281)
   *
   * Logic flow:
   * 1. Check war protection period (first 2 years + 5 months)
   * 2. Query diplomacy relations (state IN (0, 1))
   * 3. Check if nation has attackable front cities
   * 4. Count war states: onWar (state=0), onWarReady (state=1, term<5), onWarYet (state=1, term>=5)
   * 5. Determine dipState based on minWarTerm
   * 6. Upgrade to WAR state if actively fighting
   *
   * @param nation - Nation data
   * @param env - Environment data (year, month, startyear)
   * @param options - Optional settings
   * @returns Diplomacy state result with exact PHP parity
   */
  static async calcDiplomacyState(
    nation: DiplomacyNation,
    env: DiplomacyEnv,
    options?: {
      /** Skip cache lookup */
      skipCache?: boolean;
      /** Include debug info */
      debug?: boolean;
      /** Last attackable year-month from nation storage */
      lastAttackable?: number;
    }
  ): Promise<DiplomacyStateResult> {
    const sessionId = getSessionId(env);
    const nationId = getNationId(nation);

    // Early return for invalid inputs
    if (!sessionId || !nationId) {
      return {
        dipState: DIP_STATE.PEACE,
        attackable: false,
        warTargetNation: new Map(),
        minWarTerm: null,
      };
    }

    // Check cache
    if (!options?.skipCache) {
      const cached = this.getCachedState(sessionId, nationId);
      if (cached) {
        return cached;
      }
    }

    // Calculate current year-month
    const yearMonth = joinYearMonth(env.year, env.month);
    const startYear = getStartYear(env);
    const protectionEndYearMonth = joinYearMonth(startYear + 2, 5);

    // Query war relations (state IN (0, 1))
    // PHP: SELECT you, state, term FROM diplomacy WHERE me = %i AND state IN (0, 1)
    const warRelations = await diplomacyRepository.findByFilter({
      session_id: sessionId,
      me: nationId,
      state: { $in: [RELATION_STATE.AT_WAR, RELATION_STATE.WAR_DECLARED] },
    });

    // Check war protection period (PHP lines 219-228)
    // First 2 years + 5 months: limited to PEACE or DECLARED only
    if (yearMonth <= protectionEndYearMonth) {
      if (!warRelations || warRelations.length === 0) {
        const result: DiplomacyStateResult = {
          dipState: DIP_STATE.PEACE,
          attackable: false,
          warTargetNation: new Map(),
          minWarTerm: null,
          ...(options?.debug && {
            debug: {
              onWar: 0,
              onWarReady: 0,
              onWarYet: 0,
              yearMonth,
              protectionEndYearMonth,
              frontStatus: 0,
            },
          }),
        };
        this.setCachedState(sessionId, nationId, result);
        return result;
      } else {
        // Has war declarations but in protection period
        const result: DiplomacyStateResult = {
          dipState: DIP_STATE.DECLARED,
          attackable: false,
          warTargetNation: new Map(),
          minWarTerm: null,
          ...(options?.debug && {
            debug: {
              onWar: 0,
              onWarReady: 0,
              onWarYet: warRelations.length,
              yearMonth,
              protectionEndYearMonth,
              frontStatus: 0,
            },
          }),
        };
        this.setCachedState(sessionId, nationId, result);
        return result;
      }
    }

    // Check front status (PHP line 230)
    // PHP: SELECT max(front) FROM city WHERE nation=%i AND supply=1
    const frontStatus = await this.getMaxFrontStatus(sessionId, nationId);
    const attackable = frontStatus > 0;

    // Count war states (PHP lines 234-248)
    let onWar = 0;       // At war (state=0)
    let onWarReady = 0;  // War imminent (state=1, term<5)
    let onWarYet = 0;    // War declared but not imminent (state=1, term>=5)
    const warTargetNation = new Map<number, number>();

    for (const relation of warRelations || []) {
      const warNationId = relation.you;
      const warState = relation.state;
      const warTerm = relation.term ?? 0;

      if (warState === RELATION_STATE.AT_WAR) {
        // PHP line 240: state == 0
        onWar += 1;
        warTargetNation.set(warNationId, 2);
      } else if (warState === RELATION_STATE.WAR_DECLARED && warTerm < 5) {
        // PHP line 242: state == 1 && term < 5
        onWarReady += 1;
        warTargetNation.set(warNationId, 1);
      } else {
        // PHP line 246: other cases
        onWarYet += 1;
      }
    }

    // PHP line 250-252: If no active war and no imminent war, set neutral target
    if (!onWar && !onWarReady) {
      warTargetNation.set(0, 1);
    }

    // Get minimum war term (PHP line 257)
    // PHP: SELECT min(term) FROM diplomacy WHERE me = %i AND state=1
    const minWarTerm = await this.getMinWarTerm(sessionId, nationId);

    // Determine dipState based on minWarTerm (PHP lines 258-267)
    let dipState: DiplomacyStateValue;

    if (minWarTerm === null) {
      // No war declarations
      dipState = DIP_STATE.PEACE;
    } else if (minWarTerm > 8) {
      // War declared but far away (8+ months)
      dipState = DIP_STATE.DECLARED;
    } else if (minWarTerm > 5) {
      // War declared, time to recruit (6-8 months)
      dipState = DIP_STATE.RECRUITING;
    } else {
      // War imminent (5 or fewer months)
      dipState = DIP_STATE.IMMINENT;
    }

    // Upgrade to WAR state if conditions met (PHP lines 269-279)
    // Case 1: Has neutral target (0) and is attackable
    if (warTargetNation.has(0) && attackable) {
      dipState = DIP_STATE.WAR;
    }
    // Case 2: Has active war
    else if (onWar > 0) {
      if (attackable) {
        // Can attack
        dipState = DIP_STATE.WAR;
      } else {
        // Can't attack but recently could (within 5 months)
        const lastAttackable = options?.lastAttackable ??
          nation.data?.last_attackable ??
          (nation.aux as any)?.last_attackable ?? 0;

        if (lastAttackable >= yearMonth - 5) {
          dipState = DIP_STATE.WAR;
        }
      }
    }

    const result: DiplomacyStateResult = {
      dipState,
      attackable,
      warTargetNation,
      minWarTerm,
      ...(options?.debug && {
        debug: {
          onWar,
          onWarReady,
          onWarYet,
          yearMonth,
          protectionEndYearMonth,
          frontStatus,
        },
      }),
    };

    this.setCachedState(sessionId, nationId, result);
    return result;
  }

  /**
   * Categorize nation's cities into front/supply/backup
   *
   * This is a direct port of PHP GeneralAI::categorizeNationCities() (lines 3469-3515)
   *
   * Classification logic:
   * - frontCities: Cities where front > 0 (adjacent to enemy)
   * - supplyCities: Cities where supply = 1 (connected to capital)
   * - backupCities: Cities where supply = 1 AND front = 0 (safe rear cities)
   *
   * Development rate calculation:
   * dev = (agri + comm + secu + def + wall) / (agri_max + comm_max + secu_max + def_max + wall_max)
   *
   * @param sessionId - Session ID
   * @param nationId - Nation ID
   * @returns Categorized cities
   */
  static async categorizeNationCities(
    sessionId: string,
    nationId: number
  ): Promise<CityCategorizationResult> {
    // Query all cities for this nation
    const cities = await cityRepository.findByNation(sessionId, nationId);

    const nationCities = new Map<number, CategorizedCity>();
    const frontCities = new Map<number, CategorizedCity>();
    const supplyCities = new Map<number, CategorizedCity>();
    const backupCities = new Map<number, CategorizedCity>();

    for (const cityData of cities || []) {
      const cityId = cityData.city;

      // Calculate development rate (PHP lines 3489-3491)
      const devNumerator = (cityData.agri || 0) + (cityData.comm || 0) +
        (cityData.secu || 0) + (cityData.def || 0) + (cityData.wall || 0);
      const devDenominator = (cityData.agri_max || 1) + (cityData.comm_max || 1) +
        (cityData.secu_max || 1) + (cityData.def_max || 1) + (cityData.wall_max || 1);
      const dev = devNumerator / devDenominator;

      const categorizedCity: CategorizedCity = {
        city: cityId,
        name: cityData.name || '',
        nation: cityData.nation || 0,
        pop: cityData.pop || 0,
        pop_max: cityData.pop_max || 1,
        agri: cityData.agri || 0,
        agri_max: cityData.agri_max || 1,
        comm: cityData.comm || 0,
        comm_max: cityData.comm_max || 1,
        secu: cityData.secu || 0,
        secu_max: cityData.secu_max || 1,
        def: cityData.def || 0,
        def_max: cityData.def_max || 1,
        wall: cityData.wall || 0,
        wall_max: cityData.wall_max || 1,
        trust: cityData.trust || 50,
        front: cityData.front || 0,
        supply: cityData.supply || 0,
        dev,
        important: 1, // PHP line 3495: always 1
        generals: [], // Will be populated by caller if needed
        raw: cityData,
      };

      // Add to nationCities (all cities)
      nationCities.set(cityId, categorizedCity);

      // Categorize (PHP lines 3497-3504)
      if (categorizedCity.supply) {
        // PHP line 3498: if ($nationCity['supply'])
        supplyCities.set(cityId, categorizedCity);
      }

      if (categorizedCity.front) {
        // PHP line 3500: if ($nationCity['front'])
        frontCities.set(cityId, categorizedCity);
      } else if (categorizedCity.supply) {
        // PHP line 3502-3503: else if ($nationCity['supply'])
        backupCities.set(cityId, categorizedCity);
      }
    }

    return {
      nationCities,
      frontCities,
      supplyCities,
      backupCities,
    };
  }

  /**
   * Get maximum front status for a nation's cities with supply
   * PHP: SELECT max(front) FROM city WHERE nation=%i AND supply=1
   */
  private static async getMaxFrontStatus(
    sessionId: string,
    nationId: number
  ): Promise<number> {
    const cities = await cityRepository.findByNation(sessionId, nationId);

    let maxFront = 0;
    for (const city of cities || []) {
      if (city.supply && city.front > maxFront) {
        maxFront = city.front;
      }
    }

    return maxFront;
  }

  /**
   * Get minimum war term for a nation
   * PHP: SELECT min(term) FROM diplomacy WHERE me = %i AND state=1
   */
  private static async getMinWarTerm(
    sessionId: string,
    nationId: number
  ): Promise<number | null> {
    const warDeclarations = await diplomacyRepository.findByFilter({
      session_id: sessionId,
      me: nationId,
      state: RELATION_STATE.WAR_DECLARED,
    });

    if (!warDeclarations || warDeclarations.length === 0) {
      return null;
    }

    let minTerm = Infinity;
    for (const rel of warDeclarations) {
      if (rel.term < minTerm) {
        minTerm = rel.term;
      }
    }

    return minTerm === Infinity ? null : minTerm;
  }

  /**
   * Get cached diplomacy state
   */
  private static getCachedState(
    sessionId: string,
    nationId: number
  ): DiplomacyStateResult | null {
    const cacheKey = `${sessionId}:${nationId}`;
    const cached = this.diplomacyCache.get(cacheKey);

    if (!cached) {
      return null;
    }

    if (cached.expiresAt < Date.now()) {
      this.diplomacyCache.delete(cacheKey);
      return null;
    }

    return cached.result;
  }

  /**
   * Set cached diplomacy state
   */
  private static setCachedState(
    sessionId: string,
    nationId: number,
    result: DiplomacyStateResult
  ): void {
    const cacheKey = `${sessionId}:${nationId}`;
    this.diplomacyCache.set(cacheKey, {
      result,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });
  }

  /**
   * Clear cache for a specific nation or all nations
   */
  static clearCache(sessionId?: string, nationId?: number): void {
    if (sessionId && nationId) {
      this.diplomacyCache.delete(`${sessionId}:${nationId}`);
    } else if (sessionId) {
      const keysToDelete: string[] = [];
      this.diplomacyCache.forEach((_, key) => {
        if (key.startsWith(`${sessionId}:`)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => this.diplomacyCache.delete(key));
    } else {
      this.diplomacyCache.clear();
    }
  }

  /**
   * Check if a nation can declare war on another
   *
   * @param sessionId - Session ID
   * @param fromNationId - Declaring nation ID
   * @param toNationId - Target nation ID
   * @param env - Environment data
   * @returns Whether war can be declared
   */
  static async canDeclareWar(
    sessionId: string,
    fromNationId: number,
    toNationId: number,
    env: DiplomacyEnv
  ): Promise<{ canDeclare: boolean; reason?: string }> {
    // Check protection period
    const yearMonth = joinYearMonth(env.year, env.month);
    const startYear = getStartYear(env);
    const protectionEndYearMonth = joinYearMonth(startYear + 2, 5);

    if (yearMonth <= protectionEndYearMonth) {
      return { canDeclare: false, reason: 'war_protection_period' };
    }

    // Check existing relation
    const existingRelation = await diplomacyRepository.findRelation(
      sessionId,
      fromNationId,
      toNationId
    );

    if (existingRelation) {
      if (existingRelation.state === RELATION_STATE.AT_WAR) {
        return { canDeclare: false, reason: 'already_at_war' };
      }
      if (existingRelation.state === RELATION_STATE.WAR_DECLARED) {
        return { canDeclare: false, reason: 'already_declared' };
      }
      if (existingRelation.state === RELATION_STATE.ALLIANCE) {
        return { canDeclare: false, reason: 'allied_nation' };
      }
    }

    return { canDeclare: true };
  }

  /**
   * Get list of attackable nations for a nation
   *
   * @param sessionId - Session ID
   * @param nationId - Nation ID
   * @param env - Environment data
   * @returns List of nation IDs that can be attacked
   */
  static async getAttackableNations(
    sessionId: string,
    nationId: number,
    env: DiplomacyEnv
  ): Promise<number[]> {
    const dipState = await this.calcDiplomacyState(
      { nation: nationId },
      { ...env, session_id: sessionId }
    );

    if (!dipState.attackable) {
      return [];
    }

    // Return nations that are at war or war imminent
    const attackable: number[] = [];
    dipState.warTargetNation.forEach((priority, targetNationId) => {
      if (targetNationId !== 0 && priority >= 1) {
        attackable.push(targetNationId);
      }
    });

    return attackable;
  }
}

// ============================================================================
// Convenience Functions (for backward compatibility)
// ============================================================================

/**
 * Calculate diplomacy state (convenience function)
 */
export async function calcDiplomacyState(
  nation: DiplomacyNation,
  env: DiplomacyEnv,
  options?: { skipCache?: boolean; debug?: boolean; lastAttackable?: number }
): Promise<DiplomacyStateResult> {
  return DiplomacyEngine.calcDiplomacyState(nation, env, options);
}

/**
 * Categorize nation cities (convenience function)
 */
export async function categorizeNationCities(
  sessionId: string,
  nationId: number
): Promise<CityCategorizationResult> {
  return DiplomacyEngine.categorizeNationCities(sessionId, nationId);
}

/**
 * Get diplomacy state name (for debugging/display)
 */
export function getDipStateName(dipState: DiplomacyStateValue): string {
  switch (dipState) {
    case DIP_STATE.PEACE:
      return '평화';
    case DIP_STATE.DECLARED:
      return '선포';
    case DIP_STATE.RECRUITING:
      return '징병';
    case DIP_STATE.IMMINENT:
      return '직전';
    case DIP_STATE.WAR:
      return '전쟁';
    default:
      return '알 수 없음';
  }
}

export default DiplomacyEngine;
