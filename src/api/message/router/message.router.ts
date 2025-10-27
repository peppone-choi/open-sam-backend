import { Router } from 'express';

const router = Router();
// TODO: 구현
router.get('/', (_req, res) => res.json({ message: 'Message - TODO' }));
export default router;
