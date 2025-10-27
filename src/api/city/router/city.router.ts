import { Router, Request, Response } from 'express';
import { CityService } from '../service/city.service';

const router = Router();
const service = new CityService();

router.get('/:id', async (req: Request, res: Response) => {
  try {
    // TODO: 캐시 미들웨어 적용
    const city = await service.getById(req.params.id);
    
    if (!city) {
      return res.status(404).json({ error: 'City not found' });
    }
    
    res.json({ city });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
