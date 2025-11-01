import { Router } from 'express';
import { StartBattleService } from '../services/battle/StartBattle.service';
import { GetBattleStateService } from '../services/battle/GetBattleState.service';
import { DeployUnitsService } from '../services/battle/DeployUnits.service';
import { SubmitActionService } from '../services/battle/SubmitAction.service';
import { ReadyUpService } from '../services/battle/ReadyUp.service';
import { GetBattleHistoryService } from '../services/battle/GetBattleHistory.service';

const router = Router();

/**
 * @swagger
 * /api/battle/start:
 *   post:
 *     summary: 전투 시작
 *     tags: [Battle]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: 성공
 */
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

/**
 * @swagger
 * /api/battle/{battleId}:
 *   get:
 *     summary: 전투 상태 조회
 *     tags: [Battle]
 *     parameters:
 *       - in: path
 *         name: battleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 성공
 */
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

/**
 * @swagger
 * /api/battle/{battleId}/deploy:
 *   post:
 *     summary: 유닛 배치
 *     tags: [Battle]
 *     parameters:
 *       - in: path
 *         name: battleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 성공
 */
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

/**
 * @swagger
 * /api/battle/{battleId}/action:
 *   post:
 *     summary: 전투 액션 제출
 *     tags: [Battle]
 *     parameters:
 *       - in: path
 *         name: battleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 성공
 */
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

/**
 * @swagger
 * /api/battle/{battleId}/ready:
 *   post:
 *     summary: 준비 완료
 *     tags: [Battle]
 *     parameters:
 *       - in: path
 *         name: battleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 성공
 */
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

/**
 * @swagger
 * /api/battle/{battleId}/history:
 *   get:
 *     summary: 전투 히스토리 조회
 *     tags: [Battle]
 *     parameters:
 *       - in: path
 *         name: battleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 성공
 */
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
