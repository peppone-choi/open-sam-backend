import mongoose from 'mongoose';
import { Nation } from '../../models/nation.model';
import { General } from '../../models/general.model';
import { City } from '../../models/city.model';
import { Diplomacy } from '../../models/diplomacy.model';
import { logger } from '../../common/logger';
import { invalidateCache } from '../../common/cache/model-cache.helper';

/**
 * 국가 멸망 트랜잭션
 * 
 * MongoDB 트랜잭션을 사용하여 다음 작업을 원자적으로 처리:
 * 1. 국가 상태 변경 (멸망)
 * 2. 모든 소속 장수 재배치 (재야/타국 투항)
 * 3. 모든 소속 도시 중립화
 * 4. 외교 관계 정리
 * 
 * @param sessionId - 세션 ID
 * @param nationId - 멸망하는 국가 ID
 * @returns 성공 여부
 */
export async function processNationDestruction(
  sessionId: string,
  nationId: number
): Promise<boolean> {
  const session = await mongoose.startSession();
  
  try {
    const result = await session.withTransaction(async () => {
      // 1. 국가 조회 및 상태 변경
      const nation = await Nation.findOne({
        session_id: sessionId,
        nation: nationId
      }).session(session);
      
      if (!nation) {
        throw new Error(`국가를 찾을 수 없음: ${nationId}`);
      }
      
      nation.status = 'destroyed';
      nation.destroyed_at = new Date();
      nation.city_count = 0;
      await nation.save({ session });
      
      logger.info('국가 멸망 처리', { sessionId, nationId });
      
      // 2. 소속 장수 재배치
      const generals = await General.find({
        session_id: sessionId,
        nation: nationId,
        'data.officer_level': { $gt: 0 } // 재야 제외
      }).session(session);
      
      for (const general of generals) {
        general.nation = 0; // 재야로 전환
        general.city = 0;
        general.officer_level = 0;
        general.last_action = 'nation_destroyed';
        general.last_action_at = new Date();
        await general.save({ session });
      }
      
      logger.info('소속 장수 재야 전환', { 
        sessionId, nationId, 
        generalCount: generals.length 
      });
      
      // 3. 소속 도시 중립화
      const cities = await City.find({
        session_id: sessionId,
        nation: nationId
      }).session(session);
      
      for (const city of cities) {
        city.nation = 0; // 중립
        city.occupied_at = new Date();
        await city.save({ session });
      }
      
      logger.info('소속 도시 중립화', { 
        sessionId, nationId, 
        cityCount: cities.length 
      });
      
      // 4. 외교 관계 정리
      await Diplomacy.deleteMany({
        session_id: sessionId,
        $or: [
          { nation_a: nationId },
          { nation_b: nationId }
        ]
      }).session(session);
      
      logger.info('외교 관계 정리 완료', { sessionId, nationId });
      
      return { 
        success: true, 
        generalCount: generals.length, 
        cityCount: cities.length 
      };
    }, {
      readPreference: 'primary',
      readConcern: { level: 'local' },
      writeConcern: { w: 'majority' },
      maxCommitTimeMS: 60000 // 1분 (많은 문서 업데이트)
    });
    
    // 트랜잭션 성공 후 캐시 대량 무효화
    await Promise.all([
      invalidateCache('nation', sessionId, nationId, { targets: ['entity', 'lists'] }),
      invalidateCache('general', sessionId, undefined, { targets: ['lists'] }),
      invalidateCache('city', sessionId, undefined, { targets: ['lists'] })
    ]);
    
    logger.info('국가 멸망 트랜잭션 완료', { 
      sessionId, nationId, 
      result 
    });
    
    return true;
  } catch (error: any) {
    logger.error('국가 멸망 트랜잭션 실패', {
      sessionId, nationId,
      error: error.message,
      stack: error.stack
    });
    return false;
  } finally {
    await session.endSession();
  }
}
