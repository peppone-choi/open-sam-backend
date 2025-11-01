import { Router } from 'express';
import { authenticate } from '../middleware/auth';

import { UploadImageService } from '../services/misc/UploadImage.service';

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
router.post('/upload-image', authenticate, async (req, res) => {
  try {
    const result = await UploadImageService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
