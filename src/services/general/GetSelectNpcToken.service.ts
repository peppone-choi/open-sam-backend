// @ts-nocheck - Type issues need investigation
import { SelectNpcToken } from '../../models/select_npc_token.model';
import { generalRepository } from '../../repositories/general.repository';
import { sessionRepository } from '../../repositories/session.repository';

/**
 * GetSelectNpcToken Service
 * NPC 선택 토큰 조회 및 생성 (npcmode==1 전용)
 * PHP: j_get_select_npc_token.php
 */
export class GetSelectNpcTokenService {
  private static readonly VALID_SECOND = 90;
  private static readonly PICK_MORE_SECOND = 10;
  private static readonly KEEP_CNT = 3;

  static async execute(data: any, user?: any) {
    const userId = user?.userId || user?.id;
    const sessionId = data.session_id || 'sangokushi_default';
    const refresh = data.refresh === true || data.refresh === 'true';
    const keepResult = data.keep || [];

    if (!userId) {
      return {
        result: false,
        reason: '로그인이 필요합니다'
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
      const allowNpcPossess = gameEnv.allow_npc_possess || npcmode === 1 || false;
      const turnterm = gameEnv.turnterm || 300; // 초 단위

      console.log('[GetSelectNpcToken] npcmode:', npcmode);
      console.log('[GetSelectNpcToken] allow_npc_possess:', gameEnv.allow_npc_possess);
      console.log('[GetSelectNpcToken] allowNpcPossess:', allowNpcPossess);

      // allow_npc_possess가 true면 npcmode도 1로 간주
      if (!allowNpcPossess && !gameEnv.allow_npc_possess) {
        return {
          result: false,
          reason: '오리지널 캐릭터 플레이가 허용되지 않은 서버입니다'
        };
      }

      // 기존 장수 확인
      const existingGeneral = await generalRepository.findBySessionAndOwner(sessionId, userId.toString());

      if (existingGeneral) {
        return {
          result: false,
          reason: '이미 장수가 생성되었습니다'
        };
      }

      const now = new Date();
      const validSecond = Math.max(this.VALID_SECOND, turnterm * 40);
      const pickMoreSecond = Math.max(this.PICK_MORE_SECOND, Math.round(Math.pow(turnterm, 0.672) * 8));
      const validUntil = new Date(now.getTime() + validSecond * 1000);
      const pickMoreFrom = new Date(now.getTime() + pickMoreSecond * 1000);

      // 기존 토큰 조회
      const existingToken = await SelectNpcToken.findOne({
        session_id: sessionId,
        'data.owner': userId.toString(),
        'data.valid_until': { $gte: now }
      });

      if (existingToken && refresh) {
        const tokenData = existingToken.data || {};
        const pickMoreFromTime = new Date(tokenData.pick_more_from || '2000-01-01');

        if (now >= pickMoreFromTime) {
          // 기존 선택 유지
          const oldPickResult = tokenData.pick_result || {};
          const pickResult: any = {};

          for (const keepId of keepResult) {
            if (oldPickResult[keepId] && oldPickResult[keepId].keepCnt > 0) {
              pickResult[keepId] = { ...oldPickResult[keepId] };
              pickResult[keepId].keepCnt = (pickResult[keepId].keepCnt || this.KEEP_CNT) - 1;
            }
          }

          // 모든 것이 유지되었다면 refresh 불필요
          if (Object.keys(pickResult).length === Object.keys(oldPickResult).length) {
            return {
              result: true,
              pick: oldPickResult,
              pickMoreFrom: tokenData.pick_more_from,
              pickMoreSeconds: Math.max(0, Math.floor((pickMoreFromTime.getTime() - now.getTime()) / 1000)),
              validUntil: tokenData.valid_until
            };
          }

          // ✅ 첫 번째 다시 뽑기인지 확인 (pick_more_from이 2010년 이전이면 첫 번째)
          const isFirstRefresh = pickMoreFromTime.getFullYear() < 2010;
          const nextPickMoreFrom = isFirstRefresh 
            ? new Date(now.getTime() + pickMoreSecond * 1000)  // 첫 번째 이후부터 유예 시간 적용
            : pickMoreFrom;  // 이미 계산된 미래 시간 사용

          // 새로 뽑기
          const newPick = await this.generateNpcPick(sessionId, userId, pickResult);
          
          await SelectNpcToken.updateOne(
        {
          session_id: sessionId,
          'data.owner': userId.toString()
        },
        {
          $set: {
            'data.valid_until': validUntil,
            'data.pick_more_from': nextPickMoreFrom,
            'data.pick_result': { ...pickResult, ...newPick }
          }
        }
      );

          return {
            result: true,
            pick: { ...pickResult, ...newPick },
            pickMoreFrom: nextPickMoreFrom.toISOString(),
            pickMoreSeconds: isFirstRefresh ? pickMoreSecond : 0,
            validUntil: validUntil.toISOString()
          };
        } else {
          return {
            result: false,
            reason: '아직 다시 뽑을 수 없습니다'
          };
        }
      }

      if (existingToken && !refresh) {
        const tokenData = existingToken.data || {};
        const pickMoreFromTime = new Date(tokenData.pick_more_from || '2000-01-01');
        const pickMoreSeconds = Math.max(0, Math.floor((pickMoreFromTime.getTime() - now.getTime()) / 1000));

        return {
          result: true,
          pick: tokenData.pick_result || {},
          pickMoreFrom: tokenData.pick_more_from,
          pickMoreSeconds,
          validUntil: tokenData.valid_until
        };
      }

      // 새로 생성 - 처음에는 바로 다시 뽑기 가능
      const pickResult = await this.generateNpcPick(sessionId, userId, {});
      const firstPickMoreFrom = new Date('2000-01-01T01:00:00.000Z'); // 과거 시간
      
      // upsert로 토큰 생성/업데이트
      await SelectNpcToken.findOneAndUpdate(
        {
          session_id: sessionId,
          'data.id': userId
        },
        {
          session_id: sessionId,
          pick_result: pickResult,
          data: {
            id: userId,
            owner: userId.toString(),
            valid_until: validUntil,
            pick_more_from: firstPickMoreFrom, // 처음에는 과거 시간
            pick_result: pickResult,
            nonce: Math.floor(Math.random() * 0xfffffff)
          }
        },
        { upsert: true, new: true }
      );

      return {
        result: true,
        pick: pickResult,
        pickMoreFrom: firstPickMoreFrom.toISOString(), // 처음 생성 시
        pickMoreSeconds: 0,
        validUntil: validUntil.toISOString()
      };
    } catch (error: any) {
      console.error('GetSelectNpcToken error:', error);
      return {
        result: false,
        reason: error.message || 'NPC 토큰 조회 실패'
      };
    }
  }

  private static async generateNpcPick(sessionId: string, userId: number, keepPick: any): Promise<any> {
      // NPC 장수 목록 조회
      // - 기존 구현은 npc: 2 (최상위 필드)만 보고 있었는데,
      //   실제 데이터는 data.npc에 저장되는 경우가 많으므로 둘 다 지원한다.
      const npcGenerals = await generalRepository.findByFilter({
        session_id: sessionId,
        $or: [
          { npc: 2 },
          { 'data.npc': { $gte: 2 } },
        ],
      }).limit(100);


    // 다른 사용자가 예약한 NPC 제외
    const reservedNpcs = new Set<number>();
    const now = new Date();
    
    const otherTokens = await SelectNpcToken.find({
      session_id: sessionId,
      'data.owner': { $ne: userId.toString() },
      'data.valid_until': { $gte: now }
    });

    for (const token of otherTokens) {
      const pickResult = token.data?.pick_result || {};
      for (const npcId of Object.keys(pickResult)) {
        reservedNpcs.add(parseInt(npcId));
      }
    }

    // 예약되지 않은 NPC만 선택 + 도시가 0인 NPC 제외 (시나리오에 등장하지 않음)
    const availableNpcs = npcGenerals.filter((gen: any) => {
      const genNo = gen.no || gen.data?.no;
      const genCity = gen.city || gen.data?.city;
      return genNo && genCity && genCity > 0 && !reservedNpcs.has(genNo) && !keepPick[genNo];
    });

    // 5개 선택 (가중치 기반)
    const candidates: any = {};
    const weights: Record<number, number> = {};

    for (const npc of availableNpcs) {
      const npcData = npc.data || npc;
      const allStat = (npcData.leadership || 50) + (npcData.strength || 50) + (npcData.intel || 50);
      const npcId = npc.no || npcData.no;

      candidates[npcId] = {
        no: npcId,
        name: npc.name || npcData.name || '무명',
        leadership: npcData.leadership || 50,
        strength: npcData.strength || 50,
        intel: npcData.intel || 50,
        nation: npcData.nation || 0,
        imgsvr: npcData.imgsvr || 0,
        picture: npc.picture || npcData.picture || '',
        personal: npcData.personal || 'None',
        special: npcData.special || 'None',
        special2: npcData.special2 || 'None',
        keepCnt: this.KEEP_CNT
      };

      weights[npcId] = Math.pow(allStat, 1.5);
    }

    // 가중치 기반 랜덤 선택
    const pickLimit = Math.min(Object.keys(candidates).length, 5);
    const pickResult = { ...keepPick };

    while (Object.keys(pickResult).length < pickLimit && Object.keys(candidates).length > 0) {
      const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
      let random = Math.random() * totalWeight;
      
      for (const [npcId, weight] of Object.entries(weights)) {
        random -= weight;
        if (random <= 0 && !pickResult[npcId]) {
          pickResult[npcId] = candidates[npcId];
          delete weights[npcId];
          delete candidates[npcId];
          break;
        }
      }
    }

    return pickResult;
  }
}

