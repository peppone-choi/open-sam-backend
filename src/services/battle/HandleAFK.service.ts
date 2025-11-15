/**
 * HandleAFK Service - AFK 감지 및 AI 제어
 * 
 * 기능:
 * 1. 턴마다 명령 제출 여부 확인
 * 2. 3턴 연속 미제출 → AI 제어 활성화
 * 3. AI가 자동으로 명령 제출
 * 4. 유저 복귀 시 AI 제어 해제
 */

import { Battle } from '../../models/battle.model';

export interface AFKStatus {
  generalId: number;
  afkTurns: number;
  aiControlled: boolean;
  warning: boolean; // 2턴 AFK → 경고
}

export class HandleAFKService {
  /**
   * 턴 시작 시 AFK 체크
   * 명령을 제출하지 않은 장수들의 AFK 카운트 증가
   */
  static async checkAFK(battleId: string): Promise<AFKStatus[]> {
    const battle = await (Battle as any).findOne({ battleId: battleId });
    if (!battle) {
      throw new Error(`전투를 찾을 수 없습니다: ${battleId}`);
    }

    const afkStatuses: AFKStatus[] = [];
    const currentTurn = battle.current_turn;

    // 모든 참여 장수 확인
    const allGeneralIds = [
      ...battle.attacker.generals,
      ...battle.defender.generals,
    ];

    for (const generalId of allGeneralIds) {
      let afkEntry = battle.afk_tracking.find((a) => a.general_id === generalId);

      // 첫 진입
      if (!afkEntry) {
        afkEntry = {
          general_id: generalId,
          afk_turns: 0,
          ai_controlled: false,
        };
        battle.afk_tracking.push(afkEntry);
      }

      // 현재 턴에서 명령 제출 여부 확인
      const turnHistory = battle.turn_history.find((h) => h.turn === currentTurn);
      const hasSubmittedAction = turnHistory?.actions.some(
        (action: any) => action.generalId === generalId
      );

      if (!hasSubmittedAction) {
        // 명령 미제출 → AFK 카운트 증가
        afkEntry.afk_turns++;
      } else {
        // 명령 제출 → AFK 카운트 초기화
        afkEntry.afk_turns = 0;
        afkEntry.ai_controlled = false;
      }

      // 3턴 이상 AFK → AI 제어 활성화
      if (afkEntry.afk_turns >= 3 && !afkEntry.ai_controlled) {
        afkEntry.ai_controlled = true;
        console.log(`[AFK] 장수 ${generalId} AI 제어 활성화 (${afkEntry.afk_turns}턴 AFK)`);
      }

      afkStatuses.push({
        generalId,
        afkTurns: afkEntry.afk_turns,
        aiControlled: afkEntry.ai_controlled,
        warning: afkEntry.afk_turns === 2, // 2턴 AFK → 경고
      });
    }

    // DB 업데이트
    await battle.save();

    return afkStatuses;
  }

  /**
   * AI 제어 활성화 여부 확인
   */
  static async isAIControlled(
    battleId: string,
    generalId: number
  ): Promise<boolean> {
    const battle = await (Battle as any).findOne({ battleId: battleId }).exec();
    if (!battle) return false;

    const afkEntry = battle.afk_tracking.find((a) => a.general_id === generalId);
    return afkEntry?.ai_controlled || false;
  }

  /**
   * AI가 자동으로 명령 생성
   * 간단한 전술 AI:
   * 1. 공격자: 가장 가까운 거점으로 이동
   * 2. 방어자: 거점 중심 방어
   */
  static async generateAIAction(
    battleId: string,
    generalId: number
  ): Promise<any> {
    const battle = await (Battle as any).findOne({ battleId: battleId }).exec();
    if (!battle) {
      throw new Error(`전투를 찾을 수 없습니다: ${battleId}`);
    }

    // 공격자인지 방어자인지 확인
    const isAttacker = battle.attacker.generals.includes(generalId);

    // 장수의 현재 위치 가져오기 (TODO: 실제 위치 추적 필요)
    // 현재는 간단히 랜덤 이동
    const currentPos = this.getGeneralPosition(battle, generalId);

    if (isAttacker) {
      // 공격자: 중앙으로 진격
      return this.generateAttackerAction(currentPos);
    } else {
      // 방어자: 거점 방어
      return this.generateDefenderAction(currentPos);
    }
  }

  /**
   * 장수 현재 위치 가져오기
   */
  private static getGeneralPosition(battle: any, generalId: number): { x: number; y: number } {
    // FUTURE: 유닛 위치 추적 시스템 필요
    // 현재는 임시로 기본값 반환
    const isAttacker = battle.attacker.generals.includes(generalId);
    
    if (isAttacker) {
      // 공격자: 진입구 근처
      return { x: 20, y: 5 };
    } else {
      // 방어자: 거점 근처
      return { x: 20, y: 30 };
    }
  }

  /**
   * 공격자 AI 행동 생성
   * 전략: 중앙 거점(궁전)으로 진격
   */
  private static generateAttackerAction(currentPos: { x: number; y: number }): any {
    const targetPos = { x: 20, y: 35 }; // 궁전 위치

    // 목표 방향 계산
    const dx = targetPos.x - currentPos.x;
    const dy = targetPos.y - currentPos.y;

    // 다음 이동 위치
    let nextX = currentPos.x;
    let nextY = currentPos.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      // 좌우 이동 우선
      nextX += dx > 0 ? 1 : -1;
    } else {
      // 상하 이동 우선
      nextY += dy > 0 ? 1 : -1;
    }

    // 맵 범위 체크
    nextX = Math.max(0, Math.min(39, nextX));
    nextY = Math.max(0, Math.min(39, nextY));

    return {
      action: 'move',
      target: { x: nextX, y: nextY },
      aiGenerated: true,
    };
  }

  /**
   * 방어자 AI 행동 생성
   * 전략: 거점 중심 방어 (이동 최소화)
   */
  private static generateDefenderAction(currentPos: { x: number; y: number }): any {
    const gatePos = { x: 20, y: 20 }; // 성문 위치

    // 성문에서 멀리 떨어져 있으면 성문으로 이동
    const distance = Math.abs(currentPos.x - gatePos.x) + Math.abs(currentPos.y - gatePos.y);

    if (distance > 5) {
      // 성문으로 이동
      const dx = gatePos.x - currentPos.x;
      const dy = gatePos.y - currentPos.y;

      let nextX = currentPos.x;
      let nextY = currentPos.y;

      if (Math.abs(dx) > Math.abs(dy)) {
        nextX += dx > 0 ? 1 : -1;
      } else {
        nextY += dy > 0 ? 1 : -1;
      }

      return {
        action: 'move',
        target: { x: nextX, y: nextY },
        aiGenerated: true,
      };
    } else {
      // 거점 근처면 대기
      return {
        action: 'wait',
        aiGenerated: true,
      };
    }
  }

  /**
   * AFK 경고 메시지 생성
   */
  static getAFKWarningMessage(afkTurns: number): string {
    if (afkTurns === 1) {
      return '명령을 제출하지 않았습니다. (1턴 AFK)';
    } else if (afkTurns === 2) {
      return '⚠️ 경고: 다음 턴에도 명령을 제출하지 않으면 AI가 자동으로 제어합니다. (2턴 AFK)';
    } else if (afkTurns >= 3) {
      return '🤖 AI 자동 제어 활성화: 명령을 제출하면 다시 수동 제어로 전환됩니다.';
    }
    return '';
  }

  /**
   * 유저 복귀 처리
   * 명령을 제출하면 AI 제어 해제
   */
  static async handleUserReturn(
    battleId: string,
    generalId: number
  ): Promise<void> {
    const battle = await (Battle as any).findOne({ battleId: battleId }).exec();
    if (!battle) return;

    const afkEntry = battle.afk_tracking.find((a) => a.general_id === generalId);
    if (afkEntry && afkEntry.ai_controlled) {
      afkEntry.ai_controlled = false;
      afkEntry.afk_turns = 0;
      await battle.save();

      console.log(`[AFK] 장수 ${generalId} 유저 복귀 - AI 제어 해제`);
    }
  }

  /**
   * 전투 종료 시 AFK 통계
   */
  static async getAFKStatistics(battleId: string): Promise<any> {
    const battle = await (Battle as any).findOne({ battleId: battleId }).exec();
    if (!battle) return null;

    const stats: Record<number, { totalAfkTurns: number; aiControlledTurns: number }> = {};

    for (const afkEntry of battle.afk_tracking) {
      stats[afkEntry.general_id] = {
        totalAfkTurns: afkEntry.afk_turns,
        aiControlledTurns: battle.turn_history.filter((h) =>
          h.actions.some(
            (a: any) => a.generalId === afkEntry.general_id && a.aiGenerated === true
          )
        ).length,
      };
    }

    return stats;
  }
}
