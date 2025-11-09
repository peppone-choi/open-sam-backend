// @ts-nocheck - Type issues need investigation
import { Router, Request, Response } from 'express';
import { City, Nation, General } from '../../models';

const router = Router();

router.post('/map', async (req: Request, res: Response) => {
  try {
    const { year, month, neutralView, showMe } = req.body;

    const cities = await City.find({}).lean();
    const nations = await Nation.find({}).lean();

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
    const cities = await City.find({}).lean();
    const nations = await Nation.find({}).lean();

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
    
    // 국가 정보 조회
    const nations = await Nation.find({ session_id: sessionId }).lean();
    const nationMap: Record<number, any> = {};
    nations.forEach((nation: any) => {
      const nationId = nation.data?.nation || nation.nation;
      if (nationId) {
        nationMap[nationId] = {
          nation: nationId,
          name: nation.data?.name || nation.name || '이름 없음',
          color: nation.data?.color || nation.color || 0,
          capital: nation.data?.capital || nation.capital || 0,
          level: nation.data?.level || nation.level || 0,
          type: nation.data?.type || nation.type || 'None'
        };
      }
    });

    // 도시 정보 조회 (레거시와 동일한 형식)
    const cities = await City.find({ session_id: sessionId }).lean();
    
    // 레거시 형식: cityArgsList와 cities 배열
    const cityArgsList = ['city', 'nation', 'name', 'level'];
    const cityList = cities.map((city: any) => {
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
