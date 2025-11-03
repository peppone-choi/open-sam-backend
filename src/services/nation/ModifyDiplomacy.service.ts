import { General } from '../../models/general.model';
import { Diplomacy } from '../../models/diplomacy.model';

/**
 * ModifyDiplomacy Service
 * 외교 관계 수정
 */
export class ModifyDiplomacyService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const targetNationId = parseInt(data.targetNationId || data.target_nation_id);
    const dipState = parseInt(data.state || data.dipState);
    const term = data.term ? parseInt(data.term) : null;
    
    try {
      if (!generalId) {
        return { success: false, message: '장수 ID가 필요합니다' };
      }

      if (!targetNationId) {
        return { success: false, message: '대상 국가 ID가 필요합니다' };
      }

      if (dipState === undefined) {
        return { success: false, message: '외교 상태가 필요합니다' };
      }

      const general = await (General as any).findOne({
        session_id: sessionId,
        'data.no': generalId
      });

      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다' };
      }

      const nationId = general.data?.nation || 0;
      const permission = general.data?.permission || 'normal';
      const officerLevel = general.data?.officer_level || 0;

      if (nationId === 0) {
        return { success: false, message: '국가에 소속되어 있지 않습니다' };
      }

      if (permission !== 'ambassador' && officerLevel < 5) {
        return { success: false, message: '권한이 부족합니다. 외교권자 또는 수뇌부만 외교 관계를 수정할 수 있습니다' };
      }

      if (nationId === targetNationId) {
        return { success: false, message: '자신의 국가와는 외교 관계를 설정할 수 없습니다' };
      }

      const existingDiplomacy = await (Diplomacy as any).findOne({
        session_id: sessionId,
        me: nationId,
        you: targetNationId
      });

      if (existingDiplomacy) {
        await (Diplomacy as any).updateOne(
          {
            session_id: sessionId,
            me: nationId,
            you: targetNationId
          },
          {
            $set: {
              state: dipState,
              term: term || existingDiplomacy.term
            }
          }
        );
      } else {
        await (Diplomacy as any).create({
          session_id: sessionId,
          me: nationId,
          you: targetNationId,
          state: dipState,
          term: term || 0
        });
      }

      const reverseDip = await (Diplomacy as any).findOne({
        session_id: sessionId,
        me: targetNationId,
        you: nationId
      });

      if (reverseDip) {
        await (Diplomacy as any).updateOne(
          {
            session_id: sessionId,
            me: targetNationId,
            you: nationId
          },
          {
            $set: {
              state: dipState,
              term: term || reverseDip.term
            }
          }
        );
      } else {
        await (Diplomacy as any).create({
          session_id: sessionId,
          me: targetNationId,
          you: nationId,
          state: dipState,
          term: term || 0
        });
      }

      const stateNames: Record<number, string> = {
        0: '전쟁',
        1: '적대',
        2: '중립',
        3: '우호',
        4: '불가침',
        5: '동맹',
        7: '자국'
      };

      return {
        success: true,
        result: true,
        message: `외교 관계가 ${stateNames[dipState] || '알 수 없음'}(으)로 변경되었습니다`
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}
