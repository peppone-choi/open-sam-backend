import { Router } from 'express';
import { authenticate } from '../middleware/auth';

import { UploadImageService } from '../services/misc/UploadImage.service';

const router = Router();

/**
 * @swagger
 * /api/misc/upload-image:
 *   post:
 *     summary: 이미지 업로드
 *     tags: [Misc]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
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
