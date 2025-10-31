import { Router } from 'express';
import { authenticate } from '../middleware/auth';

import { BuyHiddenBuffService } from '../services/inheritaction/BuyHiddenBuff.service';
import { BuyRandomUniqueService } from '../services/inheritaction/BuyRandomUnique.service';
import { CheckOwnerService } from '../services/inheritaction/CheckOwner.service';
import { GetMoreLogService } from '../services/inheritaction/GetMoreLog.service';
import { ResetSpecialWarService } from '../services/inheritaction/ResetSpecialWar.service';
import { ResetStatService } from '../services/inheritaction/ResetStat.service';
import { ResetTurnTimeService } from '../services/inheritaction/ResetTurnTime.service';
import { SetNextSpecialWarService } from '../services/inheritaction/SetNextSpecialWar.service';

const router = Router();


// BuyHiddenBuff
router.post('/buy-hidden-buff', authenticate, async (req, res) => {
  try {
    const result = await BuyHiddenBuffService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// BuyRandomUnique
router.post('/buy-random-unique', authenticate, async (req, res) => {
  try {
    const result = await BuyRandomUniqueService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// CheckOwner
router.post('/check-owner', authenticate, async (req, res) => {
  try {
    const result = await CheckOwnerService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GetMoreLog
router.get('/get-more-log', authenticate, async (req, res) => {
  try {
    const result = await GetMoreLogService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// ResetSpecialWar
router.post('/reset-special-war', authenticate, async (req, res) => {
  try {
    const result = await ResetSpecialWarService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// ResetStat
router.post('/reset-stat', authenticate, async (req, res) => {
  try {
    const result = await ResetStatService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// ResetTurnTime
router.post('/reset-turn-time', authenticate, async (req, res) => {
  try {
    const result = await ResetTurnTimeService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// SetNextSpecialWar
router.post('/set-next-special-war', authenticate, async (req, res) => {
  try {
    const result = await SetNextSpecialWarService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


export default router;
