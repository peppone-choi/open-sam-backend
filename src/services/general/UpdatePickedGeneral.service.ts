// @ts-nocheck - Type issues need investigation
import { SelectPool } from '../../models/select_pool.model';
import { generalRepository } from '../../repositories/general.repository';
import { sessionRepository } from '../../repositories/session.repository';

/**
 * UpdatePickedGeneral Service
 * 선택된 장수 업데이트 (npcmode==2 전용)
 * PHP: j_update_picked_general.php
 */
export class UpdatePickedGeneralService {
  static async execute(data: any, user?: any) {
    const userId = user?.id;
    const sessionId = data.session_id || 'sangokushi_default';
    const pick = data.pick; // unique_name

    if (!userId) {
      return {
        result: false,
        reason: '로그인이 필요합니다'
      };
    }

    if (!pick) {
      return {
        result: false,
        reason: '장수를 선택하지 않았습니다'
      };
    }

    try {
      // 세션 정보 확인
      const session = await sessionRepository.findBySessionId(sessionId );
      if (!session) {
        return {
          result: false,
          reason: '세션을 찾을 수 없습니다'
        };
      }

      const sessionData = session.config || session.data || {};
      const npcmode = sessionData.npcmode || 0;
      const turnterm = sessionData.turnterm || 60; // 분 단위

      if (npcmode !== 2) {
        return {
          result: false,
          reason: '선택 가능한 서버가 아닙니다'
        };
      }

      // 기존 장수 확인
      const existingGeneral = await generalRepository.findBySessionAndOwner(sessionId, userId.toString());

      if (!existingGeneral) {
        return {
          result: false,
          reason: '장수가 생성하지 않았습니다. 이미 사망하지 않았는지 확인해보세요.'
        };
      }

      const now = new Date();

      // 선택 풀에서 정보 가져오기
      const selectPool = await SelectPool.findOne({
        session_id: sessionId,
        'data.owner': userId.toString(),
        'data.reserved_until': { $gte: now },
        'data.unique_name': pick
      });

      if (!selectPool || !selectPool.data?.info) {
        return {
          result: false,
          reason: '유효한 장수 목록이 없습니다.'
        };
      }

      const selectInfo = selectPool.data.info;
      const oldGeneralName = existingGeneral.name;

      // 회원 정보 가져오기
      const ownerInfo = {
        name: user?.name || 'Unknown',
        picture: user?.picture || null,
        imgsvr: user?.imgsvr || 0
      };

      // 기존 선택 풀 정리
      await SelectPool.updateMany(
        {
          session_id: sessionId,
          'data.unique_name': { $ne: pick },
          'data.general_id': existingGeneral.no
        },
        {
          $set: {
            'data.general_id': null,
            'data.owner': null,
            'data.reserved_until': null
          }
        }
      );

      // 선택된 풀 업데이트
      const updateResult = await SelectPool.updateOne(
        {
          session_id: sessionId,
          'data.unique_name': pick,
          'data.reserved_until': { $gte: now },
          'data.owner': userId.toString()
        },
        {
          $set: {
            'data.general_id': existingGeneral.no
          }
        }
      );

      if (updateResult.matchedCount === 0) {
        return {
          result: false,
          reason: '동시성 제어에 문제가 발생했습니다. 버그 제보를 부탁드립니다.'
        };
      }

      // 장수 정보 업데이트
      const genData = existingGeneral.data || {};

      if (selectInfo.leadership !== undefined) {
        genData.leadership = selectInfo.leadership;
        genData.strength = selectInfo.strength;
        genData.intel = selectInfo.intel;
      }

      if (selectInfo.picture !== undefined) {
        genData.imgsvr = selectInfo.imgsvr || 0;
        existingGeneral.picture = selectInfo.picture || null;
      }

      if (selectInfo.generalName !== undefined) {
        existingGeneral.name = selectInfo.generalName;
      }

      if (selectInfo.dex && Array.isArray(selectInfo.dex)) {
        genData.dex1 = selectInfo.dex[0] || 0;
        genData.dex2 = selectInfo.dex[1] || 0;
        genData.dex3 = selectInfo.dex[2] || 0;
        genData.dex4 = selectInfo.dex[3] || 0;
        genData.dex5 = selectInfo.dex[4] || 0;
      }

      if (selectInfo.ego !== undefined) {
        genData.personal = selectInfo.ego;
      }

      if (selectInfo.specialDomestic !== undefined) {
        genData.special = selectInfo.specialDomestic;
      }

      if (selectInfo.specialWar !== undefined) {
        genData.special2 = selectInfo.specialWar;
      }

      genData.owner_name = ownerInfo.name;

      // aux 업데이트
      const aux = genData.aux || {};
      const nextChangeDate = new Date(Date.now() + 12 * turnterm * 60000);
      aux.next_change = nextChangeDate.toISOString();
      genData.aux = aux;

      existingGeneral.data = genData;
      await existingGeneral.save();

      // 선택 풀 정리
      await SelectPool.updateMany(
        {
          session_id: sessionId,
          'data.owner': userId.toString(),
          'data.general_id': null
        },
        {
          $set: {
            'data.owner': null,
            'data.reserved_until': null
          }
        }
      );

      // TODO: ActionLogger로 로그 남기기
      console.log(`[UpdatePickedGeneral] ${oldGeneralName} -> ${selectInfo.generalName}`);

      return {
        result: true,
        reason: 'success',
        general_id: existingGeneral.no,
        old_name: oldGeneralName,
        new_name: selectInfo.generalName
      };
    } catch (error: any) {
      console.error('UpdatePickedGeneral error:', error);
      return {
        result: false,
        reason: error.message || '장수 업데이트 실패'
      };
    }
  }
}

