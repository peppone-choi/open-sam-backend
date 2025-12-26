import { Board } from '../models/board.model';
import { Comment } from '../models/comment.model';
import { IBoard } from '../models/board.model';
import { ApiError } from '../errors/ApiError';

export class BoardService {
  /**
   * 게시물 목록 조회
   */
  static async listArticles(sessionId: string, category: string, nationId?: number, isSecret: boolean = false) {
    const query: any = {
      session_id: sessionId,
      category,
      is_secret: isSecret
    };

    if (category === 'nation') {
      if (!nationId) throw new ApiError(400, '국가 ID가 필요합니다.');
      query.nation_id = nationId;
    }

    const articles = await Board.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return articles.map(a => ({
      id: a._id,
      ...a,
      no: a.data?.no
    }));
  }

  /**
   * 게시물 생성
   */
  static async createArticle(data: Partial<IBoard>) {
    const { session_id, category, nation_id, title, content, author_id, author_name, author_general_id, is_secret } = data;
    
    if (!session_id || !category || !title || !content || !author_id) {
      throw new ApiError(400, '필수 데이터가 누락되었습니다.');
    }

    // 게시물 번호 생성
    const lastArticle = await Board.findOne({ session_id, category })
      .sort({ 'data.no': -1 })
      .select('data.no')
      .lean();
    
    const articleNo = (lastArticle?.data?.no || 0) + 1;

    const article = await Board.create({
      session_id,
      category,
      nation_id,
      title,
      content,
      author_id,
      author_name,
      author_general_id,
      is_secret: is_secret || false,
      data: {
        no: articleNo,
        ...data.data
      }
    });

    return article;
  }

  /**
   * 게시물 상세 조회 (조회수 증가 포함)
   */
  static async getArticle(sessionId: string, articleId: string) {
    const article = await Board.findOneAndUpdate(
      { _id: articleId, session_id: sessionId },
      { $inc: { views: 1 } },
      { new: true }
    ).lean();

    if (!article) {
      throw new ApiError(404, '게시물을 찾을 수 없습니다.');
    }

    // 댓글 조회
    const comments = await Comment.find({
      'data.documentNo': article.data?.no || article._id
    }).sort({ createdAt: 1 }).lean();

    return {
      article,
      comments
    };
  }
}
