import { Router } from 'express';
import { authenticate } from '../middleware/auth';

import { DecideMessageResponseService } from '../services/message/DecideMessageResponse.service';
import { DeleteMessageService } from '../services/message/DeleteMessage.service';
import { GetContactListService } from '../services/message/GetContactList.service';
import { GetMessagePreviewService } from '../services/message/GetMessagePreview.service';
import { GetMessagesService } from '../services/message/GetMessages.service';
import { GetOldMessageService } from '../services/message/GetOldMessage.service';
import { GetRecentMessageService } from '../services/message/GetRecentMessage.service';
import { ReadLatestMessageService } from '../services/message/ReadLatestMessage.service';
import { SendMessageService } from '../services/message/SendMessage.service';
import { SetRecentMessageTypeService } from '../services/message/SetRecentMessageType.service';

const router = Router();

/**
 * @swagger
 * /api/message/decide-message-response:
 *   post:
 *     summary: 메시지 응답 결정
 *     description: 외교 제안, 동맹 요청 등 응답이 필요한 메시지에 답변합니다.
 *     tags: [Message]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message_id:
 *                 type: number
 *               response:
 *                 type: string
 *                 enum: [accept, reject]
 *     responses:
 *       200:
 *         description: 응답 성공
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
 *     description: 받은 메시지를 삭제합니다.
 *     tags: [Message]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message_id:
 *                 type: number
 *     responses:
 *       200:
 *         description: 삭제 성공
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
 *     summary: 연락처 목록
 *     description: 메시지를 주고받은 장수 목록을 조회합니다.
 *     tags: [Message]
 *     responses:
 *       200:
 *         description: 목록 조회 성공
 */
router.get('/get-contact-list', authenticate, async (req, res) => {
  try {
    const result = await GetContactListService.execute(req.query, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/message/get-message-preview:
 *   get:
 *     summary: 메시지 미리보기
 *     description: 메시지 목록의 미리보기를 조회합니다.
 *     tags: [Message]
 *     responses:
 *       200:
 *         description: 미리보기 조회 성공
 */
router.get('/get-message-preview', authenticate, async (req, res) => {
  try {
    const result = await GetMessagePreviewService.execute(req.query, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/message/get-messages:
 *   get:
 *     summary: 메시지 목록 조회
 *     description: 받은 메시지 목록을 조회합니다.
 *     tags: [Message]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [received, sent]
 *     responses:
 *       200:
 *         description: 목록 조회 성공
 */
router.get('/get-messages', authenticate, async (req, res) => {
  try {
    const result = await GetMessagesService.execute(req.query, req.user);
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
 *     description: 더 오래된 메시지를 조회합니다 (페이징).
 *     tags: [Message]
 *     parameters:
 *       - in: query
 *         name: before_id
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: 조회 성공
 */
router.get('/get-old-message', authenticate, async (req, res) => {
  try {
    const result = await GetOldMessageService.execute(req.query, req.user);
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
 *     description: 최근 받은 메시지를 조회합니다.
 *     tags: [Message]
 *     responses:
 *       200:
 *         description: 조회 성공
 */
router.get('/get-recent-message', authenticate, async (req, res) => {
  try {
    const result = await GetRecentMessageService.execute(req.query, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 별칭 (프론트엔드 호환)
router.post('/get-recent', authenticate, async (req, res) => {
  try {
    // POST 요청도 GET과 동일하게 처리 (query 또는 body에서 파라미터 추출)
    const params = { ...req.query, ...req.body };
    const result = await GetRecentMessageService.execute(params, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/message/read-latest-message:
 *   get:
 *     summary: 최신 메시지 읽음 처리
 *     description: 안 읽은 메시지를 읽음으로 표시합니다.
 *     tags: [Message]
 *     responses:
 *       200:
 *         description: 읽음 처리 성공
 */
router.get('/read-latest-message', authenticate, async (req, res) => {
  try {
    const result = await ReadLatestMessageService.execute(req.query, req.user);
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
 *     description: 다른 장수에게 메시지를 전송합니다.
 *     tags: [Message]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               to_general_id:
 *                 type: number
 *               message:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [normal, diplomatic, secret]
 *     responses:
 *       200:
 *         description: 전송 성공
 */
router.post('/send-message', authenticate, async (req, res) => {
  try {
    const result = await SendMessageService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/message/set-recent-message-type:
 *   post:
 *     summary: 메시지 타입 설정
 *     description: 메시지 목록의 필터 타입을 설정합니다.
 *     tags: [Message]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *     responses:
 *       200:
 *         description: 설정 성공
 */
router.post('/set-recent-message-type', authenticate, async (req, res) => {
  try {
    const result = await SetRecentMessageTypeService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
