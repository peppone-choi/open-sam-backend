import { sessionRepository } from '../../repositories/session.repository';
import { Vote } from '../../models/vote.model';
import { VoteComment } from '../../models/vote_comment.model';
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

export class GetVoteDetailService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const voteID = parseInt(data.voteID, 10);
    
    try {
      if (isNaN(voteID)) {
        throw new Error('유효하지 않은 투표 ID입니다.');
      }

      const session = await sessionRepository.findBySessionId(sessionId );
      if (!session) {
        throw new Error('세션을 찾을 수 없습니다.');
      }

      const voteKey = `vote_${voteID}`;
      const rawVote = session.data?.[voteKey];
      
      if (!rawVote) {
        throw new Error('설문조사가 없습니다.');
      }

      const voteInfo: VoteInfo = rawVote as VoteInfo;

      const voteRecords = await voteRepository.findByFilter({ 
        session_id: sessionId,
        'data.vote_id': voteID 
      });

      const voteCounts: Map<string, number> = new Map();
      for (const record of voteRecords) {
        const selection = record.data?.selection;
        if (selection) {
          const selectionKey = JSON.stringify(selection);
          voteCounts.set(selectionKey, (voteCounts.get(selectionKey) || 0) + 1);
        }
      }

      const votes = Array.from(voteCounts.entries()).map(([sel, cnt]) => [
        JSON.parse(sel),
        cnt
      ]);

      const comments = await VoteComment.find({ 
        session_id: sessionId,
        'data.vote_id': voteID 
      }).sort({ 'data.id': 1 });

      const formattedComments = comments.map(c => c.data);

      let myVote = null;
      if (user?.generalId) {
        const myVoteRecord = await voteRepository.findOneByFilter({
          session_id: sessionId,
          'data.vote_id': voteID,
          'data.general_id': user.generalId
        });
        
        if (myVoteRecord) {
          myVote = myVoteRecord.data?.selection;
        }
      }

      const userCnt = await generalRepository.count({
        session_id: sessionId,
        'data.npc': { $lt: 2 }
      });

      return {
        result: true,
        voteInfo,
        votes,
        comments: formattedComments,
        myVote,
        userCnt
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}
