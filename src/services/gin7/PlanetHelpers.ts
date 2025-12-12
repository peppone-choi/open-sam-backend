/**
 * PlanetHelpers - 행성 관련 유틸리티 함수
 * 
 * Spy/정치/내정 관련 에이전트들이 사용할 수 있는 헬퍼 함수 모음
 * Agent 01 (Gin7 Facility & Planet Government Base) 제공
 */

import { Planet, IPlanet } from '../../models/gin7/Planet';
import { Faction, IFaction } from '../../models/gin7/Faction';
import { logger } from '../../common/logger';

/**
 * 적대 관계 스탠스 타입
 */
type FactionStance = 'allied' | 'friendly' | 'neutral' | 'hostile' | 'enemy';

/**
 * 적대 행성 여부 확인
 * 주어진 factionId 관점에서 해당 행성이 적대적인지 판단
 * 
 * @param sessionId 세션 ID
 * @param planetId 행성 ID
 * @param factionId 기준 세력 ID (이 세력 관점에서 적대 여부 판단)
 * @returns 적대 여부 (true = 적대 행성)
 * 
 * 사용 예시 (SpyService):
 * const isHostile = await PlanetHelpers.isHostilePlanet('session1', 'planet1', 'EMPIRE');
 * if (isHostile) {
 *   // 첩보 작전 수행 가능
 * }
 */
export async function isHostilePlanet(
  sessionId: string,
  planetId: string,
  factionId: string
): Promise<boolean> {
  try {
    // 1. 행성 정보 조회
    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) {
      logger.warn(`[PlanetHelpers] Planet not found: ${planetId}`);
      return false;
    }

    // 2. 행성 소유 세력 확인
    const planetOwner = planet.controllingFaction || planet.ownerId;
    
    // 자기 세력 소유 행성이면 적대 아님
    if (planetOwner === factionId) {
      return false;
    }

    // 중립 행성이면 적대 아님 (첩보 대상이 될 수 없음)
    if (!planetOwner || planetOwner === 'NEUTRAL') {
      return false;
    }

    // 3. 세력 간 관계 확인
    const myFaction = await Faction.findOne({ sessionId, factionId });
    if (!myFaction) {
      logger.warn(`[PlanetHelpers] Faction not found: ${factionId}`);
      return false;
    }

    // 4. 관계 테이블에서 적대 여부 확인
    const relation = myFaction.relations.find(r => r.targetFactionId === planetOwner);
    
    if (!relation) {
      // 관계가 정의되지 않은 경우 기본적으로 적대로 간주하지 않음
      return false;
    }

    // hostile(-50 미만) 또는 enemy(-75 미만)인 경우 적대로 판단
    const hostileStances: FactionStance[] = ['hostile', 'enemy'];
    return hostileStances.includes(relation.stance) || relation.relationValue < -50;

  } catch (error) {
    logger.error(`[PlanetHelpers] Error checking hostile planet:`, error);
    return false;
  }
}

/**
 * 적대 또는 중립이 아닌 행성인지 확인 (더 넓은 범위)
 * 전쟁 중이거나 적대적이면 true
 * 
 * @param sessionId 세션 ID
 * @param planetId 행성 ID
 * @param factionId 기준 세력 ID
 * @returns 적대/교전 대상 여부
 */
export async function isEnemyOrHostilePlanet(
  sessionId: string,
  planetId: string,
  factionId: string
): Promise<boolean> {
  try {
    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) return false;

    const planetOwner = planet.controllingFaction || planet.ownerId;
    
    // 자기 세력이면 false
    if (planetOwner === factionId) return false;
    
    // 중립이면 false
    if (!planetOwner || planetOwner === 'NEUTRAL') return false;

    const myFaction = await Faction.findOne({ sessionId, factionId });
    if (!myFaction) return false;

    const relation = myFaction.relations.find(r => r.targetFactionId === planetOwner);
    
    // 관계 없으면 잠재적 적대로 간주
    if (!relation) return true;

    // 중립 이하면 적대 가능 대상
    const nonFriendlyStances: FactionStance[] = ['neutral', 'hostile', 'enemy'];
    return nonFriendlyStances.includes(relation.stance) || relation.relationValue < 0;

  } catch (error) {
    logger.error(`[PlanetHelpers] Error checking enemy planet:`, error);
    return false;
  }
}

/**
 * 행성 소유 세력 조회
 * 
 * @param sessionId 세션 ID
 * @param planetId 행성 ID
 * @returns 세력 ID 또는 null
 */
export async function getPlanetOwner(
  sessionId: string,
  planetId: string
): Promise<string | null> {
  try {
    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) return null;
    
    return planet.controllingFaction || planet.ownerId || null;
  } catch (error) {
    logger.error(`[PlanetHelpers] Error getting planet owner:`, error);
    return null;
  }
}

/**
 * 두 세력 간 관계 조회
 * 
 * @param sessionId 세션 ID
 * @param factionId1 세력 1 ID
 * @param factionId2 세력 2 ID
 * @returns 관계 정보 또는 null
 */
export async function getFactionRelation(
  sessionId: string,
  factionId1: string,
  factionId2: string
): Promise<{ stance: FactionStance; relationValue: number } | null> {
  try {
    const faction = await Faction.findOne({ sessionId, factionId: factionId1 });
    if (!faction) return null;

    const relation = faction.relations.find(r => r.targetFactionId === factionId2);
    if (!relation) return null;

    return {
      stance: relation.stance,
      relationValue: relation.relationValue
    };
  } catch (error) {
    logger.error(`[PlanetHelpers] Error getting faction relation:`, error);
    return null;
  }
}

/**
 * 특정 세력의 모든 적대 세력 목록 조회
 * 
 * @param sessionId 세션 ID
 * @param factionId 기준 세력 ID
 * @returns 적대 세력 ID 목록
 */
export async function getHostileFactions(
  sessionId: string,
  factionId: string
): Promise<string[]> {
  try {
    const faction = await Faction.findOne({ sessionId, factionId });
    if (!faction) return [];

    const hostileFactions = faction.relations
      .filter(r => r.stance === 'hostile' || r.stance === 'enemy' || r.relationValue < -50)
      .map(r => r.targetFactionId);

    return hostileFactions;
  } catch (error) {
    logger.error(`[PlanetHelpers] Error getting hostile factions:`, error);
    return [];
  }
}

/**
 * 특정 세력 소유의 모든 행성 목록 조회
 * 
 * @param sessionId 세션 ID
 * @param factionId 세력 ID
 * @returns 행성 목록
 */
export async function getFactionPlanets(
  sessionId: string,
  factionId: string
): Promise<IPlanet[]> {
  try {
    return Planet.find({
      sessionId,
      $or: [
        { ownerId: factionId },
        { controllingFaction: factionId }
      ]
    });
  } catch (error) {
    logger.error(`[PlanetHelpers] Error getting faction planets:`, error);
    return [];
  }
}

/**
 * 행성이 수도(본거지)인지 확인
 * 
 * @param sessionId 세션 ID
 * @param planetId 행성 ID
 * @returns 수도 여부
 */
export async function isCapitalPlanet(
  sessionId: string,
  planetId: string
): Promise<boolean> {
  try {
    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) return false;
    
    return planet.isHomeworld === true;
  } catch (error) {
    logger.error(`[PlanetHelpers] Error checking capital planet:`, error);
    return false;
  }
}

/**
 * 행성 방어력 조회
 * 
 * @param sessionId 세션 ID
 * @param planetId 행성 ID
 * @returns 방어력 (0-100) 또는 -1 (실패)
 */
export async function getPlanetDefenseRating(
  sessionId: string,
  planetId: string
): Promise<number> {
  try {
    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) return -1;
    
    return planet.defenseRating || 0;
  } catch (error) {
    logger.error(`[PlanetHelpers] Error getting defense rating:`, error);
    return -1;
  }
}

/**
 * 행성에 주둔 중인 수비대 확인
 * 
 * @param sessionId 세션 ID
 * @param planetId 행성 ID
 * @returns 수비대 ID 목록
 */
export async function getPlanetGarrison(
  sessionId: string,
  planetId: string
): Promise<string[]> {
  try {
    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) return [];
    
    return planet.garrisonIds || [];
  } catch (error) {
    logger.error(`[PlanetHelpers] Error getting garrison:`, error);
    return [];
  }
}

/**
 * 행성 정보 간략 조회 (자주 사용되는 필드만)
 * 
 * @param sessionId 세션 ID
 * @param planetId 행성 ID
 * @returns 행성 간략 정보 또는 null
 */
export async function getPlanetSummary(
  sessionId: string,
  planetId: string
): Promise<{
  planetId: string;
  name: string;
  owner: string | null;
  population: number;
  morale: number;
  loyalty: number;
  defenseRating: number;
  isHomeworld: boolean;
} | null> {
  try {
    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) return null;

    return {
      planetId: planet.planetId,
      name: planet.name,
      owner: planet.controllingFaction || planet.ownerId || null,
      population: planet.population,
      morale: planet.morale,
      loyalty: planet.loyalty,
      defenseRating: planet.defenseRating,
      isHomeworld: planet.isHomeworld
    };
  } catch (error) {
    logger.error(`[PlanetHelpers] Error getting planet summary:`, error);
    return null;
  }
}

// 기본 내보내기
export const PlanetHelpers = {
  isHostilePlanet,
  isEnemyOrHostilePlanet,
  getPlanetOwner,
  getFactionRelation,
  getHostileFactions,
  getFactionPlanets,
  isCapitalPlanet,
  getPlanetDefenseRating,
  getPlanetGarrison,
  getPlanetSummary
};

export default PlanetHelpers;



