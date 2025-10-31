import { Router } from 'express';
import { authenticate } from '../middleware/auth';

import { BuildNationCandidateService } from '../services/general/BuildNationCandidate.service';
import { DieOnPrestartService } from '../services/general/DieOnPrestart.service';
import { DropItemService } from '../services/general/DropItem.service';
import { GetCommandTableService } from '../services/general/GetCommandTable.service';
import { GetFrontInfoService } from '../services/general/GetFrontInfo.service';
import { GetGeneralLogService } from '../services/general/GetGeneralLog.service';
import { InstantRetreatService } from '../services/general/InstantRetreat.service';
import { JoinService } from '../services/general/Join.service';

const router = Router();


// BuildNationCandidate
router.post('/build-nation-candidate', authenticate, async (req, res) => {
  try {
    const result = await BuildNationCandidateService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// DieOnPrestart
router.post('/die-on-prestart', authenticate, async (req, res) => {
  try {
    const result = await DieOnPrestartService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// DropItem
router.post('/drop-item', authenticate, async (req, res) => {
  try {
    const result = await DropItemService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GetCommandTable
router.get('/get-command-table', authenticate, async (req, res) => {
  try {
    const result = await GetCommandTableService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GetFrontInfo
router.get('/get-front-info', authenticate, async (req, res) => {
  try {
    const result = await GetFrontInfoService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GetGeneralLog
router.get('/get-general-log', async (req, res) => {
  try {
    const result = await GetGeneralLogService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// InstantRetreat
router.post('/instant-retreat', authenticate, async (req, res) => {
  try {
    const result = await InstantRetreatService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// Join
router.post('/join', async (req, res) => {
  try {
    const result = await JoinService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


export default router;
