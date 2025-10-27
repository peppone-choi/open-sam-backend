import { Router } from 'express';
import { makeCommandService } from '../../../container';
import { asyncHandler } from '../../../common/utils/async-handler';
// import { validate } from '../../../common/middleware/validator.middleware';

const router = Router();

// TODO: Controller 생성 (DI)
// const controller = makeCommandController();

/**
 * POST /api/commands
 * 명령 제출
 */
// router.post(
//   '/',
//   validate(SubmitCommandSchema),
//   asyncHandler(controller.submit)
// );

/**
 * GET /api/commands/:id
 * 명령 조회
 */
// router.get(
//   '/:id',
//   asyncHandler(controller.getById)
// );

/**
 * GET /api/commands?generalId=xxx
 * 장수별 명령 조회
 */
// router.get(
//   '/',
//   asyncHandler(controller.getByGeneralId)
// );

// TODO: 임시 라우트 (구현 전)
router.get('/', (_req, res) => {
  res.json({ message: 'Command routes - TODO' });
});

export default router;
