import { Router, Request, Response } from 'express';
import { Board, Comment, General } from '../../models';

const router = Router();

router.post('/legacy/board/articles', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const general: any = await General.findOne({ owner: userId })
      .select('no nation officerLevel permission')
      .lean();

    if (!general) {
      return res.status(404).json({ result: false, reason: '장수를 찾을 수 없습니다.' });
    }

    if (!general.nation) {
      return res.status(403).json({ result: false, reason: '국가에 소속되어있지 않습니다.' });
    }

    const isSecret = req.body.isSecret || false;
    const permission = general.officerLevel >= 5 ? 2 : general.officerLevel >= 1 ? 1 : 0;

    if (isSecret && permission < 2) {
      return res.status(403).json({ result: false, reason: '권한이 부족합니다. 수뇌부가 아닙니다.' });
    }

    const articles: any[] = await Board.find({
      nationNo: general.nation,
      isSecret,
    })
      .sort({ date: -1 })
      .lean();

    const articleMap: any = {};
    for (const article of articles) {
      articleMap[article.no] = {
        no: article.no,
        nation_no: article.nationNo,
        is_secret: article.isSecret,
        date: article.date,
        general_no: article.generalNo,
        author: article.author,
        author_icon: article.authorIcon || '',
        title: article.title || '',
        text: article.text || '',
        comment: [],
      };
    }

    const comments: any[] = await Comment.find({
      nationNo: general.nation,
      isSecret,
    })
      .sort({ date: 1 })
      .lean();

    for (const comment of comments) {
      const docNo = comment.documentNo;
      if (articleMap[docNo]) {
        articleMap[docNo].comment.push({
          no: comment.no,
          nation_no: comment.nationNo,
          is_secret: comment.isSecret,
          date: comment.date,
          document_no: comment.documentNo,
          general_no: comment.generalNo,
          author: comment.author,
          text: comment.text || '',
        });
      }
    }

    res.json({
      result: true,
      articles: articleMap,
      reason: 'success',
    });
  } catch (error) {
    console.error('Error in board/articles:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

router.post('/legacy/board/article', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const general = await General.findOne({ owner: userId })
      .select('no nation name officerLevel')
      .lean();

    if (!general || !general.nation) {
      return res.status(403).json({ result: false, reason: '국가에 소속되어있지 않습니다.' });
    }

    const { title, text, isSecret } = req.body;

    const article = new Board({
      nationNo: general.nation,
      isSecret: isSecret || false,
      date: new Date(),
      generalNo: general.no,
      author: general.name,
      title: title || '',
      text: text || '',
    });

    await article.save();

    res.json({ result: true, reason: 'success' });
  } catch (error) {
    console.error('Error in board/article:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

router.post('/legacy/board/comment', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const general = await General.findOne({ owner: userId })
      .select('no nation name')
      .lean();

    if (!general || !general.nation) {
      return res.status(403).json({ result: false, reason: '국가에 소속되어있지 않습니다.' });
    }

    const { documentNo, text, isSecret } = req.body;

    const comment = new Comment({
      nationNo: general.nation,
      isSecret: isSecret || false,
      date: new Date(),
      documentNo,
      generalNo: general.no,
      author: general.name,
      text: text || '',
    });

    await comment.save();

    res.json({ result: true, reason: 'success' });
  } catch (error) {
    console.error('Error in board/comment:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

export default router;
