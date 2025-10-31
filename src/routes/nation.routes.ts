import { Router } from 'express';
import { authenticate } from '../middleware/auth';

import { GeneralListService } from '../services/nation/GeneralList.service';
import { GetGeneralLogService } from '../services/nation/GetGeneralLog.service';
import { GetNationInfoService } from '../services/nation/GetNationInfo.service';
import { SetBillService } from '../services/nation/SetBill.service';
import { SetBlockScoutService } from '../services/nation/SetBlockScout.service';
import { SetBlockWarService } from '../services/nation/SetBlockWar.service';
import { SetNoticeService } from '../services/nation/SetNotice.service';
import { SetRateService } from '../services/nation/SetRate.service';
import { SetScoutMsgService } from '../services/nation/SetScoutMsg.service';
import { SetSecretLimitService } from '../services/nation/SetSecretLimit.service';
import { SetTroopNameService } from '../services/nation/SetTroopName.service';

const router = Router();


// GeneralList
router.post('/general-list', authenticate, async (req, res) => {
  try {
    const result = await GeneralListService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GetGeneralLog
router.get('/get-general-log', authenticate, async (req, res) => {
  try {
    const result = await GetGeneralLogService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GetNationInfo
router.get('/get-nation-info', authenticate, async (req, res) => {
  try {
    const result = await GetNationInfoService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// SetBill
router.post('/set-bill', authenticate, async (req, res) => {
  try {
    const result = await SetBillService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// SetBlockScout
router.post('/set-block-scout', authenticate, async (req, res) => {
  try {
    const result = await SetBlockScoutService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// SetBlockWar
router.post('/set-block-war', authenticate, async (req, res) => {
  try {
    const result = await SetBlockWarService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// SetNotice
router.post('/set-notice', authenticate, async (req, res) => {
  try {
    const result = await SetNoticeService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// SetRate
router.post('/set-rate', authenticate, async (req, res) => {
  try {
    const result = await SetRateService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// SetScoutMsg
router.post('/set-scout-msg', authenticate, async (req, res) => {
  try {
    const result = await SetScoutMsgService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// SetSecretLimit
router.post('/set-secret-limit', authenticate, async (req, res) => {
  try {
    const result = await SetSecretLimitService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// SetTroopName
router.post('/set-troop-name', authenticate, async (req, res) => {
  try {
    const result = await SetTroopNameService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


export default router;
