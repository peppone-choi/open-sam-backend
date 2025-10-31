import { Router } from 'express';
import { authenticate } from '../middleware/auth';

import { ExitTroopService } from '../services/troop/ExitTroop.service';
import { JoinTroopService } from '../services/troop/JoinTroop.service';
import { KickFromTroopService } from '../services/troop/KickFromTroop.service';
import { NewTroopService } from '../services/troop/NewTroop.service';
import { SetTroopNameService } from '../services/troop/SetTroopName.service';

const router = Router();


// ExitTroop
router.post('/exit-troop', authenticate, async (req, res) => {
  try {
    const result = await ExitTroopService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// JoinTroop
router.post('/join-troop', authenticate, async (req, res) => {
  try {
    const result = await JoinTroopService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// KickFromTroop
router.post('/kick-from-troop', authenticate, async (req, res) => {
  try {
    const result = await KickFromTroopService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// NewTroop
router.post('/new-troop', authenticate, async (req, res) => {
  try {
    const result = await NewTroopService.execute(req.body, req.user);
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
