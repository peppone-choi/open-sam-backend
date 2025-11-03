import { generalRepository } from '../../repositories/general.repository';
import { General } from '../../models/general.model';
import { Session } from '../../models/session.model';
import { City } from '../../models/city.model';
import { GeneralRecord } from '../../models/general_record.model';
import crypto from 'crypto';

/**
 * InstantRetreat Service (접경귀환)
 * 장수를 가까운 아국 도시로 즉시 이동
 */
export class InstantRetreatService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    
    try {
      if (!generalId) {
        return {
          success: false,
          message: '장수 정보가 없습니다'
        };
      }

      // 1. 게임 환경 설정 로드
      const session = await (Session as any).findOne({ session_id: sessionId });
      if (!session) {
        return { success: false, message: '세션을 찾을 수 없습니다' };
      }

      const gameEnv = session.data?.game_env || {};
      
      // 2. 시나리오에서 접경귀환 가능 여부 확인
      const availableInstantAction = gameEnv.availableInstantAction || {};
      if (!availableInstantAction.instantRetreat) {
        return {
          success: false,
          message: '접경귀환을 사용할 수 없는 시나리오입니다.'
        };
      }

      // 3. 장수 정보 조회
      const general = await (General as any).findOne({ no: generalId, session_id: sessionId });
      if (!general) {
        return {
          success: false,
          message: '장수가 없습니다'
        };
      }

      // 4. 접경귀환 커맨드 실행 조건 체크
      // TODO: buildGeneralCommandClass 구현 필요
      // 현재는 기본 체크만 수행
      const nation = general.getVar('nation') || 0;
      if (nation === 0) {
        return {
          success: false,
          message: '야인 상태에서는 접경귀환을 사용할 수 없습니다.'
        };
      }

      // 5. 가까운 아국 도시 찾기 로직 (PHP의 run() 결과 시뮬레이션)
      const nearCities = await (City as any).find({
        session_id: sessionId,
        nation: nation,
        level: { $gte: 1 }
      }).sort({ city: 1 }).limit(10);

      if (nearCities.length === 0) {
        return {
          success: false,
          message: '가까운 아국 도시가 없습니다.'
        };
      }

      // 6. RNG를 사용하여 도시 선택 (deterministic)
      const currentCity = general.getVar('city') || 0;
      const seed = this.generateSeed(
        generalId,
        gameEnv.year || 184,
        gameEnv.month || 1,
        currentCity
      );
      const selectedCity = nearCities[Math.abs(seed) % nearCities.length];

      // 7. 장수를 선택된 도시로 이동
      general.setVar('city', selectedCity.city);
      await general.save();

      // 8. 로그 기록
      const { getNextRecordId } = await import('../../utils/record-helpers');
      const recordId = await getNextRecordId(sessionId);
      await (GeneralRecord as any).create({
        session_id: sessionId,
        data: {
          id: recordId,
          general_id: generalId,
          year: gameEnv.year || 184,
          month: gameEnv.month || 1,
          log_type: 'action',
          text: `접경귀환으로 ${selectedCity.name}(으)로 이동하였습니다.`,
          date: new Date().toISOString()
        }
      });

      return {
        success: true,
        result: true,
        message: '접경귀환 성공',
        data: {
          cityId: selectedCity.city,
          cityName: selectedCity.name
        }
      };

    } catch (error: any) {
      console.error('InstantRetreat error:', error);
      return {
        success: false,
        message: error.message || '접경귀환 중 오류가 발생했습니다'
      };
    }
  }

  /**
   * PHP의 LiteHashDRBG를 시뮬레이션하는 시드 생성
   */
  private static generateSeed(
    generalId: number,
    year: number,
    month: number,
    cityId: number
  ): number {
    const data = `InstantRetreat-${generalId}-${year}-${month}-${cityId}`;
    const hash = crypto.createHash('sha256').update(data).digest();
    return hash.readInt32BE(0);
  }
}
