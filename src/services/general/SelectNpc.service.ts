// @ts-nocheck - Type issues need investigation
import { SelectNpcToken } from '../../models/select_npc_token.model';
import { generalRepository } from '../../repositories/general.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { userRepository } from '../../repositories/user.repository';

/**
 * SelectNpc Service
 * 오리지널 캐릭터 선택 (npcmode==1 전용)
 * PHP: j_select_npc.php
 */
export class SelectNpcService {
  static async execute(data: any, user?: any) {
    const userId = user?.userId || user?.id;
    const sessionId = data.session_id || 'sangokushi_default';
    const pick = parseInt(data.pick); // NPC general no

    console.log('[SelectNpc] user:', JSON.stringify(user));
    console.log('[SelectNpc] userId:', userId);
    console.log('[SelectNpc] sessionId:', sessionId);
    console.log('[SelectNpc] pick:', pick);

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

      const sessionData = session.data || {};
      const gameEnv = sessionData.game_env || {};
      const npcmode = gameEnv.npcmode || 0;
      const allowNpcPossess = gameEnv.allow_npc_possess || false;
      const maxgeneral = gameEnv.maxgeneral || 50;
      const year = sessionData.year || 184;
      const month = sessionData.month || 1;

      console.log('[SelectNpc] npcmode:', npcmode);
      console.log('[SelectNpc] allow_npc_possess:', allowNpcPossess);
      console.log('[SelectNpc] maxgeneral:', maxgeneral);

      // npcmode가 1이거나 allow_npc_possess가 true여야 함
      if (npcmode !== 1 && !allowNpcPossess) {
        return {
          result: false,
          reason: '오리지널 캐릭터 플레이가 허용되지 않은 서버입니다'
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

      if (!token) {
        return {
          result: false,
          reason: '유효한 장수 목록이 없습니다.'
        };
      }

      const tokenData = token.data || {};
      const pickResult = tokenData.pick_result || token.pick_result || {};
      
      if (!pickResult[pick]) {
        return {
          result: false,
          reason: '선택한 장수가 목록에 없습니다.'
        };
      }

      const pickedNPC = pickResult[pick];

      // 선택한 NPC 장수 조회 및 업데이트
      // - 반드시 등장하는 NPC여야 하므로 city > 0 조건을 강제
      // - NPC 타입은 npc>=2 (최상위 또는 data.npc) 중 하나여야 함
      const npcGeneral = await generalRepository.findOneByFilter({
        session_id: sessionId,
        no: pick,
        city: { $gt: 0 },
        $and: [
          {
            $or: [
              { npc: 2 },
              { 'data.npc': { $gte: 2 } },
            ],
          },
          {
            $or: [
              { owner: { $exists: false } },
              { owner: '0' },
              { owner: 0 },
            ],
          },
        ],
      });

      if (!npcGeneral) {
        return {
          result: false,
          reason: '장수 등록에 실패했습니다.'
        };
      }

      // 회원 정보 가져오기
      const ownerName = user?.name || 'Unknown';
      
      let penalty: any = {};
      try {
        const userDoc = await userRepository.findById(String(userId));
        if (userDoc?.penalty) {
          penalty = userDoc.penalty;
        }
      } catch (penaltyError) {
        console.warn('[SelectNpc] penalty 정보 조회 실패:', penaltyError);
      }

      // aux 업데이트
      const aux = npcGeneral.data?.aux || {};
      const yearMonth = year * 12 + month;
      
      // 처음 빙의하는 경우 (pickYearMonth가 없음) next_change를 과거로 설정하여 바로 다시 뽑기 가능
      // 이미 한 번 뽑은 경우 (pickYearMonth가 있음) 12턴 대기
      const isFirstPick = !aux.pickYearMonth;
      aux.pickYearMonth = yearMonth;
      
      if (isFirstPick) {
        // 처음 뽑는 경우: 과거 시간으로 설정 (바로 다시 뽑기 가능)
        aux.next_change = new Date(Date.now() - 1000).toISOString();
      } else {
        // 이미 한 번 뽑은 경우: 12턴 후로 설정
        aux.next_change = new Date(Date.now() + 12 * (gameEnv.turnterm || 60) * 60000).toISOString();
      }

      // 장수 업데이트
      const genData = npcGeneral.data || {};
      genData.owner_name = ownerName;
      genData.aux = aux;
      genData.penalty = penalty;
      genData.killturn = 6;
      genData.defence_train = 80;
      
      // NPC의 기존 officer_level 무조건 보존 (0도 유효한 값)
      // 최상위 필드 우선, 없으면 data 필드 확인
      let existingOfficerLevel = npcGeneral.officer_level;
      if (existingOfficerLevel === undefined || existingOfficerLevel === null) {
        existingOfficerLevel = npcGeneral.data?.officer_level;
      }
      if (existingOfficerLevel === undefined || existingOfficerLevel === null) {
        // 정말로 관직 정보가 없는 경우만 nation 상태에 따라 설정
        const nation = genData.nation ?? npcGeneral.nation ?? 0;
        existingOfficerLevel = nation > 0 ? 1 : 0; // 국가 소속이면 1, 재야면 0
      }
      genData.officer_level = existingOfficerLevel;
      
      // permission 설정 - 기존 값 보존 (0도 유효한 값)
      let existingPermission = npcGeneral.permission;
      if (existingPermission === undefined || existingPermission === null) {
        existingPermission = npcGeneral.data?.permission;
      }
      if (existingPermission === undefined || existingPermission === null) {
        // 정말로 permission 정보가 없는 경우만 officer_level에 따라 자동 계산
        const officerLevel = genData.officer_level;
        if (officerLevel >= 11) {
          existingPermission = 4; // 군주급
        } else if (officerLevel >= 5) {
          existingPermission = 2; // 고위 관직
        } else if (officerLevel >= 1) {
          existingPermission = 0; // 일반 관직
        } else {
          existingPermission = 0; // 재야
        }
      }
      genData.permission = existingPermission;

      // DB 직접 업데이트: owner 기반 조회가 바로 반영되도록 함
      const officerLevel = genData.officer_level;
      const permission = genData.permission;

      await generalRepository.updateOneByFilter(
        {
          session_id: sessionId,
          $or: [
            { no: pick },
            { 'data.no': pick },
          ],
        },
        {
          npc: 0, // 플레이어 캐릭터 (npc >= 1은 AI가 명령 등록함)
          owner: userId.toString(),
          owner_name: ownerName,
          officer_level: officerLevel, // 최상위 필드에도 저장
          permission: permission,      // 최상위 필드에도 저장
          data: genData,
        },
      );

      // general_access_log 삽입
      // FUTURE: GeneralAccessLog 모델 구현 후 추가

      // 토큰 삭제
      await SelectNpcToken.deleteMany({
        session_id: sessionId,
        $or: [
          { 'data.owner': userId.toString() },
          { 'data.valid_until': { $lt: now } }
        ]
      });

      // FUTURE: ActionLogger 구현 (v2.0)
      console.log(`[SelectNpc] ${ownerName}이 ${pickedNPC.name} 오리지널 캐릭터로 플레이 시작`);

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

