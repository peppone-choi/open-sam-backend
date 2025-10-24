import { Router, Request, Response } from 'express';
import { GeneralService } from '../service/general.service';
import { RedisService } from '../../infrastructure/cache/redis.service';

const router = Router();
const service = new GeneralService();
const redis = new RedisService();

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // TODO: 캐시 미들웨어 적용
    const general = await service.getById(id);
    
    if (!general) {
      return res.status(404).json({ error: 'General not found' });
    }
    
    res.json({ general });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { limit = 20, skip = 0 } = req.query;
    
    // TODO: 캐시 미들웨어 적용
    const generals = await service.getAll(Number(limit), Number(skip));
    
    res.json({ generals, count: generals.length });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/train', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { statType } = req.body;
    
    // TODO: 권한 체크
    // TODO: PCP 체크
    
    // Redis Streams에 명령 발행
    const commandId = await redis.xadd('cmd:game', {
      type: 'TRAIN_GENERAL',
      generalId: id,
      statType,
      submittedAt: Date.now()
    });
    
    res.status(202).json({
      accepted: true,
      commandId,
      message: '훈련 명령이 제출되었습니다.'
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/move', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { targetCityId } = req.body;
    
    // TODO: 권한 체크
    // TODO: PCP 체크
    // TODO: 거리 계산 및 이동 시간 산출
    
    const commandId = await redis.xadd('cmd:game', {
      type: 'MOVE_GENERAL',
      generalId: id,
      targetCityId,
      submittedAt: Date.now()
    });
    
    res.status(202).json({
      accepted: true,
      commandId,
      message: '이동 명령이 제출되었습니다.'
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
