/**
 * ImpeachmentService
 * 탄핵 투표 시스템
 * 
 * Agent I: 정치/투표 시스템
 */

import { generalRepository } from '../../repositories/general.repository';
import { nationRepository } from '../../repositories/nation.repository';
import { sessionRepository } from '../../repositories/session.repository';
import {
  VoteType,
  VoteStatus,
  ImpeachmentRequest,
  ImpeachmentVote,
  OfficerLevel,
  CandidateInfo
} from '../../types/vote.types';
import { VoteSystemService } from './VoteSystem.service';
import { OfficerSystemService } from './OfficerSystem.service';

export interface InitiateImpeachmentParams {
  sessionId: string;
  nationId: number;
  requesterId: number;
  targetGeneralId?: number;  // 지정하지 않으면 현재 군주
  reason: string;
}

export interface ImpeachmentResult {
  result: boolean;
  voteId?: number;
  message?: string;
}

export interface ProcessImpeachmentParams {
  sessionId: string;
  voteId: number;
}

/**
 * 탄핵 발의 조건
 */
const IMPEACHMENT_CONDITIONS = {
  /** 탄핵 발의에 필요한 최소 관직 레벨 */
  MIN_OFFICER_LEVEL: 5,
  /** 탄핵 투표 통과 기준 (%) */
  PASS_THRESHOLD: 60,
  /** 탄핵 투표 정족수 (최소 투표 인원 비율 %) */
  QUORUM_RATIO: 30,
  /** 투표 기간 (시간) */
  VOTE_DURATION_HOURS: 24,
  /** 탄핵 쿨다운 (시간) - 연속 탄핵 방지 */
  COOLDOWN_HOURS: 48
};

export class ImpeachmentService {
  /**
   * 탄핵 발의
   */
  static async initiateImpeachment(params: InitiateImpeachmentParams): Promise<ImpeachmentResult> {
    const { sessionId, nationId, requesterId, targetGeneralId, reason } = params;

    try {
      // 발의자 확인
      const requester = await generalRepository.findOneByFilter({
        session_id: sessionId,
        no: requesterId
      });

      if (!requester) {
        return { result: false, message: '장수를 찾을 수 없습니다.' };
      }

      const requesterData = requester.data || {};

      // 같은 국가 소속인지 확인
      if (requesterData.nation !== nationId) {
        return { result: false, message: '같은 국가 소속이 아닙니다.' };
      }

      // 발의자 관직 확인
      const requesterOfficerLevel = requesterData.officer_level || 0;
      if (requesterOfficerLevel < IMPEACHMENT_CONDITIONS.MIN_OFFICER_LEVEL) {
        return { result: false, message: '수뇌부만 탄핵을 발의할 수 있습니다.' };
      }

      // 군주는 탄핵 발의 불가
      if (requesterOfficerLevel === OfficerLevel.RULER) {
        return { result: false, message: '군주는 탄핵을 발의할 수 없습니다.' };
      }

      // 탄핵 대상 확인 (기본: 현재 군주)
      let target;
      if (targetGeneralId) {
        target = await generalRepository.findOneByFilter({
          session_id: sessionId,
          no: targetGeneralId
        });
      } else {
        target = await generalRepository.findOneByFilter({
          session_id: sessionId,
          'data.nation': nationId,
          'data.officer_level': OfficerLevel.RULER
        });
      }

      if (!target) {
        return { result: false, message: '탄핵 대상을 찾을 수 없습니다.' };
      }

      const targetData = target.data || {};

      // 대상이 군주인지 확인
      if ((targetData.officer_level || 0) !== OfficerLevel.RULER) {
        return { result: false, message: '군주만 탄핵 대상이 될 수 있습니다.' };
      }

      // 같은 국가 소속인지 확인
      if (targetData.nation !== nationId) {
        return { result: false, message: '같은 국가의 군주만 탄핵할 수 있습니다.' };
      }

      // 쿨다운 확인 (진행중이거나 최근 탄핵 투표)
      const existingVote = await this.checkExistingImpeachment(sessionId, nationId);
      if (existingVote.exists) {
        return { result: false, message: existingVote.message };
      }

      // 국가 장수 수 조회 (정족수 계산용)
      const nationGenerals = await generalRepository.findByFilter({
        session_id: sessionId,
        'data.nation': nationId
      });

      const totalMembers = nationGenerals.length;
      const quorum = Math.max(3, Math.ceil(totalMembers * IMPEACHMENT_CONDITIONS.QUORUM_RATIO / 100));

      // 투표 종료 시간 계산
      const endDate = new Date();
      endDate.setHours(endDate.getHours() + IMPEACHMENT_CONDITIONS.VOTE_DURATION_HOURS);

      // 탄핵 투표 생성
      const voteResult = await VoteSystemService.createVote({
        sessionId,
        title: `${targetData.name || '무명'} 군주 탄핵안`,
        type: VoteType.IMPEACHMENT,
        options: ['찬성 (탄핵)', '반대 (유지)'],
        multipleOptions: 1,
        endDate: endDate.toISOString(),
        nationId,
        opener: requesterData.name || '무명',
        keepOldVote: true,
        metadata: {
          targetGeneralId: target.no,
          passThreshold: IMPEACHMENT_CONDITIONS.PASS_THRESHOLD,
          quorum,
          candidates: await this.getCandidateList(sessionId, nationId, target.no)
        }
      });

      if (!voteResult.result) {
        return { result: false, message: voteResult.message };
      }

      // 탄핵 기록 저장
      await this.recordImpeachment(sessionId, nationId, {
        voteId: voteResult.voteId!,
        targetGeneralId: target.no,
        requesterId,
        reason,
        initiatedAt: new Date().toISOString()
      });

      return {
        result: true,
        voteId: voteResult.voteId
      };
    } catch (error: any) {
      console.error('[ImpeachmentService] initiateImpeachment error:', error);
      return { result: false, message: error.message };
    }
  }

  /**
   * 탄핵 투표 결과 처리
   */
  static async processImpeachmentResult(params: ProcessImpeachmentParams): Promise<{
    result: boolean;
    passed: boolean;
    newRulerId?: number;
    message?: string;
  }> {
    const { sessionId, voteId } = params;

    try {
      // 투표 정보 조회
      const voteInfo = await VoteSystemService.getVoteInfo(sessionId, voteId);
      if (!voteInfo) {
        return { result: false, passed: false, message: '투표를 찾을 수 없습니다.' };
      }

      if (voteInfo.type !== VoteType.IMPEACHMENT) {
        return { result: false, passed: false, message: '탄핵 투표가 아닙니다.' };
      }

      // 투표 결과 계산
      const voteResult = await VoteSystemService.calculateVoteResult({ sessionId, voteId });

      const threshold = voteInfo.metadata?.passThreshold || IMPEACHMENT_CONDITIONS.PASS_THRESHOLD;
      const quorum = voteInfo.metadata?.quorum || 0;

      // 정족수 확인
      if (voteResult.totalVoters < quorum) {
        await VoteSystemService.closeVote(sessionId, voteId);
        return {
          result: true,
          passed: false,
          message: `정족수 미달 (${voteResult.totalVoters}/${quorum})`
        };
      }

      // 찬성 비율 계산 (찬성 = 인덱스 0)
      const agreeResult = voteResult.results.find(r => r.optionIndex === 0);
      const agreePercentage = agreeResult?.percentage || 0;

      // 탄핵 통과 여부
      const passed = agreePercentage >= threshold;

      // 투표 종료
      await VoteSystemService.closeVote(sessionId, voteId);

      if (!passed) {
        return {
          result: true,
          passed: false,
          message: `탄핵안 부결 (찬성 ${agreePercentage}%, 필요 ${threshold}%)`
        };
      }

      // 탄핵 통과 - 군주 교체
      const targetGeneralId = voteInfo.metadata?.targetGeneralId;
      if (!targetGeneralId) {
        return { result: false, passed: true, message: '탄핵 대상 정보가 없습니다.' };
      }

      // 기존 군주 강등
      await generalRepository.updateBySessionAndNo(sessionId, targetGeneralId, {
        'data.officer_level': OfficerLevel.NORMAL,
        'data.officer_city': 0,
        officer_level: OfficerLevel.NORMAL
      });

      // 새 군주 선출
      const nationId = voteInfo.nationId!;
      const nextRulerResult = await OfficerSystemService.selectNextRuler(sessionId, nationId);

      return {
        result: true,
        passed: true,
        newRulerId: nextRulerResult.newRulerId,
        message: `탄핵 통과 (찬성 ${agreePercentage}%)`
      };
    } catch (error: any) {
      console.error('[ImpeachmentService] processImpeachmentResult error:', error);
      return { result: false, passed: false, message: error.message };
    }
  }

  /**
   * 모반 시도 (탄핵 없이 강제 군주 탈취)
   * PHP che_모반시도.php 대응
   */
  static async attemptRebellion(
    sessionId: string,
    nationId: number,
    rebellerId: number
  ): Promise<{
    result: boolean;
    success: boolean;
    message?: string;
  }> {
    try {
      // 모반자 확인
      const rebeller = await generalRepository.findOneByFilter({
        session_id: sessionId,
        no: rebellerId
      });

      if (!rebeller) {
        return { result: false, success: false, message: '장수를 찾을 수 없습니다.' };
      }

      const rebellerData = rebeller.data || {};

      // 같은 국가 소속인지 확인
      if (rebellerData.nation !== nationId) {
        return { result: false, success: false, message: '국가에 소속되어 있지 않습니다.' };
      }

      // 이미 군주인 경우
      if (rebellerData.officer_level === OfficerLevel.RULER) {
        return { result: false, success: false, message: '이미 군주입니다.' };
      }

      // 현재 군주 확인
      const currentRuler = await generalRepository.findOneByFilter({
        session_id: sessionId,
        'data.nation': nationId,
        'data.officer_level': OfficerLevel.RULER
      });

      if (!currentRuler) {
        return { result: false, success: false, message: '현재 군주를 찾을 수 없습니다.' };
      }

      const rulerData = currentRuler.data || {};

      // 모반 조건 확인
      // 1. 군주가 장기간 미접속 상태
      const session = await sessionRepository.findBySessionId(sessionId);
      const killturn = session?.data?.killturn || 12;
      
      const rulerKillturn = rulerData.killturn || 0;
      if (rulerKillturn >= killturn) {
        return { result: false, success: false, message: '군주가 활동중입니다.' };
      }

      // 2. NPC 군주는 모반 대상에서 제외
      const rulerNpc = rulerData.npc || 0;
      if ([2, 3, 6, 9].includes(rulerNpc)) {
        return { result: false, success: false, message: '군주가 NPC입니다.' };
      }

      // 모반 성공 - 군주 교체
      // 기존 군주 강등
      await generalRepository.updateBySessionAndNo(sessionId, currentRuler.no, {
        'data.officer_level': OfficerLevel.NORMAL,
        'data.officer_city': 0,
        officer_level: OfficerLevel.NORMAL
      });

      // 모반자 군주 등극
      await generalRepository.updateBySessionAndNo(sessionId, rebellerId, {
        'data.officer_level': OfficerLevel.RULER,
        'data.officer_city': 0,
        officer_level: OfficerLevel.RULER
      });

      // 국가 leader 업데이트
      await nationRepository.updateByNationNum(sessionId, nationId, {
        'data.leader': rebellerId,
        leader: rebellerId
      });

      return {
        result: true,
        success: true,
        message: '모반에 성공하여 새 군주가 되었습니다.'
      };
    } catch (error: any) {
      console.error('[ImpeachmentService] attemptRebellion error:', error);
      return { result: false, success: false, message: error.message };
    }
  }

  /**
   * 기존 탄핵 투표 확인 (진행중 또는 쿨다운)
   */
  private static async checkExistingImpeachment(
    sessionId: string,
    nationId: number
  ): Promise<{ exists: boolean; message?: string }> {
    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session?.data) {
      return { exists: false };
    }

    const now = new Date();
    const cooldownMs = IMPEACHMENT_CONDITIONS.COOLDOWN_HOURS * 60 * 60 * 1000;

    // 세션 내 투표 검색
    for (const [key, value] of Object.entries(session.data)) {
      if (!key.startsWith('vote_')) continue;
      
      const vote = value as any;
      if (vote.type !== VoteType.IMPEACHMENT) continue;
      if (vote.nationId !== nationId) continue;

      // 진행중인 탄핵 투표
      if (vote.status === VoteStatus.IN_PROGRESS) {
        return { exists: true, message: '이미 진행중인 탄핵 투표가 있습니다.' };
      }

      // 최근 종료된 탄핵 투표 (쿨다운)
      if (vote.endDate) {
        const endTime = new Date(vote.endDate).getTime();
        if (now.getTime() - endTime < cooldownMs) {
          const remainingHours = Math.ceil((cooldownMs - (now.getTime() - endTime)) / (60 * 60 * 1000));
          return { exists: true, message: `탄핵 쿨다운 중입니다. (${remainingHours}시간 후 재발의 가능)` };
        }
      }
    }

    // 별도 impeachment 기록 확인
    const impeachmentKey = `impeachment_${nationId}`;
    const lastImpeachment = session.data[impeachmentKey];
    
    if (lastImpeachment?.initiatedAt) {
      const lastTime = new Date(lastImpeachment.initiatedAt).getTime();
      if (now.getTime() - lastTime < cooldownMs) {
        const remainingHours = Math.ceil((cooldownMs - (now.getTime() - lastTime)) / (60 * 60 * 1000));
        return { exists: true, message: `탄핵 쿨다운 중입니다. (${remainingHours}시간 후 재발의 가능)` };
      }
    }

    return { exists: false };
  }

  /**
   * 탄핵 기록 저장
   */
  private static async recordImpeachment(
    sessionId: string,
    nationId: number,
    record: {
      voteId: number;
      targetGeneralId: number;
      requesterId: number;
      reason: string;
      initiatedAt: string;
    }
  ): Promise<void> {
    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session) return;

    if (!session.data) {
      session.data = {};
    }

    const impeachmentKey = `impeachment_${nationId}`;
    session.data[impeachmentKey] = record;
    session.markModified('data');
    await session.save();
  }

  /**
   * 군주 후보자 목록 조회 (탄핵 통과 시 다음 군주 후보)
   */
  private static async getCandidateList(
    sessionId: string,
    nationId: number,
    excludeGeneralId: number
  ): Promise<CandidateInfo[]> {
    const generals = await generalRepository.findByFilter({
      session_id: sessionId,
      'data.nation': nationId,
      no: { $ne: excludeGeneralId },
      'data.officer_level': { $gte: 1 }
    });

    const candidates: CandidateInfo[] = generals.map(g => ({
      generalId: g.no,
      name: g.data?.name || g.name || '무명',
      officerLevel: g.data?.officer_level || 1,
      strength: g.data?.strength || 0,
      intel: g.data?.intel || 0,
      leadership: g.data?.leadership || 0
    }));

    // 관직 레벨 순으로 정렬
    candidates.sort((a, b) => b.officerLevel - a.officerLevel);

    return candidates;
  }

  /**
   * 탄핵 상태 조회
   */
  static async getImpeachmentStatus(
    sessionId: string,
    nationId: number
  ): Promise<{
    result: boolean;
    hasActiveImpeachment: boolean;
    voteId?: number;
    targetName?: string;
    progress?: {
      agree: number;
      disagree: number;
      total: number;
      threshold: number;
      quorum: number;
    };
    message?: string;
  }> {
    try {
      const session = await sessionRepository.findBySessionId(sessionId);
      if (!session?.data) {
        return { result: true, hasActiveImpeachment: false };
      }

      // 진행중인 탄핵 투표 찾기
      for (const [key, value] of Object.entries(session.data)) {
        if (!key.startsWith('vote_')) continue;
        
        const vote = value as any;
        if (vote.type !== VoteType.IMPEACHMENT) continue;
        if (vote.nationId !== nationId) continue;
        if (vote.status !== VoteStatus.IN_PROGRESS) continue;

        // 투표 결과 계산
        const voteId = parseInt(key.replace('vote_', ''), 10);
        const voteResult = await VoteSystemService.calculateVoteResult({ sessionId, voteId });

        const agreeResult = voteResult.results.find(r => r.optionIndex === 0);
        const disagreeResult = voteResult.results.find(r => r.optionIndex === 1);

        // 대상 군주 이름
        const targetGeneralId = vote.metadata?.targetGeneralId;
        let targetName = '무명';
        if (targetGeneralId) {
          const target = await generalRepository.findOneByFilter({
            session_id: sessionId,
            no: targetGeneralId
          });
          targetName = target?.data?.name || target?.name || '무명';
        }

        return {
          result: true,
          hasActiveImpeachment: true,
          voteId,
          targetName,
          progress: {
            agree: agreeResult?.voteCount || 0,
            disagree: disagreeResult?.voteCount || 0,
            total: voteResult.totalVoters,
            threshold: vote.metadata?.passThreshold || IMPEACHMENT_CONDITIONS.PASS_THRESHOLD,
            quorum: vote.metadata?.quorum || 0
          }
        };
      }

      return { result: true, hasActiveImpeachment: false };
    } catch (error: any) {
      console.error('[ImpeachmentService] getImpeachmentStatus error:', error);
      return { result: false, hasActiveImpeachment: false, message: error.message };
    }
  }

  /**
   * 탄핵 투표 취소 (군주 또는 발의자만 가능)
   */
  static async cancelImpeachment(
    sessionId: string,
    voteId: number,
    requesterId: number
  ): Promise<{ result: boolean; message?: string }> {
    try {
      // 투표 정보 조회
      const voteInfo = await VoteSystemService.getVoteInfo(sessionId, voteId);
      if (!voteInfo) {
        return { result: false, message: '투표를 찾을 수 없습니다.' };
      }

      if (voteInfo.type !== VoteType.IMPEACHMENT) {
        return { result: false, message: '탄핵 투표가 아닙니다.' };
      }

      // 요청자 확인
      const requester = await generalRepository.findOneByFilter({
        session_id: sessionId,
        no: requesterId
      });

      if (!requester) {
        return { result: false, message: '장수를 찾을 수 없습니다.' };
      }

      const requesterData = requester.data || {};

      // 발의자 또는 군주만 취소 가능
      const isOpener = voteInfo.opener === requesterData.name;
      const isRuler = requesterData.officer_level === OfficerLevel.RULER && 
                      requesterData.nation === voteInfo.nationId;

      if (!isOpener && !isRuler) {
        return { result: false, message: '발의자 또는 군주만 탄핵 투표를 취소할 수 있습니다.' };
      }

      // 투표 취소
      return VoteSystemService.cancelVote(sessionId, voteId);
    } catch (error: any) {
      console.error('[ImpeachmentService] cancelImpeachment error:', error);
      return { result: false, message: error.message };
    }
  }
}

