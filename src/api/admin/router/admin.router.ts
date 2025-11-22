import { Router } from 'express';
import { GameConfigController } from '../controller/game-config.controller';
import { GameConfigService } from '../service/game-config.service';
import { requireAdmin, requirePermission, requireSuperAdmin } from '../middleware/auth.middleware';
import { AdminPermission } from '../@types/admin.types';
import { asyncHandler } from '../../../common/utils/async-handler';

const router: import('express').Router = Router();

// 게임 설정 컨트롤러
const gameConfigService = new GameConfigService();
const gameConfigController = new GameConfigController(gameConfigService);

// 모든 admin 라우트에 인증 필요
router.use(requireAdmin);

// ==================== 게임 설정 ====================

// 설정 조회
router.get(
  '/config',
  requirePermission(AdminPermission.MANAGE_CONFIG),
  asyncHandler((req, res) => gameConfigController.getConfig(req, res))
);

// 병종 상성 업데이트
router.put(
  '/config/unit-advantage',
  requirePermission(AdminPermission.MANAGE_CONFIG),
  asyncHandler((req, res) => gameConfigController.updateUnitAdvantage(req, res))
);

// 병종 정보 업데이트
router.put(
  '/config/units',
  requirePermission(AdminPermission.MANAGE_CONFIG),
  asyncHandler((req, res) => gameConfigController.updateUnits(req, res))
);

// 게임 밸런스 업데이트
router.put(
  '/config/balance',
  requirePermission(AdminPermission.MANAGE_CONFIG),
  asyncHandler((req, res) => gameConfigController.updateBalance(req, res))
);

// 턴 설정 업데이트
router.put(
  '/config/turn',
  requirePermission(AdminPermission.MANAGE_CONFIG),
  asyncHandler((req, res) => gameConfigController.updateTurnConfig(req, res))
);

// 경험치 설정 업데이트
router.put(
  '/config/exp',
  requirePermission(AdminPermission.MANAGE_CONFIG),
  asyncHandler((req, res) => gameConfigController.updateExpConfig(req, res))
);

// ==================== 도메인 CRUD ====================

// General 관리
router.get(
  '/generals',
  requirePermission(AdminPermission.MANAGE_GENERALS),
  asyncHandler(async (req, res) => {
    // FUTURE: General 목록 조회
    res.json({ message: '장수 목록 조회 기능이 준비 중입니다.' });

  })
);

router.get(
  '/generals/:id',
  requirePermission(AdminPermission.MANAGE_GENERALS),
  asyncHandler(async (req, res) => {
    // FUTURE: General 상세 조회
    res.json({ message: `장수 ${req.params.id} 상세 조회 기능이 준비 중입니다.` });

  })
);

router.put(
  '/generals/:id',
  requirePermission(AdminPermission.MANAGE_GENERALS),
  asyncHandler(async (req, res) => {
    // FUTURE: General 수정
    res.json({ message: `장수 ${req.params.id} 수정 기능이 준비 중입니다.` });

  })
);

router.delete(
  '/generals/:id',
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    // FUTURE: General 삭제
    res.json({ message: `장수 ${req.params.id} 삭제 기능이 준비 중입니다.` });

  })
);

// City 관리
router.get(
  '/cities',
  requirePermission(AdminPermission.MANAGE_CITIES),
  asyncHandler(async (req, res) => {
    res.json({ message: '도시 목록 조회 기능이 준비 중입니다.' });
  })
);


router.put(
  '/cities/:id',
  requirePermission(AdminPermission.MANAGE_CITIES),
  asyncHandler(async (req, res) => {
    res.json({ message: `도시 ${req.params.id} 수정 기능이 준비 중입니다.` });
  })
);


// Nation 관리
router.get(
  '/nations',
  requirePermission(AdminPermission.MANAGE_NATIONS),
  asyncHandler(async (req, res) => {
    res.json({ message: '국가 목록 조회 기능이 준비 중입니다.' });
  })
);


router.put(
  '/nations/:id',
  requirePermission(AdminPermission.MANAGE_NATIONS),
  asyncHandler(async (req, res) => {
    res.json({ message: `국가 ${req.params.id} 수정 기능이 준비 중입니다.` });
  })
);


// ==================== 시스템 ====================

// 시스템 상태
router.get(
  '/system/status',
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json({
      status: 'running',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: '1.0.0',
    });
  })
);

// 데이터베이스 통계
router.get(
  '/system/stats',
  requireAdmin,
  asyncHandler(async (req, res) => {
    // FUTURE: 데이터베이스 통계
    res.json({
      generals: 0,
      cities: 0,
      nations: 0,
      users: 0,
    });
  })
);

export default router;
