import { Router, Request, Response } from 'express';
import { CityService } from '../service/city.service';
import { CityRepository } from '../repository/city.repository';
import { BattleFieldTileRepository } from '../../battlefield-tile/repository/battlefield-tile.repository';
import { getCacheManager } from '../../../container';

const router = Router();
const cityRepo = new CityRepository();
const tileRepo = new BattleFieldTileRepository();
const cacheManager = getCacheManager();
const service = new CityService(cityRepo, cacheManager, tileRepo);

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
