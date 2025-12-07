/**
 * VoteSystemService
 * 투표 생성/진행/결과 처리
 * 
 * Agent I: 정치/투표 시스템
 */

import { sessionRepository } from '../../repositories/session.repository';
import { generalRepository } from '../../repositories/general.repository';
import { voteRepository } from '../../repositories/vote.repository';
import { Vote } from '../../models/vote.model';
import {
  VoteType,
  VoteStatus,
  VoteInfo,
  VoteResult,
  VoteOptionResult,
  VoteMetadata,
  VoteRecord
} from '../../types/vote.types';

export interface CreateVoteParams {
  sessionId: string;
  title: string;
  type?: VoteType;
  options: string[];
  multipleOptions?: number;
  endDate?: string | null;
  nationId?: number;
  opener?: string;
  keepOldVote?: boolean;
  metadata?: VoteMetadata;
}

export interface CastVoteParams {
  sessionId: string;
  voteId: number;
  generalId: number;
  selection: number[];
}

export interface GetVoteResultParams {
  sessionId: string;
  voteId: number;
}

export class VoteSystemService {
  /**
   * 새 투표 생성
   */
  static async createVote(params: CreateVoteParams): Promise<{
    result: boolean;
    voteId?: number;
    message?: string;
  }> {
    const {
      sessionId,
      title,
      type = VoteType.SURVEY,
      options,
      multipleOptions = 1,
      endDate = null,
      nationId,
      opener,
      keepOldVote = false,
      metadata
    } = params;

    try {
      // 유효성 검사
      if (!title || title.length < 1) {
        return { result: false, message: '제목을 입력해주세요.' };
      }

      if (!options || options.length === 0) {
        return { result: false, message: '항목이 없습니다.' };
      }

      if (options.length < 2) {
        return { result: false, message: '최소 2개 이상의 선택지가 필요합니다.' };
      }

      // 종료일 검증
      if (endDate) {
        const now = new Date();
        const oEndDate = new Date(endDate);
        if (oEndDate < now) {
          return { result: false, message: '종료일이 이미 지났습니다.' };
        }
      }

      // 세션 조회
      const session = await sessionRepository.findBySessionId(sessionId);
      if (!session) {
        return { result: false, message: '세션을 찾을 수 없습니다.' };
      }

      // 이전 투표 종료
      const lastVote = session.lastVote || 0;
      if (!keepOldVote && lastVote > 0) {
        await this.closeVote(sessionId, lastVote);
      }

      // 새 투표 ID 생성
      const voteId = lastVote + 1;

      // 다중 선택 제한
      const finalMultipleOptions = Math.max(0, Math.min(multipleOptions, options.length));

      // 투표 정보 생성
      const voteInfo: VoteInfo = {
        id: voteId,
        title,
        type,
        status: VoteStatus.IN_PROGRESS,
        multipleOptions: finalMultipleOptions,
        opener: opener || '[SYSTEM]',
        startDate: new Date().toISOString(),
        endDate,
        options,
        nationId,
        metadata
      };

      // 세션에 투표 정보 저장
      if (!session.data) {
        session.data = {};
      }
      session.data[`vote_${voteId}`] = voteInfo;
      session.lastVote = voteId;
      session.markModified('data');
      await session.save();

      // 장수들에게 새 투표 알림
      await generalRepository.updateManyByFilter(
        { session_id: sessionId },
        { $set: { 'data.newvote': 1 } }
      );

      return { result: true, voteId };
    } catch (error: any) {
      console.error('[VoteSystemService] createVote error:', error);
      return { result: false, message: error.message };
    }
  }

  /**
   * 투표 종료
   */
  static async closeVote(sessionId: string, voteId: number): Promise<{
    result: boolean;
    message?: string;
  }> {
    try {
      const session = await sessionRepository.findBySessionId(sessionId);
      if (!session?.data) {
        return { result: false, message: '세션을 찾을 수 없습니다.' };
      }

      const voteKey = `vote_${voteId}`;
      const voteInfo = session.data[voteKey] as VoteInfo;

      if (!voteInfo) {
        return { result: false, message: '투표를 찾을 수 없습니다.' };
      }

      if (voteInfo.endDate) {
        return { result: false, message: '이미 종료된 투표입니다.' };
      }

      // 투표 결과 계산
      const voteResult = await this.calculateVoteResult({ sessionId, voteId });

      // 투표 상태 업데이트
      voteInfo.endDate = new Date().toISOString();
      voteInfo.status = this.determineVoteStatus(voteInfo, voteResult);

      session.data[voteKey] = voteInfo;
      session.markModified('data');
      await session.save();

      return { result: true };
    } catch (error: any) {
      console.error('[VoteSystemService] closeVote error:', error);
      return { result: false, message: error.message };
    }
  }

  /**
   * 투표 참여
   */
  static async castVote(params: CastVoteParams): Promise<{
    result: boolean;
    reward?: number;
    message?: string;
  }> {
    const { sessionId, voteId, generalId, selection } = params;

    try {
      // 유효성 검사
      if (!selection || selection.length === 0) {
        return { result: false, message: '선택한 항목이 없습니다.' };
      }

      // 세션 조회
      const session = await sessionRepository.findBySessionId(sessionId);
      if (!session) {
        return { result: false, message: '세션을 찾을 수 없습니다.' };
      }

      // 투표 정보 조회
      const voteKey = `vote_${voteId}`;
      const voteInfo = session.data?.[voteKey] as VoteInfo;

      if (!voteInfo) {
        return { result: false, message: '설문조사가 없습니다.' };
      }

      // 투표 종료 확인
      if (voteInfo.endDate && new Date(voteInfo.endDate) < new Date()) {
        return { result: false, message: '설문조사가 종료되었습니다.' };
      }

      if (voteInfo.status !== VoteStatus.IN_PROGRESS) {
        return { result: false, message: '진행중인 투표가 아닙니다.' };
      }

      // 다중 선택 제한 확인
      if (voteInfo.multipleOptions >= 1 && selection.length > voteInfo.multipleOptions) {
        return { result: false, message: '선택한 항목이 너무 많습니다.' };
      }

      // 선택지 범위 확인
      const optionsCnt = voteInfo.options.length;
      for (const sel of selection) {
        if (sel < 0 || sel >= optionsCnt) {
          return { result: false, message: '유효하지 않은 선택입니다.' };
        }
      }

      // 장수 조회
      const general = await generalRepository.findOneByFilter({
        session_id: sessionId,
        no: generalId
      });

      if (!general) {
        return { result: false, message: '장수를 찾을 수 없습니다.' };
      }

      const nationId = general.data?.nation || 0;

      // 국가별 투표인 경우 국가 확인
      if (voteInfo.nationId && voteInfo.nationId !== nationId) {
        return { result: false, message: '해당 국가 소속만 투표할 수 있습니다.' };
      }

      // 중복 투표 확인
      const existingVote = await voteRepository.findOneByFilter({
        session_id: sessionId,
        'data.vote_id': voteId,
        'data.general_id': generalId
      });

      if (existingVote) {
        return { result: false, message: '이미 설문조사를 완료하였습니다.' };
      }

      // 투표 정렬
      const sortedSelection = [...selection].sort((a, b) => a - b);

      // 투표 기록 저장
      const voteRecord = new Vote({
        session_id: sessionId,
        data: {
          vote_id: voteId,
          general_id: generalId,
          nation_id: nationId,
          selection: sortedSelection,
          voted_at: new Date().toISOString()
        }
      });

      await voteRecord.save();

      // 보상 지급
      const develCost = session.develcost || 100;
      const voteReward = develCost * 5;

      const currentGold = general.gold || general.data?.gold || 0;
      await generalRepository.updateBySessionAndNo(sessionId, generalId, {
        gold: currentGold + voteReward,
        'data.gold': currentGold + voteReward
      });

      return { result: true, reward: voteReward };
    } catch (error: any) {
      console.error('[VoteSystemService] castVote error:', error);
      return { result: false, message: error.message };
    }
  }

  /**
   * 투표 결과 계산
   */
  static async calculateVoteResult(params: GetVoteResultParams): Promise<VoteResult> {
    const { sessionId, voteId } = params;

    // 투표 기록 조회
    const voteRecords = await voteRepository.findByFilter({
      session_id: sessionId,
      'data.vote_id': voteId
    });

    // 세션에서 투표 정보 조회
    const session = await sessionRepository.findBySessionId(sessionId);
    const voteInfo = session?.data?.[`vote_${voteId}`] as VoteInfo;

    // 선택지별 투표 수 계산
    const optionCounts: Map<number, number> = new Map();

    for (const record of voteRecords) {
      const selections = record.data?.selection as number[] || [];
      for (const sel of selections) {
        optionCounts.set(sel, (optionCounts.get(sel) || 0) + 1);
      }
    }

    // 결과 배열 생성
    const results: VoteOptionResult[] = [];
    const totalVotes = voteRecords.length;

    if (voteInfo?.options) {
      for (let i = 0; i < voteInfo.options.length; i++) {
        const voteCount = optionCounts.get(i) || 0;
        results.push({
          optionIndex: i,
          optionText: voteInfo.options[i],
          voteCount,
          percentage: totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0
        });
      }
    }

    // 최다 득표 선택지 찾기
    let winner: number | undefined;
    let maxVotes = 0;
    for (const [optionIndex, count] of optionCounts) {
      if (count > maxVotes) {
        maxVotes = count;
        winner = optionIndex;
      }
    }

    return {
      voteId,
      totalVoters: totalVotes,
      votesCast: totalVotes,
      results,
      status: voteInfo?.status || VoteStatus.IN_PROGRESS,
      winner
    };
  }

  /**
   * 투표 상태 결정
   */
  private static determineVoteStatus(voteInfo: VoteInfo, result: VoteResult): VoteStatus {
    const threshold = voteInfo.metadata?.passThreshold ?? 50;
    const quorum = voteInfo.metadata?.quorum ?? 0;

    // 정족수 미달
    if (quorum > 0 && result.totalVoters < quorum) {
      return VoteStatus.CANCELLED;
    }

    // 탄핵 투표의 경우 특별 처리
    if (voteInfo.type === VoteType.IMPEACHMENT) {
      // 찬성(인덱스 0)이 threshold% 이상이면 통과
      const agreeResult = result.results.find(r => r.optionIndex === 0);
      if (agreeResult && agreeResult.percentage >= threshold) {
        return VoteStatus.PASSED;
      }
      return VoteStatus.REJECTED;
    }

    // 일반 투표는 결과 그대로
    return VoteStatus.PASSED;
  }

  /**
   * 투표 정보 조회
   */
  static async getVoteInfo(sessionId: string, voteId: number): Promise<VoteInfo | null> {
    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session?.data) {
      return null;
    }

    return session.data[`vote_${voteId}`] as VoteInfo || null;
  }

  /**
   * 진행중인 투표 목록 조회
   */
  static async getActiveVotes(sessionId: string, nationId?: number): Promise<VoteInfo[]> {
    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session?.data) {
      return [];
    }

    const votes: VoteInfo[] = [];
    const now = new Date();

    for (const [key, value] of Object.entries(session.data)) {
      if (key.startsWith('vote_') && value) {
        const voteInfo = value as VoteInfo;
        
        // 종료되지 않은 투표
        if (!voteInfo.endDate || new Date(voteInfo.endDate) > now) {
          // 국가 필터
          if (!nationId || !voteInfo.nationId || voteInfo.nationId === nationId) {
            votes.push(voteInfo);
          }
        }
      }
    }

    return votes.sort((a, b) => b.id - a.id);
  }

  /**
   * 장수의 투표 기록 조회
   */
  static async getGeneralVoteRecord(
    sessionId: string,
    voteId: number,
    generalId: number
  ): Promise<VoteRecord | null> {
    const record = await voteRepository.findOneByFilter({
      session_id: sessionId,
      'data.vote_id': voteId,
      'data.general_id': generalId
    });

    if (!record?.data) {
      return null;
    }

    return {
      voteId: record.data.vote_id,
      generalId: record.data.general_id,
      nationId: record.data.nation_id,
      selection: record.data.selection,
      votedAt: record.data.voted_at
    };
  }

  /**
   * 투표 취소
   */
  static async cancelVote(sessionId: string, voteId: number): Promise<{
    result: boolean;
    message?: string;
  }> {
    try {
      const session = await sessionRepository.findBySessionId(sessionId);
      if (!session?.data) {
        return { result: false, message: '세션을 찾을 수 없습니다.' };
      }

      const voteKey = `vote_${voteId}`;
      const voteInfo = session.data[voteKey] as VoteInfo;

      if (!voteInfo) {
        return { result: false, message: '투표를 찾을 수 없습니다.' };
      }

      voteInfo.status = VoteStatus.CANCELLED;
      voteInfo.endDate = new Date().toISOString();

      session.data[voteKey] = voteInfo;
      session.markModified('data');
      await session.save();

      return { result: true };
    } catch (error: any) {
      console.error('[VoteSystemService] cancelVote error:', error);
      return { result: false, message: error.message };
    }
  }

  /**
   * 투표 통과/부결 처리 (훅)
   * 투표 유형에 따라 실제 게임 로직 실행
   */
  static async processVoteResult(sessionId: string, voteId: number): Promise<{
    result: boolean;
    message?: string;
  }> {
    const voteInfo = await this.getVoteInfo(sessionId, voteId);
    if (!voteInfo) {
      return { result: false, message: '투표를 찾을 수 없습니다.' };
    }

    const voteResult = await this.calculateVoteResult({ sessionId, voteId });

    // 투표 유형별 처리
    switch (voteInfo.type) {
      case VoteType.IMPEACHMENT:
        // ImpeachmentService에서 처리
        return { result: true, message: '탄핵 결과 처리는 ImpeachmentService에서 진행됩니다.' };

      case VoteType.LEADER_ELECTION:
        // 선출 투표 처리
        return this.processElectionResult(sessionId, voteInfo, voteResult);

      case VoteType.POLICY:
        // 정책 투표 처리
        return this.processPolicyResult(sessionId, voteInfo, voteResult);

      case VoteType.CAPITAL_MOVE:
        // 천도 투표 처리
        return this.processCapitalMoveResult(sessionId, voteInfo, voteResult);

      default:
        return { result: true, message: '투표 결과가 기록되었습니다.' };
    }
  }

  /**
   * 선출 투표 결과 처리
   */
  private static async processElectionResult(
    sessionId: string,
    voteInfo: VoteInfo,
    result: VoteResult
  ): Promise<{ result: boolean; message?: string }> {
    if (result.winner === undefined) {
      return { result: false, message: '선출된 후보가 없습니다.' };
    }

    const candidates = voteInfo.metadata?.candidates;
    if (!candidates || !candidates[result.winner]) {
      return { result: false, message: '후보 정보를 찾을 수 없습니다.' };
    }

    const winner = candidates[result.winner];
    
    // OfficerSystemService를 통해 관직 임명
    // (순환 참조 방지를 위해 동적 import)
    const { OfficerSystemService } = await import('./OfficerSystem.service');
    
    return OfficerSystemService.appointOfficer({
      sessionId,
      nationId: voteInfo.nationId || 0,
      targetGeneralId: winner.generalId,
      targetOfficerLevel: 12, // 군주
      appointerId: 0 // 시스템 임명
    });
  }

  /**
   * 정책 투표 결과 처리
   */
  private static async processPolicyResult(
    sessionId: string,
    voteInfo: VoteInfo,
    result: VoteResult
  ): Promise<{ result: boolean; message?: string }> {
    const policyChange = voteInfo.metadata?.policyChange;
    if (!policyChange) {
      return { result: false, message: '정책 변경 정보가 없습니다.' };
    }

    const nationId = voteInfo.nationId;
    if (!nationId) {
      return { result: false, message: '국가 정보가 없습니다.' };
    }

    // 투표 결과 확인 (통과 여부)
    const passThreshold = voteInfo.metadata?.passThreshold || 0.5;
    const totalVotes = result.totalVotes || 0;
    const winnerVotes = result.options?.[result.winner || 0]?.votes || 0;
    
    if (totalVotes === 0 || winnerVotes / totalVotes < passThreshold) {
      return { result: false, message: '정책 변경이 부결되었습니다.' };
    }

    try {
      // PolicyService를 통해 정책 변경
      const { PolicyService } = await import('../nation/Policy.service');
      const { nationRepository } = await import('../../repositories/nation.repository');

      const nation = await nationRepository.findBySessionAndNationId(sessionId, nationId);
      const year = nation?.data?.year || 184;
      const month = nation?.data?.month || 1;

      const setResult = await PolicyService.setPolicy(
        sessionId,
        nationId,
        policyChange.newPolicy,
        0, // 투표에 의한 변경이므로 setterId = 0
        year,
        month
      );

      if (!setResult.success) {
        return { result: false, message: setResult.error || '정책 변경에 실패했습니다.' };
      }

      return { result: true, message: `정책이 '${policyChange.newPolicyName || policyChange.newPolicy}'(으)로 변경되었습니다.` };
    } catch (error: any) {
      return { result: false, message: `정책 변경 처리 오류: ${error.message}` };
    }
  }

  /**
   * 천도 투표 결과 처리
   */
  private static async processCapitalMoveResult(
    sessionId: string,
    voteInfo: VoteInfo,
    result: VoteResult
  ): Promise<{ result: boolean; message?: string }> {
    const targetCityId = voteInfo.metadata?.targetCityId;
    if (!targetCityId) {
      return { result: false, message: '천도 대상 도시가 없습니다.' };
    }

    const nationId = voteInfo.nationId;
    if (!nationId) {
      return { result: false, message: '국가 정보가 없습니다.' };
    }

    // 투표 결과 확인 (통과 여부)
    const passThreshold = voteInfo.metadata?.passThreshold || 0.5;
    const totalVotes = result.totalVotes || 0;
    const winnerVotes = result.options?.[result.winner || 0]?.votes || 0;
    
    if (totalVotes === 0 || winnerVotes / totalVotes < passThreshold) {
      return { result: false, message: '천도가 부결되었습니다.' };
    }

    try {
      const { nationRepository } = await import('../../repositories/nation.repository');
      const { cityRepository } = await import('../../repositories/city.repository');
      const { ActionLogger } = await import('../../utils/ActionLogger');

      // 국가 정보 조회
      const nation = await nationRepository.findBySessionAndNationId(sessionId, nationId);
      if (!nation) {
        return { result: false, message: '국가를 찾을 수 없습니다.' };
      }

      const nationName = nation.name || `국가${nationId}`;
      const oldCapitalId = nation.data?.capital || nation.capital;

      // 대상 도시 확인
      const targetCity = await cityRepository.findByCityNum(sessionId, targetCityId);
      if (!targetCity) {
        return { result: false, message: '대상 도시를 찾을 수 없습니다.' };
      }

      const targetCityNation = targetCity.nation || targetCity.data?.nation;
      if (targetCityNation !== nationId) {
        return { result: false, message: '자국 도시만 수도로 지정할 수 있습니다.' };
      }

      const targetCityName = targetCity.name || targetCity.data?.name || `도시${targetCityId}`;

      // 수도 변경
      await nationRepository.updateBySessionAndNationId(sessionId, nationId, {
        capital: targetCityId,
        'data.capital': targetCityId,
      });

      // 로그 기록
      const year = nation.data?.year || 184;
      const month = nation.data?.month || 1;
      const actionLogger = new ActionLogger(0, nationId, year, month, sessionId, false);
      actionLogger.pushGlobalHistoryLog(
        `<S><b>【천도】</b></><D><b>${nationName}</b></>이(가) 투표로 <G><b>${targetCityName}</b></>(으)로 천도하였습니다.`
      );
      await actionLogger.flush();

      return { result: true, message: `수도가 '${targetCityName}'(으)로 이전되었습니다.` };
    } catch (error: any) {
      return { result: false, message: `천도 처리 오류: ${error.message}` };
    }
  }
}


