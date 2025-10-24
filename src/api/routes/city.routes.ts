import { Router } from 'express';
import { CityController } from '../controllers/city.controller';
import { container } from 'tsyringe';

const router = Router();
const controller = container.resolve(CityController);

/**
 * GET /api/cities
 * 도시 목록 조회
 */
router.get('/', (req, res, next) => controller.getAll(req, res, next));

/**
 * GET /api/cities/:id
 * 특정 도시 조회
 */
router.get('/:id', (req, res, next) => controller.getById(req, res, next));

/**
 * POST /api/cities/:id/produce
 * 생산 시작 (무기, 식량 등)
 * Hint: Redis Streams에 커맨드 발행
 */
router.post('/:id/produce', (req, res, next) => controller.produce(req, res, next));

/**
 * POST /api/cities/:id/recruit
 * 병력 징병
 */
router.post('/:id/recruit', (req, res, next) => controller.recruit(req, res, next));

// TODO: 추가 엔드포인트 (건설, 세금 등)

export const cityRoutes = router;
