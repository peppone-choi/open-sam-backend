// @ts-nocheck - Type issues need investigation
import { SelectNpcToken } from '../../models/select_npc_token.model';
import { generalRepository } from '../../repositories/general.repository';
import { sessionRepository } from '../../repositories/session.repository';
import mongoose from 'mongoose';

/**
 * SelectNpc Service
 * NPC 선택 및 빙의 (npcmode==1 전용)
 * PHP: j_select_npc.php
 */
export class SelectNpcService {
  static async execute(data: any, user?: any) {
    const userId = user?.id;
    const sessionId = data.session_id || 'sangokushi_default';
    const pick = parseInt(data.pick); // NPC general no

    if (!userId) {
      return {
        result: false,
        reason: '로그인이 필요합니다'
      };
    }

    if (!pick || pick <= 0) {
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
      const maxgeneral = sessionData.maxgeneral || 50;
      const year = sessionData.year || 184;
      const month = sessionData.month || 1;

      if (npcmode !== 1) {
        return {
          result: false,
          reason: '빙의 가능한 서버가 아닙니다'
        };
      }

      // 장수 수 확인
      const generalCount = await generalRepository.count({
        session_id: sessionId,
        npc: { $lt: 2 }
      });

      if (generalCount >= maxgeneral) {
        return {
          result: false,
          reason: '더 이상 등록할 수 없습니다.'
        };
      }

      const now = new Date();

      // NPC 토큰에서 선택 가능한지 확인
      const token = await SelectNpcToken.findOne({
        session_id: sessionId,
        'data.owner': userId.toString(),
        'data.valid_until': { $gte: now }
      });

      if (!token || !token.pick_result) {
        return {
          result: false,
          reason: '유효한 장수 목록이 없습니다.'
        };
      }

      const pickResult = token.pick_result;
      
      if (!pickResult[pick]) {
        return {
          result: false,
          reason: '선택한 장수가 목록에 없습니다.'
        };
      }

      const pickedNPC = pickResult[pick];

      // 선택한 NPC 장수 조회 및 업데이트
      // owner 필드가 없거나 '0' 이하인 NPC 찾기
      const npcGeneral = await generalRepository.findBySessionAndNo({
        session_id: sessionId,
        'data.no': pick,
        npc: 2,
        $or: [
          { owner: { $exists: false } },
          { owner: '0' },
          { owner: { $lt: '1' } }
        ]
      });

      if (!npcGeneral) {
        return {
          result: false,
          reason: '장수 등록에 실패했습니다.'
        };
      }

      // 회원 정보 가져오기
      const ownerName = user?.name || 'Unknown';
      
      // TODO: RootDB에서 penalty 정보 가져오기
      const penalty: any = {};

      // aux 업데이트
      const aux = npcGeneral.data?.aux || {};
      const yearMonth = year * 12 + month;
      aux.pickYearMonth = yearMonth;
      aux.next_change = new Date(Date.now() + 12 * (sessionData.turnterm || 60) * 60000).toISOString(); // 분 단위

      // 장수 업데이트
      const genData = npcGeneral.data || {};
      genData.owner_name = ownerName;
      genData.aux = aux;
      genData.penalty = penalty;
      genData.killturn = 6;
      genData.defence_train = 80;
      genData.permission = 'normal';

      npcGeneral.npc = 1; // 빙의된 NPC
      npcGeneral.owner = userId.toString();
      npcGeneral.data = genData;
      await npcGeneral.save();

      // general_access_log 삽입
      // TODO: GeneralAccessLog 모델 구현 후 추가

      // 토큰 삭제
      await SelectNpcToken.deleteMany({
        session_id: sessionId,
        $or: [
          { 'data.owner': userId.toString() },
          { 'data.valid_until': { $lt: now } }
        ]
      });

      // TODO: ActionLogger로 로그 남기기
      console.log(`[SelectNpc] ${ownerName}이 ${pickedNPC.name}에 빙의`);

      return {
        result: true,
        reason: 'success',
        general_id: pick,
        general_name: pickedNPC.name
      };
    } catch (error: any) {
      console.error('SelectNpc error:', error);
      return {
        result: false,
        reason: error.message || 'NPC 선택 실패'
      };
    }
  }
}

