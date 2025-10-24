import { Router } from 'express';
import { generalRoutes } from './general.routes';
import { cityRoutes } from './city.routes';
import { commandRoutes } from './command.routes';

const router = Router();

// 라우트 등록
router.use('/generals', generalRoutes);
router.use('/cities', cityRoutes);
router.use('/commands', commandRoutes);

// TODO: 추가 라우트 (battles, nations 등)

export const routes = router;
