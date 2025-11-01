import { Request, Response } from 'express';
import { UploadImageService } from '../services/misc/UploadImage.service';

/**
 * MiscController
 * misc 그룹의 모든 API 처리
 */
export class MiscController {

  /**
   * UploadImage
   */
  static async uploadImage(req: Request, res: Response) {
    try {
      const result = await UploadImageService.execute(req.body, req.user);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}
