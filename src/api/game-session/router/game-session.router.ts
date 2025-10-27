import { Router } from 'express';
import { asyncHandler } from '../../../common/utils/async-handler';

const router = Router();

/**
 * GET /game-session
 * 목록 조회
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    // TODO: Implement list
    res.json({ 
      message: 'List game-session',
      data: [],
      total: 0 
    });
  })
);

/**
 * GET /game-session/:id
 * 상세 조회
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    // TODO: Implement get by id
    res.json({ 
      message: 'Get game-session by id',
      id: req.params.id 
    });
  })
);

/**
 * POST /game-session
 * 생성
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    // TODO: Implement create
    res.status(201).json({ 
      message: 'GameSession created',
      data: req.body 
    });
  })
);

/**
 * PUT /game-session/:id
 * 수정
 */
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    // TODO: Implement update
    res.json({ 
      message: 'GameSession updated',
      id: req.params.id,
      data: req.body 
    });
  })
);

/**
 * DELETE /game-session/:id
 * 삭제
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    // TODO: Implement delete
    res.json({ 
      message: 'GameSession deleted',
      id: req.params.id 
    });
  })
);

export default router;
