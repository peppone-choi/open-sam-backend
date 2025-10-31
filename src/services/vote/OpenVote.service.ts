import { Session } from '../../models/session.model';

interface VoteInfo {
  id: number;
  title: string;
  multipleOptions: number;
  opener: string | null;
  startDate: string;
  endDate: string | null;
  options: string[];
}

export class OpenVoteService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const voteID = parseInt(data.voteID, 10);
    
    try {
      if (isNaN(voteID)) {
        throw new Error('유효하지 않은 투표 ID입니다.');
      }

      const isVoteAdmin = user?.userGrade >= 5;
      if (!isVoteAdmin) {
        throw new Error('권한이 부족합니다.');
      }

      const session = await Session.findOne({ session_id: sessionId });
      if (!session) {
        throw new Error('세션을 찾을 수 없습니다.');
      }

      if (!session.data) {
        throw new Error('세션 데이터가 없습니다.');
      }

      const voteKey = `vote_${voteID}`;
      const rawVote = session.data[voteKey];
      
      if (!rawVote) {
        throw new Error('설문조사가 없습니다.');
      }

      const voteInfo: VoteInfo = rawVote as VoteInfo;

      if (!voteInfo.endDate) {
        throw new Error('이미 진행 중인 설문조사입니다.');
      }

      voteInfo.endDate = null;
      session.data[voteKey] = voteInfo;
      session.markModified('data');
      await session.save();

      return {
        result: true
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}
