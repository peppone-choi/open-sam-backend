/**
 * DiplomacyState.service.ts - 외교 상태 관리 서비스
 *
 * PHP 참조: core/hwe/sammo/DiplomaticMessage.php
 * 
 * 외교 상태 정의:
 * - WAR (0): 교전 중
 * - DECLARATION (1): 선전포고 (24턴 후 교전으로 전환)
 * - PEACE (2): 평화 (중립)
 * - ALLIANCE (3): 동맹
 * - NO_AGGRESSION (7): 불가침
 */

import { diplomacyRepository } from '../../repositories/diplomacy.repository';

/**
 * 외교 상태 열거형
 */
export enum DiplomacyState {
  WAR = 0,              // 교전
  DECLARATION = 1,      // 선전포고
  PEACE = 2,            // 평화 (중립)
  ALLIANCE = 3,         // 동맹
  NO_AGGRESSION = 7     // 불가침
}

/**
 * 외교 상태 이름
 */
export const DiplomacyStateName: Record<DiplomacyState, string> = {
  [DiplomacyState.WAR]: '교전',
  [DiplomacyState.DECLARATION]: '선전포고',
  [DiplomacyState.PEACE]: '평화',
  [DiplomacyState.ALLIANCE]: '동맹',
  [DiplomacyState.NO_AGGRESSION]: '불가침'
};

/**
 * 외교 상태 전이 규칙
 * key: 현재 상태, value: 전이 가능한 상태 목록
 */
export const DiplomacyTransitions: Record<DiplomacyState, DiplomacyState[]> = {
  [DiplomacyState.WAR]: [
    DiplomacyState.PEACE  // 종전 → 평화
  ],
  [DiplomacyState.DECLARATION]: [
    DiplomacyState.WAR,   // 선전포고 기간 종료 → 교전
    DiplomacyState.PEACE  // 종전 → 평화
  ],
  [DiplomacyState.PEACE]: [
    DiplomacyState.DECLARATION,    // 선전포고
    DiplomacyState.NO_AGGRESSION,  // 불가침 조약
    DiplomacyState.ALLIANCE        // 동맹 체결
  ],
  [DiplomacyState.ALLIANCE]: [
    DiplomacyState.PEACE,          // 동맹 파기/만료 → 평화
    DiplomacyState.DECLARATION     // 선전포고 (동맹 파기 후)
  ],
  [DiplomacyState.NO_AGGRESSION]: [
    DiplomacyState.PEACE,          // 불가침 파기/만료 → 평화
    DiplomacyState.DECLARATION     // 선전포고 (불가침 파기 필요)
  ]
};

/**
 * 외교 관계 정보
 */
export interface DiplomacyRelation {
  sessionId: string;
  meNationId: number;
  youNationId: number;
  state: DiplomacyState;
  term: number;
}

/**
 * 상태 전이 검증 결과
 */
export interface TransitionResult {
  valid: boolean;
  reason?: string;
}

/**
 * DiplomacyStateService - 외교 상태 관리 서비스
 */
export class DiplomacyStateService {
  /**
   * 두 국가 간 외교 상태 조회
   */
  static async getRelation(
    sessionId: string,
    meNationId: number,
    youNationId: number
  ): Promise<DiplomacyRelation | null> {
    if (meNationId === 0 || youNationId === 0) {
      return null;
    }

    try {
      const relation = await diplomacyRepository.findRelation(
        sessionId,
        meNationId,
        youNationId
      );

      if (!relation) {
        return null;
      }

      return {
        sessionId,
        meNationId,
        youNationId,
        state: relation.state as DiplomacyState,
        term: relation.term || 0
      };
    } catch (error) {
      console.error('[DiplomacyStateService] getRelation error:', error);
      return null;
    }
  }

  /**
   * 외교 상태 전이 가능 여부 검증
   */
  static canTransition(
    fromState: DiplomacyState,
    toState: DiplomacyState
  ): TransitionResult {
    const allowedTransitions = DiplomacyTransitions[fromState];

    if (!allowedTransitions) {
      return {
        valid: false,
        reason: `알 수 없는 외교 상태입니다: ${fromState}`
      };
    }

    if (!allowedTransitions.includes(toState)) {
      const fromName = DiplomacyStateName[fromState];
      const toName = DiplomacyStateName[toState];
      return {
        valid: false,
        reason: `${fromName} 상태에서 ${toName} 상태로 전환할 수 없습니다.`
      };
    }

    return { valid: true };
  }

  /**
   * 선전포고 가능 여부 검증
   */
  static canDeclareWar(currentState: DiplomacyState): TransitionResult {
    // 이미 교전/선전포고 상태
    if (currentState === DiplomacyState.WAR) {
      return { valid: false, reason: '아국과 이미 교전중입니다.' };
    }
    if (currentState === DiplomacyState.DECLARATION) {
      return { valid: false, reason: '아국과 이미 선포중입니다.' };
    }
    // 불가침 상태
    if (currentState === DiplomacyState.NO_AGGRESSION) {
      return { valid: false, reason: '불가침국입니다.' };
    }
    // 동맹 상태 (동맹 파기 후 선포 가능)
    if (currentState === DiplomacyState.ALLIANCE) {
      return { valid: false, reason: '동맹국입니다. 동맹 파기 후 선포 가능합니다.' };
    }

    return { valid: true };
  }

  /**
   * 불가침 제의 가능 여부 검증
   */
  static canProposeNonAggression(currentState: DiplomacyState): TransitionResult {
    if (currentState === DiplomacyState.WAR) {
      return { valid: false, reason: '아국과 이미 교전중입니다.' };
    }
    if (currentState === DiplomacyState.DECLARATION) {
      return { valid: false, reason: '아국과 이미 선포중입니다.' };
    }
    if (currentState === DiplomacyState.NO_AGGRESSION) {
      return { valid: false, reason: '이미 불가침 상태입니다.' };
    }
    if (currentState === DiplomacyState.ALLIANCE) {
      return { valid: false, reason: '이미 동맹 상태입니다.' };
    }

    return { valid: true };
  }

  /**
   * 불가침 파기 가능 여부 검증
   */
  static canBreakNonAggression(currentState: DiplomacyState): TransitionResult {
    if (currentState !== DiplomacyState.NO_AGGRESSION) {
      return { valid: false, reason: '불가침 중인 상대국에게만 가능합니다.' };
    }

    return { valid: true };
  }

  /**
   * 종전 가능 여부 검증
   */
  static canProposePeace(currentState: DiplomacyState): TransitionResult {
    if (currentState !== DiplomacyState.WAR && currentState !== DiplomacyState.DECLARATION) {
      return { valid: false, reason: '선포, 전쟁중인 상대국에게만 가능합니다.' };
    }

    return { valid: true };
  }

  /**
   * 양방향 외교 상태 업데이트
   */
  static async updateBilateralState(
    sessionId: string,
    nationId1: number,
    nationId2: number,
    newState: DiplomacyState,
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
        state: newState,
        term
      });

      // 국가 2 → 국가 1
      await this.upsertRelation({
        sessionId,
        meNationId: nationId2,
        youNationId: nationId1,
        state: newState,
        term
      });

      console.log(
        `[DiplomacyStateService] Updated bilateral state: ${nationId1} <-> ${nationId2}, ` +
        `state=${DiplomacyStateName[newState]}, term=${term}`
      );
    } catch (error) {
      console.error('[DiplomacyStateService] updateBilateralState error:', error);
      throw error;
    }
  }

  /**
   * 외교 관계 생성 또는 업데이트
   */
  static async upsertRelation(relation: DiplomacyRelation): Promise<void> {
    const { sessionId, meNationId, youNationId, state, term } = relation;

    if (meNationId === 0 || youNationId === 0) {
      return;
    }

    try {
      const existing = await diplomacyRepository.findRelation(
        sessionId,
        meNationId,
        youNationId
      );

      if (existing) {
        await diplomacyRepository.updateMany(
          {
            session_id: sessionId,
            me: meNationId,
            you: youNationId
          },
          { state, term }
        );
      } else {
        await diplomacyRepository.create({
          session_id: sessionId,
          me: meNationId,
          you: youNationId,
          state,
          term
        });
      }
    } catch (error) {
      console.error('[DiplomacyStateService] upsertRelation error:', error);
      throw error;
    }
  }

  /**
   * 외교 기간 감소 (매 턴 처리)
   * 기간이 0이 되면 상태 전이 발생
   */
  static async decreaseTerm(sessionId: string): Promise<void> {
    try {
      // term이 0보다 큰 모든 관계의 term을 1씩 감소
      await diplomacyRepository.updateMany(
        {
          session_id: sessionId,
          term: { $gt: 0 }
        },
        {
          $inc: { term: -1 }
        }
      );

      // 선전포고 기간 종료 → 교전으로 전환
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

        console.log(
          `[DiplomacyStateService] Declaration expired: ${relation.me} vs ${relation.you} → WAR`
        );
      }

      // 불가침/동맹 기간 종료 → 평화로 전환
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

        console.log(
          `[DiplomacyStateService] Pact expired: ${relation.me} vs ${relation.you} → PEACE`
        );
      }
    } catch (error) {
      console.error('[DiplomacyStateService] decreaseTerm error:', error);
      throw error;
    }
  }

  /**
   * 국가의 모든 외교 관계 조회
   */
  static async getNationRelations(
    sessionId: string,
    nationId: number
  ): Promise<DiplomacyRelation[]> {
    if (nationId === 0) {
      return [];
    }

    try {
      const relations = await diplomacyRepository.findByNation(sessionId, nationId);
      
      return relations.map((r: any) => ({
        sessionId,
        meNationId: r.me,
        youNationId: r.you,
        state: r.state as DiplomacyState,
        term: r.term || 0
      }));
    } catch (error) {
      console.error('[DiplomacyStateService] getNationRelations error:', error);
      return [];
    }
  }

  /**
   * 국가 멸망 시 외교 관계 삭제
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
      console.log(`[DiplomacyStateService] Removed all relations for nation ${nationId}`);
    } catch (error) {
      console.error('[DiplomacyStateService] removeNationRelations error:', error);
      throw error;
    }
  }

  /**
   * 특정 상태의 모든 국가 조회
   */
  static async getNationsWithState(
    sessionId: string,
    nationId: number,
    state: DiplomacyState
  ): Promise<number[]> {
    if (nationId === 0) {
      return [];
    }

    try {
      const relations = await diplomacyRepository.findByFilter({
        session_id: sessionId,
        me: nationId,
        state
      });

      return relations.map((r: any) => r.you);
    } catch (error) {
      console.error('[DiplomacyStateService] getNationsWithState error:', error);
      return [];
    }
  }

  /**
   * 적대 국가 목록 조회 (교전 + 선전포고)
   */
  static async getEnemyNations(
    sessionId: string,
    nationId: number
  ): Promise<number[]> {
    if (nationId === 0) {
      return [];
    }

    try {
      const relations = await diplomacyRepository.findByFilter({
        session_id: sessionId,
        me: nationId,
        state: { $in: [DiplomacyState.WAR, DiplomacyState.DECLARATION] }
      });

      return relations.map((r: any) => r.you);
    } catch (error) {
      console.error('[DiplomacyStateService] getEnemyNations error:', error);
      return [];
    }
  }

  /**
   * 우호 국가 목록 조회 (동맹 + 불가침)
   */
  static async getFriendlyNations(
    sessionId: string,
    nationId: number
  ): Promise<number[]> {
    if (nationId === 0) {
      return [];
    }

    try {
      const relations = await diplomacyRepository.findByFilter({
        session_id: sessionId,
        me: nationId,
        state: { $in: [DiplomacyState.ALLIANCE, DiplomacyState.NO_AGGRESSION] }
      });

      return relations.map((r: any) => r.you);
    } catch (error) {
      console.error('[DiplomacyStateService] getFriendlyNations error:', error);
      return [];
    }
  }
}


