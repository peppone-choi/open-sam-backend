import { Session } from '../../models/session.model';
import { General } from '../../models/general.model';

interface VoteInfo {
  id: number;
  title: string;
  multipleOptions: number;
  opener: string | null;
  startDate: string;
  endDate: string | null;
  options: string[];
}

export class NewVoteService {
  static async closeOldVote(sessionId: string, voteID: number): Promise<void> {
    const session = await Session.findOne({ session_id: sessionId });
    if (!session || !session.data) {
      return;
    }

    const voteKey = `vote_${voteID}`;
    const lastVoteInfo = session.data[voteKey] as VoteInfo;
    
    if (!lastVoteInfo || lastVoteInfo.endDate) {
      return;
    }

    lastVoteInfo.endDate = new Date().toISOString();
    session.data[voteKey] = lastVoteInfo;
    session.markModified('data');
    await session.save();
  }

  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    
    try {
      const title = data.title;
      if (!title || title.length < 1) {
        throw new Error('제목을 입력해주세요.');
      }

      let multipleOptions = parseInt(data.multipleOptions, 10) || 1;
      if (multipleOptions < 0) {
        multipleOptions = 0;
      }

      const endDate = data.endDate || null;
      const options: string[] = data.options || [];
      const keepOldVote = data.keepOldVote || false;

      if (!options || options.length === 0) {
        throw new Error('항목이 없습니다.');
      }

      if (endDate !== null) {
        try {
          const now = new Date();
          const oEndDate = new Date(endDate);
          if (oEndDate < now) {
            throw new Error('종료일이 이미 지났습니다.');
          }
        } catch (e: any) {
          throw new Error('종료일이 잘못되었습니다. ' + e.message);
        }
      }

      const session = await Session.findOne({ session_id: sessionId });
      if (!session) {
        throw new Error('세션을 찾을 수 없습니다.');
      }

      const isVoteAdmin = user?.userGrade >= 5;
      if (!isVoteAdmin) {
        throw new Error('권한이 부족합니다.');
      }

      const userName = user?.userName || '[SYSTEM]';

      if (!session.data) {
        session.data = {};
      }

      const lastVote = session.data.lastVote || 0;
      const voteID = lastVote + 1;

      if (!keepOldVote) {
        await this.closeOldVote(sessionId, lastVote);
      }

      multipleOptions = Math.max(0, Math.min(multipleOptions, options.length));

      const voteInfo: VoteInfo = {
        id: voteID,
        title,
        opener: userName,
        multipleOptions,
        startDate: new Date().toISOString(),
        endDate,
        options
      };

      session.data[`vote_${voteID}`] = voteInfo;
      session.data.lastVote = voteID;
      session.markModified('data');
      await session.save();

      await General.updateMany(
        { session_id: sessionId },
        { $set: { 'data.newvote': 1 } }
      );

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
