// @ts-nocheck - Type issues need investigation
import { Router, Request, Response } from 'express';
import { General } from '../../models';

const router = Router();

router.post('/setting/save', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const general = await General.findOne({ owner: userId });
    if (!general) {
      return res.status(404).json({ result: false, reason: '장수를 찾을 수 없습니다.' });
    }

    const { useTreatment, autoNationTurn, customCSS } = req.body;

    const aux = general.aux || {};
    if (useTreatment !== undefined) aux.use_treatment = useTreatment;
    if (autoNationTurn !== undefined) aux.use_auto_nation_turn = autoNationTurn;
    if (customCSS !== undefined) aux.custom_css = customCSS;

    general.aux = aux;
    await general.save();

    res.json({ result: true, reason: 'success' });
  } catch (error) {
    console.error('Error in setting/save:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

router.get('/setting/get', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ result: false, reason: '로그인이 필요합니다.' });
    }

    const general: any = await General.findOne({ owner: userId })
      .select('aux')
      .lean();

    if (!general) {
      return res.status(404).json({ result: false, reason: '장수를 찾을 수 없습니다.' });
    }

    const settings = {
      useTreatment: general.aux?.use_treatment || 10,
      autoNationTurn: general.aux?.use_auto_nation_turn || 1,
      customCSS: general.aux?.custom_css || '',
    };

    res.json({
      result: true,
      settings,
    });
  } catch (error) {
    console.error('Error in setting/get:', error);
    res.status(500).json({ result: false, reason: 'Internal server error' });
  }
});

export default router;
