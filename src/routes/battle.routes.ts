import { Router } from 'express';
import { StartBattleService } from '../services/battle/StartBattle.service';
import { GetBattleStateService } from '../services/battle/GetBattleState.service';
import { DeployUnitsService } from '../services/battle/DeployUnits.service';
import { SubmitActionService } from '../services/battle/SubmitAction.service';
import { ReadyUpService } from '../services/battle/ReadyUp.service';
import { GetBattleHistoryService } from '../services/battle/GetBattleHistory.service';

const router = Router();

router.post('/start', async (req, res) => {
  try {
    const result = await StartBattleService.execute(req.body, (req as any).user);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:battleId', async (req, res) => {
  try {
    const result = await GetBattleStateService.execute({
      battleId: req.params.battleId
    }, (req as any).user);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:battleId/deploy', async (req, res) => {
  try {
    const result = await DeployUnitsService.execute({
      battleId: req.params.battleId,
      ...req.body
    }, (req as any).user);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:battleId/action', async (req, res) => {
  try {
    const result = await SubmitActionService.execute({
      battleId: req.params.battleId,
      ...req.body
    }, (req as any).user);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:battleId/ready', async (req, res) => {
  try {
    const result = await ReadyUpService.execute({
      battleId: req.params.battleId,
      ...req.body
    }, (req as any).user);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:battleId/history', async (req, res) => {
  try {
    const result = await GetBattleHistoryService.execute({
      battleId: req.params.battleId
    }, (req as any).user);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
