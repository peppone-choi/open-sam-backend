/**
 * LOGH Commander API Routes
 * 은하영웅전설 커맨더 API
 */

import { Router } from 'express';
import { LoghCommander } from '../../models/logh/Commander.model';
import { Fleet } from '../../models/logh/Fleet.model';
import { authenticate, validateSession } from '../../middleware/auth';

const router = Router();

/**
 * GET /api/logh/my-commander
 * 내 커맨더 정보 조회
 */
router.get('/my-commander', authenticate, validateSession, async (req, res) => {
  try {
    const sessionId = req.sessionInstance?.session_id;
    const userId = req.user?.userId;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    // FUTURE: userId로 commander 매핑 필요 (현재는 첫 번째 커맨더 반환)
    const commander = await LoghCommander.findOne({ session_id: sessionId, isActive: true });

    if (!commander) {
      return res.status(404).json({ error: 'Commander not found' });
    }

    res.json(commander);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/logh/commander/:no
 * 특정 커맨더 정보 조회
 */
router.get('/commander/:no', authenticate, validateSession, async (req, res) => {
  try {
    const sessionId = req.sessionInstance?.session_id;
    const commanderNo = parseInt(req.params.no);

    const commander = await LoghCommander.findOne({
      session_id: sessionId,
      no: commanderNo
    });

    if (!commander) {
      return res.status(404).json({ error: 'Commander not found' });
    }

    res.json(commander);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/logh/commanders
 * 모든 커맨더 목록 조회
 */
router.get('/commanders', authenticate, validateSession, async (req, res) => {
  try {
    const sessionId = req.sessionInstance?.session_id;
    const { faction } = req.query;

    const filter: any = { session_id: sessionId, isActive: true };
    if (faction) {
      filter.faction = faction;
    }

    const commanders = await LoghCommander.find(filter).sort({ no: 1 });

    res.json({ commanders });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/logh/commander/update
 * 커맨더 정보 업데이트
 */
router.post('/commander/update', authenticate, validateSession, async (req, res) => {
  try {
    const sessionId = req.sessionInstance?.session_id;
    const userId = req.user?.userId;
    const { commanderNo, updates } = req.body;

    const commander = await LoghCommander.findOne({
      session_id: sessionId,
      no: commanderNo,
    });

    if (!commander) {
      return res.status(404).json({ error: 'Commander not found' });
    }

    // 업데이트 적용
    Object.assign(commander, updates);
    await commander.save();

    res.json({ success: true, commander });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
