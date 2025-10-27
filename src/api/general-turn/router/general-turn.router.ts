import { Router } from 'express';

const router = Router();

// TODO: Controller 연결
router.get('/', (_req, res) => {
  res.json({ message: 'GeneralTurn routes - TODO' });
});

export default router;
