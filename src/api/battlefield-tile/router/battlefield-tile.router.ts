import { Router } from 'express';

const router = Router();

// TODO: Controller 연결
// GET /:sessionId/cities/:cityId/tiles
// POST /:sessionId/cities/:cityId/tiles/regenerate

router.get('/', (_req, res) => res.json({ message: 'BattleFieldTile - TODO' }));

export default router;
