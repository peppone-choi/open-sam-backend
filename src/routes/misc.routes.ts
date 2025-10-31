import { Router } from 'express';
import { authenticate } from '../middleware/auth';

import { UploadImageService } from '../services/misc/UploadImage.service';

const router = Router();


// UploadImage
router.post('/upload-image', authenticate, async (req, res) => {
  try {
    const result = await UploadImageService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


export default router;
