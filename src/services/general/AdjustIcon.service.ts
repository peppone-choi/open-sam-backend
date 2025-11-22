import { generalRepository } from '../../repositories/general.repository';
import { userRepository } from '../../repositories/user.repository';
import { FeatureFlags } from '../../config/featureFlags';


/**
 * AdjustIcon Service
 * 회원 정보의 아이콘을 장수에게 동기화
 * PHP: j_adjust_icon.php
 */
export class AdjustIconService {
  static async execute(data: any, user?: any) {
    const userId = user?.id;

    if (!userId) {
      return {
        result: false,
        reason: '로그인이 필요합니다'
      };
    }

    try {
      let picture = user?.picture ?? null;
      let imgsvr = typeof user?.imgsvr === 'number' ? user.imgsvr : 0;

      const userDoc = userId ? await userRepository.findById(String(userId)) : null;
      if (userDoc) {
        picture = picture ?? userDoc.picture ?? userDoc.avatarUrl ?? null;
        imgsvr = userDoc.imgsvr ?? imgsvr ?? 0;
      } else if (FeatureFlags.isRootDBEnabled()) {
        return {
          result: false,
          reason: 'RootDB 연결이 필요합니다'
        };
      }

      if (!picture && imgsvr === 0) {
        return {
          result: false,
          reason: '회원 기록 정보가 없습니다'
        };
      }

      // 현재 세션의 모든 장수 아이콘 업데이트 (npc=0인 경우만)

      const sessionId = data.session_id || 'sangokushi_default';
      const updateResult = await generalRepository.updateManyByFilter(
        {
          session_id: sessionId,
          owner: userId.toString(),
          npc: { $ne: 2 } // NPC가 아닌 경우만
        },
        {
          $set: {
            picture: picture || null,
            'data.imgsvr': imgsvr || 0
          }
        }
      );

      const affected = updateResult.modifiedCount;

      if (affected === 0) {
        return {
          result: true,
          reason: '등록된 장수가 없습니다'
        };
      }

      return {
        result: true,
        reason: 'success',
        affected
      };
    } catch (error: any) {
      console.error('AdjustIcon error:', error);
      return {
        result: false,
        reason: error.message || '아이콘 조정 실패'
      };
    }
  }
}

