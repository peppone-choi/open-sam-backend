/**
 * 전술전투 API 라우터
 */

import { Router, Request, Response, NextFunction } from 'express';
import { TacticalBattleController } from '../controller/tactical.controller';
import { authenticate } from '../../../middleware/auth';

const router = Router();
const controller = new TacticalBattleController();

// ============================================================
// 전투 세션 관리
// ============================================================

// 진행 중인 전투 목록
router.get('/battles', authenticate, controller.getBattles);

// 내 국가의 참여 가능한 전투 목록
router.get('/battles/available', authenticate, controller.getAvailableBattles);

// 전투 세션 상세 조회
router.get('/battle/:battleId', authenticate, controller.getBattle);

// 전투 참여
router.post('/battle/:battleId/join', authenticate, controller.joinBattle);

// AI 위임
router.post('/battle/:battleId/delegate', authenticate, controller.delegateToAI);

// 전투 시작 (관리자/테스트용)
router.post('/battle/:battleId/start', authenticate, controller.startBattle);

// ============================================================
// 전투 행동
// ============================================================

// 유닛 이동
router.post('/battle/:battleId/move', authenticate, controller.moveUnit);

// 유닛 공격
router.post('/battle/:battleId/attack', authenticate, controller.attackUnit);

// 유닛 대기
router.post('/battle/:battleId/wait', authenticate, controller.waitUnit);

// 유닛 퇴각
router.post('/battle/:battleId/retreat', authenticate, controller.retreatUnit);

// 턴 종료
router.post('/battle/:battleId/end-turn', authenticate, controller.endTurn);

// ============================================================
// AI / 시뮬레이션
// ============================================================

// AI 턴 실행
router.post('/battle/:battleId/ai-turn', authenticate, controller.executeAITurn);

// 전투 시뮬레이션 (끝까지 자동 실행)
router.post('/battle/:battleId/simulate', authenticate, controller.simulateBattle);

// ============================================================
// 유틸리티
// ============================================================

// 이동 가능 위치 조회
router.get('/battle/:battleId/movable/:unitId', authenticate, controller.getMovablePositions);

// 공격 가능 대상 조회
router.get('/battle/:battleId/attackable/:unitId', authenticate, controller.getAttackableTargets);

// 전투 로그 조회
router.get('/battle/:battleId/logs', authenticate, controller.getBattleLogs);

export default router;

