import { sessionRepository } from '../../repositories/session.repository';
import { Vote } from '../../models/vote.model';
import { generalRepository } from '../../repositories/general.repository';
import { voteRepository } from '../../repositories/vote.repository';

interface VoteInfo {
  id: number;
  title: string;
  multipleOptions: number;
  opener: string | null;
  startDate: string;
  endDate: string | null;
  options: string[];
}

export class VoteService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    
    try {
      const voteID = parseInt(data.voteID, 10);
      let selection: number[] = data.selection;

      if (isNaN(voteID)) {
        throw new Error('유효하지 않은 투표 ID입니다.');
      }

      if (!selection || selection.length === 0) {
        throw new Error('선택한 항목이 없습니다.');
      }

      if (!user?.generalId) {
        throw new Error('게임에 로그인해주세요.');
      }

      const session = await sessionRepository.findBySessionId(sessionId );
      if (!session) {
        throw new Error('세션을 찾을 수 없습니다.');
      }

      const voteKey = `vote_${voteID}`;
      const rawVoteInfo = session.data?.[voteKey];
      
      if (!rawVoteInfo) {
        throw new Error('설문조사가 없습니다.');
      }

      const voteInfo: VoteInfo = rawVoteInfo as VoteInfo;

      if (voteInfo.endDate && new Date(voteInfo.endDate) < new Date()) {
        throw new Error('설문조사가 종료되었습니다.');
      }

      if (voteInfo.multipleOptions >= 1 && selection.length > voteInfo.multipleOptions) {
        throw new Error('선택한 항목이 너무 많습니다.');
      }

      const optionsCnt = voteInfo.options.length;
      for (const sel of selection) {
        if (sel >= optionsCnt) {
          throw new Error('선택한 항목이 없습니다.');
        }
      }

      selection.sort((a, b) => a - b);

      const general = await generalRepository.findOneByFilter({
        session_id: sessionId,
        no: user.generalId
      });

      if (!general) {
        throw new Error('장수를 찾을 수 없습니다.');
      }

      const nationID = general.data?.nation || 0;

      const existingVote = await voteRepository.findOneByFilter({
        session_id: sessionId,
        'data.vote_id': voteID,
        'data.general_id': user.generalId
      });

      if (existingVote) {
        throw new Error('이미 설문조사를 완료하였습니다.');
      }

      const voteRecord = new Vote({
        session_id: sessionId,
        data: {
          vote_id: voteID,
          general_id: user.generalId,
          nation_id: nationID,
          selection
        }
      });
      
      await voteRecord.save();

      const develCost = session.data?.develcost || 100;
      const voteReward = develCost * 5;

      const currentGold = general.data?.gold || general.gold || 0;
      const newGold = currentGold + voteReward;
      
      await generalRepository.updateBySessionAndNo(sessionId, generalNo, {
        gold: newGold
      });
      
      let wonLottery = false;

      return {
        result: true,
        wonLottery
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}
