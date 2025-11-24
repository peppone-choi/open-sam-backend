/**
 * UpdateRelation.service.ts - 외교 관계 업데이트 서비스
 * 
 * 전투 사망자 수 기록, 외교 관계 포인트 조정, 동맹/적대 관계 업데이트
 */

import { diplomacyRepository } from '../../repositories/diplomacy.repository';
import { GameConst } from '../../constants/GameConst';

interface DiplomacyUpdate {
  sessionId: string;
  meNationId: number;
  youNationId: number;
  state?: number;
  term?: number;
  deaths?: number;
}

/**
 * 외교 관계 상태 코드
 */
export enum DiplomacyState {
  WAR = 0,              // 교전
  DECLARATION = 1,      // 선전포고
  PEACE = 2,            // 평화
  ALLIANCE = 3,         // 동맹
  NO_AGGRESSION = 7     // 불가침
}

/**
 * UpdateRelationService - 외교 관계 업데이트 서비스
 */
export class UpdateRelationService {
  /**
   * 외교 관계 생성 또는 업데이트
   * 
   * @param update - 업데이트 정보
   */
  static async upsertRelation(update: DiplomacyUpdate): Promise<void> {
    const { sessionId, meNationId, youNationId, state, term } = update;

    if (meNationId === 0 || youNationId === 0) {
      return; // 재야는 외교 관계 없음
    }

    try {
      const existing = await diplomacyRepository.findRelation(
        sessionId,
        meNationId,
        youNationId
      );

      if (existing) {
        // 기존 관계 업데이트
        const updateData: any = {};
        
        if (state !== undefined) {
          updateData.state = state;
        }
        
        if (term !== undefined) {
          updateData.term = term;
        }

        await diplomacyRepository.updateMany(
          {
            session_id: sessionId,
            me: meNationId,
            you: youNationId
          },
          updateData
        );
      } else {
        // 새로운 관계 생성
        await diplomacyRepository.create({
          session_id: sessionId,
          me: meNationId,
          you: youNationId,
          state: state !== undefined ? state : DiplomacyState.PEACE,
          term: term !== undefined ? term : 0
        });
      }
    } catch (error) {
      console.error('[UpdateRelationService] Failed to upsert relation:', error);
      throw error;
    }
  }

  /**
   * 전투 사망자 기록
   * 
   * @param sessionId - 세션 ID
   * @param meNationId - 나의 국가 ID
   * @param youNationId - 상대 국가 ID
   * @param deaths - 사망자 수
   */
  static async recordBattleDeaths(
    sessionId: string,
    meNationId: number,
    youNationId: number,
    deaths: number
  ): Promise<void> {
    if (meNationId === 0 || youNationId === 0 || deaths <= 0) {
      return;
    }

    try {
      await diplomacyRepository.updateDeaths(
        sessionId,
        meNationId,
        youNationId,
        deaths
      );

      console.log(
        `[UpdateRelationService] Recorded ${deaths} deaths from nation ${meNationId} to ${youNationId}`
      );
    } catch (error) {
      console.error('[UpdateRelationService] Failed to record battle deaths:', error);
      throw error;
    }
  }

  /**
   * 외교 관계 포인트 조정
   * 
   * @param sessionId - 세션 ID
   * @param meNationId - 나의 국가 ID
   * @param youNationId - 상대 국가 ID
   * @param pointDelta - 포인트 변화량 (양수: 호감 증가, 음수: 호감 감소)
   */
  static async adjustRelationPoints(
    sessionId: string,
    meNationId: number,
    youNationId: number,
    pointDelta: number
  ): Promise<void> {
    if (meNationId === 0 || youNationId === 0) {
      return;
    }

    try {
      await diplomacyRepository.updateMany(
        {
          session_id: sessionId,
          me: meNationId,
          you: youNationId
        },
        {
          $inc: { points: pointDelta }
        }
      );

      console.log(
        `[UpdateRelationService] Adjusted relation points between ${meNationId} and ${youNationId} by ${pointDelta}`
      );
    } catch (error) {
      console.error('[UpdateRelationService] Failed to adjust relation points:', error);
      throw error;
    }
  }

  /**
   * 양방향 외교 관계 업데이트
   * 
   * @param sessionId - 세션 ID
   * @param nationId1 - 국가 1 ID
   * @param nationId2 - 국가 2 ID
   * @param state - 외교 상태
   * @param term - 외교 기간
   */
  static async updateBilateralRelation(
    sessionId: string,
    nationId1: number,
    nationId2: number,
    state: number,
    term: number = 0
  ): Promise<void> {
    if (nationId1 === 0 || nationId2 === 0) {
      return;
    }

    try {
      // 국가 1 → 국가 2
      await this.upsertRelation({
        sessionId,
        meNationId: nationId1,
        youNationId: nationId2,
        state,
        term
      });

      // 국가 2 → 국가 1
      await this.upsertRelation({
        sessionId,
        meNationId: nationId2,
        youNationId: nationId1,
        state,
        term
      });

      console.log(
        `[UpdateRelationService] Updated bilateral relation between ${nationId1} and ${nationId2}: state=${state}, term=${term}`
      );
    } catch (error) {
      console.error('[UpdateRelationService] Failed to update bilateral relation:', error);
      throw error;
    }
  }

  /**
   * 선전포고
   * 
   * @param sessionId - 세션 ID
   * @param meNationId - 선포하는 국가 ID
   * @param youNationId - 선포 받는 국가 ID
   */
  static async declareWar(
    sessionId: string,
    meNationId: number,
    youNationId: number
  ): Promise<void> {
    await this.updateBilateralRelation(
      sessionId,
      meNationId,
      youNationId,
      DiplomacyState.DECLARATION,
      5 // 선전포고 기간 5턴
    );
  }

  /**
   * 교전 상태로 전환
   * 
   * @param sessionId - 세션 ID
   * @param nationId1 - 국가 1 ID
   * @param nationId2 - 국가 2 ID
   */
  static async enterWar(
    sessionId: string,
    nationId1: number,
    nationId2: number
  ): Promise<void> {
    await this.updateBilateralRelation(
      sessionId,
      nationId1,
      nationId2,
      DiplomacyState.WAR,
      0
    );
  }

  /**
   * 종전
   * 
   * @param sessionId - 세션 ID
   * @param nationId1 - 국가 1 ID
   * @param nationId2 - 국가 2 ID
   */
  static async makePeace(
    sessionId: string,
    nationId1: number,
    nationId2: number
  ): Promise<void> {
    await this.updateBilateralRelation(
      sessionId,
      nationId1,
      nationId2,
      DiplomacyState.PEACE,
      0
    );
  }

  /**
   * 동맹 체결
   * 
   * @param sessionId - 세션 ID
   * @param nationId1 - 국가 1 ID
   * @param nationId2 - 국가 2 ID
   * @param term - 동맹 기간 (턴)
   */
  static async formAlliance(
    sessionId: string,
    nationId1: number,
    nationId2: number,
    term: number = 12
  ): Promise<void> {
    await this.updateBilateralRelation(
      sessionId,
      nationId1,
      nationId2,
      DiplomacyState.ALLIANCE,
      term
    );
  }

  /**
   * 불가침 조약 체결
   * 
   * @param sessionId - 세션 ID
   * @param nationId1 - 국가 1 ID
   * @param nationId2 - 국가 2 ID
   * @param term - 조약 기간 (턴)
   */
  static async signNoAggression(
    sessionId: string,
    nationId1: number,
    nationId2: number,
    term: number = 12
  ): Promise<void> {
    await this.updateBilateralRelation(
      sessionId,
      nationId1,
      nationId2,
      DiplomacyState.NO_AGGRESSION,
      term
    );
  }

  /**
   * 외교 기간 감소 (매 턴마다 호출)
   * 
   * @param sessionId - 세션 ID
   */
  static async decreaseDiplomacyTerm(sessionId: string): Promise<void> {
    try {
      // term이 0보다 큰 모든 외교 관계의 term을 1씩 감소
      await diplomacyRepository.updateMany(
        {
          session_id: sessionId,
          term: { $gt: 0 }
        },
        {
          $inc: { term: -1 }
        }
      );

      // term이 0이 된 선전포고는 교전 상태로 전환
      const declarationExpired = await diplomacyRepository.findByFilter({
        session_id: sessionId,
        state: DiplomacyState.DECLARATION,
        term: 0
      });

      for (const relation of declarationExpired) {
        await diplomacyRepository.updateMany(
          {
            session_id: sessionId,
            me: relation.me,
            you: relation.you
          },
          {
            state: DiplomacyState.WAR,
            term: 0
          }
        );
      }

      // term이 0이 된 동맹/불가침은 평화 상태로 전환
      const pactExpired = await diplomacyRepository.findByFilter({
        session_id: sessionId,
        state: { $in: [DiplomacyState.ALLIANCE, DiplomacyState.NO_AGGRESSION] },
        term: 0
      });

      for (const relation of pactExpired) {
        await diplomacyRepository.updateMany(
          {
            session_id: sessionId,
            me: relation.me,
            you: relation.you
          },
          {
            state: DiplomacyState.PEACE,
            term: 0
          }
        );
      }
    } catch (error) {
      console.error('[UpdateRelationService] Failed to decrease diplomacy term:', error);
      throw error;
    }
  }

  /**
   * 국가 멸망 시 외교 관계 삭제
   * 
   * @param sessionId - 세션 ID
   * @param nationId - 멸망한 국가 ID
   */
  static async removeNationRelations(
    sessionId: string,
    nationId: number
  ): Promise<void> {
    if (nationId === 0) {
      return;
    }

    try {
      await diplomacyRepository.deleteByNation(sessionId, nationId);

      console.log(`[UpdateRelationService] Removed all relations for nation ${nationId}`);
    } catch (error) {
      console.error('[UpdateRelationService] Failed to remove nation relations:', error);
      throw error;
    }
  }

  /**
   * 외교 관계 조회
   * 
   * @param sessionId - 세션 ID
   * @param meNationId - 나의 국가 ID
   * @param youNationId - 상대 국가 ID
   * @returns 외교 관계 정보
   */
  static async getRelation(
    sessionId: string,
    meNationId: number,
    youNationId: number
  ): Promise<any> {
    if (meNationId === 0 || youNationId === 0) {
      return null;
    }

    try {
      return await diplomacyRepository.findRelation(
        sessionId,
        meNationId,
        youNationId
      );
    } catch (error) {
      console.error('[UpdateRelationService] Failed to get relation:', error);
      return null;
    }
  }

  /**
   * 국가의 모든 외교 관계 조회
   * 
   * @param sessionId - 세션 ID
   * @param nationId - 국가 ID
   * @returns 외교 관계 목록
   */
  static async getNationRelations(
    sessionId: string,
    nationId: number
  ): Promise<any[]> {
    if (nationId === 0) {
      return [];
    }

    try {
      return await diplomacyRepository.findByNation(sessionId, nationId);
    } catch (error) {
      console.error('[UpdateRelationService] Failed to get nation relations:', error);
      return [];
    }
  }
}
