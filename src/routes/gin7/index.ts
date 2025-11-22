import { Router } from 'express';
import authorityRoutes from './authority.routes';
import operationsRoutes from './operations.routes';
import stateRoutes from './state.routes';

const router = Router();

router.use('/', stateRoutes);
router.use('/authority', authorityRoutes);
router.use('/operations', operationsRoutes);

export default router;
