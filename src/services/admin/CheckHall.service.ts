import { generalRepository } from '../../repositories/general.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { Hall } from '../../models/hall.model';

/**
 * CheckHall Service
 * 명예의 전당에 장수 통계를 기록하는 서비스
 * PHP: func.php의 CheckHall 함수
 */
export class CheckHallService {
  static async execute(generalNo: number, sessionId: string) {
    try {
      const general = await generalRepository.findBySessionAndNo({
        session_id: sessionId,
        'data.no': generalNo
      });

      if (!general) {
        return { success: false, reason: '장수를 찾을 수 없습니다' };
      }

      const genData = general.data || {};
      
      // 기본 통계 계산 (단순화 버전)
      const experience = genData.experience || 0;
      const dedication = genData.dedication || 0;
      const firenum = genData.firenum || 0;
      const warnum = genData.warnum || 0;
      const killnum = genData.killnum || 0;
      const occupied = genData.occupied || 0;
      const killcrew = genData.killcrew || 0;

      // 승률 계산
      const winrate = warnum > 0 ? killnum / warnum : 0;
      const killrate = (genData.deathcrew || 0) > 0 ? killcrew / (genData.deathcrew || 1) : 0;

      // 명예의 전당 기록
      const session = await sessionRepository.findBySessionId(sessionId );
      const sessionData = session?.data || {};
      const season = sessionData.season || 1;
      const scenario = sessionData.scenario || 0;
      const owner = general.owner ? parseInt(String(general.owner)) : null;

      const hallRecords = [
        { type: 'experience', value: experience },
        { type: 'dedication', value: dedication },
        { type: 'firenum', value: firenum },
        { type: 'warnum', value: warnum },
        { type: 'killnum', value: killnum },
        { type: 'winrate', value: winrate },
        { type: 'occupied', value: occupied },
        { type: 'killcrew', value: killcrew },
        { type: 'killrate', value: killrate }
      ];

      // Hall에 기록 (upsert)
      for (const record of hallRecords) {
        await Hall.findOneAndUpdate(
          {
            server_id: sessionId,
            season,
            scenario,
            general_no: generalNo,
            type: record.type
          },
          {
            server_id: sessionId,
            season,
            scenario,
            general_no: generalNo,
            type: record.type,
            value: record.value,
            owner,
            aux: {
              name: genData.name || general.name,
              picture: genData.picture || '',
              color: genData.color || '#000000'
            }
          },
          { upsert: true, new: true }
        );
      }

      return {
        success: true,
        stats: {
          experience,
          dedication,
          firenum,
          warnum,
          killnum,
          occupied,
          killcrew,
          winrate,
          killrate
        }
      };
    } catch (error: any) {
      return {
        success: false,
        reason: error.message || 'CheckHall 처리 중 오류가 발생했습니다'
      };
    }
  }
}

