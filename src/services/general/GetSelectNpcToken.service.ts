import { SelectNpcToken } from '../../models/select_npc_token.model';
import { General } from '../../models/general.model';
import { Session } from '../../models/session.model';

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
    const userId = user?.id;
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
      const session = await (Session as any).findOne({ session_id: sessionId }).lean();
      if (!session) {
        return {
          result: false,
          reason: '세션을 찾을 수 없습니다'
        };
      }

      const sessionData = (session as any).config || session.data || {};
      const npcmode = sessionData.npcmode || 0;
      const turnterm = sessionData.turnterm || 60; // 분 단위

      if (npcmode !== 1) {
        return {
          result: false,
          reason: '빙의 가능한 서버가 아닙니다'
        };
      }

      // 기존 장수 확인
      const existingGeneral = await (General as any).findOne({
        session_id: sessionId,
        owner: userId.toString()
      });

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
      const existingToken = await (SelectNpcToken as any).findOne({
        session_id: sessionId,
        'data.owner': userId.toString(),
        'data.valid_until': { $gte: now }
      }).lean();

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

          // 새로 뽑기
          const newPick = await this.generateNpcPick(sessionId, userId, pickResult);
          
          await (SelectNpcToken as any).updateOne(
        {
          session_id: sessionId,
          'data.owner': userId.toString()
        },
        {
          $set: {
            'data.valid_until': validUntil,
            'data.pick_more_from': pickMoreFrom,
            'data.pick_result': { ...pickResult, ...newPick }
          }
        }
      );

          return {
            result: true,
            pick: { ...pickResult, ...newPick },
            pickMoreFrom: pickMoreFrom.toISOString(),
            pickMoreSeconds: pickMoreSecond,
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

      // 새로 생성
      const pickResult = await this.generateNpcPick(sessionId, userId, {});
      
      // 만료된 토큰 삭제
      await (SelectNpcToken as any).deleteMany({
        session_id: sessionId,
        'data.valid_until': { $lt: now }
      });

      // 새 토큰 생성
      await (SelectNpcToken as any).create({
        session_id: sessionId,
        data: {
          owner: userId.toString(),
          valid_until: validUntil,
          pick_more_from: pickMoreFrom,
          pick_result: pickResult,
          nonce: Math.floor(Math.random() * 0xfffffff)
        }
      });

      return {
        result: true,
        pick: pickResult,
        pickMoreFrom: '2000-01-01T01:00:00.000Z', // 처음 생성 시
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
    // NPC 장수 목록 조회 (npc=2인 장수들)
    const npcGenerals = await (General as any).find({
      session_id: sessionId,
      npc: 2
    }).limit(100).lean();

    // 다른 사용자가 예약한 NPC 제외
    const reservedNpcs = new Set<number>();
    const now = new Date();
    
    const otherTokens = await (SelectNpcToken as any).find({
      session_id: sessionId,
      'data.owner': { $ne: userId.toString() },
      'data.valid_until': { $gte: now }
    }).lean();

    for (const token of otherTokens) {
      const pickResult = token.data?.pick_result || {};
      for (const npcId of Object.keys(pickResult)) {
        reservedNpcs.add(parseInt(npcId));
      }
    }

    // 예약되지 않은 NPC만 선택
    const availableNpcs = npcGenerals.filter((gen: any) => {
      const genNo = gen.no || gen.data?.no;
      return genNo && !reservedNpcs.has(genNo) && !keepPick[genNo];
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

