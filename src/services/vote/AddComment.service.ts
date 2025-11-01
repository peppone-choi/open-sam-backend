import { VoteComment } from '../../models/vote_comment.model';
import { General } from '../../models/general.model';
import { Nation } from '../../models/nation.model';

export class AddCommentService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    
    try {
      const voteID = parseInt(data.voteID, 10);
      let text = data.text;

      if (isNaN(voteID)) {
        throw new Error('유효하지 않은 투표 ID입니다.');
      }

      if (!text || text.length < 1) {
        throw new Error('댓글 내용을 입력해주세요.');
      }

      if (!user?.generalId) {
        throw new Error('게임에 로그인해주세요.');
      }

      text = text.substring(0, 200);

      const general = await General.findOne({
        session_id: sessionId,
        no: user.generalId
      });

      if (!general) {
        throw new Error('장수를 찾을 수 없습니다.');
      }

      const generalName = general.name;
      const nationID = general.data?.nation || 0;

      let nationName = '재야';
      if (nationID > 0) {
        const nation = await Nation.findOne({
          session_id: sessionId,
          no: nationID
        });
        
        if (nation) {
          nationName = nation.name;
        }
      }

      const lastComment = await VoteComment.findOne({
        session_id: sessionId
      }).sort({ 'data.id': -1 });

      const nextId = lastComment?.data?.id ? lastComment.data.id + 1 : 1;

      const comment = new VoteComment({
        session_id: sessionId,
        data: {
          id: nextId,
          vote_id: voteID,
          general_id: user.generalId,
          nation_id: nationID,
          nation_name: nationName,
          general_name: generalName,
          text,
          date: new Date().toISOString()
        }
      });

      await comment.save();

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
