import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { Board, Comment, General } from '../models';
import { checkPermission } from '../utils/permission-helper';

const BoardModel = Board as any;
const CommentModel = Comment as any;
const GeneralModel = General as any;

const router = Router();

/**
 * 게시물 목록 조회
 */
router.post('/get-articles', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const general: any = await GeneralModel.findOne({ owner: String(userId) })
      .select('no data.nation data.officer_level')
      .lean();

    if (!general) {
      return res.status(404).json({ result: false, reason: '장수를 찾을 수 없습니다.' });
    }

    const isSecret = req.body.isSecret || false;
    
    // 권한 체크 (PHP func.php:390-434)
    const perm = checkPermission(general);
    if (isSecret && !perm.canAccessSecret) {
      return res.status(403).json({ result: false, reason: perm.message || '권한이 부족합니다. 수뇌부가 아닙니다.' });
    }
    if (!perm.canAccessBoard) {
      return res.status(403).json({ result: false, reason: perm.message });
    }

    const nationId = general.data?.nation || general.nation || 0;

    const sessionId = req.body.session_id || req.query.session_id || 'sangokushi_default';

    const articles: any[] = await BoardModel.find({
      session_id: sessionId,
      'data.nation': nationId,
      'data.isSecret': isSecret,
    })
      .sort({ 'data.date': -1 })
      .lean();

    const articleArray = articles.map((article: any, index: number) => {
      const articleData = article.data || {};
      return {
        no: articleData.no || article._id || index,
        nation_no: nationId,
        is_secret: isSecret,
        date: articleData.date || article.createdAt || new Date(),
        general_no: articleData.generalNo || articleData.general_no,
        author: articleData.author || '무명',
        author_icon: articleData.authorIcon || articleData.author_icon || '',
        title: articleData.title || '',
        text: articleData.text || '',
        comment: [],
      };
    });

    // 댓글 조회
    const comments: any[] = await CommentModel.find({
      session_id: sessionId,
      'data.nation': nationId,
      'data.isSecret': isSecret,
    })
      .sort({ 'data.date': 1 })
      .lean();

    const articleMap: any = {};
    articleArray.forEach((article: any) => {
      articleMap[article.no] = article;
    });

    comments.forEach((comment: any) => {
      const commentData = comment.data || {};
      const docNo = commentData.documentNo || commentData.document_no;
      if (articleMap[docNo]) {
        articleMap[docNo].comment.push({
          no: comment.no || commentData.no,
          nation_no: nationId,
          is_secret: isSecret,
          date: commentData.date || comment.date,
          document_no: docNo,
          general_no: commentData.generalNo || commentData.general_no,
          author: commentData.author || '무명',
          text: commentData.text || '',
        });
      }
    });

    res.json({
      result: true,
      articles: Object.values(articleMap),
      reason: 'success',
    });
  } catch (error: any) {
    console.error('Error in board/get-articles:', error);
    res.status(500).json({ result: false, reason: error.message || 'Internal server error' });
  }
});

/**
 * 게시물 작성
 */
router.post('/post-article', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const general = await GeneralModel.findOne({ owner: String(userId) })
      .select('no picture nation data.nation data.name data.imgsvr data.officer_level data.permission data.penalty')
      .lean();

    if (!general) {
      return res.status(404).json({ result: false, reason: '장수를 찾을 수 없습니다.' });
    }

    const { title, text, isSecret } = req.body;

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

    // 장수 초상 경로 구성 (GeneralBasicCard와 동일한 규칙 활용)
    let authorIcon = '';
    const picture = general.picture || (general.data && general.data.picture) || '';
    const imgsvr = (general.data && general.data.imgsvr) || 0;
    if (picture) {
      if (typeof picture === 'string' && (picture.startsWith('http://') || picture.startsWith('https://') || picture.startsWith('/'))) {
        authorIcon = picture;
      } else if (imgsvr && imgsvr > 0) {
        authorIcon = `/api/general/icon/${imgsvr}/${picture}`;
      } else {
        authorIcon = `/image/general/${picture}.png`;
      }
    } else {
      authorIcon = '/default_portrait.png';
    }

    // 게시물 번호 생성
    const lastArticle = await BoardModel.findOne({ session_id: sessionId })
      .sort({ 'data.no': -1 })
      .select('data.no')
      .lean();
    const articleNo = (lastArticle?.data?.no || 0) + 1;

    const article = await BoardModel.create({
      session_id: sessionId,
      data: {
        no: articleNo,
        nation: nationId,
        isSecret: isSecret || false,
        date: new Date(),
        generalNo: general.no || (general.data && general.data.no),
        author: authorName,
        authorIcon,
        title: title || '',
        text: text || '',
      }
    });

    res.json({ result: true, reason: 'success', article: article });
  } catch (error: any) {
     console.error('Error in board/post-article:', error);
     res.status(500).json({ result: false, reason: error.message || 'Internal server error' });
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


