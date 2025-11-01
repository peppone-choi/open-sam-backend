import { Router } from 'express';
import { authenticate } from '../middleware/auth';

import { ExitTroopService } from '../services/troop/ExitTroop.service';
import { JoinTroopService } from '../services/troop/JoinTroop.service';
import { KickFromTroopService } from '../services/troop/KickFromTroop.service';
import { NewTroopService } from '../services/troop/NewTroop.service';
import { SetTroopNameService } from '../services/troop/SetTroopName.service';

const router = Router();

/**
 * @swagger
 * /api/troop/exit-troop:
 *   post:
 *     summary: 부대 탈퇴
 *     tags: [Troop]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/exit-troop', authenticate, async (req, res) => {
  try {
    const result = await ExitTroopService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/troop/join-troop:
 *   post:
 *     summary: 부대 가입
 *     tags: [Troop]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/join-troop', authenticate, async (req, res) => {
  try {
    const result = await JoinTroopService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/troop/kick-from-troop:
 *   post:
 *     summary: 부대에서 추방
 *     tags: [Troop]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/kick-from-troop', authenticate, async (req, res) => {
  try {
    const result = await KickFromTroopService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/troop/new-troop:
 *   post:
 *     summary: 새 부대 생성
 *     tags: [Troop]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/new-troop', authenticate, async (req, res) => {
  try {
    const result = await NewTroopService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/troop/set-troop-name:
 *   post:
 *     summary: 부대 이름 변경
 *     tags: [Troop]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 성공
 */
router.post('/set-troop-name', authenticate, async (req, res) => {
  try {
    const result = await SetTroopNameService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


export default router;
