// @ts-nocheck - Type issues need investigation
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
import { logger } from '../../common/logger';
import { Tournament } from '../../models/tournament.model';
import { generalRepository } from '../../repositories/general.repository';
import { RankData } from '../../models/rank_data.model';
import { KVStorage } from '../../utils/KVStorage';
import { Util } from '../../utils/Util';
import { ActionLogger } from '../../utils/ActionLogger';
import { Betting } from '../../core/betting/Betting';
import { JosaUtil } from '../../utils/JosaUtil';
import { tournamentRepository } from '../../repositories/tournament.repository';
import { General } from '../../models/general.model';
import { acquireDistributedLock, releaseDistributedLock } from '../../common/lock/distributed-lock.helper';

// Helper 함수들
function getTwo(tournament: number, phase: number): [number, number] {
  let cand: [number, number] = [0, 1];
  
  switch (tournament) {
    case 2: // 예선
      const candMap: [number, number][] = [
        [0, 1], [2, 3], [4, 5], [6, 7],
        [0, 2], [1, 3], [4, 6], [5, 7],
        [0, 3], [1, 6], [2, 5], [4, 7],
        [0, 4], [1, 5], [2, 6], [3, 7],
        [0, 5], [1, 4], [2, 7], [3, 6],
        [0, 6], [1, 7], [2, 4], [3, 5],
        [0, 7], [1, 2], [3, 4], [5, 6],
      ];
      cand = candMap[phase % 28];
      if (phase >= 28) {
        cand = [cand[1], cand[0]];
      }
      break;
    case 4: // 본선
      const candMap2: [number, number][] = [
        [0, 1], [2, 3],
        [0, 2], [1, 3],
        [0, 3], [1, 2],
      ];
      cand = candMap2[phase % 6];
      break;
  }
  return cand;
}

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
  const lockKey = `lock:tournament:${sessionId}`;
  const acquired = await acquireDistributedLock(lockKey, {
    ttl: 90,
    retry: 3,
    retryDelayMs: 400,
    context: 'tournament-engine',
  });

  if (!acquired) {
    logger.debug('[TournamentEngine] Skip run because another worker holds the lock', { sessionId });
    return;
  }

  try {
    const gameStor = KVStorage.getStorage(`game_env:${sessionId}`);
    const startedAt = Date.now();
    
    const tournament = await gameStor.getValue('tournament') || 0;
    const phase = await gameStor.getValue('phase') || 0;
    const tnmtType = await gameStor.getValue('tnmt_type') || 0;
    const tnmtAuto = await gameStor.getValue('tnmt_auto') || false;
    const tnmtTime = await gameStor.getValue('tnmt_time');
    const turnTerm = await gameStor.getValue('turnterm') || 60;

    // 수동 진행이면 무시
    if (!tnmtAuto) {
      logger.debug(`[TournamentEngine] Auto mode disabled for ${sessionId}`);
      return;
    }

    if (!tnmtTime) {
      logger.debug(`[TournamentEngine] No scheduled time for tournament in ${sessionId}`);
      return;
    }

    const now = new Date();
    const tnmtTimeDate = new Date(tnmtTime as string | Date);
    const offset = Math.floor((now.getTime() - tnmtTimeDate.getTime()) / 1000);

    if (offset < 0) {
      logger.debug(`[TournamentEngine] Tournament not ready yet for ${sessionId}`, { tnmtTime: tnmtTimeDate.toISOString() });
      return;
    }

    const unit = calcTournamentTerm(turnTerm);
    let iter = Math.floor(offset / unit) + 1;
    if (iter > 600) {
      logger.warn(`[TournamentEngine] Iteration cap reached for ${sessionId}`, { iter, unit, offset });
      iter = 600;
    }

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

    ActionLogger.info('[TournamentEngine] Tournament processed', {
      sessionId,
      tournament: currentTournament,
      phase: currentPhase,
      newTime: newTime.toISOString()
    });

    const durationMs = Date.now() - startedAt;
    logger.info('[TournamentEngine] Execution summary', {
      sessionId,
      durationMs,
      steps: iter,
      tournament: currentTournament,
      phase: currentPhase
    });
  } catch (error: any) {
    logger.error('[TournamentEngine] Error processing tournament', {
      sessionId,
      error: error.message,
      stack: error.stack
    });
  } finally {
    await releaseDistributedLock(lockKey, 'tournament-engine');
  }
}

/**
 * 신청 마감: 저능력 장수 자동 채우기 (1 -> 2)
 */
async function fillLowGenAll(sessionId: string, tnmtType: number): Promise<void> {
  try {
    const gameStor = KVStorage.getStorage(`game_env:${sessionId}`);
    const grpCount: number[] = [0, 0, 0, 0, 0, 0, 0, 0];

    // 그룹별 참가자 수 계산
    const tournaments = await Tournament.aggregate([
      { $match: { session_id: sessionId } },
      { $group: { _id: '$grp', count: { $sum: 1 } } }
    ]);

    for (const t of tournaments) {
      if (t._id >= 0 && t._id < 8) {
        grpCount[t._id] = t.count;
      }
    }

    await gameStor.setValue('tournament', 2);
    await gameStor.setValue('phase', 0);

    const currentJoinerCnt = grpCount.reduce((sum, cnt) => sum + cnt, 0);
    if (currentJoinerCnt === 64) {
      return;
    }

    const toBeFilledCnt = 8 * 8 - currentJoinerCnt;

    // 토너먼트 타입별 스코어 함수
    const scoringCandFunction = (gen: any): number => {
      switch (tnmtType) {
        case 0: // 전력전
          return (gen.leadership || 0) + (gen.strength || 0) + (gen.intel || 0);
        case 1: // 통솔전
          return gen.leadership || 0;
        case 2: // 일기토
          return gen.strength || 0;
        case 3: // 설전
          return gen.intel || 0;
        default:
          throw new Error(`invalid tnmt_type: ${tnmtType}`);
      }
    };

    // 자동신청하고, 돈 있고, 아직 참가 안한 장수
    const freeJoinerCandidate: Array<[any, number]> = [];
    
    const generals = await generalRepository.findByFilter({
      session_id: sessionId,
      'data.tnmt': 1,
      'data.tournament': 0
    })
      
      ;

    for (const gen of generals) {
      const genData = gen.data || {};
      const score = scoringCandFunction(genData);
      freeJoinerCandidate.push([gen, Math.pow(score, 1.5)]);
    }

    const joinersValues: any[] = [];
    const joinersIdx: number[] = [];

    for (let i = 0; i < toBeFilledCnt; i++) {
      if (freeJoinerCandidate.length === 0) {
        break;
      }

      const [general] = Util.choiceRandomUsingWeightPair(freeJoinerCandidate);
      const genIdx = freeJoinerCandidate.findIndex(([g]) => g === general);
      if (genIdx >= 0) {
        freeJoinerCandidate.splice(genIdx, 1);
      }
      if (!general) {
        break;
      }

      const generalData = general.data || {};
      const generalNo = general.no || generalData.no || 0;
      const generalNpc = general.npc ?? generalData.npc ?? 0;
      const resolvedName = general.name || generalData.name || '무명';
      const resolvedLeadership = general.leadership ?? generalData.leadership ?? 10;
      const resolvedStrength = general.strength ?? generalData.strength ?? 10;
      const resolvedIntel = general.intel ?? generalData.intel ?? 10;
      const resolvedLevel = general.lvl ?? generalData.explevel ?? generalData.lvl ?? 10;
      const resolvedHorse = general.horse ?? generalData.horse ?? 'None';
      const resolvedWeapon = general.weapon ?? generalData.weapon ?? 'None';
      const resolvedBook = general.book ?? generalData.book ?? 'None';

      // 가장 적은 그룹 찾기
      const minGrpCount = Math.min(...grpCount);
      const grpIdx = grpCount.indexOf(minGrpCount);
      const grpCnt = grpCount[grpIdx];

      joinersValues.push({
        session_id: sessionId,
        no: generalNo,
        npc: generalNpc,
        name: resolvedName,
        leadership: resolvedLeadership,
        strength: resolvedStrength,
        intel: resolvedIntel,
        lvl: resolvedLevel,
        grp: grpIdx,
        grp_no: grpCnt,
        h: resolvedHorse,
        w: resolvedWeapon,
        b: resolvedBook,
        win: 0,
        draw: 0,
        lose: 0,
        gl: 0,
        prmt: 0
      });

      if (generalNo > 0) {
        joinersIdx.push(generalNo);
      }
      grpCount[grpIdx] += 1;
    }

    // 무명 장수로 빈 자리 채우기
    for (let grpIdx = 0; grpIdx < 8; grpIdx++) {
      while (grpCount[grpIdx] < 8) {
        const grpCnt = grpCount[grpIdx];
        joinersValues.push({
          session_id: sessionId,
          no: 0,
          npc: 2,
          name: '무명장수',
          leadership: 10,
          strength: 10,
          intel: 10,
          lvl: 10,
          grp: grpIdx,
          grp_no: grpCnt,
          h: 'None',
          w: 'None',
          b: 'None',
          win: 0,
          draw: 0,
          lose: 0,
          gl: 0,
          prmt: 0
        });
        grpCount[grpIdx] += 1;
      }
    }

    // 장수 tournament 플래그 업데이트
    if (joinersIdx.length > 0) {
      await generalRepository.updateManyByFilter(
        {
          session_id: sessionId,
          $or: [
            { 'data.no': { $in: joinersIdx } },
            { no: { $in: joinersIdx } }
          ]
        },
        { $set: { 'data.tournament': 1 } }
      );
    }

    // 토너먼트에 추가
    if (joinersValues.length > 0) {
      await Tournament.insertMany(joinersValues);
    }

    ActionLogger.info('[TournamentEngine] fillLowGenAll completed', { 
      sessionId, 
      tnmtType, 
      added: joinersValues.length 
    });
  } catch (error: any) {
    logger.error('[TournamentEngine] fillLowGenAll error', {
      sessionId,
      tnmtType,
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * 예선 진행 (2 -> 3, phase 0-55)
 */
async function qualify(sessionId: string, tnmtType: number, tnmt: number, phase: number): Promise<void> {
  try {
    const gameStor = KVStorage.getStorage(`game_env:${sessionId}`);
    const cand = getTwo(tnmt, phase);

    // 각 그룹 페이즈 실행
    for (let i = 0; i < 8; i++) {
      await fight(sessionId, tnmtType, tnmt, phase, i, cand[0], cand[1], 0);
    }

    if (phase < 55) {
      await gameStor.setValue('phase', phase + 1);
    } else {
      await gameStor.setValue('phase', 0);
      await gameStor.setValue('tournament', 3);

      // 각 그룹에서 상위 4명 진출 처리 (gd = win*3+draw 기준으로 정렬)
      for (let grpIdx = 0; grpIdx < 8; grpIdx++) {
        const candidates = await Tournament
          .find({
            session_id: sessionId,
            grp: grpIdx
          })
          ;

        // gd = win*3+draw 계산 후 정렬
        const promoters = candidates
          .map(gen => ({
            ...gen,
            gd: (gen.win || 0) * 3 + (gen.draw || 0)
          }))
          .sort((a, b) => {
            if (b.gd !== a.gd) return b.gd - a.gd;
            if (b.gl !== a.gl) return b.gl - a.gl;
            return 0;
          })
          .slice(0, 4);

        for (let grpRank = 0; grpRank < promoters.length; grpRank++) {
          const grpGen = promoters[grpRank];
          await tournamentRepository.updateOneByFilter(
            {
              session_id: sessionId,
              grp: grpIdx,
              grp_no: grpGen.grp_no
            },
            {
              $set: { prmt: grpRank + 1 }
            }
          );
        }
      }
    }
  } catch (error: any) {
    logger.error('[TournamentEngine] qualify error', {
      sessionId,
      tnmtType,
      tnmt,
      phase,
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * 추첨 진행 (3 -> 4, phase 0-31)
 */
async function selection(sessionId: string, tnmtType: number, tnmt: number, phase: number): Promise<void> {
  try {
    const gameStor = KVStorage.getStorage(`game_env:${sessionId}`);
    
    let grp: number;
    let grp_no: number;
    let query: any;

    // 시드1 배정
    if (phase < 8) {
      grp = phase + 10;
      grp_no = 0;
      query = { session_id: sessionId, prmt: 1 };
    } else if (phase < 16) {
      // 시드2 배정
      grp = phase - 8 + 10;
      grp_no = 1;
      query = { session_id: sessionId, prmt: 2 };
    } else if (phase < 24) {
      grp = phase - 16 + 10;
      grp_no = 2;
      query = { session_id: sessionId, prmt: { $gt: 2 } };
    } else {
      grp = phase - 24 + 10;
      grp_no = 3;
      query = { session_id: sessionId, prmt: { $gt: 2 } };
    }

    // 해당 시드에서 랜덤 선택
    const candidates = await Tournament
      .find(query)
      ;

    if (candidates.length === 0) {
      ActionLogger.warn('[TournamentEngine] No candidates for selection', { sessionId, phase, query });
      return;
    }

    const general = Util.choiceRandom(candidates);
    if (!general) {
      return;
    }

    // 본선에 추가
    await tournamentRepository.create({
      session_id: sessionId,
      no: general.no,
      npc: general.npc,
      name: general.name,
      leadership: general.leadership,
      strength: general.strength,
      intel: general.intel,
      lvl: general.lvl,
      grp: grp,
      grp_no: grp_no,
      h: general.h || 'None',
      w: general.w || 'None',
      b: general.b || 'None',
      win: 0,
      draw: 0,
      lose: 0,
      gl: 0,
      prmt: 0
    });

    // 시드 삭제
    await tournamentRepository.updateOneByFilter(
      {
        session_id: sessionId,
        grp: general.grp,
        grp_no: general.grp_no
      },
      {
        $set: { prmt: 0 }
      }
    );

    if (phase < 31) {
      await gameStor.setValue('phase', phase + 1);
    } else {
      await gameStor.setValue('tournament', 4);
      await gameStor.setValue('phase', 0);
    }
  } catch (error: any) {
    logger.error('[TournamentEngine] selection error', {
      sessionId,
      tnmtType,
      tnmt,
      phase,
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * 본선 진행 (4 -> 5, phase 0-5)
 */
async function finallySingle(sessionId: string, tnmtType: number, tnmt: number, phase: number): Promise<void> {
  try {
    const gameStor = KVStorage.getStorage(`game_env:${sessionId}`);
    const cand = getTwo(tnmt, phase);

    // 각 그룹 페이즈 실행
    for (let i = 10; i < 18; i++) {
      await fight(sessionId, tnmtType, tnmt, phase, i, cand[0], cand[1], 0);
    }

    if (phase < 5) {
      await gameStor.setValue('phase', phase + 1);
    } else {
      await gameStor.setValue('tournament', 5);
      await gameStor.setValue('phase', 0);

      // 각 그룹에서 상위 2명 진출 처리 (gd = win*3+draw 기준으로 정렬)
      for (let grpIdx = 10; grpIdx < 18; grpIdx++) {
        const candidates = await Tournament
          .find({
            session_id: sessionId,
            grp: grpIdx
          })
          ;

        // gd = win*3+draw 계산 후 정렬
        const promoters = candidates
          .map(gen => ({
            ...gen,
            gd: (gen.win || 0) * 3 + (gen.draw || 0)
          }))
          .sort((a, b) => {
            if (b.gd !== a.gd) return b.gd - a.gd;
            if (b.gl !== a.gl) return b.gl - a.gl;
            return 0;
          })
          .slice(0, 2);

        for (let grpRank = 0; grpRank < promoters.length; grpRank++) {
          const grpGen = promoters[grpRank];
          await tournamentRepository.updateOneByFilter(
            {
              session_id: sessionId,
              grp: grpIdx,
              grp_no: grpGen.grp_no
            },
            {
              $set: { prmt: grpRank + 1 }
            }
          );
        }
      }
    }
  } catch (error: any) {
    logger.error('[TournamentEngine] finallySingle error', {
      sessionId,
      tnmtType,
      tnmt,
      phase,
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * 16강 배정 (5 -> 6)
 */
async function final16set(sessionId: string): Promise<void> {
  try {
    const gameStor = KVStorage.getStorage(`game_env:${sessionId}`);

    // 1조1-5조2, 2조1-6조2, 3조1-7조2, 4조1-8조2, 5조1-1조2, 6조1-2조2, 7조1-3조2, 8조1-4조2
    const grp = [10, 14, 11, 15, 12, 16, 13, 17, 14, 10, 15, 11, 16, 12, 17, 13];
    const prmt = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2];

    for (let i = 0; i < 16; i++) {
      const general = await tournamentRepository.findOneByFilter({
        session_id: sessionId,
        grp: grp[i],
        prmt: prmt[i]
      });

      if (!general) {
        ActionLogger.warn('[TournamentEngine] General not found for final16set', { 
          sessionId, 
          grp: grp[i], 
          prmt: prmt[i] 
        });
        continue;
      }

      // 16강에 추가
      const newGrp = 20 + Math.floor(i / 2);
      const newGrp_no = i % 2;

      await tournamentRepository.create({
        session_id: sessionId,
        no: general.no,
        npc: general.npc,
        name: general.name,
        leadership: general.leadership,
        strength: general.strength,
        intel: general.intel,
        lvl: general.lvl,
        grp: newGrp,
        grp_no: newGrp_no,
        h: general.h || 'None',
        w: general.w || 'None',
        b: general.b || 'None',
        win: 0,
        draw: 0,
        lose: 0,
        gl: 0,
        prmt: 0
      });
    }

    // 모든 prmt 초기화
    await tournamentRepository.updateManyByFilter(
      { session_id: sessionId },
      { $set: { prmt: 0 } }
    );

    await gameStor.setValue('tournament', 6);
    await gameStor.setValue('phase', 0);
  } catch (error: any) {
    logger.error('[TournamentEngine] final16set error', {
      sessionId,
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * 베팅 시작 (6)
 */
async function startBetting(sessionId: string, type: number, unit: number): Promise<void> {
  try {
    const gameStor = KVStorage.getStorage(`game_env:${sessionId}`);
    const [year, month, startyear] = await gameStor.getValuesAsArray(['year', 'month', 'startyear']);
    
    const logger = new ActionLogger(0, 0, year, month);
    logger.pushGlobalHistoryLog(`<S>◆</>${year}년 ${month}월:<B><b>【대회】</b></>우승자를 예상하는 <C>내기</>가 진행중입니다! 호사가의 참여를 기다립니다!`);
    await logger.flush();

    const [typeText, statName, statKey] = [
      ['전력전', '종능', 'total'],
      ['통솔전', '통솔', 'leadership'],
      ['일기토', '무력', 'strength'],
      ['설전', '지력', 'intel'],
    ][type];

    const bettingID = await Betting.genNextBettingID(sessionId);

    const openYearMonth = Util.joinYearMonth(year, month);
    const closeYearMonth = openYearMonth + 120;

    const candidates: Record<number, any> = {};

    const generalList = await Tournament
      .find({
        session_id: sessionId,
        grp: { $gte: 20, $lt: 30 }
      })
      .sort({ grp: 1, grp_no: 1 })
      .limit(16)
      ;

    for (const general of generalList) {
      if (general.no <= 0) {
        continue;
      }
      const total = general.leadership + general.strength + general.intel;
      const statValue = statKey === 'total' ? total : general[statKey];
      
      candidates[general.no] = {
        title: general.name,
        info: `${statName}: ${statValue}`,
        isHtml: null,
        aux: {
          ...general,
          total: total
        }
      };
    }

    const bettingInfo = {
      id: bettingID,
      type: 'tournament',
      name: typeText,
      finished: false,
      selectCnt: 1,
      isExclusive: null,
      reqInheritancePoint: false,
      openYearMonth: openYearMonth,
      closeYearMonth: closeYearMonth,
      candidates: candidates,
      winner: null
    };

    await Betting.openBetting(sessionId, bettingInfo);

    await gameStor.setValue('last_tournament_betting_id', bettingID);

    const betGold = Util.valueFit(Math.floor((3 + year - startyear) * 0.334) * 10, 10);

    // NPC 베팅
    const npcList = await General
      .find({
        session_id: sessionId,
        'data.npc': { $gte: 2 },
        'data.gold': { $gte: 500 + betGold }
      })
      
      ;

    const betting = new Betting(sessionId, bettingID);
    const targetList = Object.keys(candidates).map(Number);

    for (const npc of npcList) {
      if (targetList.length === 0) break;
      const target = Util.choiceRandom(targetList);
      if (target) {
        try {
          await betting.bet(npc.no, null, [target], betGold);
        } catch (error: any) {
          ActionLogger.warn('[TournamentEngine] NPC bet failed', {
            sessionId,
            npcId: npc.no,
            error: error.message
          });
        }
      }
    }

    ActionLogger.info('[TournamentEngine] startBetting completed', { 
      sessionId, 
      type, 
      bettingID,
      npcCount: npcList.length
    });
  } catch (error: any) {
    logger.error('[TournamentEngine] startBetting error', {
      sessionId,
      type,
      unit,
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * 결승전 진행 (7/8/9/10)
 */
async function finalFight(sessionId: string, tnmtType: number, tnmt: number, phase: number, type: number): Promise<void> {
  try {
    const gameStor = KVStorage.getStorage(`game_env:${sessionId}`);

    const config: Record<number, [number, number, number]> = {
      16: [20, 7, 7],
      8: [30, 3, 8],
      4: [40, 1, 9],
      2: [50, 0, 0],
    };

    const [offset, turn, next] = config[type] || [0, 0, 0];
    if (offset === 0) {
      throw new Error(`Invalid type: ${type}`);
    }

    const grp = phase + offset;
    await fight(sessionId, tnmtType, tnmt, phase, grp, 0, 1, 1);

    await gameStor.setValue('phase', phase + 1);

    // 승자 조회
    const general = await tournamentRepository.findOneByFilter({
      session_id: sessionId,
      grp: grp,
      win: { $gt: 0 },
      grp_no: { $in: [0, 1] }
    });

    if (!general) {
      ActionLogger.warn('[TournamentEngine] No winner found for finalFight', { sessionId, grp, phase });
      return;
    }

    // x강에 추가
    const newGrp = Math.floor(phase / 2) + offset + 10;
    const newGrp_no = phase % 2;

    await tournamentRepository.create({
      session_id: sessionId,
      no: general.no,
      npc: general.npc,
      name: general.name,
      leadership: general.leadership,
      strength: general.strength,
      intel: general.intel,
      lvl: general.lvl,
      grp: newGrp,
      grp_no: newGrp_no,
      h: general.h || 'None',
      w: general.w || 'None',
      b: general.b || 'None',
      win: 0,
      draw: 0,
      lose: 0,
      gl: 0,
      prmt: 0
    });

    if (phase >= turn) {
      await gameStor.setValue('tournament', next);
      await gameStor.setValue('phase', 0);
    }
  } catch (error: any) {
    logger.error('[TournamentEngine] finalFight error', {
      sessionId,
      tnmtType,
      tnmt,
      phase,
      type,
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * 토너먼트 전투 함수
 */
async function fight(
  sessionId: string,
  tnmtType: number,
  tnmt: number,
  phase: number,
  group: number,
  g1: number,
  g2: number,
  type: number
): Promise<void> {
  try {
    const turn = type === 0 ? 10 : 100;

    const [tp, tp2] = [
      [0, 'total', 'tt'],
      [1, 'leadership', 'tl'],
      [2, 'strength', 'ts'],
      [3, 'intel', 'ti'],
    ][tnmtType] || [null, null];

    if (!tp || !tp2) {
      throw new Error(`Invalid tnmt_type: ${tnmtType}`);
    }

    // 장수 조회
    const gen1 = await tournamentRepository.findOneByFilter({
      session_id: sessionId,
      grp: group,
      grp_no: g1
    });

    const gen2 = await tournamentRepository.findOneByFilter({
      session_id: sessionId,
      grp: group,
      grp_no: g2
    });

    if (!gen1 || !gen2) {
      ActionLogger.warn('[TournamentEngine] fight: General not found', { sessionId, group, g1, g2 });
      return;
    }

    // 에너지 계산 (간단 버전)
    const getLog = (lvl1: number, lvl2: number): number => {
      if (lvl1 >= lvl2) {
        return 1 + Math.log10(1 + lvl1 - lvl2) / 10;
      } else {
        return 1 - Math.log10(1 + lvl2 - lvl1) / 10;
      }
    };

    const stat1 = tp === 'total' 
      ? (gen1.leadership + gen1.strength + gen1.intel) * 7 / 15
      : gen1[tp];
    const stat2 = tp === 'total'
      ? (gen2.leadership + gen2.strength + gen2.intel) * 7 / 15
      : gen2[tp];

    const e1 = Util.round(stat1 * getLog(gen1.lvl, gen2.lvl) * 10);
    const e2 = Util.round(stat2 * getLog(gen1.lvl, gen2.lvl) * 10);
    let energy1 = e1;
    let energy2 = e2;

    let gd1 = 0;
    let gd2 = 0;
    let sel = 2; // 무승부

    // 전투 진행 (간단 버전)
    for (let currentPhase = 1; currentPhase <= turn; currentPhase++) {
      // 평타
      let damage1 = Util.round(stat2 * (Math.floor(Math.random() * 21) + 90) / 130);
      let damage2 = Util.round(stat1 * (Math.floor(Math.random() * 21) + 90) / 130);

      // 보너스타
      if (Math.floor(Math.random() * 100) < stat1) {
        damage2 += Util.round(stat1 * (Math.floor(Math.random() * 41) + 10) / 130);
      }
      if (Math.floor(Math.random() * 100) < stat2) {
        damage1 += Util.round(stat2 * (Math.floor(Math.random() * 41) + 10) / 130);
      }

      energy1 -= damage1;
      energy2 -= damage2;
      gd1 += damage1;
      gd2 += damage2;

      energy1 = Util.round(energy1);
      energy2 = Util.round(energy2);

      if (energy1 <= 0 && energy2 <= 0) {
        if (type === 0) {
          sel = 2; // 무승부
          break;
        } else {
          // 재대결 - 초기 값의 절반으로 재설정
          energy1 = Util.round(e1 / 2);
          energy2 = Util.round(e2 / 2);
        }
      } else if (energy1 <= 0) {
        sel = 1; // gen2 승리
        break;
      } else if (energy2 <= 0) {
        sel = 0; // gen1 승리
        break;
      }
    }

    // 결과 업데이트
    const gl = Util.round((gd2 - gd1) / 50);

    // rank_data 조회
    const gen1glDoc = await RankData.findOne({
      session_id: sessionId,
      'data.id': gen1.no,
      'data.type': `${tp2}g`
    });
    const gen2glDoc = await RankData.findOne({
      session_id: sessionId,
      'data.id': gen2.no,
      'data.type': `${tp2}g`
    });

    const gen1gl = gen1glDoc?.data?.value || 0;
    const gen2gl = gen2glDoc?.data?.value || 0;

    let gl1 = 0;
    let gl2 = 0;
    let gen1resKey = 'd';
    let gen2resKey = 'd';

    if (sel === 0) {
      // gen1 승리
      await tournamentRepository.updateOneByFilter(
        { session_id: sessionId, grp: group, grp_no: g1 },
        { $inc: { win: 1, gl: gl } }
      );
      await tournamentRepository.updateOneByFilter(
        { session_id: sessionId, grp: group, grp_no: g2 },
        { $inc: { lose: 1, gl: -gl } }
      );

      if (gen1gl > gen2gl) {
        gl1 = 1;
        gl2 = 0;
      } else if (gen1gl === gen2gl) {
        gl1 = 2;
        gl2 = -1;
      } else {
        gl1 = 3;
        gl2 = -2;
      }

      gen1resKey = 'w';
      gen2resKey = 'l';
    } else if (sel === 1) {
      // gen2 승리
      await tournamentRepository.updateOneByFilter(
        { session_id: sessionId, grp: group, grp_no: g1 },
        { $inc: { lose: 1, gl: -gl } }
      );
      await tournamentRepository.updateOneByFilter(
        { session_id: sessionId, grp: group, grp_no: g2 },
        { $inc: { win: 1, gl: gl } }
      );

      if (gen2gl > gen1gl) {
        gl2 = 1;
        gl1 = 0;
      } else if (gen2gl === gen1gl) {
        gl2 = 2;
        gl1 = -1;
      } else {
        gl2 = 3;
        gl1 = -2;
      }

      gen1resKey = 'l';
      gen2resKey = 'w';
    } else {
      // 무승부
      await tournamentRepository.updateManyByFilter(
        { session_id: sessionId, grp: group, grp_no: { $in: [g1, g2] } },
        { $inc: { draw: 1 } }
      );

      if (gen1gl > gen2gl) {
        gl2 = -1;
        gl1 = 1;
      } else if (gen1gl === gen2gl) {
        gl2 = 0;
        gl1 = 0;
      } else {
        gl2 = 1;
        gl1 = -1;
      }

      gen1resKey = 'd';
      gen2resKey = 'd';
    }

    // rank_data 업데이트
    if (gen1.no > 0) {
      await RankData.findOneAndUpdate(
        {
          session_id: sessionId,
          'data.id': gen1.no,
          'data.type': `${tp2}${gen1resKey}`
        },
        {
          $inc: { 'data.value': 1 }
        },
        { upsert: true }
      );

      await RankData.findOneAndUpdate(
        {
          session_id: sessionId,
          'data.id': gen1.no,
          'data.type': `${tp2}g`
        },
        {
          $inc: { 'data.value': gl1 }
        },
        { upsert: true }
      );
    }

    if (gen2.no > 0) {
      await RankData.findOneAndUpdate(
        {
          session_id: sessionId,
          'data.id': gen2.no,
          'data.type': `${tp2}${gen2resKey}`
        },
        {
          $inc: { 'data.value': 1 }
        },
        { upsert: true }
      );

      await RankData.findOneAndUpdate(
        {
          session_id: sessionId,
          'data.id': gen2.no,
          'data.type': `${tp2}g`
        },
        {
          $inc: { 'data.value': gl2 }
        },
        { upsert: true }
      );
    }
  } catch (error: any) {
    logger.error('[TournamentEngine] fight error', {
      sessionId,
      tnmtType,
      tnmt,
      phase,
      group,
      g1,
      g2,
      type,
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * 보상 지급 (10 -> 0)
 */
async function setGift(sessionId: string, tnmtType: number, tnmt: number, phase: number): Promise<void> {
  try {
    const gameStor = KVStorage.getStorage(`game_env:${sessionId}`);
    const [year, month, develcost, bettingId] = await gameStor.getValuesAsArray(['year', 'month', 'develcost', 'last_tournament_betting_id']);

    const resultHelper: Record<number, any> = {};

    const [tp, tp2] = [
      ['전력전', 'tt'],
      ['통솔전', 'tl'],
      ['일기토', 'ts'],
      ['설전', 'ti'],
    ][tnmtType] || [null, null];

    if (!tp || !tp2) {
      throw new Error(`Invalid tnmt_type: ${tnmtType}`);
    }

    // 16강자 명성 돈
    let cost = develcost || 100;
    const round16Generals = await tournamentRepository.findByFilter({
      session_id: sessionId,
      grp: { $gte: 20, $lt: 30 },
      no: { $gt: 0 }
    });

    for (const general of round16Generals) {
      const generalID = general.no;
      
      await generalRepository.updateOneByFilter(
        { session_id: sessionId, no: generalID },
        { 
          $inc: { 
            'data.experience': 25,
            'data.gold': cost
          }
        }
      );

      // rank_data 업데이트
      await RankData.findOneAndUpdate(
        {
          session_id: sessionId,
          'data.id': generalID,
          'data.type': `${tp2}g`
        },
        {
          $inc: { 'data.value': 1 }
        },
        { upsert: true }
      );

      const logger = new ActionLogger(generalID, 0, year, month);
      resultHelper[generalID] = {
        id: generalID,
        grp: general.grp,
        grp_no: general.grp_no,
        reward: cost,
        msg: "<span class='ev_highlight'>16강 진출</span>",
        logger: logger,
        inheritance_point: 10
      };
    }

    // 8강자 명성 돈
    cost = (develcost || 100) * 2;
    const round8Generals = await tournamentRepository.findByFilter({
      session_id: sessionId,
      grp: { $gte: 30, $lt: 40 },
      no: { $gt: 0 }
    });

    for (const general of round8Generals) {
      const generalID = general.no;
      
      await generalRepository.updateOneByFilter(
        { session_id: sessionId, no: generalID },
        { 
          $inc: { 
            'data.experience': 50,
            'data.gold': cost
          }
        }
      );

      await RankData.findOneAndUpdate(
        {
          session_id: sessionId,
          'data.id': generalID,
          'data.type': `${tp2}g`
        },
        {
          $inc: { 'data.value': 1 }
        },
        { upsert: true }
      );

      if (resultHelper[generalID]) {
        resultHelper[generalID].reward += cost;
        resultHelper[generalID].msg = "<span class='ev_highlight'>8강 진출</span>";
      }
    }

    // 4강자 명성 돈
    cost = (develcost || 100) * 3;
    const round4Generals = await tournamentRepository.findByFilter({
      session_id: sessionId,
      grp: { $gte: 40, $lt: 50 },
      no: { $gt: 0 }
    });

    for (const general of round4Generals) {
      const generalID = general.no;
      
      await generalRepository.updateOneByFilter(
        { session_id: sessionId, no: generalID },
        { 
          $inc: { 
            'data.experience': 50,
            'data.gold': cost
          }
        }
      );

      await RankData.findOneAndUpdate(
        {
          session_id: sessionId,
          'data.id': generalID,
          'data.type': `${tp2}g`
        },
        {
          $inc: { 'data.value': 2 }
        },
        { upsert: true }
      );

      if (resultHelper[generalID]) {
        resultHelper[generalID].reward += cost;
        resultHelper[generalID].msg = "<span class='ev_highlight'>4강 진출</span>";
        resultHelper[generalID].inheritance_point = 10;
      }

      // 유산포인트 증가
      const inheritStor = KVStorage.getStorage(`inheritance_${generalID}:${sessionId}`);
      const previous = await inheritStor.getValue('previous') || [0, null];
      await inheritStor.setValue('previous', [previous[0] + 10, previous[1]]);
    }

    // 결승자 명성 돈
    cost = (develcost || 100) * 6;
    let runnerUp: any = null;
    const finalGenerals = await tournamentRepository.findByFilter({
      session_id: sessionId,
      grp: { $gte: 50, $lt: 60 },
      no: { $gt: 0 }
    });

    for (const general of finalGenerals) {
      const generalID = general.no;
      
      await generalRepository.updateOneByFilter(
        { session_id: sessionId, no: generalID },
        { 
          $inc: { 
            'data.experience': 100,
            'data.gold': cost
          }
        }
      );

      await RankData.findOneAndUpdate(
        {
          session_id: sessionId,
          'data.id': generalID,
          'data.type': `${tp2}g`
        },
        {
          $inc: { 'data.value': 2 }
        },
        { upsert: true }
      );

      if (resultHelper[generalID]) {
        resultHelper[generalID].reward += cost;
        resultHelper[generalID].msg = "<span class='ev_highlight'>준우승</span>으";
        resultHelper[generalID].inheritance_point = 50;
      }

      if (general.lose > 0) {
        runnerUp = general;
      }
    }

    // 우승자 명성 돈
    cost = (develcost || 100) * 8;
    let winner: any = null;
    const winnerGenerals = await tournamentRepository.findByFilter({
      session_id: sessionId,
      grp: { $gte: 60 },
      no: { $gt: 0 }
    });

    for (const general of winnerGenerals) {
      const generalID = general.no;
      
      await generalRepository.updateOneByFilter(
        { session_id: sessionId, no: generalID },
        { 
          $inc: { 
            'data.experience': 200,
            'data.gold': cost
          }
        }
      );

      await RankData.findOneAndUpdate(
        {
          session_id: sessionId,
          'data.id': generalID,
          'data.type': `${tp2}g`
        },
        {
          $inc: { 'data.value': 2 }
        },
        { upsert: true }
      );

      await RankData.findOneAndUpdate(
        {
          session_id: sessionId,
          'data.id': generalID,
          'data.type': `${tp2}p`
        },
        {
          $inc: { 'data.value': 1 }
        },
        { upsert: true }
      );

      if (resultHelper[generalID]) {
        resultHelper[generalID].reward += cost;
        resultHelper[generalID].msg = "<span class='ev_highlight'>우승</span>으";
        resultHelper[generalID].inheritance_point = 100;
      }

      winner = general;
    }

    if (!winner || !runnerUp) {
      ActionLogger.warn('[TournamentEngine] setGift: Winner or runner-up not found', { sessionId, winner, runnerUp });
      return;
    }

    // 자동진행 끝
    await gameStor.setValue('tnmt_auto', false);

    // 장수열전 기록
    const winnerLogger = resultHelper[winner.no]?.logger;
    const runnerUpLogger = resultHelper[runnerUp.no]?.logger;

    if (winnerLogger) {
      winnerLogger.pushGeneralHistoryLog(`<C>${tp}</> 대회에서 우승`);
      await winnerLogger.flush();
    }

    if (runnerUpLogger) {
      runnerUpLogger.pushGeneralHistoryLog(`<C>${tp}</> 대회에서 준우승`);
      await runnerUpLogger.flush();
    }

    const winnerRewardText = Util.numberFormat(resultHelper[winner.no]?.reward || 0);
    const runnerUpRewardText = Util.numberFormat(resultHelper[runnerUp.no]?.reward || 0);

    const josaYiWinner = JosaUtil.pick(winner.name, '이');
    const josaYiRunnerUp = JosaUtil.pick(runnerUp.name, '이');

    const globalLogger = new ActionLogger(0, 0, year, month);
    globalLogger.pushGlobalHistoryLog(`<B><b>【대회】</b></><C>${tp}</> 대회에서 <Y>${winner.name}</>${josaYiWinner} <C>우승</>, <Y>${runnerUp.name}</>${josaYiRunnerUp} <C>준우승</>을 차지하여 천하에 이름을 떨칩니다!`);
    globalLogger.pushGlobalHistoryLog(`<B><b>【대회】</b></><C>${tp}</> 대회의 <S>우승자</>에게는 <C>${winnerRewardText}</>, <S>준우승자</>에겐 <C>${runnerUpRewardText}</>의 <S>상금</>과 약간의 <S>명성</>이 주어집니다!`);
    await globalLogger.flush();

    // 개인 보상 로그
    for (const generalID in resultHelper) {
      const general = resultHelper[generalID];
      const rewardText = Util.numberFormat(general.reward);
      const logger = general.logger;
      
      logger.pushGeneralActionLog(`<C>${tp}</> 대회의 ${general.msg}로 <C>${rewardText}</>의 <S>상금</>, 약간의 <S>명성</> 획득!`, ActionLogger.PLAIN);
      await logger.flush();

      // 유산포인트 증가
      if (general.inheritance_point > 0) {
        const inheritStor = KVStorage.getStorage(`inheritance_${generalID}:${sessionId}`);
        const previous = await inheritStor.getValue('previous') || [0, null];
        await inheritStor.setValue('previous', [previous[0] + general.inheritance_point, previous[1]]);
      }
    }

    // 베팅 보상 지급
    if (bettingId) {
      try {
        const betting = new Betting(sessionId, bettingId);
        await betting.giveReward([winner.no]);
      } catch (error: any) {
        ActionLogger.warn('[TournamentEngine] setGift: Betting reward failed', {
          sessionId,
          bettingId,
          error: error.message
        });
      }
    }

    ActionLogger.info('[TournamentEngine] setGift completed', {
      sessionId,
      tnmtType,
      winner: winner.no,
      runnerUp: runnerUp.no
    });
  } catch (error: any) {
    logger.error('[TournamentEngine] setGift error', {
      sessionId,
      tnmtType,
      tnmt,
      phase,
      error: error.message,
      stack: error.stack
    });
  }
}

