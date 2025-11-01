import { Router } from 'express';
import { StartBattleService } from '../services/battle/StartBattle.service';
import { GetBattleStateService } from '../services/battle/GetBattleState.service';
import { DeployUnitsService } from '../services/battle/DeployUnits.service';
import { SubmitActionService } from '../services/battle/SubmitAction.service';
import { ReadyUpService } from '../services/battle/ReadyUp.service';
import { GetBattleHistoryService } from '../services/battle/GetBattleHistory.service';

const router = Router();

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
    const result = await StartBattleService.execute(req.body, (req as any).user);
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
    }, (req as any).user);
    
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
    }, (req as any).user);
    
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
    }, (req as any).user);
    
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
    }, (req as any).user);
    
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
    }, (req as any).user);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
