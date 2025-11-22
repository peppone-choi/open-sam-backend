// @ts-nocheck - Type issues need investigation
import { Router, Request, Response } from 'express';
import { cityRepository } from '../../repositories/city.repository';
import { nationRepository } from '../../repositories/nation.repository';

const router = Router();

function toPlain<T>(doc: T | null | undefined): any | null {
  if (!doc) return null;
  return typeof (doc as any).toObject === 'function' ? (doc as any).toObject() : doc;
}

router.post('/map', async (req: Request, res: Response) => {
  try {
    const sessionId = (req.body.session_id as string) || 'sangokushi_default';

    const cities = (await cityRepository.findBySession(sessionId)) || [];
    const nations = (await nationRepository.findBySession(sessionId)) || [];

    const mapData = {
      cities: cities.map(city => ({
        city: city.city,
        name: city.name,
        level: city.level,
        nation: city.nation,
        pop: city.pop,
        agri: city.agri,
        comm: city.comm,
        secu: city.secu,
        def: city.def,
        wall: city.wall,
      })),
      nations: nations.map(nation => ({
        nation: nation.nation,
        name: nation.name,
        color: nation.color,
        capital: nation.capital,
      })),
    };

    res.json({
      result: true,
      map: mapData,
    });
  } catch (error) {
    console.error('Error in map:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

router.get('/map', async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.session_id as string) || 'sangokushi_default';
    const cities = (await cityRepository.findBySession(sessionId)) || [];
    const nations = (await nationRepository.findBySession(sessionId)) || [];

    res.json({
      result: true,
      cities,
      nations,
    });
  } catch (error) {
    console.error('Error in map:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

router.get('/city-list', async (req: Request, res: Response) => {
  try {
    const sessionId = (req.query.session_id as string) || 'sangokushi_default';
    
    const nationsRaw = (await nationRepository.findBySession(sessionId)) || [];
    const citiesRaw = (await cityRepository.findBySession(sessionId)) || [];

    const nationMap: Record<number, any> = {};
    nationsRaw.forEach((nation: any) => {
      const data = typeof nation.toObject === 'function' ? nation.toObject() : nation;
      const nationId = data.data?.nation || data.nation;
      if (nationId) {
        nationMap[nationId] = {
          nation: nationId,
          name: data.data?.name || data.name || '이름 없음',
          color: data.data?.color || data.color || 0,
          capital: data.data?.capital || data.capital || 0,
          level: data.data?.level || data.level || 0,
          type: data.data?.type || data.type || 'None'
        };
      }
    });

    const cityArgsList = ['city', 'nation', 'name', 'level'];
    const cityList = citiesRaw.map((city: any) => {
      const cityData = city.data || city;
      return [
        cityData.id || cityData.city || 0,
        cityData.nation || 0,
        cityData.name || '도시명 없음',
        cityData.level || 1
      ];
    });

    res.json({
      result: true,
      nations: nationMap,
      cityArgsList,
      cities: cityList
    });
  } catch (error) {
    console.error('Error in city-list:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

export default router;
