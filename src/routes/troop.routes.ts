import { Router } from 'express';
import { authenticate } from '../middleware/auth';

import { ExitTroopService } from '../services/troop/ExitTroop.service';
import { JoinTroopService } from '../services/troop/JoinTroop.service';
import { KickFromTroopService } from '../services/troop/KickFromTroop.service';
import { ModifyTroopService } from '../services/troop/ModifyTroop.service';
import { NewTroopService } from '../services/troop/NewTroop.service';
import { SetLeaderCandidateService } from '../services/troop/SetLeaderCandidate.service';
import { SetTroopNameService } from '../services/troop/SetTroopName.service';

const router = Router();

/**
 * @swagger
 * /api/troop/exit-troop:
 *   post:
 *     summary: 부대 탈퇴
 *     description: 현재 소속된 부대에서 탈퇴합니다. 부대장은 탈퇴 불가.
 *     tags: [Troop]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 탈퇴 성공
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
 *     description: 특정 부대에 가입 신청합니다. 부대장 승인 필요.
 *     tags: [Troop]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               troop_id:
 *                 type: number
 *                 description: 가입할 부대 ID
 *     responses:
 *       200:
 *         description: 가입 신청 성공
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
 *     summary: 부대원 추방
 *     description: 부대장이 부대원을 추방합니다.
 *     tags: [Troop]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               general_id:
 *                 type: number
 *                 description: 추방할 장수 ID
 *     responses:
 *       200:
 *         description: 추방 성공
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
 * /api/troop/modify-troop:
 *   post:
 *     summary: 부대 정보 수정
 *     description: 부대 설명, 모집 조건 등을 수정합니다.
 *     tags: [Troop]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *               recruit_condition:
 *                 type: string
 *     responses:
 *       200:
 *         description: 수정 성공
 */
router.post('/modify-troop', authenticate, async (req, res) => {
  try {
    const result = await ModifyTroopService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/troop/new-troop:
 *   post:
 *     summary: 부대 생성
 *     description: 새로운 부대를 생성합니다. 생성자가 부대장이 됩니다.
 *     tags: [Troop]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: 부대명
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: 생성 성공
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
 * /api/troop/set-leader-candidate:
 *   post:
 *     summary: 부대장 후보 지정
 *     description: 부대장 부재 시 다음 부대장이 될 후보를 지정합니다.
 *     tags: [Troop]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               general_id:
 *                 type: number
 *     responses:
 *       200:
 *         description: 지정 성공
 */
router.post('/set-leader-candidate', authenticate, async (req, res) => {
  try {
    const result = await SetLeaderCandidateService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/troop/set-troop-name:
 *   post:
 *     summary: 부대명 변경
 *     description: 부대 이름을 변경합니다. 부대장만 가능.
 *     tags: [Troop]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: 변경 성공
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
