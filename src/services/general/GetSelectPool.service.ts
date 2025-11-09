// @ts-nocheck - Type issues need investigation
import { SelectPool } from '../../models/select_pool.model';
import { generalRepository } from '../../repositories/general.repository';
import { sessionRepository } from '../../repositories/session.repository';

/**
 * GetSelectPool Service
 * 장수 선택 풀 조회 (npcmode==2 전용)
 * PHP: j_get_select_pool.php
 */
export class GetSelectPoolService {
  static async execute(data: any, user?: any) {
    const userId = user?.id;
    const sessionId = data.session_id || 'sangokushi_default';

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
      const existingGeneral = await generalRepository.findBySessionAndOwner(
        sessionId,
        userId.toString(),
        { npc: { $ne: 2 } }
      );

      const now = new Date();
      
      if (existingGeneral) {
        const aux = existingGeneral.aux || {};
        const nextChange = aux.next_change;
        
        if (nextChange && new Date(nextChange) > now) {
          return {
            result: false,
            reason: '아직 다시 고를 수 없습니다'
          };
        }
      }

      // 기존 토큰 조회
      const existingTokens = await SelectPool.find({
        session_id: sessionId,
        'data.owner': userId.toString(),
        'data.reserved_until': { $gte: now }
      });

      if (existingTokens && existingTokens.length > 0) {
        const pick = [];
        let validUntil: Date | null = null;

        for (const token of existingTokens) {
          const tokenData = token.data || {};
          validUntil = tokenData.reserved_until || null;
          
          const info = {
            ...tokenData.info,
            uniqueName: tokenData.unique_name || tokenData.uniqueName,
            name: tokenData.info?.name || tokenData.info?.generalName || '무명',
            no: tokenData.info?.no || pick.length + 1
          };

          // 특기 정보 추가
          if (info.specialDomestic) {
            info.specialDomesticName = this.getSpecialName(info.specialDomestic, 'domestic');
            info.specialDomesticInfo = this.getSpecialInfo(info.specialDomestic, 'domestic');
          }

          if (info.specialWar) {
            info.specialWarName = this.getSpecialName(info.specialWar, 'war');
            info.specialWarInfo = this.getSpecialInfo(info.specialWar, 'war');
          }

          if (info.personal) {
            info.personalName = this.getPersonalityName(info.personal);
          }

          pick.push(info);
        }

        // dex 합계로 정렬
        pick.sort((a, b) => {
          const aSum = (a.dex || []).reduce((sum: number, val: number) => sum + val, 0);
          const bSum = (b.dex || []).reduce((sum: number, val: number) => sum + val, 0);
          return aSum - bSum;
        });

        return {
          result: true,
          pool: pick,
          validUntil: validUntil?.toISOString() || null
        };
      }

      // 새로 생성 (14개 장수 풀에서 선택)
      const pick = await this.generateSelectPool(sessionId, userId, turnterm);
      
      return {
        result: true,
        pool: pick,
        validUntil: pick.length > 0 ? pick[0].validUntil : null
      };
    } catch (error: any) {
      console.error('GetSelectPool error:', error);
      return {
        result: false,
        reason: error.message || '선택 풀 조회 실패'
      };
    }
  }

  private static async generateSelectPool(sessionId: string, userId: number, turnterm: number): Promise<any[]> {
    // TODO: 실제 장수 풀에서 랜덤 선택하는 로직 구현
    // 현재는 간단한 더미 데이터 생성
    const now = new Date();
    const validUntil = new Date(now.getTime() + turnterm * 60000); // turnterm 분 후

    const pick: any[] = [];
    
    // 14개 장수 생성 (더미 데이터 - 실제로는 풀에서 가져와야 함)
    for (let i = 0; i < 14; i++) {
      const dex = [
        Math.floor(Math.random() * 100),
        Math.floor(Math.random() * 100),
        Math.floor(Math.random() * 100),
        Math.floor(Math.random() * 100),
        Math.floor(Math.random() * 100)
      ];

      const uniqueName = `general_${userId}_${Date.now()}_${i}`;
      const info = {
        no: i + 1,
        uniqueName,
        name: `장수${i + 1}`,
        generalName: `장수${i + 1}`,
        leadership: 50 + Math.floor(Math.random() * 50),
        strength: 50 + Math.floor(Math.random() * 50),
        intel: 50 + Math.floor(Math.random() * 50),
        dex,
        age: 20 + Math.floor(Math.random() * 20),
        picture: `img_${i % 10}`,
        imgsvr: 0,
        personal: 'Random',
        specialDomestic: 'None',
        specialWar: 'None',
        city: 1,
        isNPC: false,
        validUntil: validUntil.toISOString()
      };

      // SelectPool에 저장
      await SelectPool.create({
        session_id: sessionId,
        data: {
          owner: userId.toString(),
          reserved_until: validUntil,
          unique_name: uniqueName,
          info
        }
      });
      
      pick.push(info);
    }

    // dex 합계로 정렬
    pick.sort((a, b) => {
      const aSum = a.dex.reduce((sum: number, val: number) => sum + val, 0);
      const bSum = b.dex.reduce((sum: number, val: number) => sum + val, 0);
      return aSum - bSum;
    });

    return pick;
  }

  private static getSpecialName(special: string, type: 'domestic' | 'war'): string {
    // TODO: 특기 이름 매핑 구현
    return special || 'None';
  }

  private static getSpecialInfo(special: string, type: 'domestic' | 'war'): string {
    // TODO: 특기 설명 매핑 구현
    return '';
  }

  private static getPersonalityName(personal: string): string {
    // TODO: 성격 이름 매핑 구현
    return personal || 'Random';
  }
}

