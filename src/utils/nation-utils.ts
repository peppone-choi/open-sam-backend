/**
 * Nation Utilities
 * PHP func.php 국가 관련 함수 구현
 */

import { Nation, INation } from '../models/nation.model';
import { General } from '../models/general.model';
import { City } from '../models/city.model';
import { Model } from 'mongoose';

/**
 * 국가 정적 정보 갱신
 * PHP: refreshNationStaticInfo()
 */
export async function refreshNationStaticInfo(
  sessionId?: string,
  nationNum?: number
): Promise<void> {
  try {
    // TODO: 실제 구현 필요
    // PHP에서는 국가의 도시 수, 장수 수 등을 계산하여 업데이트
    console.log('[refreshNationStaticInfo] Called', { sessionId, nationNum });
    
    // 기본 구현: 모든 국가 또는 특정 국가의 통계 업데이트
    const filter: any = {};
    if (sessionId) filter.session_id = sessionId;
    if (nationNum !== undefined) filter.nation = nationNum;
    
    // 각 국가별 도시 수, 장수 수 계산
    // (실제로는 aggregation pipeline 사용 권장)
    
  } catch (error) {
    console.error('[refreshNationStaticInfo] Error:', error);
  }
}

/**
 * 국가 정적 정보 조회
 * PHP: getNationStaticInfo()
 */
export async function getNationStaticInfo(
  sessionId: string,
  nationNum: number
): Promise<any> {
  try {
    const nation = await (Nation as Model<INation>).findOne({
      session_id: sessionId,
      nation: nationNum
    });
    
    if (!nation) {
      return null;
    }
    
    // 도시 수 계산
    const cityCount = await (City as any).countDocuments({
      session_id: sessionId,
      nation: nationNum
    });
    
    // 장수 수 계산
    const generalCount = await (General as any).countDocuments({
      session_id: sessionId,
      nation: nationNum
    });
    
    return {
      nation,
      cityCount,
      generalCount
    };
  } catch (error) {
    console.error('[getNationStaticInfo] Error:', error);
    return null;
  }
}

/**
 * 국가 삭제
 * PHP: deleteNation($nationID)
 */
export async function deleteNation(
  sessionId: string,
  nationNum: number
): Promise<void> {
  try {
    // 국가 문서 삭제
    await (Nation as Model<INation>).deleteMany({
      session_id: sessionId,
      nation: nationNum
    });
    
    console.log(`[deleteNation] Deleted nation ${nationNum} from session ${sessionId}`);
  } catch (error) {
    console.error('[deleteNation] Error:', error);
    throw error;
  }
}

/**
 * 국가가 존재하는지 확인
 */
export async function nationExists(
  sessionId: string,
  nationNum: number
): Promise<boolean> {
  const count = await (Nation as any).countDocuments({
    session_id: sessionId,
    nation: nationNum
  });
  
  return count > 0;
}

/**
 * 국가 이름 조회
 */
export async function getNationName(
  sessionId: string,
  nationNum: number
): Promise<string | null> {
  const nation = await (Nation as Model<INation>).findOne({
    session_id: sessionId,
    nation: nationNum
  });
  
  return nation?.name || null;
}

/**
 * 국력 계산 가중치
 */
const POWER_WEIGHTS = {
  population: 0.0001,
  cities: 10,
  generals: 5,
  gold: 0.001,
  rice: 0.001,
  tech: 0.5,
  military: 0.01,
  facilities: 0.001,
  avgAbility: 0.5,
};

/**
 * 국력 계산
 * PHP getNationPower() 기반
 * 
 * @param sessionId 세션 ID
 * @param nationNum 국가 번호
 * @returns 국력 점수
 */
export async function calculateNationPower(
  sessionId: string,
  nationNum: number
): Promise<number> {
  try {
    const nation = await (Nation as Model<INation>).findOne({
      session_id: sessionId,
      nation: nationNum
    });
    
    if (!nation) return 0;
    
    const nationData = nation.data || {};
    
    // 도시 통계
    const cities = await (City as any).find({
      session_id: sessionId,
      nation: nationNum
    });
    
    let totalPopulation = 0;
    let totalFacilities = 0;
    
    for (const city of cities) {
      totalPopulation += city.pop || 0;
      totalFacilities += (city.agri || 0) + (city.comm || 0) + (city.def || 0) + (city.wall || 0);
    }
    
    // 장수 통계
    const generals = await (General as any).find({
      session_id: sessionId,
      'data.nation': nationNum
    });
    
    let totalCrew = 0;
    let avgAbility = 0;
    
    for (const general of generals) {
      const genData = general.data || {};
      totalCrew += genData.crew || 0;
      avgAbility += (genData.leadership || 0) + (genData.strength || 0) + (genData.intel || 0);
    }
    
    if (generals.length > 0) {
      avgAbility = avgAbility / generals.length;
    }
    
    // 경제력
    const economicPower = 
      totalPopulation * POWER_WEIGHTS.population +
      totalFacilities * POWER_WEIGHTS.facilities +
      (nationData.gold || 0) * POWER_WEIGHTS.gold +
      (nationData.rice || 0) * POWER_WEIGHTS.rice;
    
    // 군사력
    const militaryPower = 
      totalCrew * POWER_WEIGHTS.military +
      generals.length * POWER_WEIGHTS.generals +
      avgAbility * POWER_WEIGHTS.avgAbility;
    
    // 총 국력
    const power = Math.round(
      economicPower +
      militaryPower +
      cities.length * POWER_WEIGHTS.cities +
      (nationData.tech || 0) * POWER_WEIGHTS.tech
    );
    
    return power;
  } catch (error) {
    console.error('[calculateNationPower] Error:', error);
    return 0;
  }
}

/**
 * 모든 국가 국력 갱신
 */
export async function refreshAllNationPower(sessionId: string): Promise<void> {
  try {
    const nations = await (Nation as Model<INation>).find({ session_id: sessionId });
    
    for (const nation of nations) {
      const nationNum = nation.nation || nation.data?.nation;
      if (!nationNum || nationNum === 0) continue;
      
      const power = await calculateNationPower(sessionId, nationNum);
      
      await (Nation as Model<INation>).updateOne(
        { session_id: sessionId, nation: nationNum },
        { $set: { 'data.power': power } }
      );
    }
    
    console.log(`[refreshAllNationPower] Updated power for ${nations.length} nations`);
  } catch (error) {
    console.error('[refreshAllNationPower] Error:', error);
  }
}
