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
    const cities = await City.find({})
      .populate('nation', 'name color')
      .lean();

    res.json({
      result: true,
      cities,
    });
  } catch (error) {
    console.error('Error in city-list:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

export default router;
