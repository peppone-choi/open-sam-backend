import { Router } from 'express';
import { authenticate } from '../middleware/auth';

import { GetReservedCommandService } from '../services/nationcommand/GetReservedCommand.service';
import { PushCommandService } from '../services/nationcommand/PushCommand.service';
import { RepeatCommandService } from '../services/nationcommand/RepeatCommand.service';
import { ReserveBulkCommandService } from '../services/nationcommand/ReserveBulkCommand.service';
import { ReserveCommandService } from '../services/nationcommand/ReserveCommand.service';

const router = Router();


// GetReservedCommand
router.get('/get-reserved-command', authenticate, async (req, res) => {
  try {
    const result = await GetReservedCommandService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// PushCommand
router.post('/push-command', authenticate, async (req, res) => {
  try {
    const result = await PushCommandService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// RepeatCommand
router.post('/repeat-command', authenticate, async (req, res) => {
  try {
    const result = await RepeatCommandService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// ReserveBulkCommand
router.post('/reserve-bulk-command', authenticate, async (req, res) => {
  try {
    const result = await ReserveBulkCommandService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// ReserveCommand
router.post('/reserve-command', authenticate, async (req, res) => {
  try {
    const result = await ReserveCommandService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


export default router;
