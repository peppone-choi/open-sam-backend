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
