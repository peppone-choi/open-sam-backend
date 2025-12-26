import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { Board, Comment, General } from '../models';
import { checkPermission } from '../utils/permission-helper';
import { BoardService } from '../services/board.service';
import { ApiError } from '../errors/ApiError';

const router = Router();

/**
 * 게시물 목록 조회 (카테고리 기반)
 */
router.post('/get-articles', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const { category = 'nation', isSecret = false, session_id } = req.body;
    const sessionId = session_id || req.query.session_id || 'sangokushi_default';

    const general: any = await General.findOne({ session_id: sessionId, owner: String(userId) })
      .select('no data.nation data.officer_level data.permission data.penalty')
      .lean();

    if (!general) {
      return res.status(404).json({ result: false, reason: '장수를 찾을 수 없습니다.' });
    }

    const nationId = general.data?.nation || 0;

    // 권한 체크
    const perm = checkPermission(general);
    if (isSecret && !perm.canAccessSecret) {
      return res.status(403).json({ result: false, reason: '권한이 부족합니다. 기밀실 접근 권한이 없습니다.' });
    }

    const articles = await BoardService.listArticles(sessionId, category, nationId, isSecret);

    res.json({
      result: true,
      articles: articles.map(a => ({
        ...a,
        comment: [] // 호환성을 위해 빈 배열 추가 (필요 시 lazy load)
      })),
      reason: 'success',
    });
  } catch (error: any) {
    console.error('Error in board/get-articles:', error);
    res.status(error.status || 500).json({ result: false, reason: error.message || 'Internal server error' });
  }
});

/**
 * 게시물 작성
 */
router.post('/post-article', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { title, text, isSecret, category = 'nation', session_id } = req.body;
    const sessionId = session_id || req.query.session_id || 'sangokushi_default';

    const general = await General.findOne({ session_id: sessionId, owner: String(userId) })
      .select('no picture nation data.nation data.name data.imgsvr data.officer_level data.permission data.penalty')
      .lean();

    if (!general) {
      return res.status(404).json({ result: false, reason: '장수를 찾을 수 없습니다.' });
    }

    const perm = checkPermission(general);
    if (isSecret && !perm.canAccessSecret) {
      throw new ApiError(403, '기밀실 게시물 작성 권한이 없습니다.');
    }

    const nationId = general.data?.nation || 0;
    const authorName = general.data?.name || general.name || '무명';

    const article = await BoardService.createArticle({
      session_id: sessionId,
      category,
      nation_id: nationId,
      title,
      content: text,
      author_id: String(userId),
      author_name: authorName,
      author_general_id: general.no || general.data?.no,
      is_secret: isSecret,
    });

    res.json({ result: true, reason: 'success', article });
  } catch (error: any) {
    res.status(error.status || 500).json({ result: false, reason: error.message });
  }
});

 /**
  * 댓글 작성 (회의실/기밀실 공용)
  */
 router.post('/comment', authenticate, async (req, res) => {
   try {
     const userId = req.user?.userId || req.user?.id;
     if (!userId) {
       return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
     }

    const general: any = await GeneralModel.findOne({ owner: String(userId) })
      .select('no picture nation data.nation data.name data.officer_level data.permission data.penalty')
      .lean();


     if (!general) {
       return res.status(404).json({ result: false, reason: '장수를 찾을 수 없습니다.' });
     }

      const { documentNo, text, isSecret } = req.body;

      // 권한 체크
      const perm = checkPermission(general);
      if (isSecret && !perm.canAccessSecret) {
        return res.status(403).json({ result: false, reason: perm.message || '권한이 부족합니다. 수뇌부가 아닙니다.' });
      }
      if (!perm.canAccessBoard) {
        return res.status(403).json({ result: false, reason: perm.message });
      }

      const sessionId = req.body.session_id || req.query.session_id || 'sangokushi_default';
      const nationId = (general.data && general.data.nation) != null ? general.data.nation : (general.nation ?? 0);
      const authorName = (general.data && general.data.name) || general.name || '무명';

      const comment = await CommentModel.create({
        session_id: sessionId,
        data: {
          nation: nationId,
          isSecret: isSecret || false,
          date: new Date(),
          documentNo,
          generalNo: general.no || (general.data && general.data.no),
          author: authorName,
          text: text || '',
        },
      });


     res.json({ result: true, reason: 'success', comment });
   } catch (error: any) {
     console.error('Error in board/comment:', error);
     res.status(500).json({ result: false, reason: error.message || 'Internal server error' });
   }
 });
 
 export default router;


