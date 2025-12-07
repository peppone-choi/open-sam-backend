import * as yup from 'yup';
import { validate, battleIdSchema, battleGeneralIdSchema, preventMongoInjection, safeParseInt } from '../middleware/validation.middleware';
import { Router } from 'express';
import { StartBattleService } from '../services/battle/StartBattle.service';
import { GetBattleStateService } from '../services/battle/GetBattleState.service';
import { DeployUnitsService } from '../services/battle/DeployUnits.service';
import { SubmitActionService } from '../services/battle/SubmitAction.service';
import { ReadyUpService } from '../services/battle/ReadyUp.service';
import { GetBattleHistoryService } from '../services/battle/GetBattleHistory.service';
import { ResolveTurnService } from '../services/battle/ResolveTurn.service';
import { StartSimulationService } from '../services/battle/StartSimulation.service';
import { AutoBattleService } from '../services/battle/AutoBattle.service';
import { ReplayService } from '../services/battle/Replay.service';
import type { BattleConfig } from '../battle/types';
import { battleRepository } from '../repositories/battle.repository';
import { cityRepository } from '../repositories/city.repository';
import { nationRepository } from '../repositories/nation.repository';

const router = Router();

function toPlain<T>(doc: T | null | undefined): any | null {
  if (!doc) return null;
  return typeof (doc as any).toObject === 'function' ? (doc as any).toObject() : doc;
}

/**
 * @swagger
 * /api/battle/start:
 *   post:
 *     summary: 전투 시작 (PHP 버전에 없는 신규 기능)
 *     description: |
 *       새로운 턴제 전략 전투를 생성하고 시작합니다. 이는 Node.js 버전에서 완전히 새로 추가된 실시간 전투 시스템입니다.
 *       
 *       **전투 시스템 개요:**
 *       - 턴제 전략 전투 (최대 30턴)
 *       - 헥스 그리드 기반 배치
 *       - 실시간 명령 입력
 *       - Planning → Resolution 페이즈 반복
 *       - 지형 효과 적용
 *       - 특수 스킬 사용
 *       
 *       **전투 생성 프로세스:**
 *       1. 공격 국가와 방어 국가 지정
 *       2. 대상 도시 선택
 *       3. 공격 참가 장수 선택
 *       4. 방어측은 해당 도시의 장수 자동 참전
 *       5. 전투 인스턴스 생성 (DEPLOYING 상태)
 *       
 *       **전투 상태 (BattleStatus):**
 *       - DEPLOYING: 유닛 배치 단계
 *       - IN_PROGRESS: 전투 진행 중
 *       - COMPLETED: 전투 완료
 *       - CANCELLED: 전투 취소
 *       
 *       **전투 페이즈 (BattlePhase):**
 *       - PLANNING: 명령 입력 (제한 시간)
 *       - RESOLUTION: 명령 실행 및 결과 계산
 *       
 *       **유닛 데이터:**
 *       - generalId, generalName: 장수 정보
 *       - troops: 병력 수
 *       - leadership, strength, intelligence: 능력치
 *       - unitType: 보병/궁병/기병
 *       - morale: 사기 (0-100)
 *       - training: 훈련도 (0-100)
 *       - specialSkills: 특수 기술
 *       
 *       **지형 효과:**
 *       - PLAINS: 기본 지형
 *       - FOREST: 궁병 유리, 기병 불리
 *       - MOUNTAIN: 방어 유리, 이동 느림
 *       - RIVER: 모든 유닛 불리
 *       
 *       **사용 시나리오:**
 *       1. **도시 공격**: 국가가 적 도시 공격
 *          - 공격 장수 5명 선발
 *          - 방어측 자동 응전
 *       
 *       2. **영토 확장**: 무주공산 도시 점령
 *          - 빠른 전투 (방어 약함)
 *       
 *       3. **결전**: 대규모 전투
 *          - 양측 최대 10명씩
 *          - 전략적 배치 필수
 *       
 *       **주의사항:**
 *       - 공격 장수는 병력(crew > 0) 필수
 *       - 도시가 존재해야 함
 *       - 전투 시작 후 취소 불가
 *       - 동시에 같은 도시에 여러 전투 불가
 *     tags: [Battle]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - attackerNationId
 *               - defenderNationId
 *               - targetCityId
 *             properties:
 *               session_id:
 *                 type: string
 *                 description: 게임 세션 ID
 *                 example: sangokushi_default
 *               attackerNationId:
 *                 type: number
 *                 description: 공격 국가 ID
 *                 example: 1
 *               defenderNationId:
 *                 type: number
 *                 description: 방어 국가 ID
 *                 example: 2
 *               targetCityId:
 *                 type: number
 *                 description: 대상 도시 ID
 *                 example: 5
 *               attackerGeneralIds:
 *                 type: array
 *                 items:
 *                   type: number
 *                 description: 공격 참가 장수 ID 목록
 *                 example: [1001, 1002, 1003]
 *           examples:
 *             city_attack:
 *               summary: 도시 공격
 *               value:
 *                 attackerNationId: 1
 *                 defenderNationId: 2
 *                 targetCityId: 5
 *                 attackerGeneralIds: [1001, 1002, 1003, 1004, 1005]
 *             small_skirmish:
 *               summary: 소규모 전투
 *               value:
 *                 attackerNationId: 1
 *                 defenderNationId: 0
 *                 targetCityId: 10
 *                 attackerGeneralIds: [1001, 1002]
 *     responses:
 *       200:
 *         description: 전투 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 battleId:
 *                   type: string
 *                   description: 전투 고유 ID (UUID)
 *                   example: "550e8400-e29b-41d4-a716-446655440000"
 *                 message:
 *                   type: string
 *                   example: 전투가 생성되었습니다
 *                 status:
 *                   type: string
 *                   example: DEPLOYING
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *             examples:
 *               city_not_found:
 *                 summary: 도시 없음
 *                 value:
 *                   success: false
 *                   message: 대상 도시를 찾을 수 없습니다
 *               no_attackers:
 *                 summary: 공격 장수 없음
 *                 value:
 *                   success: false
 *                   message: 공격 장수가 없습니다
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.post('/start', async (req, res) => {
  try {
    const result = await StartBattleService.execute(req.body, req.user);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/battle/auto-resolve:
 *   post:
 *     summary: 빠른 자동 전투 시뮬레이션
 *     description: 새 AutoBattle 엔진을 이용해 공격/수비 데이터를 즉시 계산합니다. 프론트나 툴에서 JSON을 보내면 즉시 승패/로그가 반환됩니다.
 *     tags: [Battle]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               attackers:
 *                 type: object
 *                 description: 공격측 정보 (nation, generals 등)
 *               defenders:
 *                 type: object
 *               city:
 *                 type: object
 *               maxTurns:
 *                 type: number
 *               seed:
 *                 type: string
 *     responses:
 *       200:
 *         description: 시뮬레이션 성공
 *       400:
 *         description: 잘못된 입력
 */
router.post('/auto-resolve', async (req, res) => {
  try {
    const payload = req.body as Partial<BattleConfig>;
    const attackers = payload?.attackers;
    const defenders = payload?.defenders;

    if (!attackers || !defenders || !attackers.generals?.length || !defenders.generals?.length) {
      res.status(400).json({ success: false, message: '공격·방어 데이터가 모두 필요합니다.' });
      return;
    }

    const normalizedConfig: BattleConfig = {
      attackers: { ...attackers, side: 'attackers' },
      defenders: { ...defenders, side: 'defenders' },
      city: payload.city,
      maxTurns: payload.maxTurns,
      scenarioId: payload.scenarioId ?? 'sangokushi',
      seed: payload.seed
    };

    const result = AutoBattleService.simulate(normalizedConfig);
    res.json({ success: true, result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/battle/{battleId}:
 *   get:
 *     summary: 전투 상태 조회
 *     description: |
 *       진행 중이거나 완료된 전투의 현재 상태를 조회합니다. 실시간 전투 UI 업데이트에 사용됩니다.
 *       
 *       **조회 가능 정보:**
 *       - 전투 기본 정보 (ID, 상태, 페이즈)
 *       - 현재 턴 / 최대 턴
 *       - 공격/방어 국가 및 대상 도시
 *       - 지형 정보
 *       - 양측 유닛 목록 및 상태
 *       - 준비 완료 플레이어 목록
 *       - 승자 (완료 시)
 *       - 시작/완료 시간
 *       
 *       **유닛 상태 정보:**
 *       - 현재 위치 (x, y)
 *       - 현재 병력
 *       - 사기/훈련도
 *       - 적용된 버프/디버프
 *       - 사용 가능한 특수 기술
 *       
 *       **사용 시나리오:**
 *       1. **전투 UI 렌더링**: 맵 표시
 *          - 유닛 위치 표시
 *          - 지형 렌더링
 *          - 턴 카운터
 *       
 *       2. **폴링**: 실시간 업데이트
 *          - 1초마다 조회
 *          - 상태 변경 감지
 *          - 페이즈 전환 확인
 *       
 *       3. **명령 입력 가능 여부**: 상태 확인
 *          - PLANNING 페이즈인가?
 *          - 내 턴인가?
 *          - 이미 명령 입력했는가?
 *       
 *       4. **결과 확인**: 전투 종료 후
 *          - 승자 확인
 *          - 최종 유닛 상태
 *          - 전투 이력으로 이동
 *       
 *       **폴링 최적화:**
 *       - WebSocket 없이 HTTP 폴링 사용
 *       - 1초 간격 권장
 *       - 페이즈 전환 시 즉시 업데이트
 *       
 *       **주의사항:**
 *       - battleId는 UUID 형식
 *       - 존재하지 않는 전투는 404
 *       - 완료된 전투도 조회 가능 (이력)
 *     tags: [Battle]
 *     parameters:
 *       - in: path
 *         name: battleId
 *         required: true
 *         schema:
 *           type: string
 *         description: 전투 ID (UUID)
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: 전투 상태 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 battle:
 *                   type: object
 *                   properties:
 *                     battleId:
 *                       type: string
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     status:
 *                       type: string
 *                       enum: [DEPLOYING, IN_PROGRESS, COMPLETED, CANCELLED]
 *                       example: IN_PROGRESS
 *                     currentPhase:
 *                       type: string
 *                       enum: [PLANNING, RESOLUTION]
 *                       example: PLANNING
 *                     currentTurn:
 *                       type: number
 *                       example: 5
 *                     maxTurns:
 *                       type: number
 *                       example: 30
 *                     attackerNationId:
 *                       type: number
 *                       example: 1
 *                     defenderNationId:
 *                       type: number
 *                       example: 2
 *                     targetCityId:
 *                       type: number
 *                       example: 5
 *                     terrain:
 *                       type: string
 *                       example: PLAINS
 *                     attackerUnits:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           generalId:
 *                             type: number
 *                           generalName:
 *                             type: string
 *                           troops:
 *                             type: number
 *                           position:
 *                             type: object
 *                             properties:
 *                               x:
 *                                 type: number
 *                               y:
 *                                 type: number
 *                     defenderUnits:
 *                       type: array
 *                       items:
 *                         type: object
 *                     readyPlayers:
 *                       type: array
 *                       items:
 *                         type: number
 *                       description: 준비 완료한 장수 ID 목록
 *                     winner:
 *                       type: string
 *                       enum: [attacker, defender, null]
 *                       example: null
 *             examples:
 *               planning_phase:
 *                 summary: 명령 입력 단계
 *                 value:
 *                   success: true
 *                   battle:
 *                     battleId: "550e8400-e29b-41d4-a716-446655440000"
 *                     status: IN_PROGRESS
 *                     currentPhase: PLANNING
 *                     currentTurn: 5
 *                     maxTurns: 30
 *                     readyPlayers: [1001, 1002]
 *               completed:
 *                 summary: 전투 완료
 *                 value:
 *                   success: true
 *                   battle:
 *                     status: COMPLETED
 *                     winner: attacker
 *                     completedAt: "2024-11-01T15:30:00Z"
 *       404:
 *         description: 전투를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.get('/:battleId', async (req, res) => {
  try {
    const result = await GetBattleStateService.execute({
      battleId: req.params.battleId
    }, req.user);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/battle/{battleId}/deploy:
 *   post:
 *     summary: 유닛 배치
 *     description: |
 *       전투 시작 전 DEPLOYING 단계에서 자신의 유닛을 헥스 그리드에 배치합니다. 전략적 배치가 승패를 좌우합니다.
 *       
 *       **배치 규칙:**
 *       - DEPLOYING 상태에서만 가능
 *       - 공격측: 맵 왼쪽 3열 (x: 0-2)
 *       - 방어측: 맵 오른쪽 3열 (x: 10-12)
 *       - 같은 칸에 여러 유닛 불가
 *       - 유효한 칸만 배치 가능
 *       
 *       **배치 전략:**
 *       - 전방: 고방어 유닛 (통솔 높은 장수)
 *       - 중앙: 주력 공격 유닛
 *       - 후방: 궁병, 지원 유닛
 *       - 측면: 기동력 높은 기병
 *       
 *       **지형 고려:**
 *       - FOREST: 궁병을 숲 근처 배치
 *       - MOUNTAIN: 방어 유닛을 산 근처 배치
 *       - RIVER: 도하 지점 확보
 *       
 *       **사용 시나리오:**
 *       1. **공격측 배치**: 돌파형
 *          - 강력한 장수 중앙 집중
 *          - 양 측면 기병 배치
 *          - 후방 궁병 지원
 *       
 *       2. **방어측 배치**: 방어형
 *          - 성벽 이점 활용
 *          - 일자 방어선 형성
 *          - 거점 방어
 *       
 *       3. **특수 배치**: 기습형
 *          - 측면 기병 집중
 *          - 우회 기동
 *       
 *       4. **배치 변경**: 실시간 조정
 *          - 상대 배치 보고 변경
 *          - 모두 준비 전까지 수정 가능
 *       
 *       **헥스 좌표:**
 *       - x: 0-12 (좌우)
 *       - y: 0-8 (상하)
 *       - 맵 크기는 전투마다 다를 수 있음
 *       
 *       **주의사항:**
 *       - 배치 완료 후 전투 시작하면 변경 불가
 *       - 시간 제한 있을 수 있음
 *       - 미배치 유닛은 랜덤 배치
 *     tags: [Battle]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: battleId
 *         required: true
 *         schema:
 *           type: string
 *         description: 전투 ID
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - generalId
 *               - position
 *             properties:
 *               generalId:
 *                 type: number
 *                 description: 배치할 장수 ID
 *                 example: 1001
 *               position:
 *                 type: object
 *                 required:
 *                   - x
 *                   - y
 *                 properties:
 *                   x:
 *                     type: number
 *                     description: X 좌표 (0-12)
 *                     example: 1
 *                   y:
 *                     type: number
 *                     description: Y 좌표 (0-8)
 *                     example: 4
 *           examples:
 *             frontline:
 *               summary: 전방 배치
 *               value:
 *                 generalId: 1001
 *                 position: {x: 0, y: 4}
 *             backline:
 *               summary: 후방 배치 (궁병)
 *               value:
 *                 generalId: 1002
 *                 position: {x: 2, y: 4}
 *     responses:
 *       200:
 *         description: 배치 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 배치 완료
 *                 position:
 *                   type: object
 *                   properties:
 *                     x:
 *                       type: number
 *                     y:
 *                       type: number
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *             examples:
 *               wrong_phase:
 *                 summary: 배치 단계 아님
 *                 value:
 *                   success: false
 *                   message: 배치 단계가 아닙니다
 *               invalid_position:
 *                 summary: 잘못된 위치
 *                 value:
 *                   success: false
 *                   message: 유효하지 않은 위치입니다
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.post('/:battleId/deploy', async (req, res) => {
  try {
    const result = await DeployUnitsService.execute({
      battleId: req.params.battleId,
      ...req.body
    }, req.user);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/battle/{battleId}/action:
 *   post:
 *     summary: 턴 액션 제출
 *     description: |
 *       현재 턴의 Planning 페이즈에서 장수의 행동을 제출합니다. 이동, 공격, 스킬 사용 등을 선택할 수 있습니다.
 *       
 *       **액션 타입:**
 *       - MOVE: 이동
 *       - ATTACK: 일반 공격
 *       - SKILL: 특수 기술 사용
 *       - DEFEND: 방어 태세
 *       - WAIT: 대기
 *       
 *       **액션 제출 규칙:**
 *       - PLANNING 페이즈에서만 가능
 *       - 턴당 1회만 제출 (수정 가능)
 *       - 제한 시간 내 제출 필요
 *       - 미제출 시 자동 WAIT
 *       
 *       **이동 (MOVE):**
 *       - target: {x, y} 목표 좌표
 *       - 이동 범위 제한 (유닛 타입별)
 *       - 지형에 따라 이동력 변화
 *       - 적 유닛이 있는 칸 불가
 *       
 *       **공격 (ATTACK):**
 *       - targetGeneralId: 대상 장수 ID
 *       - 사거리 내에 있어야 함
 *       - 유닛 타입별 사거리 다름
 *       - 보병: 1칸, 궁병: 3칸, 기병: 2칸
 *       
 *       **스킬 (SKILL):**
 *       - skillId: 사용할 스킬 ID
 *       - target 또는 targetGeneralId
 *       - 쿨다운 확인 필요
 *       - 특수 효과 (버프/디버프/힐/광역공격)
 *       
 *       **방어 (DEFEND):**
 *       - 피해 감소 50%
 *       - 반격 불가
 *       - 이동 불가
 *       
 *       **사용 시나리오:**
 *       1. **기습 공격**: 기병 돌격
 *          - 빠른 이동으로 접근
 *          - ATTACK으로 선제 타격
 *       
 *       2. **원거리 지원**: 궁병 사격
 *          - 후방에서 안전하게
 *          - ATTACK으로 원거리 공격
 *       
 *       3. **특수 전술**: 계략 사용
 *          - 지력 높은 장수
 *          - SKILL로 화공, 혼란 등
 *       
 *       4. **수비 전략**: 요새 방어
 *          - 전방 DEFEND
 *          - 후방 ATTACK 지원
 *       
 *       **전술 조합:**
 *       - 이동 + 다음턴 공격
 *       - 스킬로 약화 + 집중 공격
 *       - 방어로 버티기 + 역습
 *       
 *       **주의사항:**
 *       - Planning 시간 제한 (보통 60초)
 *       - 모든 플레이어 제출 시 즉시 Resolution
 *       - 제출 후 수정 가능 (Ready 전까지)
 *     tags: [Battle]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: battleId
 *         required: true
 *         schema:
 *           type: string
 *         description: 전투 ID
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - generalId
 *               - action
 *             properties:
 *               generalId:
 *                 type: number
 *                 description: 행동할 장수 ID
 *                 example: 1001
 *               action:
 *                 type: string
 *                 enum: [MOVE, ATTACK, SKILL, DEFEND, WAIT]
 *                 description: 액션 타입
 *                 example: ATTACK
 *               target:
 *                 type: object
 *                 description: 목표 좌표 (MOVE, 일부 SKILL)
 *                 properties:
 *                   x:
 *                     type: number
 *                   y:
 *                     type: number
 *               targetGeneralId:
 *                 type: number
 *                 description: 대상 장수 ID (ATTACK, 일부 SKILL)
 *                 example: 2001
 *               skillId:
 *                 type: string
 *                 description: 스킬 ID (SKILL)
 *                 example: "fire_attack"
 *           examples:
 *             attack:
 *               summary: 일반 공격
 *               value:
 *                 generalId: 1001
 *                 action: ATTACK
 *                 targetGeneralId: 2001
 *             move:
 *               summary: 이동
 *               value:
 *                 generalId: 1002
 *                 action: MOVE
 *                 target: {x: 5, y: 4}
 *             skill:
 *               summary: 스킬 사용 (화공)
 *               value:
 *                 generalId: 1003
 *                 action: SKILL
 *                 skillId: "fire_attack"
 *                 target: {x: 6, y: 5}
 *             defend:
 *               summary: 방어
 *               value:
 *                 generalId: 1004
 *                 action: DEFEND
 *     responses:
 *       200:
 *         description: 액션 제출 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 행동이 제출되었습니다
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *             examples:
 *               wrong_phase:
 *                 summary: Planning 단계 아님
 *                 value:
 *                   success: false
 *                   message: 명령 입력 단계가 아닙니다
 *               invalid_target:
 *                 summary: 잘못된 대상
 *                 value:
 *                   success: false
 *                   message: 사거리 밖입니다
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.post('/:battleId/action', async (req, res) => {
  try {
    const result = await SubmitActionService.execute({
      battleId: req.params.battleId,
      ...req.body
    }, req.user);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/battle/{battleId}/ready:
 *   post:
 *     summary: Ready-Up (턴 준비 완료)
 *     description: |
 *       현재 턴의 Planning 페이즈에서 명령 입력을 완료하고 준비 완료 신호를 보냅니다. 모든 플레이어가 Ready하면 즉시 Resolution 페이즈로 전환됩니다.
 *       
 *       **Ready-Up 시스템:**
 *       - 각 플레이어가 개별적으로 Ready
 *       - 모든 플레이어 Ready 시 즉시 Resolution
 *       - 제한 시간 내 미Ready 시 자동 진행
 *       - Ready 후에도 시간 내 명령 수정 가능
 *       
 *       **Ready 조건:**
 *       - Planning 페이즈여야 함
 *       - 전투가 IN_PROGRESS 상태
 *       - 최소 1개 액션 제출 (권장)
 *       
 *       **전환 조건:**
 *       - 모든 참가 장수의 Ready 필요
 *       - 공격측 + 방어측 전체
 *       - 하나라도 미Ready면 대기
 *       
 *       **사용 시나리오:**
 *       1. **빠른 진행**: 명령 확정
 *          - 액션 제출 완료
 *          - Ready-Up 클릭
 *          - 다른 플레이어 대기
 *       
 *       2. **전술적 대기**: 상대 관찰
 *          - 액션 제출
 *          - Ready 보류
 *          - 상대 움직임 예측
 *          - 마지막에 Ready
 *       
 *       3. **실시간 대응**: 액션 수정
 *          - 초기 액션 제출
 *          - Ready 누름
 *          - 상대 움직임 보고 수정
 *          - 다시 Ready
 *       
 *       4. **자동 진행**: 시간 초과
 *          - 60초 제한 시간
 *          - 미Ready 시 자동 Ready
 *          - 미제출 액션은 WAIT
 *       
 *       **전략적 활용:**
 *       - 빠른 Ready: 압박, 상대 실수 유도
 *       - 늦은 Ready: 신중함, 최적 판단
 *       - Ready 취소: 없음 (수정만 가능)
 *       
 *       **UI 표시:**
 *       - Ready 플레이어 목록 표시
 *       - "3/5 Ready" 같은 표시
 *       - 남은 시간 타이머
 *       
 *       **주의사항:**
 *       - Ready 후에도 수정 가능
 *       - 모든 플레이어 Ready 시 즉시 진행
 *       - Resolution 페이즈는 자동 계산
 *     tags: [Battle]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: battleId
 *         required: true
 *         schema:
 *           type: string
 *         description: 전투 ID
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - generalId
 *             properties:
 *               generalId:
 *                 type: number
 *                 description: Ready하는 장수 ID
 *                 example: 1001
 *           examples:
 *             ready:
 *               summary: Ready-Up
 *               value:
 *                 generalId: 1001
 *     responses:
 *       200:
 *         description: Ready-Up 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Ready-Up 완료
 *                 allReady:
 *                   type: boolean
 *                   description: 모든 플레이어 Ready 여부
 *                   example: false
 *                 readyPlayers:
 *                   type: array
 *                   items:
 *                     type: number
 *                   description: Ready한 장수 ID 목록
 *                   example: [1001, 1002, 2001]
 *             examples:
 *               partial:
 *                 summary: 일부만 Ready
 *                 value:
 *                   success: true
 *                   message: Ready-Up 완료
 *                   allReady: false
 *                   readyPlayers: [1001, 1002]
 *               all_ready:
 *                 summary: 모두 Ready (즉시 진행)
 *                 value:
 *                   success: true
 *                   message: Ready-Up 완료
 *                   allReady: true
 *                   readyPlayers: [1001, 1002, 1003, 2001, 2002]
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *             examples:
 *               wrong_phase:
 *                 summary: Planning 단계 아님
 *                 value:
 *                   success: false
 *                   message: Planning 단계가 아닙니다
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.post('/:battleId/ready', async (req, res) => {
  try {
    const result = await ReadyUpService.execute({
      battleId: req.params.battleId,
      ...req.body
    }, req.user);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/battle/{battleId}/resolve:
 *   post:
 *     summary: 턴 해결 (Resolution)
 *     description: |
 *       Planning 페이즈를 종료하고 Resolution 페이즈를 실행합니다. 모든 플레이어의 액션을 계산하고 전투 결과를 반영합니다.
 *       
 *       **자동 호출 조건:**
 *       - 모든 플레이어 Ready-Up 완료
 *       - Planning 제한 시간 초과
 *       
 *       **수동 호출 (관리자):**
 *       - 테스트용
 *       - 강제 진행
 *       
 *       **Resolution 프로세스:**
 *       1. Planning → Resolution 전환
 *       2. 모든 액션 수집
 *       3. 이동 처리 (충돌 검사)
 *       4. 공격 처리 (병종 상성, 데미지)
 *       5. 스킬 처리
 *       6. 데미지 적용
 *       7. 사망 유닛 제거
 *       8. 승리 조건 체크
 *       9. 턴 증가 / 전투 종료
 *       10. Planning 재시작 OR 전투 완료
 *       
 *       **전투 결과:**
 *       - 각 액션의 성공/실패
 *       - 데미지 계산 결과
 *       - 유닛 상태 변화
 *       - 승리/패배 여부
 *       
 *       **승리 조건:**
 *       - 공격군: 방어군 전멸
 *       - 방어군: 공격군 전멸 OR 턴 수 초과
 *       - 무승부: 양측 전멸 OR 최대 턴 도달
 *     tags: [Battle]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: battleId
 *         required: true
 *         schema:
 *           type: string
 *         description: 전투 ID
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: 턴 해결 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 턴 해결 완료
 *                 events:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                         enum: [move, attack, damage, death, victory]
 *                       actorId:
 *                         type: number
 *                       message:
 *                         type: string
 *       400:
 *         description: 잘못된 요청
 *       500:
 *         description: 서버 오류
 */
router.post('/:battleId/resolve', async (req, res) => {
  try {
    const result = await ResolveTurnService.execute(req.params.battleId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/battle/{battleId}/history:
 *   get:
 *     summary: 전투 이력 조회
 *     description: |
 *       완료된 전투의 턴별 상세 이력을 조회합니다. 리플레이, 분석, 학습에 사용됩니다.
 *       
 *       **이력 데이터:**
 *       - 턴별 상태 스냅샷
 *       - 각 장수의 행동 기록
 *       - 피해/회복 로그
 *       - 스킬 사용 기록
 *       - 사기/훈련도 변화
 *       - 승패 결정 과정
 *       
 *       **턴별 이벤트:**
 *       - 이동 경로
 *       - 공격 성공/실패
 *       - 피해량 (데미지 계산)
 *       - 스킬 효과 발동
 *       - 버프/디버프 적용/해제
 *       - 사망 이벤트
 *       
 *       **사용 시나리오:**
 *       1. **리플레이**: 전투 다시 보기
 *          - 턴별 재생
 *          - 애니메이션 표시
 *          - 일시정지/되감기
 *       
 *       2. **전술 분석**: 승패 원인 파악
 *          - 어느 턴에서 역전되었나
 *          - 어떤 스킬이 효과적이었나
 *          - 실수한 부분은 어디인가
 *       
 *       3. **학습**: 전술 개선
 *          - 강자의 플레이 연구
 *          - 성공 패턴 찾기
 *          - 실패 패턴 회피
 *       
 *       4. **공유**: 명승부 공유
 *          - 하이라이트 클립
 *          - 커뮤니티 공유
 *          - 통계 자랑
 *       
 *       **데이터 구조:**
 *       ```json
 *       {
 *         "turns": [
 *           {
 *             "turnNumber": 1,
 *             "phase": "RESOLUTION",
 *             "events": [
 *               {
 *                 "type": "MOVE",
 *                 "generalId": 1001,
 *                 "from": {x: 0, y: 4},
 *                 "to": {x: 2, y: 4}
 *               },
 *               {
 *                 "type": "ATTACK",
 *                 "attacker": 1001,
 *                 "defender": 2001,
 *                 "damage": 500,
 *                 "critical": false
 *               }
 *             ]
 *           }
 *         ]
 *       }
 *       ```
 *       
 *       **통계 정보:**
 *       - 총 턴 수
 *       - 총 피해량
 *       - 스킬 사용 횟수
 *       - MVP (최다 기여)
 *       
 *       **주의사항:**
 *       - 완료된 전투만 조회 가능
 *       - 대용량 데이터일 수 있음
 *       - 페이징 또는 압축 고려
 *     tags: [Battle]
 *     parameters:
 *       - in: path
 *         name: battleId
 *         required: true
 *         schema:
 *           type: string
 *         description: 전투 ID
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: 전투 이력 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 history:
 *                   type: object
 *                   properties:
 *                     battleId:
 *                       type: string
 *                     totalTurns:
 *                       type: number
 *                       example: 15
 *                     winner:
 *                       type: string
 *                       example: attacker
 *                     turns:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           turnNumber:
 *                             type: number
 *                           events:
 *                             type: array
 *                             items:
 *                               type: object
 *             examples:
 *               short_battle:
 *                 summary: 짧은 전투 (5턴)
 *                 value:
 *                   success: true
 *                   history:
 *                     battleId: "550e8400-e29b-41d4-a716-446655440000"
 *                     totalTurns: 5
 *                     winner: attacker
 *                     turns: []
 *       404:
 *         description: 전투를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.get('/:battleId/history', async (req, res) => {
  try {
    const result = await GetBattleHistoryService.execute({
      battleId: req.params.battleId
    }, req.user);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/battle/{battleId}/start-simulation:
 *   post:
 *     summary: 실시간 전투 시뮬레이션 시작 (Phase 3)
 *     description: |
 *       배치 완료 후 실시간 RTS 전투를 시작합니다. AI 제어 유닛 자동 배치 및 게임 루프 시작.
 *       
 *       **Phase 3 전투 시스템:**
 *       - 20 tick/s 실시간 게임 루프
 *       - 800x600 좌표 기반 이동
 *       - 병종별 AI 전술
 *       - WebSocket으로 상태 브로드캐스트
 *       
 *       **자동 배치:**
 *       - 미배치 AI 유닛 자동 배치
 *       - 진형별 배치 (line/column/wedge/square/skirmish)
 *       - isAIControlled = true 설정
 *       
 *       **시뮬레이션 시작:**
 *       - BattleStatus: DEPLOYING → IN_PROGRESS
 *       - BattleSimulationManager 시작
 *       - WebSocket room 생성: `battle:{battleId}`
 *     tags: [Battle]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: battleId
 *         required: true
 *         schema:
 *           type: string
 *         description: 전투 ID
 *     responses:
 *       200:
 *         description: 시뮬레이션 시작 성공
 *       400:
 *         description: 잘못된 요청
 *       500:
 *         description: 서버 오류
 */
router.post('/:battleId/start-simulation', async (req, res) => {
  try {
    const result = await StartSimulationService.execute({
      battleId: req.params.battleId
    }, req.user);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/battle/detail:
 *   post:
 *     summary: 전투 상세 정보 조회
 *     tags: [Battle]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - battleID
 *             properties:
 *               battleID:
 *                 type: number
 *     responses:
 *       200:
 *         description: 전투 상세 정보
 */
router.post('/detail', async (req, res) => {
  try {
    const { GetBattleDetailService } = await import('../services/battle/GetBattleDetail.service');
    const result = await GetBattleDetailService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    console.error('Error in battle/detail:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/battle/center:
 *   get:
 *     summary: 전투 센터 - 진행 중인 전투 및 최근 완료된 전투 목록 조회
 *     description: |
 *       진행 중인 전투와 최근 완료된 전투 목록을 조회합니다.
 *       
 *       **조회 데이터:**
 *       - 진행 중인 전투 (DEPLOYING, IN_PROGRESS)
 *       - 최근 완료된 전투 (COMPLETED, 최근 30일)
 *       - 국가 및 도시 정보 포함
 *       
 *       **필터링:**
 *       - status: 'ongoing' | 'finished' | 'all' (기본값: 'all')
 *       - limit: 조회 개수 (기본값: 50)
 *       
 *       **정렬:**
 *       - 진행 중인 전투 우선
 *       - 시작/종료 시간 내림차순
 *     tags: [Battle]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: session_id
 *         schema:
 *           type: string
 *         description: 게임 세션 ID
 *         example: sangokushi_default
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ongoing, finished, all]
 *         description: 전투 상태 필터
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *         description: 조회 개수
 *     responses:
 *       200:
 *         description: 전투 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: boolean
 *                   example: true
 *                 battles:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: 전투 ID
 *                       battleId:
 *                         type: string
 *                         description: 전투 UUID
 *                       attackerNation:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: number
 *                           name:
 *                             type: string
 *                           color:
 *                             type: string
 *                       defenderNation:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: number
 *                           name:
 *                             type: string
 *                           color:
 *                             type: string
 *                       city:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: number
 *                           name:
 *                             type: string
 *                       status:
 *                         type: string
 *                         enum: [ongoing, finished]
 *                       startDate:
 *                         type: string
 *                         format: date-time
 *                       endDate:
 *                         type: string
 *                         format: date-time
 *       500:
 *         description: 서버 오류
 *   post:
 *     summary: 전투 센터 (진행 중인 전투 목록) - Legacy
 *     tags: [Battle]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 전투 목록
 */
router.get('/center', async (req, res) => {
  try {
    const sessionId = (req.query.session_id as string) || 'sangokushi_default';
    const statusFilter = (req.query.status as string) || 'all';
    const limit = parseInt(req.query.limit as string) || 50;

    // 전투 상태별 필터
    let statusQuery: any = {};
    if (statusFilter === 'ongoing') {
      statusQuery = { status: { $in: ['preparing', 'deploying', 'in_progress'] } };
    } else if (statusFilter === 'finished') {
      statusQuery = { status: 'completed' };
    }

    // 전투 목록 조회
    // @ts-ignore - Model types need investigation
    const { Battle } = await import('../models/battle.model');
    // @ts-ignore - Model find type issue
    const battles: any[] = await Battle.find({
      session_id: sessionId,
      ...statusQuery
    }).sort({ startedAt: -1 }).limit(limit).lean().exec();

    // 국가 및 도시 정보 조회
    const nationIds = new Set<number>();
    const cityIds = new Set<number>();

    battles.forEach((battle: any) => {
      nationIds.add(battle.attackerNationId);
      nationIds.add(battle.defenderNationId);
      cityIds.add(battle.targetCityId);
    });

    const uniqueNationIds = Array.from(nationIds).filter((id): id is number => typeof id === 'number' && !Number.isNaN(id));
    const uniqueCityIds = Array.from(cityIds).filter((id): id is number => typeof id === 'number' && !Number.isNaN(id));

    // 배치 쿼리로 N+1 문제 해결 (20+ 쿼리 → 2 쿼리)
    const nationMap = await nationRepository.findByNationNums(sessionId, uniqueNationIds);
    const cityMap = await cityRepository.findByCityNums(sessionId, uniqueCityIds);

    // 응답 데이터 구성
    const battleList = battles.map((battle: any) => {
      const attackerNation: any = nationMap.get(battle.attackerNationId);
      const defenderNation: any = nationMap.get(battle.defenderNationId);
      const city: any = cityMap.get(battle.targetCityId);

      return {
        id: battle.battleId || battle._id,
        battleId: battle.battleId,
        attackerNation: {
          id: battle.attackerNationId,
          name: attackerNation?.name || attackerNation?.data?.name || '알 수 없음',
          color: attackerNation?.color || attackerNation?.data?.color || '#888888'
        },
        defenderNation: {
          id: battle.defenderNationId,
          name: defenderNation?.name || defenderNation?.data?.name || '알 수 없음',
          color: defenderNation?.color || defenderNation?.data?.color || '#888888'
        },
        city: {
          id: battle.targetCityId,
          name: city?.name || '알 수 없음'
        },
        status: ['preparing', 'deploying', 'in_progress'].includes(battle.status) ? 'ongoing' : 'finished',
        startDate: battle.startedAt || battle.createdAt,
        endDate: battle.completedAt,
        currentPhase: battle.currentPhase,
        currentTurn: battle.currentTurn,
        maxTurns: battle.maxTurns,
        winner: battle.winner
      };
    });

    res.json({
      result: true,
      battles: battleList
    });
  } catch (error: any) {
    console.error('Error in GET /api/battle/center:', error);
    res.status(500).json({ result: false, message: error.message });
  }
});

router.post('/center', async (req, res) => {
  try {
    const { GetBattleCenterService } = await import('../services/battle/GetBattleCenter.service');
    const result = await GetBattleCenterService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    console.error('Error in battle/center:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @swagger
 * /api/battle/simulate:
 *   post:
 *     summary: 전투 시뮬레이션
 *     description: 공격자와 방어자의 전투력을 계산하여 시뮬레이션 결과 반환
 *     tags: [Battle]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - attacker
 *               - defender
 *             properties:
 *               attacker:
 *                 type: object
 *                 properties:
 *                   leadership:
 *                     type: number
 *                   strength:
 *                     type: number
 *                   crew:
 *                     type: number
 *                   train:
 *                     type: number
 *                   atmos:
 *                     type: number
 *               defender:
 *                 type: object
 *                 properties:
 *                   leadership:
 *                     type: number
 *                   strength:
 *                     type: number
 *                   crew:
 *                     type: number
 *                   train:
 *                     type: number
 *                   atmos:
 *                     type: number
 *               terrain:
 *                 type: string
 *                 default: plains
 *     responses:
 *       200:
 *         description: 시뮬레이션 결과
 */
router.post('/simulate', async (req, res) => {
  try {
    const { units, year, month, seed, repeatCount = 1, terrain = 'plains', isDefenderCity = false } = req.body;

    if (!units || !Array.isArray(units) || units.length === 0) {
      return res.status(400).json({ 
        result: false, 
        reason: '유닛 정보가 필요합니다.' 
      });
    }

    // 공격자와 방어자 분리
    const attackers = units.filter((u: any) => u.type === 'attacker');
    const defenders = units.filter((u: any) => u.type === 'defender');

    if (attackers.length === 0 || defenders.length === 0) {
      return res.status(400).json({ 
        result: false, 
        reason: '공격자와 방어자 유닛이 각각 필요합니다.' 
      });
    }

    // BattleCalculator 사용
    const { simulateBattle, UnitType, TerrainType } = await import('../core/battle-calculator');
    
    // TerrainType 변환
    let terrainType = TerrainType.PLAINS;
    if (terrain === 'forest') terrainType = TerrainType.FOREST;
    else if (terrain === 'mountain') terrainType = TerrainType.MOUNTAIN;
    else if (terrain === 'water') terrainType = TerrainType.WATER;
    else if (terrain === 'fortress') terrainType = TerrainType.FORTRESS;

    // 첫 번째 공격자와 방어자로 시뮬레이션 (간단 버전)
    const attacker = attackers[0];
    const defender = defenders[0];

    // UnitType 변환
    const attackerUnitType = mapUnitType(attacker.crewType || 'FOOTMAN');
    const defenderUnitType = mapUnitType(defender.crewType || 'FOOTMAN');

    const result = simulateBattle(
      attacker.name || '공격자',
      attacker.crew || 1000,
      [attacker.leadership || 50, attacker.strength || 50, attacker.intel || 50],
      attackerUnitType,
      defender.name || '방어자',
      defender.crew || 1000,
      [defender.leadership || 50, defender.strength || 50, defender.intel || 50],
      defenderUnitType,
      terrainType,
      isDefenderCity
    );

    // 반복 시뮬레이션 (repeatCount > 1인 경우)
    let aggregatedResults = null;
    if (repeatCount > 1 && repeatCount <= 1000) {
      let attackerWins = 0;
      let defenderWins = 0;
      let totalAttackerLoss = 0;
      let totalDefenderLoss = 0;

      for (let i = 0; i < repeatCount; i++) {
        const simResult = simulateBattle(
          attacker.name || '공격자',
          attacker.crew || 1000,
          [attacker.leadership || 50, attacker.strength || 50, attacker.intel || 50],
          attackerUnitType,
          defender.name || '방어자',
          defender.crew || 1000,
          [defender.leadership || 50, defender.strength || 50, defender.intel || 50],
          defenderUnitType,
          terrainType,
          isDefenderCity
        );

        if (simResult.winner === 'attacker') attackerWins++;
        else if (simResult.winner === 'defender') defenderWins++;
        totalAttackerLoss += simResult.attackerCasualties;
        totalDefenderLoss += simResult.defenderCasualties;
      }

      aggregatedResults = {
        repeatCount,
        attackerWinRate: (attackerWins / repeatCount) * 100,
        defenderWinRate: (defenderWins / repeatCount) * 100,
        avgAttackerLoss: Math.floor(totalAttackerLoss / repeatCount),
        avgDefenderLoss: Math.floor(totalDefenderLoss / repeatCount),
      };
    }

    res.json({
      result: true,
      simulation: {
        winner: result.winner,
        attackerSurvivors: result.attackerSurvivors,
        defenderSurvivors: result.defenderSurvivors,
        attackerCasualties: result.attackerCasualties,
        defenderCasualties: result.defenderCasualties,
        phases: result.phases,
        battleLog: result.battleLog,
        duration: result.duration,
        aggregated: aggregatedResults
      },
    });
  } catch (error: any) {
    console.error('Error in battle/simulate:', error);
    res.status(500).json({ result: false, reason: error.message || 'Internal server error' });
  }
});

// UnitType 매핑 헬퍼
function mapUnitType(crewType: string): any {
  const { UnitType } = require('../core/battle-calculator');
  const typeMap: Record<string, any> = {
    'FOOTMAN': UnitType.FOOTMAN,
    'CAVALRY': UnitType.CAVALRY,
    'ARCHER': UnitType.ARCHER,
    'WIZARD': UnitType.WIZARD,
    'SIEGE': UnitType.SIEGE,
    '보병': UnitType.FOOTMAN,
    '기병': UnitType.CAVALRY,
    '궁병': UnitType.ARCHER,
    '귀병': UnitType.WIZARD,
    '차병': UnitType.SIEGE,
  };
  return typeMap[crewType] || UnitType.FOOTMAN;
}

/**
 * @swagger
 * /api/battle/replay/{battleId}:
 *   get:
 *     summary: 전투 리플레이 데이터 조회
 *     description: |
 *       전투의 전체 리플레이 데이터를 조회합니다.
 *       초기 배치, 맵 정보, 턴별 상세 이력을 포함합니다.
 *       BattleLog 컬렉션에서 조회하며, 없으면 Battle 컬렉션에서 조회를 시도할 수 있습니다.
 *     tags: [Battle]
 *     parameters:
 *       - in: path
 *         name: battleId
 *         required: true
 *         schema:
 *           type: string
 *         description: 전투 ID
 *     responses:
 *       200:
 *         description: 리플레이 데이터 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 replay:
 *                   type: object
 *                   properties:
 *                     battleId:
 *                       type: string
 *                     map:
 *                       type: object
 *                     initialAttackerUnits:
 *                       type: array
 *                     initialDefenderUnits:
 *                       type: array
 *                     turnHistory:
 *                       type: array
 *                     winner:
 *                       type: string
 *       404:
 *         description: 리플레이를 찾을 수 없음
 */
router.get('/replay/:battleId', async (req, res) => {
  try {
    const battleId = req.params.battleId;
    
    // 1. BattleLog에서 조회
    const replay = await ReplayService.getReplay(battleId);
    
    if (replay) {
      return res.json({
        success: true,
        replay
      });
    }

    // 2. BattleLog에 없으면 Battle에서 조회 후 변환 (Optional fallback)
    // 현재는 BattleLog가 없으면 404
    res.status(404).json({ success: false, message: '리플레이를 찾을 수 없습니다.' });

  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
