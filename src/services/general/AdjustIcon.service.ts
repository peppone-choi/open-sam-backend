import { General } from '../../models/general.model';
import mongoose from 'mongoose';

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
      // RootDB에서 회원 정보 조회 (레거시와 동일)
      // RootDB는 별도의 connection을 사용하므로 직접 쿼리
      const rootDb = mongoose.connection.db?.admin() 
        ? mongoose.connection.db 
        : null;

      if (!rootDb) {
        // RootDB 연결이 없으면 일반 DB에서 조회 시도
        // 실제로는 RootDB 모델이나 별도 연결이 필요할 수 있음
        return {
          result: false,
          reason: 'RootDB 연결이 필요합니다'
        };
      }

      // 실제 구현에서는 RootDB 컬렉션에 직접 접근해야 함
      // 임시로 사용자 정보에서 가져오기 (user 객체에 picture, imgsvr가 있다고 가정)
      const picture = user?.picture || null;
      const imgsvr = user?.imgsvr || 0;

      if (!picture && imgsvr === 0) {
        // RootDB에서 실제로 조회해야 하는 경우
        // TODO: RootDB 연결 구현 필요
        return {
          result: false,
          reason: '회원 기록 정보가 없습니다'
        };
      }

      // 현재 세션의 모든 장수 아이콘 업데이트 (npc=0인 경우만)
      const sessionId = data.session_id || 'sangokushi_default';
      const updateResult = await (General as any).updateMany(
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

