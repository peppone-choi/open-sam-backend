/**
 * LOGH Fleet API Routes
 * 은하영웅전설 함대 API
 */

import { Router } from 'express';
import { Fleet } from '../../models/logh/Fleet.model';
import { authenticate, validateSession } from '../../middleware/auth';

const router = Router();

/**
 * GET /api/logh/fleet/:id
 * 함대 정보 조회
 */
router.get('/fleet/:id', authenticate, validateSession, async (req, res) => {
  try {
    const sessionId = req.sessionInstance?.session_id;
    const fleetId = req.params.id;

    const fleet = await Fleet.findOne({
      session_id: sessionId,
      fleetId,
    });

    if (!fleet) {
      return res.status(404).json({ error: 'Fleet not found' });
    }

    res.json(fleet);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/logh/fleets
 * 모든 함대 목록 조회
 */
router.get('/fleets', authenticate, validateSession, async (req, res) => {
  try {
    const sessionId = req.sessionInstance?.session_id;
    const { faction, commanderId } = req.query;

    const filter: any = { session_id: sessionId };
    if (faction) {
      filter.faction = faction;
    }
    if (commanderId) {
      filter.commanderId = commanderId;
    }

    const fleets = await Fleet.find(filter).sort({ fleetId: 1 });

    res.json({ fleets });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/logh/fleet/update
 * 함대 정보 업데이트
 */
router.post('/fleet/update', authenticate, validateSession, async (req, res) => {
  try {
    const sessionId = req.sessionInstance?.session_id;
    const { fleetId, updates } = req.body;

    const fleet = await Fleet.findOne({
      session_id: sessionId,
      fleetId,
    });

    if (!fleet) {
      return res.status(404).json({ error: 'Fleet not found' });
    }

    // 업데이트 적용
    Object.assign(fleet, updates);
    await fleet.save();

    res.json({ success: true, fleet });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
