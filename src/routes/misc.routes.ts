import { Router } from 'express';
import { authenticate } from '../middleware/auth';

import { UploadImageService } from '../services/misc/UploadImage.service';
import { RaiseEventService } from '../services/misc/RaiseEvent.service';

const router = Router();

/**
 * @swagger
 * /api/misc/upload-image:
 *   post:
 *     summary: 이미지 업로드
 *     description: |
 *       장수 초상화, 국가 깃발, 아이템 아이콘 등의 이미지를 업로드합니다.
 *       
 *       **지원 형식:**
 *       - JPEG, PNG, GIF
 *       - 최대 5MB
 *       - 최소 해상도: 64x64
 *       - 최대 해상도: 2048x2048
 *       
 *       **사용처:**
 *       - 장수 커스텀 초상화
 *       - 국가 깃발/상징
 *       - 게시판 이미지
 *       - 아이템 아이콘
 *       
 *       **보안:**
 *       - 파일 타입 검증
 *       - 악성 코드 스캔
 *       - 이미지 리사이징
 *       - CDN 업로드
 *       
 *       **반환값:**
 *       - URL: 업로드된 이미지 경로
 *       - 썸네일 생성 (자동)
 *     tags: [Misc]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: 업로드할 이미지 파일
 *               type:
 *                 type: string
 *                 enum: [portrait, flag, item, board]
 *                 description: 이미지 타입
 *     responses:
 *       200:
 *         description: 업로드 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 url:
 *                   type: string
 *                   description: 업로드된 이미지 URL
 *                 thumbnail:
 *                   type: string
 *                   description: 썸네일 URL
 *       400:
 *         description: 잘못된 요청 (파일 크기, 형식 등)
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.post('/upload-image', async (req, res) => {
  try {
    const result = await UploadImageService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/misc/raise-event:
 *   post:
 *     summary: 게임 이벤트 발생 (관리자 전용)
 *     description: |
 *       관리자가 게임 이벤트를 발생시킵니다. grade >= 6인 관리자만 사용 가능합니다.
 *       
 *       **지원 이벤트 타입:**
 *       - 전투 이벤트
 *       - 자원 이벤트
 *       - 특수 이벤트
 *       - 국가 이벤트
 *       
 *       **사용 시나리오:**
 *       - 테스트 목적 이벤트 발생
 *       - 특별 이벤트 진행
 *       - 디버깅 및 개발
 *     tags: [Misc]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event:
 *                 type: string
 *                 description: 이벤트 이름
 *                 example: TestEvent
 *               arg:
 *                 type: string
 *                 description: 이벤트 인자 (JSON 문자열)
 *                 example: '{"param1": "value1", "param2": 123}'
 *               session_id:
 *                 type: string
 *                 description: 게임 세션 ID
 *                 example: sangokushi_default
 *     responses:
 *       200:
 *         description: 이벤트 발생 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: boolean
 *                   example: true
 *                 reason:
 *                   type: string
 *                   example: success
 *                 eventName:
 *                   type: string
 *                 eventArgs:
 *                   type: array
 *       400:
 *         description: 잘못된 요청
 *       401:
 *         description: 인증 실패
 *       403:
 *         description: 권한 부족 (관리자만 가능)
 *       500:
 *         description: 서버 오류
 */
router.post('/raise-event', authenticate, async (req, res) => {
  try {
    const result = await RaiseEventService.execute(req.body, req.user);
    
    if (!result.result) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
