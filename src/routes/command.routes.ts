import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { CommandController } from '../controllers/command.controller';

const router = Router();

/**
 * @swagger
 * /api/command/get-reserved-command:
 *   get:
 *     summary: 예약된 명령 목록 조회
 *     description: |
 *       현재 장수가 예약한 턴별 명령 목록을 조회합니다.
 *       
 *       **기능:**
 *       - 장수의 모든 예약 명령(turn 0~29) 조회
 *       - 턴 인덱스 순으로 정렬된 결과 반환
 *       - 각 턴의 명령 타입, 인자, 간단한 설명 포함
 *       
 *       **사용 시나리오:**
 *       1. 장수가 로그인 후 자신의 예약 명령 확인
 *       2. 명령 수정 전 현재 상태 파악
 *       3. UI에서 12턴 타임라인 표시
 *       
 *       **응답 데이터:**
 *       - turns: 턴별 명령 배열 (turn_idx, action, arg, brief)
 *       - total_turns: 전체 턴 수 (최대 30)
 *       
 *       **주의사항:**
 *       - JWT 인증 필수
 *       - session_id가 없으면 기본 세션 사용
 *       - 장수가 없거나 사망한 경우 빈 배열 반환
 *     tags: [Command]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: session_id
 *         schema:
 *           type: string
 *         description: 게임 세션 ID (생략시 기본 세션)
 *         example: sangokushi_default
 *     responses:
 *       200:
 *         description: 예약 명령 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 turns:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       turn_idx:
 *                         type: number
 *                         description: 턴 인덱스 (0-29)
 *                         example: 0
 *                       action:
 *                         type: string
 *                         description: 명령 타입
 *                         example: 훈련
 *                       arg:
 *                         type: object
 *                         description: 명령 인자
 *                         example: { type: "soldier", amount: 100 }
 *                       brief:
 *                         type: string
 *                         description: 명령 간단 설명
 *                         example: 보병 100명 훈련
 *                 total_turns:
 *                   type: number
 *                   example: 30
 *       401:
 *         description: 인증 실패
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
 *                   example: Invalid or expired token
 *       500:
 *         description: 서버 오류
 */
router.get('/get-reserved-command', authenticate, CommandController.getReservedCommand);

/**
 * @swagger
 * /api/command/push-command:
 *   post:
 *     summary: 명령 순서 밀기/당기기
 *     description: |
 *       예약된 명령들의 순서를 앞뒤로 조정합니다.
 *       
 *       **기능:**
 *       - 양수(+): 모든 명령을 뒤로 미루기 (나중 턴으로)
 *       - 음수(-): 모든 명령을 앞으로 당기기 (빠른 턴으로)
 *       - 범위: -12 ~ +12
 *       - 범위를 벗어난 명령은 '휴식'으로 초기화
 *       
 *       **사용 시나리오:**
 *       1. 급한 명령이 생겨서 모든 명령을 뒤로 미루고 싶을 때
 *       2. 시간이 남아서 명령 실행을 앞당기고 싶을 때
 *       3. 전투 대비를 위해 훈련 일정 조정
 *       
 *       **예제:**
 *       - amount: 3 → 모든 명령이 3턴 뒤로 밀림
 *       - amount: -2 → 모든 명령이 2턴 앞당겨짐
 *       - amount: 0 → 변화 없음 (즉시 성공 반환)
 *       
 *       **주의사항:**
 *       - 턴 30을 넘어가는 명령은 휴식으로 변경
 *       - 턴 0 이전으로 가는 명령은 다시 뒤로 배치됨
 *       - 명령 내용은 유지되고 순서만 변경
 *     tags: [Command]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               session_id:
 *                 type: string
 *                 description: 게임 세션 ID
 *                 example: sangokushi_default
 *               general_id:
 *                 type: number
 *                 description: 장수 ID (JWT에서 자동 추출 가능)
 *                 example: 1
 *               amount:
 *                 type: integer
 *                 minimum: -12
 *                 maximum: 12
 *                 description: 밀거나 당길 턴 수 (양수=뒤로, 음수=앞으로)
 *                 example: 3
 *           examples:
 *             push_forward:
 *               summary: 3턴 뒤로 미루기
 *               value:
 *                 session_id: sangokushi_default
 *                 amount: 3
 *             pull_back:
 *               summary: 2턴 앞당기기
 *               value:
 *                 session_id: sangokushi_default
 *                 amount: -2
 *     responses:
 *       200:
 *         description: 명령 순서 변경 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 result:
 *                   type: boolean
 *                   example: true
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
 *                   example: amount는 -12 ~ 12 사이여야 합니다
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.post('/push-command', authenticate, CommandController.pushCommand);

/**
 * @swagger
 * /api/command/repeat-command:
 *   post:
 *     summary: 마지막 명령 반복 예약
 *     description: |
 *       가장 최근에 실행했던 명령을 다시 예약합니다.
 *       
 *       **기능:**
 *       - 이전 턴에 실행된 명령 조회
 *       - 동일한 명령을 다음 빈 턴에 예약
 *       - 명령 타입과 모든 인자가 복사됨
 *       
 *       **사용 시나리오:**
 *       1. 훈련을 계속 반복하고 싶을 때
 *       2. 내정 명령을 지속적으로 실행
 *       3. 이전과 같은 작업 빠르게 재설정
 *       
 *       **주의사항:**
 *       - 실행 가능한 턴이 없으면 실패
 *       - 상황이 변경되어 더 이상 실행 불가능한 명령도 그대로 복사됨
 *       - 실제 실행 시점에 조건 검증 재수행
 *     tags: [Command]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               session_id:
 *                 type: string
 *                 example: sangokushi_default
 *               general_id:
 *                 type: number
 *                 example: 1
 *     responses:
 *       200:
 *         description: 명령 반복 예약 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 result:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: 반복할 명령이 없거나 예약 불가
 *       401:
 *         description: 인증 실패
 */
router.post('/repeat-command', authenticate, CommandController.repeatCommand);

/**
 * @swagger
 * /api/command/reserve-bulk-command:
 *   post:
 *     summary: 여러 턴 명령 일괄 예약
 *     description: |
 *       한 번에 여러 턴의 명령을 예약합니다.
 *       
 *       **기능:**
 *       - 최대 12턴까지 한 번에 예약 가능
 *       - 각 턴마다 다른 명령 지정 가능
 *       - 턴 순서대로 배치
 *       
 *       **사용 시나리오:**
 *       1. 한 주간의 훈련 스케줄 한 번에 설정
 *       2. 연속된 내정 명령 계획
 *       3. 전투 준비 루틴 일괄 설정
 *       
 *       **요청 형식:**
 *       - commands: 명령 배열 (최대 12개)
 *       - 각 명령: { action, arg, brief }
 *       
 *       **주의사항:**
 *       - 기존 예약된 명령은 덮어씌워짐
 *       - 12개를 초과하면 앞의 12개만 적용
 *       - 빈 슬롯은 '휴식'으로 채워짐
 *     tags: [Command]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - commands
 *             properties:
 *               session_id:
 *                 type: string
 *                 example: sangokushi_default
 *               general_id:
 *                 type: number
 *                 example: 1
 *               commands:
 *                 type: array
 *                 maxItems: 12
 *                 items:
 *                   type: object
 *                   properties:
 *                     action:
 *                       type: string
 *                       example: 훈련
 *                     arg:
 *                       type: object
 *                       example: { type: "soldier", amount: 100 }
 *                     brief:
 *                       type: string
 *                       example: 보병 100명 훈련
 *           examples:
 *             week_schedule:
 *               summary: 일주일 훈련 스케줄
 *               value:
 *                 session_id: sangokushi_default
 *                 commands:
 *                   - action: 훈련
 *                     arg: { type: "soldier", amount: 100 }
 *                     brief: 보병 훈련
 *                   - action: 훈련
 *                     arg: { type: "archer", amount: 50 }
 *                     brief: 궁병 훈련
 *                   - action: 휴식
 *                     arg: {}
 *                     brief: 휴식
 *     responses:
 *       200:
 *         description: 일괄 예약 성공
 *       400:
 *         description: 잘못된 명령 형식
 *       401:
 *         description: 인증 실패
 */
router.post('/reserve-bulk-command', authenticate, CommandController.reserveBulkCommand);

/**
 * @swagger
 * /api/command/reserve-command:
 *   post:
 *     summary: 단일 턴 명령 예약
 *     description: |
 *       특정 턴에 명령을 예약합니다.
 *       
 *       **기능:**
 *       - 지정한 턴 인덱스에 명령 설정
 *       - 기존 명령이 있으면 덮어씌움
 *       - 턴 범위: 0-29 (최대 30턴)
 *       
 *       **사용 시나리오:**
 *       1. 특정 턴에만 명령 변경
 *       2. 긴급 명령 삽입
 *       3. 실수한 명령 수정
 *       
 *       **명령 타입 예시:**
 *       - 훈련: 병력 훈련
 *       - 농업개발, 상업발전, 기술개발: 내정
 *       - 정찰, 이동: 군사 행동
 *       - 휴식: 아무 것도 하지 않음
 *       
 *       **주의사항:**
 *       - turn_idx는 0-29 범위여야 함
 *       - 현재 턴보다 이전 턴은 예약 불가
 *       - 실행 시점에 조건(금, 병력 등) 재검증
 *     tags: [Command]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - turn_idx
 *               - action
 *             properties:
 *               session_id:
 *                 type: string
 *                 example: sangokushi_default
 *               general_id:
 *                 type: number
 *                 example: 1
 *               turn_idx:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 29
 *                 description: 예약할 턴 인덱스
 *                 example: 5
 *               action:
 *                 type: string
 *                 description: 명령 타입
 *                 example: 훈련
 *               arg:
 *                 type: object
 *                 description: 명령 인자
 *                 example: { type: "soldier", amount: 100 }
 *               brief:
 *                 type: string
 *                 description: 명령 간단 설명
 *                 example: 보병 100명 훈련
 *           examples:
 *             training:
 *               summary: 보병 훈련 예약
 *               value:
 *                 session_id: sangokushi_default
 *                 turn_idx: 5
 *                 action: 훈련
 *                 arg:
 *                   type: soldier
 *                   amount: 100
 *                 brief: 보병 100명 훈련
 *             agriculture:
 *               summary: 농업 개발 예약
 *               value:
 *                 session_id: sangokushi_default
 *                 turn_idx: 3
 *                 action: 농업개발
 *                 arg:
 *                   invest: 1000
 *                 brief: 농업에 1000금 투자
 *             rest:
 *               summary: 휴식 예약
 *               value:
 *                 session_id: sangokushi_default
 *                 turn_idx: 10
 *                 action: 휴식
 *                 arg: {}
 *                 brief: 휴식
 *     responses:
 *       200:
 *         description: 명령 예약 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 result:
 *                   type: boolean
 *                   example: true
 *                 turn_idx:
 *                   type: number
 *                   example: 5
 *                 action:
 *                   type: string
 *                   example: 훈련
 *       400:
 *         description: 잘못된 턴 인덱스 또는 명령
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
 *                   example: turn_idx는 0-29 사이여야 합니다
 *       401:
 *         description: 인증 실패
 *       500:
 *         description: 서버 오류
 */
router.post('/reserve-command', authenticate, CommandController.reserveCommand);

export default router;
