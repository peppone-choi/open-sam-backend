import { Router } from 'express';
import { BattleController } from '../controller/battle.controller';
import { authMiddleware } from '../../../middleware/auth';

const router = Router();

// 컨트롤러 인스턴스
const controller = new BattleController();

/**
 * 전투 API 라우터
 * 
 * 토탈워 스타일 전투 시스템과 메인 게임을 연결하는 REST API
 */

// ============================================
// 전투 조회
// ============================================

/**
 * GET /api/battle
 * 전투 목록 조회
 * @query sessionId - 세션 ID (필수)
 * @query status - 전투 상태 필터 ('active' | 'completed' | 'all')
 * @query nationId - 국가 ID 필터
 * @query limit - 조회 개수 (기본 20)
 */
router.get('/', authMiddleware, controller.list);

/**
 * GET /api/battle/:battleId
 * 전투 상세 조회
 * @param battleId - 전투 ID
 */
router.get('/:battleId', authMiddleware, controller.getById);

/**
 * GET /api/battle/:battleId/state
 * 전투 실시간 상태 조회 (유닛 위치, HP 등)
 * @param battleId - 전투 ID
 */
router.get('/:battleId/state', authMiddleware, controller.getState);

/**
 * GET /api/battle/:battleId/replay
 * 전투 리플레이 데이터 조회
 * @param battleId - 전투 ID
 */
router.get('/:battleId/replay', authMiddleware, controller.getReplay);

/**
 * GET /api/battle/history/:sessionId
 * 세션의 전투 기록 조회
 * @param sessionId - 세션 ID
 * @query nationId - 국가 ID 필터
 * @query generalId - 장수 ID 필터
 * @query page - 페이지 번호 (기본 1)
 * @query limit - 페이지당 개수 (기본 20)
 */
router.get('/history/:sessionId', authMiddleware, controller.getHistory);

// ============================================
// 전투 생성 및 제어
// ============================================

/**
 * POST /api/battle/start
 * 전투 시작 (새 전투 생성)
 * @body sessionId - 세션 ID
 * @body attackerNationId - 공격 국가 ID
 * @body defenderNationId - 방어 국가 ID
 * @body attackerGeneralIds - 공격 장수 ID 목록
 * @body targetCityId - 대상 도시 ID
 * @body battleType - 전투 유형 ('field' | 'siege' | 'ambush')
 * @body multiStackMode - 멀티 스택 모드 여부 (기본 true)
 */
router.post('/start', authMiddleware, controller.startBattle);

/**
 * POST /api/battle/:battleId/deploy
 * 유닛 배치 (전투 시작 전)
 * @param battleId - 전투 ID
 * @body generalId - 장수 ID
 * @body unitId - 유닛 ID (멀티스택 모드)
 * @body position - 배치 위치 { x, y }
 * @body formation - 진형
 */
router.post('/:battleId/deploy', authMiddleware, controller.deployUnits);

/**
 * POST /api/battle/:battleId/ready
 * 전투 준비 완료 신호
 * @param battleId - 전투 ID
 * @body generalId - 장수 ID
 */
router.post('/:battleId/ready', authMiddleware, controller.markReady);

/**
 * POST /api/battle/:battleId/command
 * 전투 명령 전송 (이동, 공격 등)
 * @param battleId - 전투 ID
 * @body generalId - 장수 ID
 * @body unitId - 유닛 ID
 * @body command - 명령 타입 ('move' | 'attack' | 'hold' | 'retreat' | 'formation' | 'ability')
 * @body params - 명령 파라미터
 */
router.post('/:battleId/command', authMiddleware, controller.sendCommand);

// ============================================
// 전투 결과
// ============================================

/**
 * POST /api/battle/:battleId/result
 * 전투 결과 저장 (클라이언트에서 전투 종료 시)
 * @param battleId - 전투 ID
 * @body winner - 승자 ('attacker' | 'defender' | 'draw')
 * @body duration - 전투 시간 (ms)
 * @body attackerResult - 공격측 결과
 * @body defenderResult - 방어측 결과
 * @body rewards - 보상 정보
 * @body replayData - 리플레이 데이터 (압축)
 */
router.post('/:battleId/result', authMiddleware, controller.submitResult);

/**
 * POST /api/battle/:battleId/surrender
 * 항복 처리
 * @param battleId - 전투 ID
 * @body generalId - 항복하는 장수 ID
 */
router.post('/:battleId/surrender', authMiddleware, controller.surrender);

/**
 * POST /api/battle/:battleId/cancel
 * 전투 취소 (관리자 또는 양측 합의)
 * @param battleId - 전투 ID
 */
router.post('/:battleId/cancel', authMiddleware, controller.cancelBattle);

// ============================================
// 관리자 전용
// ============================================

/**
 * DELETE /api/battle/:battleId
 * 전투 삭제 (관리자 전용)
 * @param battleId - 전투 ID
 */
router.delete('/:battleId', authMiddleware, controller.remove);

export default router;
