import mongoose from 'mongoose';
import { City } from '../../models/city.model';
import { General } from '../../models/general.model';
import { Nation } from '../../models/nation.model';
import { logger } from '../../common/logger';
import { invalidateCache } from '../../common/cache/model-cache.helper';

/**
 * 도시 점령 트랜잭션
 * 
 * MongoDB 트랜잭션을 사용하여 다음 작업을 원자적으로 처리:
 * 1. 도시 소유권 변경
 * 2. 점령 장수 위치 업데이트
 * 3. 구 국가 영토 감소
 * 4. 신 국가 영토 증가
 * 
 * @param sessionId - 세션 ID
 * @param cityId - 도시 ID
 * @param newNationId - 새로운 소유 국가 ID
 * @param occupyingGeneralId - 점령 장수 ID
 * @returns 성공 여부
 */
export async function processCityOccupation(
  sessionId: string,
  cityId: number,
  newNationId: number,
  occupyingGeneralId: number
): Promise<boolean> {
  const session = await mongoose.startSession();
  
  try {
    const result = await session.withTransaction(async () => {
      // 1. 도시 조회 및 소유권 변경
      const city = await City.findOne({ 
        session_id: sessionId, 
        city: cityId 
      }).session(session);
      
      if (!city) {
        throw new Error(`도시를 찾을 수 없음: ${cityId}`);
      }
      
      const oldNationId = city.nation;
      city.nation = newNationId;
      city.occupied_at = new Date();
      await city.save({ session });
      
      logger.info('도시 소유권 변경', { 
        sessionId, cityId, 
        oldNation: oldNationId, 
        newNation: newNationId 
      });
      
      // 2. 점령 장수 위치 업데이트
      const general = await General.findOne({
        session_id: sessionId,
        no: occupyingGeneralId
      }).session(session);
      
      if (general) {
        general.city = cityId;
        general.last_action = 'occupy_city';
        general.last_action_at = new Date();
        await general.save({ session });
        
        logger.info('장수 위치 업데이트', { 
          sessionId, generalId: occupyingGeneralId, cityId 
        });
      }
      
      // 3. 구 국가 영토 감소
      if (oldNationId > 0) {
        const oldNation = await Nation.findOne({
          session_id: sessionId,
          nation: oldNationId
        }).session(session);
        
        if (oldNation) {
          oldNation.city_count = Math.max(0, (oldNation.city_count || 0) - 1);
          await oldNation.save({ session });
          
          logger.info('구 국가 영토 감소', { 
            sessionId, nationId: oldNationId, 
            cityCount: oldNation.city_count 
          });
        }
      }
      
      // 4. 신 국가 영토 증가
      const newNation = await Nation.findOne({
        session_id: sessionId,
        nation: newNationId
      }).session(session);
      
      if (newNation) {
        newNation.city_count = (newNation.city_count || 0) + 1;
        await newNation.save({ session });
        
        logger.info('신 국가 영토 증가', { 
          sessionId, nationId: newNationId, 
          cityCount: newNation.city_count 
        });
      }
      
      return { success: true, oldNationId, newNationId };
    }, {
      readPreference: 'primary',
      readConcern: { level: 'local' },
      writeConcern: { w: 'majority' },
      maxCommitTimeMS: 30000
    });
    
    // 트랜잭션 성공 후 캐시 무효화
    await Promise.all([
      invalidateCache('city', sessionId, cityId),
      invalidateCache('general', sessionId, occupyingGeneralId),
      result.oldNationId > 0 && invalidateCache('nation', sessionId, result.oldNationId),
      invalidateCache('nation', sessionId, result.newNationId)
    ].filter(Boolean));
    
    logger.info('도시 점령 트랜잭션 완료', { 
      sessionId, cityId, newNationId, occupyingGeneralId 
    });
    
    return true;
  } catch (error: any) {
    logger.error('도시 점령 트랜잭션 실패', {
      sessionId, cityId, newNationId, occupyingGeneralId,
      error: error.message,
      stack: error.stack
    });
    return false;
  } finally {
    await session.endSession();
  }
}
