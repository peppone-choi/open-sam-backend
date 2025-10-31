import { Router } from 'express';
import { authenticate } from '../middleware/auth';

import { ExecuteEngineService } from '../services/global/ExecuteEngine.service';
import { GeneralListService } from '../services/global/GeneralList.service';
import { GeneralListWithTokenService } from '../services/global/GeneralListWithToken.service';
import { GetCachedMapService } from '../services/global/GetCachedMap.service';
import { GetConstService } from '../services/global/GetConst.service';
import { GetCurrentHistoryService } from '../services/global/GetCurrentHistory.service';
import { GetDiplomacyService } from '../services/global/GetDiplomacy.service';
import { GetGlobalMenuService } from '../services/global/GetGlobalMenu.service';
import { GetHistoryService } from '../services/global/GetHistory.service';
import { GetMapService } from '../services/global/GetMap.service';
import { GetNationListService } from '../services/global/GetNationList.service';
import { GetRecentRecordService } from '../services/global/GetRecentRecord.service';

const router = Router();


// ExecuteEngine
router.post('/execute-engine', async (req, res) => {
  try {
    const result = await ExecuteEngineService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GeneralList
router.post('/general-list', async (req, res) => {
  try {
    const result = await GeneralListService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GeneralListWithToken
router.post('/general-list-with-token', async (req, res) => {
  try {
    const result = await GeneralListWithTokenService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GetCachedMap
router.get('/get-cached-map', async (req, res) => {
  try {
    const result = await GetCachedMapService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GetConst
router.get('/get-const', async (req, res) => {
  try {
    const result = await GetConstService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GetCurrentHistory
router.get('/get-current-history', authenticate, async (req, res) => {
  try {
    const result = await GetCurrentHistoryService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GetDiplomacy
router.get('/get-diplomacy', authenticate, async (req, res) => {
  try {
    const result = await GetDiplomacyService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GetGlobalMenu
router.get('/get-global-menu', async (req, res) => {
  try {
    const result = await GetGlobalMenuService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GetHistory
router.get('/get-history', async (req, res) => {
  try {
    const result = await GetHistoryService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GetMap
router.get('/get-map', async (req, res) => {
  try {
    const result = await GetMapService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GetNationList
router.get('/get-nation-list', async (req, res) => {
  try {
    const result = await GetNationListService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// GetRecentRecord
router.get('/get-recent-record', authenticate, async (req, res) => {
  try {
    const result = await GetRecentRecordService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


export default router;
