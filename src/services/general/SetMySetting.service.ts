import { General } from '../../models/general.model';
import { User } from '../../models/user.model';
import { Session } from '../../models/session.model';

/**
 * SetMySetting Service
 * 사용자 설정 저장 (PHP: j_set_my_setting.php)
 * defence_train, use_treatment, use_auto_nation_turn, tnmt 등 설정
 */
export class SetMySettingService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const userId = user?.userId || data.user_id;
    const generalId = user?.generalId || data.general_id;
    
    try {
      if (!userId || !generalId) {
        return {
          result: false,
          reason: '로그인이 필요합니다'
        };
      }

      // 입력값 검증
      const defenceTrain = Math.max(40, Math.min(999, data.defence_train || 80));
      const useTreatment = Math.max(10, Math.min(100, data.use_treatment || 10));
      const useAutoNationTurn = data.use_auto_nation_turn !== undefined ? data.use_auto_nation_turn : 1;
      const tnmt = data.tnmt !== undefined ? Math.max(0, Math.min(1, data.tnmt)) : 1;
      const detachNPC = data.detachNPC || false;

      // defence_train 값 정규화
      let normalizedDefenceTrain = defenceTrain;
      if (defenceTrain <= 90) {
        normalizedDefenceTrain = Math.round(defenceTrain / 10) * 10;
      } else {
        normalizedDefenceTrain = 999;
      }

      // 장수 조회
      const general = await (General as any).findOne({
        session_id: sessionId,
        owner: userId,
        'data.no': generalId
      });

      if (!general) {
        return {
          result: false,
          reason: '장수를 찾을 수 없습니다'
        };
      }

      const genData = general.data || {};
      const updateData: any = {};

      // defence_train 변경 시 효과 적용
      if (normalizedDefenceTrain !== genData.defence_train) {
        updateData['data.defence_train'] = normalizedDefenceTrain;
        
        // myset 감소
        updateData['data.myset'] = (genData.myset || 0) - 1;

        if (normalizedDefenceTrain === 999) {
          // 훈련도와 사기 감소
          const affectedTrain = Math.max(20, (genData.train || 80) - 3);
          const affectedAtmos = Math.max(20, (genData.atmos || 80) - 6);
          updateData['data.train'] = affectedTrain;
          updateData['data.atmos'] = affectedAtmos;
        }
      }

      // aux 변수 설정
      const aux = genData.aux || {};
      aux.use_treatment = useTreatment;
      aux.use_auto_nation_turn = useAutoNationTurn;
      updateData['data.aux'] = aux;

      // tnmt 설정
      updateData['data.tnmt'] = tnmt;

      // NPC 분리 처리
      if (genData.npc === 1 && detachNPC) {
        const session = await (Session as any).findOne({ session_id: sessionId });
        const sessionData = session?.data || {};
        const turnterm = sessionData.turnterm || 60;

        let targetKillTurn;
        if (turnterm < 10) {
          targetKillTurn = 30 / turnterm;
        } else {
          targetKillTurn = 60 / turnterm;
        }
        updateData['data.killturn'] = targetKillTurn;
      }

      // 사용자 패널티 정보 업데이트
      const user = await (User as any).findById(userId);
      if (user && user.penalty) {
        const penalty = typeof user.penalty === 'string' ? JSON.parse(user.penalty) : user.penalty;
        updateData['data.penalty'] = JSON.stringify(penalty);
      }

      // 업데이트 실행
      await (General as any).updateOne(
        {
          session_id: sessionId,
          owner: userId,
          'data.no': generalId
        },
        {
          $set: updateData
        }
      );

      return {
        result: true,
        reason: 'success'
      };
    } catch (error: any) {
      console.error('SetMySetting error:', error);
      return {
        result: false,
        reason: error.message || '설정 저장 실패'
      };
    }
  }
}

