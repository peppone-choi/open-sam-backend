import { sessionRepository } from '../../repositories/session.repository';

interface VoteInfo {
  id: number;
  title: string;
  multipleOptions: number;
  opener: string | null;
  startDate: string;
  endDate: string | null;
  options: string[];
}

export class GetVoteListService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    
    try {
      const session = await sessionRepository.findBySessionId(sessionId );
      if (!session) {
        throw new Error('세션을 찾을 수 없습니다.');
      }

      const votes: Record<number, VoteInfo> = {};
      
      if (session.data && typeof session.data === 'object') {
        for (const [key, value] of Object.entries(session.data)) {
          if (key.startsWith('vote_')) {
            const voteId = parseInt(key.substring(5), 10);
            if (!isNaN(voteId) && value && typeof value === 'object') {
              votes[voteId] = value as VoteInfo;
            }
          }
        }
      }

      return {
        result: true,
        votes
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}
