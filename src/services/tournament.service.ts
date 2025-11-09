// @ts-nocheck - Argument count mismatches need review
/**
 * Tournament Service
 * 토너먼트 시스템 관리 서비스
 */

import { Tournament } from '../models/tournament.model';
import { General } from '../models/general.model';
import { Session } from '../models/session.model';
import { logger } from '../common/logger';
import { generalRepository } from '../repositories/general.repository';
import { tournamentRepository } from '../repositories/tournament.repository';

export type TournamentType = '전력전' | '통솔전' | '일기토' | '설전';
export type TournamentState = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * 토너먼트 상태:
 * 0: 신청 마감 전
 * 1: 신청 마감
 * 2: 예선 중
 * 3: 추첨 중
 * 4: 본선 중
 * 5: 배정 중
 * 6: 베팅 중
 * 7: 16강 중
 * 8: 8강 중
 * 9: 4강 중
 * 10: 결승
 */

export class TournamentService {
  /**
   * 토너먼트 타입을 숫자로 변환
   */
  static convertTournamentType(type: TournamentType): number {
    const map: Record<TournamentType, number> = {
      '전력전': 0,
      '통솔전': 1,
      '일기토': 2,
      '설전': 3
    };
    return map[type] ?? 0;
  }

  /**
   * 숫자를 토너먼트 타입으로 변환
   */
  static convertTournamentTypeFromNumber(type: number): TournamentType {
    const map: Record<number, TournamentType> = {
      0: '전력전',
      1: '통솔전',
      2: '일기토',
      3: '설전'
    };
    return map[type] ?? '전력전';
  }

  /**
   * 토너먼트 정보 조회
   */
  static async getTournamentInfo(sessionId: string) {
    try {
      const session = await sessionRepository.findBySessionId(sessionId );
      
      if (!session) {
        return {
          result: false,
          reason: '세션을 찾을 수 없습니다'
        };
      }

      const sessionData = session.data || {};
      const gameEnv = sessionData.game_env || {};
      
      const tournament = gameEnv.tournament || 0; // 상태
      const phase = gameEnv.phase || 0; // 단계
      const tnmtType = gameEnv.tnmt_type || 0; // 타입
      const tnmtAuto = gameEnv.tnmt_auto || false; // 자동 진행
      const tnmtTime = gameEnv.tnmt_time || null; // 시간
      const tnmtMsg = gameEnv.tnmt_msg || ''; // 메시지

      // 참가자 조회
      const participants = await Tournament
        .find({ session_id: sessionId })
        .sort({ seq: 1 })
        ;

      return {
        result: true,
        tournament: {
          isActive: tournament > 0,
          isApplicationOpen: tournament === 0,
          type: tnmtType,
          typeName: this.convertTournamentTypeFromNumber(tnmtType),
          state: tournament,
          phase,
          time: tnmtTime,
          auto: tnmtAuto,
          message: tnmtMsg,
          participants: participants.map((p: any) => ({
            seq: p.seq,
            no: p.no,
            name: p.name,
            npc: p.npc,
            leadership: p.leadership,
            strength: p.strength,
            intel: p.intel,
            lvl: p.lvl,
            grp: p.grp,
            grp_no: p.grp_no,
            win: p.win,
            draw: p.draw,
            lose: p.lose,
            gl: p.gl,
            prmt: p.prmt
          }))
        }
      };
    } catch (error: any) {
      logger.error('토너먼트 정보 조회 실패', { error: error.message });
      return {
        result: false,
        reason: error.message
      };
    }
  }

  /**
   * 토너먼트 신청
   */
  static async applyForTournament(sessionId: string, generalNo: number) {
    try {
      // 세션 확인
      const session = await sessionRepository.findBySessionId(sessionId );
      if (!session) {
        return {
          result: false,
          reason: '세션을 찾을 수 없습니다'
        };
      }

      const sessionData = session.data || {};
      const gameEnv = sessionData.game_env || {};
      
      // 신청 기간 확인
      if (gameEnv.tournament !== 0) {
        return {
          result: false,
          reason: '신청 기간이 아닙니다'
        };
      }

      // 이미 신청했는지 확인
      const existing = await tournamentRepository.findOneByFilter({
        session_id: sessionId,
        no: generalNo
      });

      if (existing) {
        return {
          result: false,
          reason: '이미 신청하셨습니다'
        };
      }

      // 장수 정보 조회
      const general = await generalRepository.findBySessionAndNo({
        session_id: sessionId,
        'data.no': generalNo
      });

      if (!general) {
        return {
          result: false,
          reason: '장수를 찾을 수 없습니다'
        };
      }

      const genData = general.data || {};

      // 토너먼트 참가자 추가
      const participant = new Tournament({
        no: generalNo,
        npc: genData.npc || 0,
        name: genData.name || general.name,
        w: genData.w || 'None',
        b: genData.b || 'None',
        h: genData.h || 'None',
        leadership: genData.leadership || 0,
        strength: genData.strength || 0,
        intel: genData.intel || 0,
        lvl: genData.officer_level || 0,
        session_id: sessionId
      });

      await participant.save();

      logger.info('토너먼트 신청 완료', { sessionId, generalNo });

      return {
        result: true,
        reason: '신청이 완료되었습니다'
      };
    } catch (error: any) {
      logger.error('토너먼트 신청 실패', { error: error.message });
      return {
        result: false,
        reason: error.message
      };
    }
  }

  /**
   * 토너먼트 신청 취소
   */
  static async cancelTournamentApplication(sessionId: string, generalNo: number) {
    try {
      const session = await sessionRepository.findBySessionId(sessionId );
      if (!session) {
        return {
          result: false,
          reason: '세션을 찾을 수 없습니다'
        };
      }

      const sessionData = session.data || {};
      const gameEnv = sessionData.game_env || {};
      
      // 신청 기간 확인
      if (gameEnv.tournament !== 0) {
        return {
          result: false,
          reason: '신청 취소 기간이 아닙니다'
        };
      }

      // 신청 삭제
      await tournamentRepository.deleteByFilter({
        session_id: sessionId,
        no: generalNo
      });

      logger.info('토너먼트 신청 취소 완료', { sessionId, generalNo });

      return {
        result: true,
        reason: '신청이 취소되었습니다'
      };
    } catch (error: any) {
      logger.error('토너먼트 신청 취소 실패', { error: error.message });
      return {
        result: false,
        reason: error.message
      };
    }
  }

  /**
   * 토너먼트 대진표 조회
   */
  static async getTournamentBracket(sessionId: string) {
    try {
      const participants = await Tournament
        .find({ session_id: sessionId })
        .sort({ grp: 1, grp_no: 1 })
        ;

      // 그룹별로 정리
      const bracket: any = {};
      for (const p of participants) {
        if (!bracket[p.grp]) {
          bracket[p.grp] = [];
        }
        bracket[p.grp].push({
          seq: p.seq,
          no: p.no,
          name: p.name,
          win: p.win,
          draw: p.draw,
          lose: p.lose,
          gl: p.gl,
          prmt: p.prmt
        });
      }

      return {
        result: true,
        bracket
      };
    } catch (error: any) {
      logger.error('토너먼트 대진표 조회 실패', { error: error.message });
      return {
        result: false,
        reason: error.message
      };
    }
  }
}


