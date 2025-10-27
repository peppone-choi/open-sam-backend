import { Router } from 'express';
import { asyncHandler } from '../../../common/utils/async-handler';

const router = Router();

/**
 * GET /nation
 * 목록 조회
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    // TODO: Implement list
    res.json({ 
      message: 'List nation',
      data: [],
      total: 0 
    });
  })
);

/**
 * GET /nation/:id
 * 상세 조회
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    // TODO: Implement get by id
    res.json({ 
      message: 'Get nation by id',
      id: req.params.id 
    });
  })
);

/**
 * POST /nation
 * 생성
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    // TODO: Implement create
    res.status(201).json({ 
      message: 'Nation created',
      data: req.body 
    });
  })
);

/**
 * PUT /nation/:id
 * 수정
 */
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    // TODO: Implement update
    res.json({ 
      message: 'Nation updated',
      id: req.params.id,
      data: req.body 
    });
  })
);

/**
 * DELETE /nation/:id
 * 삭제
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    // TODO: Implement delete
    res.json({ 
      message: 'Nation deleted',
      id: req.params.id 
    });
  })
);

export default router;
