import { Router } from 'express';
import { authenticate } from '../middleware/auth';

import { AddCommentService } from '../services/vote/AddComment.service';
import { GetVoteDetailService } from '../services/vote/GetVoteDetail.service';
import { GetVoteListService } from '../services/vote/GetVoteList.service';
import { NewVoteService } from '../services/vote/NewVote.service';
import { OpenVoteService } from '../services/vote/OpenVote.service';
import { VoteService } from '../services/vote/Vote.service';

const router = Router();

/**
 * @swagger
 * /api/vote/add-comment:
 *   post:
 *     summary: 투표 댓글 작성
 *     description: 투표 안건에 의견을 작성합니다.
 *     tags: [Vote]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               vote_id:
 *                 type: number
 *               comment:
 *                 type: string
 *     responses:
 *       200:
 *         description: 댓글 작성 성공
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
 *     description: 특정 투표의 상세 정보와 현재 투표 현황을 조회합니다.
 *     tags: [Vote]
 *     parameters:
 *       - in: query
 *         name: vote_id
 *         required: true
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: 조회 성공
 */
router.get('/get-vote-detail', authenticate, async (req, res) => {
  try {
    const result = await GetVoteDetailService.execute(req.query, req.user);
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
 *     description: 현재 진행 중인 국가 투표 목록을 조회합니다.
 *     tags: [Vote]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, closed]
 *     responses:
 *       200:
 *         description: 목록 조회 성공
 */
router.get('/get-vote-list', authenticate, async (req, res) => {
  try {
    const result = await GetVoteListService.execute(req.query, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/vote/new-vote:
 *   post:
 *     summary: 투표 생성
 *     description: 새로운 투표 안건을 생성합니다. 국가 중요 사안에 대해 투표를 시작합니다.
 *     tags: [Vote]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: 투표 제목
 *               description:
 *                 type: string
 *               options:
 *                 type: array
 *                 items:
 *                   type: string
 *               duration:
 *                 type: number
 *                 description: 투표 기간 (시간)
 *     responses:
 *       200:
 *         description: 투표 생성 성공
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
 * /api/vote/open-vote:
 *   post:
 *     summary: 투표 공개
 *     description: 생성된 투표를 공개하여 투표를 시작합니다.
 *     tags: [Vote]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               vote_id:
 *                 type: number
 *     responses:
 *       200:
 *         description: 투표 공개 성공
 */
router.post('/open-vote', authenticate, async (req, res) => {
  try {
    const result = await OpenVoteService.execute(req.body, req.user);
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
 *     description: 투표 안건에 대해 자신의 의견을 투표합니다.
 *     tags: [Vote]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               vote_id:
 *                 type: number
 *               choice:
 *                 type: number
 *                 description: 선택지 번호
 *     responses:
 *       200:
 *         description: 투표 성공
 */
router.post('/vote', authenticate, async (req, res) => {
  try {
    const result = await VoteService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/get-list', authenticate, async (req, res) => {
  try {
    const result = await GetVoteListService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
