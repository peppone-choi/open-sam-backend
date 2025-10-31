import { Router } from 'express';
import { authenticate } from '../middleware/auth';

import { DecideMessageResponseService } from '../services/message/DecideMessageResponse.service';
import { DeleteMessageService } from '../services/message/DeleteMessage.service';
import { GetContactListService } from '../services/message/GetContactList.service';
import { GetOldMessageService } from '../services/message/GetOldMessage.service';
import { GetRecentMessageService } from '../services/message/GetRecentMessage.service';
import { ReadLatestMessageService } from '../services/message/ReadLatestMessage.service';
import { SendMessageService } from '../services/message/SendMessage.service';

const router = Router();

/**
 * @swagger
 * /api/message/decide-message-response:
 *   post:
 *     summary: 메시지 응답 결정
 *     tags: [Message]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/decide-message-response', authenticate, async (req, res) => {
  try {
    const result = await DecideMessageResponseService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/message/delete-message:
 *   post:
 *     summary: 메시지 삭제
 *     tags: [Message]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/delete-message', authenticate, async (req, res) => {
  try {
    const result = await DeleteMessageService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/message/get-contact-list:
 *   get:
 *     summary: 연락처 목록 조회
 *     tags: [Message]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.get('/get-contact-list', authenticate, async (req, res) => {
  try {
    const result = await GetContactListService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/message/get-old-message:
 *   get:
 *     summary: 이전 메시지 조회
 *     tags: [Message]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.get('/get-old-message', authenticate, async (req, res) => {
  try {
    const result = await GetOldMessageService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/message/get-recent-message:
 *   get:
 *     summary: 최근 메시지 조회
 *     tags: [Message]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.get('/get-recent-message', authenticate, async (req, res) => {
  try {
    const result = await GetRecentMessageService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/message/read-latest-message:
 *   post:
 *     summary: 최신 메시지 읽기
 *     tags: [Message]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/read-latest-message', authenticate, async (req, res) => {
  try {
    const result = await ReadLatestMessageService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/message/send-message:
 *   post:
 *     summary: 메시지 전송
 *     tags: [Message]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/send-message', authenticate, async (req, res) => {
  try {
    const result = await SendMessageService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


export default router;
