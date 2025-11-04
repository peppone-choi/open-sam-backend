/**
 * TournamentEngine Service
 * 
 * 토너먼트 자동 진행 엔진
 * PHP 참조: hwe/func_tournament.php의 processTournament()
 * 
 * 상태 전이:
 * 1: 신청 마감 -> 2: 예선
 * 2: 예선 (phase 0-55) -> 3: 추첨
 * 3: 추첨 (phase 0-31) -> 4: 본선
 * 4: 본선 (phase 0-5) -> 5: 배정
 * 5: 배정 -> 6: 베팅
 * 6: 베팅 -> 7: 16강
 * 7: 16강 (phase 0-7) -> 8: 8강
 * 8: 8강 (phase 0-3) -> 9: 4강
 * 9: 4강 (phase 0-1) -> 10: 결승
 * 10: 결승 -> 0: 종료 (보상 지급)
 */

import { Session } from '../../models/session.model';
import { Tournament } from '../../models/tournament.model';
import { General } from '../../models/general.model';
import { KVStorage } from '../../utils/KVStorage';
import { logger } from '../../common/logger';
import { Util } from '../../utils/Util';

/**
 * 토너먼트 단위 시간 계산 (초)
 */
function calcTournamentTerm(turnTerm: number): number {
  return Util.valueFit(turnTerm, 5, 120);
}

/**
 * 토너먼트 자동 진행 처리
 */
export async function processTournament(sessionId: string): Promise<void> {
  try {
    const gameStor = KVStorage.getStorage(`game_env:${sessionId}`);
    
    const tournament = await gameStor.getValue('tournament') || 0;
    const phase = await gameStor.getValue('phase') || 0;
    const tnmtType = await gameStor.getValue('tnmt_type') || 0;
    const tnmtAuto = await gameStor.getValue('tnmt_auto') || false;
    const tnmtTime = await gameStor.getValue('tnmt_time');
    const turnTerm = await gameStor.getValue('turnterm') || 60;

    // 수동 진행이면 무시
    if (!tnmtAuto) {
      return;
    }

    if (!tnmtTime) {
      return;
    }

    const now = new Date();
    const tnmtTimeDate = new Date(tnmtTime as string | Date);
    const offset = Math.floor((now.getTime() - tnmtTimeDate.getTime()) / 1000);

    if (offset < 0) {
      return;
    }

    const unit = calcTournamentTerm(turnTerm);
    const iter = Math.floor(offset / unit) + 1;

    let currentTournament = tournament;
    let currentPhase = phase;

    for (let i = 0; i < iter; i++) {
      switch (currentTournament) {
        case 1: // 신청 마감
          await fillLowGenAll(sessionId, tnmtType);
          currentTournament = 2;
          currentPhase = 0;
          break;

        case 2: // 예선중
          await qualify(sessionId, tnmtType, currentTournament, currentPhase);
          currentPhase++;
          if (currentPhase >= 56) {
            currentTournament = 3;
            currentPhase = 0;
          }
          break;

        case 3: // 추첨중
          await selection(sessionId, tnmtType, currentTournament, currentPhase);
          currentPhase += 8;
          if (currentPhase >= 32) {
            currentTournament = 4;
            currentPhase = 0;
          }
          break;

        case 4: // 본선중
          await finallySingle(sessionId, tnmtType, currentTournament, currentPhase);
          currentPhase++;
          if (currentPhase >= 6) {
            currentTournament = 5;
            currentPhase = 0;
          }
          break;

        case 5: // 배정중
          await final16set(sessionId);
          currentTournament = 6;
          currentPhase = 0;
          await startBetting(sessionId, tnmtType, unit);
          break;

        case 6: // 베팅중
          const bettingId = await gameStor.getValue('last_tournament_betting_id') || 0;
          if (bettingId) {
            const { Betting } = await import('../../core/betting/Betting');
            const betting = new Betting(sessionId, bettingId);
            await betting.closeBetting();
          }
          currentTournament = 7;
          currentPhase = 0;
          break;

        case 7: // 16강중
          await finalFight(sessionId, tnmtType, currentTournament, currentPhase, 16);
          currentPhase++;
          if (currentPhase >= 8) {
            currentTournament = 8;
            currentPhase = 0;
          }
          break;

        case 8: // 8강중
          await finalFight(sessionId, tnmtType, currentTournament, currentPhase, 8);
          currentPhase++;
          if (currentPhase >= 4) {
            currentTournament = 9;
            currentPhase = 0;
          }
          break;

        case 9: // 4강중
          await finalFight(sessionId, tnmtType, currentTournament, currentPhase, 4);
          currentPhase++;
          if (currentPhase >= 2) {
            currentTournament = 10;
            currentPhase = 0;
          }
          break;

        case 10: // 결승중
          await finalFight(sessionId, tnmtType, currentTournament, currentPhase, 2);
          currentTournament = 0;
          currentPhase = 0;
          await setGift(sessionId, tnmtType, currentTournament, currentPhase);
          i = iter; // 종료
          break;
      }

      // 베팅은 무조건 60페이즈 후 진행 (최대 1시간)
      if (currentTournament === 6) {
        const betTerm = Util.valueFit(unit * 60, null, 3600);
        const dt = new Date(tnmtTimeDate.getTime() + (unit * i + betTerm) * 1000);
        await gameStor.setValue('tournament', currentTournament);
        await gameStor.setValue('phase', currentPhase);
        await gameStor.setValue('tnmt_time', dt.toISOString());
        return;
      }
    }

    // 상태 업데이트
    const second = unit * iter;
    const newTime = new Date(tnmtTimeDate.getTime() + second * 1000);
    await gameStor.setValue('tournament', currentTournament);
    await gameStor.setValue('phase', currentPhase);
    await gameStor.setValue('tnmt_time', newTime.toISOString());

    logger.info('[TournamentEngine] Tournament processed', {
      sessionId,
      tournament: currentTournament,
      phase: currentPhase,
      newTime: newTime.toISOString()
    });
  } catch (error: any) {
    logger.error('[TournamentEngine] Error processing tournament', {
      sessionId,
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * 신청 마감: 저능력 장수 자동 채우기 (1 -> 2)
 */
async function fillLowGenAll(sessionId: string, tnmtType: number): Promise<void> {
  // TODO: 구현 필요
  logger.info('[TournamentEngine] fillLowGenAll called', { sessionId, tnmtType });
}

/**
 * 예선 진행 (2 -> 3, phase 0-55)
 */
async function qualify(sessionId: string, tnmtType: number, tnmt: number, phase: number): Promise<void> {
  // TODO: 구현 필요
  logger.info('[TournamentEngine] qualify called', { sessionId, tnmtType, tnmt, phase });
}

/**
 * 추첨 진행 (3 -> 4, phase 0-31)
 */
async function selection(sessionId: string, tnmtType: number, tnmt: number, phase: number): Promise<void> {
  // TODO: 구현 필요
  logger.info('[TournamentEngine] selection called', { sessionId, tnmtType, tnmt, phase });
}

/**
 * 본선 진행 (4 -> 5, phase 0-5)
 */
async function finallySingle(sessionId: string, tnmtType: number, tnmt: number, phase: number): Promise<void> {
  // TODO: 구현 필요
  logger.info('[TournamentEngine] finallySingle called', { sessionId, tnmtType, tnmt, phase });
}

/**
 * 16강 배정 (5 -> 6)
 */
async function final16set(sessionId: string): Promise<void> {
  // TODO: 구현 필요
  logger.info('[TournamentEngine] final16set called', { sessionId });
}

/**
 * 베팅 시작 (6)
 */
async function startBetting(sessionId: string, type: number, unit: number): Promise<void> {
  // TODO: 구현 필요 (Betting 클래스 완성 후)
  logger.info('[TournamentEngine] startBetting called', { sessionId, type, unit });
}

/**
 * 결승전 진행 (7/8/9/10)
 */
async function finalFight(sessionId: string, tnmtType: number, tnmt: number, phase: number, type: number): Promise<void> {
  // TODO: 구현 필요
  logger.info('[TournamentEngine] finalFight called', { sessionId, tnmtType, tnmt, phase, type });
}

/**
 * 보상 지급 (10 -> 0)
 */
async function setGift(sessionId: string, tnmtType: number, tnmt: number, phase: number): Promise<void> {
  // TODO: 구현 필요
  logger.info('[TournamentEngine] setGift called', { sessionId, tnmtType, tnmt, phase });
}

