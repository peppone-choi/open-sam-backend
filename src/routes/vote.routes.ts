import { Router } from 'express';
import { authenticate } from '../middleware/auth';

import { AddCommentService } from '../services/vote/AddComment.service';
import { GetVoteDetailService } from '../services/vote/GetVoteDetail.service';
import { GetVoteListService } from '../services/vote/GetVoteList.service';
import { NewVoteService } from '../services/vote/NewVote.service';
import { VoteService } from '../services/vote/Vote.service';

const router = Router();

/**
 * @swagger
 * /api/vote/add-comment:
 *   post:
 *     summary: 투표 댓글 추가
 *     tags: [Vote]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/add-comment', authenticate, async (req, res) => {
  try {
    const result = await AddCommentService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/vote/get-vote-detail:
 *   get:
 *     summary: 투표 상세 조회
 *     tags: [Vote]
 *     responses:
 *       200:
 *         description: 성공
 */
router.get('/get-vote-detail', async (req, res) => {
  try {
    const result = await GetVoteDetailService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/vote/get-vote-list:
 *   get:
 *     summary: 투표 목록 조회
 *     tags: [Vote]
 *     responses:
 *       200:
 *         description: 성공
 */
router.get('/get-vote-list', async (req, res) => {
  try {
    const result = await GetVoteListService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/vote/new-vote:
 *   post:
 *     summary: 새 투표 생성
 *     tags: [Vote]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/new-vote', authenticate, async (req, res) => {
  try {
    const result = await NewVoteService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/vote/vote:
 *   post:
 *     summary: 투표하기
 *     tags: [Vote]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/vote', authenticate, async (req, res) => {
  try {
    const result = await VoteService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


export default router;
