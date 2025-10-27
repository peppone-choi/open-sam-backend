import { Router } from 'express';
import { makeGeneralService } from '../../../container';
import { asyncHandler } from '../../../common/utils/async-handler';
// import { validate } from '../../../common/middleware/validator.middleware';
// import { cacheMiddleware } from '../../../common/middleware/cache.middleware';

const router = Router();

// TODO: Controller 생성 (DI)
// const controller = makeGeneralController();

/**
 * GET /api/generals/:id
 * 장수 상세 조회
 */
// router.get(
//   '/:id',
//   cacheMiddleware({ ttl: 3 }),
//   asyncHandler(controller.getById)
// );

/**
 * GET /api/generals
 * 장수 목록 조회
 */
// router.get(
//   '/',
//   cacheMiddleware({ ttl: 3 }),
//   asyncHandler(controller.getAll)
// );

/**
 * POST /api/generals/:id/train
 * 장수 훈련 명령 발행
 */
// router.post(
//   '/:id/train',
//   validate(TrainGeneralSchema),
//   asyncHandler(controller.train)
// );

// TODO: 임시 라우트 (구현 전)
router.get('/', (_req, res) => {
  res.json({ message: 'General routes - TODO' });
});

export default router;
